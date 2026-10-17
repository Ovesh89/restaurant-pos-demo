import crypto from 'node:crypto';
import { utcNowIso } from '../../repositories/BaseMongoRepository.js';
import { getNextSequence } from '../../utils/sequence.js';
import { toDecimal, roundMoney, formatMoney } from '../../utils/decimal.js';
import {
  NotFoundAppError,
  ValidationAppError,
  StateConflictError,
} from '../../middleware/errorHandler.js';
import { branchRepository, tableRepository } from '../restaurant/repositories.js';
import { productRepository, categoryRepository } from '../menu/repositories.js';
import { customerRepository } from '../customers/repository.js';
import { billRepository } from '../billing/repositories.js';
import { kotService } from '../kot/service.js';
import { notificationService } from '../notifications/service.js';
import { auditService } from '../audit/service.js';
import { orderRepository, orderEventRepository } from './repositories.js';

export function calculateOrderFinancials(items = []) {
  let subtotalDec = toDecimal(0);
  let taxTotalDec = toDecimal(0);
  let grandTotalDec = toDecimal(0);

  for (const it of items) {
    if ((it.status || 'ACTIVE') === 'CANCELLED') continue;
    const qty = Number(it.quantity) || 1;
    const unitPriceDec = toDecimal(it.unitPrice || 0);
    const lineSubDec =
      it.lineSubtotal !== undefined
        ? toDecimal(it.lineSubtotal)
        : roundMoney(unitPriceDec.times(qty));

    const taxRateDec = toDecimal(it.taxConfig?.rate ?? '5.00');
    const taxMode = String(it.taxConfig?.mode || 'EXCLUSIVE').toUpperCase();

    let lineTaxDec;
    let lineTotalDec;
    if (it.taxAmount !== undefined && it.lineTotal !== undefined) {
      lineTaxDec = toDecimal(it.taxAmount);
      lineTotalDec = toDecimal(it.lineTotal);
    } else if (taxMode === 'INCLUSIVE') {
      const divisor = toDecimal(1).plus(taxRateDec.div(100));
      lineTaxDec = roundMoney(lineSubDec.minus(lineSubDec.div(divisor)));
      lineTotalDec = lineSubDec;
    } else {
      lineTaxDec = roundMoney(lineSubDec.times(taxRateDec.div(100)));
      lineTotalDec = roundMoney(lineSubDec.plus(lineTaxDec));
    }

    subtotalDec = subtotalDec.plus(lineSubDec);
    taxTotalDec = taxTotalDec.plus(lineTaxDec);
    grandTotalDec = grandTotalDec.plus(lineTotalDec);
  }

  const subtotal = formatMoney(subtotalDec);
  const taxTotal = formatMoney(taxTotalDec);
  const grandTotal = formatMoney(grandTotalDec);

  return {
    subtotal,
    discountAmount: '0.00',
    taxableAmount: subtotal,
    taxTotal,
    grandTotal,
    paidAmount: '0.00',
    balanceDue: grandTotal,
    paymentStatus: 'UNPAID',
  };
}

class OrderService {
  async _captureOrderItems(rawItems, now) {
    const capturedItems = [];
    for (const it of rawItems) {
      const prodId = it.productId;
      const qty = parseInt(it.quantity ?? 1, 10);
      const note = String(it.note || it.notes || '').trim();

      if (Number.isNaN(qty) || qty <= 0) {
        throw new ValidationAppError(
          `Quantity for product ${prodId} must be greater than zero.`
        );
      }

      const prod = await productRepository.findById(prodId);
      if (!prod || prod.isActive === false) {
        throw new NotFoundAppError(`Product ${prodId} not found or inactive.`);
      }

      if (prod.available === false) {
        throw new ValidationAppError(
          `Product '${prod.name}' is currently marked unavailable.`
        );
      }

      const itemId = crypto.randomUUID();
      const unitPrice = formatMoney(prod.currentPrice);
      const taxConfig = prod.taxConfig || { rate: '5.00', mode: 'EXCLUSIVE' };
      const lineSubtotalDec = roundMoney(toDecimal(unitPrice).times(qty));
      const taxRateDec = toDecimal(taxConfig.rate ?? '5.00');
      const taxMode = String(taxConfig.mode || 'EXCLUSIVE').toUpperCase();

      let lineTaxDec;
      let lineTotalDec;
      if (taxMode === 'INCLUSIVE') {
        const divisor = toDecimal(1).plus(taxRateDec.div(100));
        lineTaxDec = roundMoney(lineSubtotalDec.minus(lineSubtotalDec.div(divisor)));
        lineTotalDec = lineSubtotalDec;
      } else {
        lineTaxDec = roundMoney(lineSubtotalDec.times(taxRateDec.div(100)));
        lineTotalDec = roundMoney(lineSubtotalDec.plus(lineTaxDec));
      }

      capturedItems.push({
        _id: itemId,
        id: itemId,
        productId: prod._id,
        productName: prod.name,
        code: prod.code || '',
        station: prod.kitchenStation || 'MAIN',
        quantity: qty,
        unitPrice,
        taxConfig,
        taxAmount: formatMoney(lineTaxDec),
        lineSubtotal: formatMoney(lineSubtotalDec),
        lineTotal: formatMoney(lineTotalDec),
        note,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
    }
    return capturedItems;
  }

  async createOrder({ data, captainId, captainName }) {
    const branchId = data.branchId || 'branch-main';
    const inputTableId = data.tableId;
    const customerId = data.customerId || null;
    const rawItems = data.items || [];
    const submitImmediately = Boolean(data.submitImmediately);
    const held = Boolean(data.held);
    const notes = String(data.notes || '').trim();

    if (!branchId || !inputTableId) {
      throw new ValidationAppError('branchId and tableId are required.');
    }

    const branch = await branchRepository.findById(branchId);
    if (!branch || branch.isActive === false) {
      throw new NotFoundAppError('Branch not found or inactive.');
    }

    const table = await tableRepository.findById(inputTableId);
    if (!table || table.isActive === false) {
      throw new NotFoundAppError('Table not found or inactive.');
    }

    const tableId = table._id;
    if (table.branchId !== branchId) {
      throw new ValidationAppError('Table does not belong to the specified branch.');
    }

    const activeOrder = await orderRepository.findActiveByTable(branchId, tableId);
    if (activeOrder) {
      throw new StateConflictError(
        `Table ${table.tableNumber} already has active order ${activeOrder.orderNumber}.`
      );
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new ValidationAppError('Order must contain at least one item.');
    }

    const now = utcNowIso();
    const capturedItems = await this._captureOrderItems(rawItems, now);
    const financials = calculateOrderFinancials(capturedItems);
    const orderNumber = await getNextSequence('ord', 'ORD', branch.code || 'MAIN');

    let status = 'DRAFT';
    if (held) {
      status = 'HOLD';
    } else if (submitImmediately) {
      status = 'WAITING_CONFIRMATION';
    }

    const orderDoc = {
      _id: crypto.randomUUID(),
      orderNumber,
      branchId,
      tableId,
      tableNumber: table.tableNumber || '',
      captainId,
      captainName: captainName || 'Staff',
      customerId,
      status,
      source: 'CAPTAIN',
      held,
      notes,
      items: capturedItems,
      financials,
      kotRevision: 0,
      submittedAt: status === 'WAITING_CONFIRMATION' ? now : null,
      confirmedAt: null,
      confirmedBy: null,
      servedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    };

    const serializedOrder = await orderRepository.insertOne(orderDoc);

    // Update Table status to OCCUPIED
    await tableRepository.updateById(tableId, {
      status: 'OCCUPIED',
      activeOrderId: serializedOrder.id,
    });

    // Record ORDER_CREATED event
    await orderEventRepository.recordEvent({
      orderId: serializedOrder.id,
      branchId,
      eventType: 'ORDER_CREATED',
      fromStatus: null,
      toStatus: status,
      actorId: captainId,
      metadata: { orderNumber, tableNumber: table.tableNumber },
    });

    if (status === 'WAITING_CONFIRMATION') {
      await orderEventRepository.recordEvent({
        orderId: serializedOrder.id,
        branchId,
        eventType: 'ORDER_SUBMITTED',
        fromStatus: 'DRAFT',
        toStatus: 'WAITING_CONFIRMATION',
        actorId: captainId,
      });

      await notificationService.notify({
        branchId,
        eventType: 'ORDER_SUBMITTED',
        title: `New Order: Table ${table.tableNumber}`,
        message: `Order ${orderNumber} submitted by ${captainName} awaiting confirmation.`,
        recipientRole: 'RECEPTION',
        metadata: { orderId: serializedOrder.id, orderNumber },
      });
    }

    await auditService.logAction({
      branchId,
      actorId: captainId,
      actorName: captainName,
      action: 'ORDER_CREATED',
      entityType: 'ORDER',
      entityId: serializedOrder.id,
      metadata: { orderNumber, itemCount: capturedItems.length },
    });

    return {
      ...serializedOrder,
      kots: [],
    };
  }

  async submitOrder({ orderId, actorId, actorName }) {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundAppError('Order not found.');
    }

    const currentStatus = order.status;
    if (currentStatus === 'WAITING_CONFIRMATION') {
      return this.getOrder(orderId);
    }

    if (!['DRAFT', 'HOLD'].includes(currentStatus)) {
      throw new StateConflictError(`Cannot submit order in status '${currentStatus}'.`);
    }

    const now = utcNowIso();
    const updated = await orderRepository.updateStatus(orderId, 'WAITING_CONFIRMATION', {
      held: false,
      submittedAt: now,
    });

    await orderEventRepository.recordEvent({
      orderId,
      branchId: order.branchId,
      eventType: 'ORDER_SUBMITTED',
      fromStatus: currentStatus,
      toStatus: 'WAITING_CONFIRMATION',
      actorId,
    });

    await notificationService.notify({
      branchId: order.branchId,
      eventType: 'ORDER_SUBMITTED',
      title: `Order Submitted: Table ${order.tableNumber || ''}`,
      message: `Order ${order.orderNumber} is ready for review.`,
      recipientRole: 'RECEPTION',
      metadata: { orderId, orderNumber: order.orderNumber },
    });

    await auditService.logAction({
      branchId: order.branchId,
      actorId,
      actorName,
      action: 'ORDER_SUBMITTED',
      entityType: 'ORDER',
      entityId: orderId,
      metadata: { orderNumber: order.orderNumber },
    });

    return {
      ...updated,
      kots: await kotService.findByOrder(orderId),
    };
  }

  async holdOrder({ orderId, reason = '', actorId, actorName }) {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundAppError('Order not found.');
    }

    if (order.status === 'HOLD') {
      return this.getOrder(orderId);
    }

    if (!['DRAFT', 'WAITING_CONFIRMATION'].includes(order.status)) {
      throw new StateConflictError(
        'Can only hold orders that are not yet confirmed or preparing.'
      );
    }

    const updated = await orderRepository.updateStatus(orderId, 'HOLD', {
      held: true,
      holdReason: String(reason || '').trim(),
    });

    await orderEventRepository.recordEvent({
      orderId,
      branchId: order.branchId,
      eventType: 'ORDER_HELD',
      fromStatus: order.status,
      toStatus: 'HOLD',
      actorId,
      reason: reason || null,
    });

    return {
      ...updated,
      kots: await kotService.findByOrder(orderId),
    };
  }

  async resumeOrder({ orderId, actorId, actorName }) {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundAppError('Order not found.');
    }

    if (order.status === 'DRAFT' && !order.held) {
      return this.getOrder(orderId);
    }

    if (order.status !== 'HOLD') {
      throw new StateConflictError('Order is not currently on hold.');
    }

    const updated = await orderRepository.updateStatus(orderId, 'DRAFT', {
      held: false,
      holdReason: '',
    });

    await orderEventRepository.recordEvent({
      orderId,
      branchId: order.branchId,
      eventType: 'ORDER_RESUMED',
      fromStatus: 'HOLD',
      toStatus: 'DRAFT',
      actorId,
    });

    return {
      ...updated,
      kots: await kotService.findByOrder(orderId),
    };
  }

  async confirmOrder({ orderId, actorId, actorName }) {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundAppError('Order not found.');
    }

    const currentStatus = order.status;

    // Idempotency: if already confirmed/KOT sent, return existing KOT without creating duplicate
    if (['CONFIRMED', 'KOT_SENT', 'PREPARING', 'READY', 'SERVED'].includes(currentStatus)) {
      const kots = await kotService.findByOrder(orderId);
      return {
        order: { ...order, kots },
        kot: kots[0] || null,
      };
    }

    if (currentStatus !== 'WAITING_CONFIRMATION') {
      throw new StateConflictError(
        `Order cannot be confirmed in status '${currentStatus}'. Expected 'WAITING_CONFIRMATION'.`
      );
    }

    const now = utcNowIso();
    const updatedOrder = await orderRepository.updateStatus(orderId, 'KOT_SENT', {
      confirmedAt: now,
      confirmedBy: actorName,
      confirmedByUserId: actorId,
      kotRevision: 1,
    });

    const kot = await kotService.createInitialKot({
      order: updatedOrder,
      actorId,
      actorName,
    });

    if (updatedOrder.tableId) {
      await tableRepository.updateById(updatedOrder.tableId, { status: 'KOT_SENT' });
    }

    await orderEventRepository.recordEvent({
      orderId,
      branchId: updatedOrder.branchId,
      eventType: 'ORDER_CONFIRMED',
      fromStatus: currentStatus,
      toStatus: 'KOT_SENT',
      actorId,
      metadata: { kotId: kot.id, kotNumber: kot.kotNumber },
    });

    await auditService.logAction({
      branchId: updatedOrder.branchId,
      actorId,
      actorName,
      action: 'ORDER_CONFIRMED',
      entityType: 'ORDER',
      entityId: orderId,
      metadata: { orderNumber: updatedOrder.orderNumber, kotNumber: kot.kotNumber },
    });

    return {
      order: { ...updatedOrder, kots: [kot] },
      kot,
    };
  }

  async rejectOrder({ orderId, reason, actorId, actorName }) {
    if (!reason || !String(reason).trim()) {
      throw new ValidationAppError('A non-empty reason is required to reject an order.');
    }

    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundAppError('Order not found.');
    }

    const currentStatus = order.status;
    if (currentStatus !== 'WAITING_CONFIRMATION') {
      throw new StateConflictError(`Cannot reject order in status '${currentStatus}'.`);
    }

    const trimmedReason = String(reason).trim();
    const now = utcNowIso();
    const updated = await orderRepository.updateStatus(orderId, 'REJECTED', {
      rejectionReason: trimmedReason,
      rejectedAt: now,
    });

    if (order.tableId) {
      await tableRepository.updateById(order.tableId, {
        status: 'AVAILABLE',
        activeOrderId: null,
      });
    }

    await orderEventRepository.recordEvent({
      orderId,
      branchId: order.branchId,
      eventType: 'ORDER_REJECTED',
      fromStatus: currentStatus,
      toStatus: 'REJECTED',
      actorId,
      reason: trimmedReason,
    });

    await notificationService.notify({
      branchId: order.branchId,
      eventType: 'ORDER_REJECTED',
      title: `Order Rejected: Table ${order.tableNumber || ''}`,
      message: `Order ${order.orderNumber} was rejected: ${trimmedReason}`,
      recipientRole: 'CAPTAIN',
      recipientUserId: order.captainId || null,
      metadata: { orderId, reason: trimmedReason },
    });

    await auditService.logAction({
      branchId: order.branchId,
      actorId,
      actorName,
      action: 'ORDER_REJECTED',
      entityType: 'ORDER',
      entityId: orderId,
      reason: trimmedReason,
    });

    return {
      ...updated,
      kots: await kotService.findByOrder(orderId),
    };
  }

  async addOrModifyItems({ orderId, itemsToAdd, reason = null, actorId, actorName }) {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundAppError('Order not found.');
    }

    const currentStatus = order.status;
    if (['COMPLETED', 'CANCELLED', 'REJECTED', 'BILL_PENDING', 'BILLING'].includes(currentStatus)) {
      throw new StateConflictError(
        `Cannot modify items on order in status '${currentStatus}'.`
      );
    }

    if (!Array.isArray(itemsToAdd) || itemsToAdd.length === 0) {
      throw new ValidationAppError('items list cannot be empty.');
    }

    const now = utcNowIso();
    const capturedNewItems = await this._captureOrderItems(itemsToAdd, now);
    const deltaKotItems = capturedNewItems.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      note: it.note || '',
      station: it.station || 'MAIN',
      changeType: 'ADD',
    }));

    const newOrderItems = [...(order.items || []), ...capturedNewItems];
    const financials = calculateOrderFinancials(newOrderItems);

    let updatedOrder = await orderRepository.updateById(orderId, {
      items: newOrderItems,
      financials,
      updatedAt: now,
    });

    let modKot = null;
    if (['CONFIRMED', 'KOT_SENT', 'PREPARING', 'READY', 'SERVED'].includes(currentStatus)) {
      modKot = await kotService.createModificationKot({
        order: updatedOrder,
        deltaItems: deltaKotItems,
        reason: reason || 'Additional items ordered',
        actorId,
        actorName,
      });

      updatedOrder = await orderRepository.updateById(orderId, {
        kotRevision: modKot.revision,
      });
    }

    await orderEventRepository.recordEvent({
      orderId,
      branchId: order.branchId,
      eventType: 'ORDER_ITEMS_MODIFIED',
      fromStatus: currentStatus,
      toStatus: currentStatus,
      actorId,
      metadata: {
        itemsAdded: itemsToAdd.length,
        hasModificationKot: modKot !== null,
      },
    });

    await auditService.logAction({
      branchId: order.branchId,
      actorId,
      actorName,
      action: 'ORDER_ITEMS_MODIFIED',
      entityType: 'ORDER',
      entityId: orderId,
      reason: reason || 'Items added/modified',
      metadata: { itemsAdded: itemsToAdd.length },
    });

    const kots = await kotService.findByOrder(orderId);
    return {
      order: { ...updatedOrder, kots },
      modificationKot: modKot,
    };
  }

  async cancelOrder({ orderId, reason, actorId, actorName }) {
    if (!reason || !String(reason).trim()) {
      throw new ValidationAppError('A non-empty reason is required to cancel an order.');
    }

    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundAppError('Order not found.');
    }

    const currentStatus = order.status;
    if (['COMPLETED', 'CANCELLED'].includes(currentStatus)) {
      throw new StateConflictError(`Cannot cancel order in status '${currentStatus}'.`);
    }

    const trimmedReason = String(reason).trim();
    const now = utcNowIso();
    const cancelledItems = (order.items || []).map((it) => ({
      ...it,
      status: 'CANCELLED',
      updatedAt: now,
    }));
    const financials = calculateOrderFinancials(cancelledItems);

    const updated = await orderRepository.updateStatus(orderId, 'CANCELLED', {
      cancellationReason: trimmedReason,
      cancelledAt: now,
      items: cancelledItems,
      financials,
    });

    if (
      ['CONFIRMED', 'KOT_SENT', 'PREPARING', 'READY', 'SERVED', 'BILL_PENDING'].includes(
        currentStatus
      )
    ) {
      await kotService.createCancellationKot({
        order,
        reason: trimmedReason,
        actorId,
        actorName,
      });
    }

    if (order.tableId) {
      await tableRepository.updateById(order.tableId, {
        status: 'AVAILABLE',
        activeOrderId: null,
      });
    }

    await orderEventRepository.recordEvent({
      orderId,
      branchId: order.branchId,
      eventType: 'ORDER_CANCELLED',
      fromStatus: currentStatus,
      toStatus: 'CANCELLED',
      actorId,
      reason: trimmedReason,
    });

    await auditService.logAction({
      branchId: order.branchId,
      actorId,
      actorName,
      action: 'ORDER_CANCELLED',
      entityType: 'ORDER',
      entityId: orderId,
      reason: trimmedReason,
    });

    return {
      ...updated,
      kots: await kotService.findByOrder(orderId),
    };
  }

  async cancelOrderItem({ orderId, itemId, reason, actorId, actorName }) {
    if (!itemId) {
      throw new ValidationAppError('itemId is required.');
    }
    if (!reason || !String(reason).trim()) {
      throw new ValidationAppError('A non-empty reason is required to cancel an item.');
    }

    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundAppError('Order not found.');
    }

    const currentStatus = order.status;
    if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(currentStatus)) {
      throw new StateConflictError(
        `Cannot cancel items on order in status '${currentStatus}'.`
      );
    }

    const items = [...(order.items || [])];
    const targetIdx = items.findIndex(
      (it) => it._id === itemId || it.id === itemId || it.productId === itemId
    );
    if (targetIdx === -1) {
      throw new NotFoundAppError('Order item not found.');
    }

    const targetItem = items[targetIdx];
    const now = utcNowIso();
    items[targetIdx] = {
      ...targetItem,
      status: 'CANCELLED',
      cancellationReason: String(reason).trim(),
      updatedAt: now,
    };

    const financials = calculateOrderFinancials(items);
    const updatedOrder = await orderRepository.updateById(orderId, {
      items,
      financials,
      updatedAt: now,
    });

    let cancellationKot = null;
    if (['CONFIRMED', 'KOT_SENT', 'PREPARING', 'READY', 'SERVED'].includes(currentStatus)) {
      cancellationKot = await kotService.createCancellationKot({
        order,
        cancelledItems: [targetItem],
        reason: String(reason).trim(),
        actorId,
        actorName,
      });
    }

    await orderEventRepository.recordEvent({
      orderId,
      branchId: order.branchId,
      eventType: 'ORDER_ITEM_CANCELLED',
      fromStatus: currentStatus,
      toStatus: currentStatus,
      actorId,
      reason: String(reason).trim(),
      metadata: { itemId: targetItem._id || targetItem.id, productName: targetItem.productName },
    });

    await auditService.logAction({
      branchId: order.branchId,
      actorId,
      actorName,
      action: 'ORDER_ITEM_CANCELLED',
      entityType: 'ORDER',
      entityId: orderId,
      reason: String(reason).trim(),
      metadata: { itemId: targetItem._id || targetItem.id, productName: targetItem.productName },
    });

    const kots = await kotService.findByOrder(orderId);
    return {
      order: { ...updatedOrder, kots },
      cancellationKot,
    };
  }

  async getOrder(orderId) {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundAppError('Order not found.');
    }
    const kots = await kotService.findByOrder(orderId);
    return {
      ...order,
      kots,
    };
  }

  async listOrders(filters = {}) {
    const paginated = await orderRepository.listOrders(filters);
    const orderIds = paginated.items.map((o) => o._id || o.id);
    if (orderIds.length > 0) {
      const kots = await kotService.findByOrderIds(orderIds);
      const kotsByOrderId = new Map();
      for (const k of kots) {
        const list = kotsByOrderId.get(k.orderId) || [];
        list.push(k);
        kotsByOrderId.set(k.orderId, list);
      }
      paginated.items = paginated.items.map((o) => ({
        ...o,
        kots: kotsByOrderId.get(o._id || o.id) || [],
      }));
    }
    return paginated;
  }

  async getOrderHistory({
    branchId = 'branch-main',
    dateFrom = null,
    dateTo = null,
    month = null,
    customerId = null,
    categoryId = null,
    status = null,
    search = null,
    page = 1,
    limit = 50,
  } = {}) {
    let start = dateFrom;
    let end = dateTo;

    if (month && String(month).trim()) {
      const match = /^(\d{4})-(\d{1,2})$/.exec(String(month).trim());
      if (match) {
        const year = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const lastDay = new Date(year, m, 0).getDate();
        start = `${year}-${String(m).padStart(2, '0')}-01T00:00:00.000Z`;
        end = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;
      }
    } else {
      if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
        start = `${start}T00:00:00.000Z`;
      }
      if (end && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
        end = `${end}T23:59:59.999Z`;
      }
    }

    const query = { branchId };
    if (start || end) {
      query.createdAt = {};
      if (start) query.createdAt.$gte = start;
      if (end) query.createdAt.$lte = end;
    }

    if (status && status !== 'ALL') {
      if (status === 'COMPLETED_PAID') {
        query.status = { $in: ['COMPLETED', 'PAID', 'BILLING', 'BILL_PENDING'] };
      } else if (status === 'ACTIVE') {
        query.status = { $nin: ['COMPLETED', 'CANCELLED', 'REJECTED'] };
      } else if (status === 'CANCELLED') {
        query.status = { $in: ['CANCELLED', 'REJECTED'] };
      } else {
        query.status = status;
      }
    }

    const rawOrders = await orderRepository.findMany(query, {
      sort: [['createdAt', -1]],
    });

    const [categories, products, customers] = await Promise.all([
      categoryRepository.findByBranch(branchId),
      productRepository.findMany({ branchId }),
      customerRepository.findMany({ branchId }),
    ]);

    const categoryMap = new Map(categories.map((c) => [String(c._id || c.id), c.name]));
    const productMap = new Map(products.map((p) => [String(p._id || p.id), p]));
    const customerMap = new Map(customers.map((c) => [String(c._id || c.id), c]));

    const orderIds = rawOrders.map((o) => o._id || o.id);
    const bills = orderIds.length > 0
      ? await billRepository.findMany({ branchId, orderId: { $in: orderIds } })
      : [];
    const billByOrderId = new Map(bills.map((b) => [b.orderId, b]));

    const processedOrders = [];
    for (const order of rawOrders) {
      const ordId = order._id || order.id;
      const linkedBill = billByOrderId.get(ordId);

      let customer = null;
      const custId = order.customerId || linkedBill?.customerId;
      if (custId && customerMap.has(String(custId))) {
        const c = customerMap.get(String(custId));
        customer = {
          id: c._id || c.id,
          name: c.name,
          mobile: c.mobile || c.phone || '',
          email: c.email || '',
        };
      } else if (linkedBill?.customerName) {
        customer = {
          id: linkedBill.customerId || null,
          name: linkedBill.customerName,
          mobile: linkedBill.customerMobile || '',
          email: '',
        };
      }

      if (customerId && customerId !== 'ALL') {
        if (customerId === 'WALK_IN' || customerId === 'walk-in') {
          if (customer) continue;
        } else {
          if (!customer || String(customer.id) !== String(customerId)) {
            continue;
          }
        }
      }

      const enrichedItems = (order.items || []).map((it) => {
        let catId = it.categoryId;
        let catName = it.categoryName;
        if (!catId && it.productId) {
          const prod = productMap.get(String(it.productId));
          if (prod) {
            catId = prod.categoryId || null;
          }
        }
        if (catId && !catName) {
          catName = categoryMap.get(String(catId)) || 'General';
        }
        return {
          ...it,
          categoryId: catId || 'uncategorized',
          categoryName: catName || 'General',
        };
      });

      if (categoryId && categoryId !== 'ALL') {
        const hasCategory = enrichedItems.some(
          (it) => String(it.categoryId) === String(categoryId) && (it.status || 'ACTIVE') !== 'CANCELLED'
        );
        if (!hasCategory) continue;
      }

      if (search && String(search).trim()) {
        const q = String(search).trim().toLowerCase();
        const orderNo = String(order.orderNumber || order.orderNo || '').toLowerCase();
        const tableNo = String(order.tableNumber || order.tableNo || '').toLowerCase();
        const captain = String(order.captainName || '').toLowerCase();
        const custName = String(customer?.name || '').toLowerCase();
        const custPhone = String(customer?.mobile || '').toLowerCase();
        const dishMatch = enrichedItems.some((it) =>
          String(it.productName || it.name || '').toLowerCase().includes(q)
        );

        const matches =
          orderNo.includes(q) ||
          tableNo.includes(q) ||
          captain.includes(q) ||
          custName.includes(q) ||
          custPhone.includes(q) ||
          dishMatch;

        if (!matches) continue;
      }

      const subtotal = order.financials?.subtotal || order.subtotal || '0.00';
      const taxTotal = order.financials?.taxTotal || order.tax || '0.00';
      const discountAmount = order.financials?.discountAmount || order.discount || '0.00';
      const grandTotal = linkedBill?.grandTotal || order.financials?.grandTotal || order.grandTotal || '0.00';

      processedOrders.push({
        ...order,
        id: ordId,
        orderNo: order.orderNumber || order.orderNo,
        orderNumber: order.orderNumber || order.orderNo,
        tableNo: order.tableNumber || order.tableNo,
        tableNumber: order.tableNumber || order.tableNo,
        customer,
        items: enrichedItems,
        bill: linkedBill
          ? {
              id: linkedBill._id || linkedBill.id,
              billNumber: linkedBill.billNumber,
              status: linkedBill.status,
              grandTotal: linkedBill.grandTotal,
              paidAmount: linkedBill.paidAmount,
              balanceAmount: linkedBill.balanceAmount,
            }
          : null,
        subtotal,
        taxTotal,
        discountAmount,
        grandTotal,
      });
    }

    let totalSalesDec = toDecimal(0);
    let totalSubtotalDec = toDecimal(0);
    let totalTaxDec = toDecimal(0);
    let totalDiscountDec = toDecimal(0);
    let totalItemsSold = 0;

    const categoryStatsMap = new Map();
    const dailyStatsMap = new Map();

    for (const ord of processedOrders) {
      const isCancelled = ord.status === 'CANCELLED' || ord.status === 'REJECTED';
      const gTotal = toDecimal(ord.grandTotal || 0);
      const sTotal = toDecimal(ord.subtotal || 0);
      const tTotal = toDecimal(ord.taxTotal || 0);
      const dTotal = toDecimal(ord.discountAmount || 0);

      if (!isCancelled) {
        totalSalesDec = totalSalesDec.plus(gTotal);
        totalSubtotalDec = totalSubtotalDec.plus(sTotal);
        totalTaxDec = totalTaxDec.plus(tTotal);
        totalDiscountDec = totalDiscountDec.plus(dTotal);
      }

      const day = String(ord.createdAt || '').slice(0, 10) || 'unknown';
      const dayAcc = dailyStatsMap.get(day) || {
        date: day,
        ordersCount: 0,
        salesDec: toDecimal(0),
        itemsCount: 0,
      };
      dayAcc.ordersCount += 1;
      if (!isCancelled) {
        dayAcc.salesDec = dayAcc.salesDec.plus(gTotal);
      }

      for (const it of ord.items || []) {
        if ((it.status || 'ACTIVE') === 'CANCELLED') continue;
        const qty = Number(it.quantity || 1);
        const lineTotal = toDecimal(
          it.lineTotal || it.lineSubtotal || toDecimal(it.unitPrice || 0).times(qty)
        );

        if (!isCancelled) {
          totalItemsSold += qty;
          dayAcc.itemsCount += qty;

          const catId = it.categoryId || 'uncategorized';
          const catName = it.categoryName || 'General';
          const catAcc = categoryStatsMap.get(catId) || {
            categoryId: catId,
            categoryName: catName,
            quantity: 0,
            revenueDec: toDecimal(0),
          };
          catAcc.quantity += qty;
          catAcc.revenueDec = catAcc.revenueDec.plus(lineTotal);
          categoryStatsMap.set(catId, catAcc);
        }
      }

      dailyStatsMap.set(day, dayAcc);
    }

    const categoryBreakdown = [...categoryStatsMap.values()]
      .sort((a, b) => b.revenueDec.comparedTo(a.revenueDec))
      .map((c) => {
        const rev = formatMoney(c.revenueDec);
        const pct = totalSalesDec.gt(0)
          ? Number(c.revenueDec.div(totalSalesDec).times(100).toFixed(1))
          : 0;
        return {
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          quantity: c.quantity,
          revenue: rev,
          percentage: pct,
        };
      });

    const dailyBreakdown = [...dailyStatsMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        ordersCount: d.ordersCount,
        itemsCount: d.itemsCount,
        sales: formatMoney(d.salesDec),
      }));

    const totalOrders = processedOrders.length;
    const validOrdersCount = processedOrders.filter(
      (o) => o.status !== 'CANCELLED' && o.status !== 'REJECTED'
    ).length;

    const averageOrderValue = validOrdersCount > 0
      ? formatMoney(roundMoney(totalSalesDec.div(validOrdersCount)))
      : '0.00';

    const summary = {
      branchId,
      totalOrders,
      validOrdersCount,
      totalSales: formatMoney(totalSalesDec),
      totalSubtotal: formatMoney(totalSubtotalDec),
      totalTax: formatMoney(totalTaxDec),
      totalDiscount: formatMoney(totalDiscountDec),
      totalItemsSold,
      averageOrderValue,
      dateFrom: start,
      dateTo: end,
    };

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 50, 1);
    const totalPages = Math.ceil(totalOrders / limitNum) || 1;
    const paginatedOrders = processedOrders.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return {
      summary,
      categoryBreakdown,
      dailyBreakdown,
      orders: paginatedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalOrders,
        totalPages,
        pages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    };
  }

  async getOrderEvents(orderId) {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundAppError('Order not found.');
    }
    return orderEventRepository.listEventsForOrder(orderId);
  }
}

export const orderService = new OrderService();
