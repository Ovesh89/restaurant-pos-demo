import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { ORDER_STATUS, KOT_TYPE, KOT_STATUS } from '../../../constants/orderStatus.js';
import { TABLE_STATUS } from '../../../constants/tableStatus.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { kotRepository } from '../kotRepository.js';
import { tableRepository } from '../tableRepository.js';
import { auditRepository } from '../auditRepository.js';

function getDailyOrderNo(orders) {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const dateKey = `${day}${month}${year}`;
  const prefix = `ORD-${dateKey}-`;

  const dailyOrders = orders.filter((o) => o.orderNo && o.orderNo.startsWith(prefix));
  let maxSeq = 0;
  for (const o of dailyOrders) {
    const parts = o.orderNo.split('-');
    const seq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

class OrderLocalRepository {
  async getOrders(filters = {}) {
    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    let list = [...orders];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        list = list.filter((o) => filters.status.includes(o.status));
      } else {
        list = list.filter((o) => o.status === filters.status);
      }
    }

    if (filters.tableId) {
      list = list.filter((o) => o.tableId === filters.tableId);
    }

    if (filters.orderType) {
      list = list.filter((o) => (o.orderType || 'DINE_IN') === filters.orderType);
    }

    if (filters.captainId) {
      list = list.filter((o) => o.captainId === filters.captainId);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (o) =>
          (o.orderNo && o.orderNo.toLowerCase().includes(q)) ||
          (o.tableNo && o.tableNo.toLowerCase().includes(q)) ||
          (o.customerName && o.customerName.toLowerCase().includes(q)) ||
          (o.captainName && o.captainName.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = list.length;
    let paginated = list;
    if (filters.page || filters.limit) {
      const pageNum = Math.max(1, parseInt(filters.page, 10) || 1);
      const limitNum = Math.max(1, parseInt(filters.limit, 10) || 20);
      const totalPages = Math.max(1, Math.ceil(total / limitNum));
      paginated = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      paginated.pagination = {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        pages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      };
    } else {
      paginated.pagination = {
        total,
        page: 1,
        limit: total || 20,
        totalPages: 1,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      };
    }
    paginated.items = paginated;
    return paginated;
  }

  _findOrderIndex(orders, orderId) {
    if (!orderId) return -1;
    return orders.findIndex(
      (o) => o.id === orderId || o._id === orderId || o.orderNo === orderId || o.orderNumber === orderId
    );
  }

  async getOrderById(id) {
    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const idx = this._findOrderIndex(orders, id);
    return idx !== -1 ? orders[idx] : null;
  }

  async getActiveOrderByTable(tableId) {
    const orders = await this.getOrders();
    return orders.find(
      (o) =>
        o.tableId === tableId &&
        o.status !== ORDER_STATUS.COMPLETED &&
        o.status !== ORDER_STATUS.CANCELLED &&
        o.status !== ORDER_STATUS.REJECTED
    ) || null;
  }

  /**
   * Create or Save Draft Order
   * Applies the Price Snapshot Rule: captures unitPrice at addition time
   */
  async createOrder({
    table,
    tableId,
    tableNo,
    captain,
    captainId,
    captainName,
    items,
    notes = '',
    isDraft = false,
    autoApprove = false,
    orderType = 'DINE_IN',
    customerName = '',
    customerPhone = '',
    onlineOrderRef = '',
  }) {
    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const orderNo = getDailyOrderNo(orders);

    if (!items || items.length === 0) {
      throw new Error('Order must contain at least one menu dish.');
    }

    const isTableOrder = !orderType || orderType === 'DINE_IN';
    const tableObj = table || (tableId ? { id: tableId, tableNo: tableNo, branchId: 'branch-001' } : null);
    const captainObj = captain || { id: captainId || 'captain-01', name: captainName || 'Captain' };

    const resolvedTableId = isTableOrder ? (tableObj ? tableObj.id : tableId || null) : null;
    let resolvedTableNo = tableNo || (tableObj ? tableObj.tableNo : null);
    if (!isTableOrder) {
      if (tableNo) {
        resolvedTableNo = tableNo;
      } else if (orderType === 'TAKEAWAY') {
        resolvedTableNo = 'Take Away';
      } else if (orderType === 'ZOMATO') {
        resolvedTableNo = 'Zomato';
      } else if (orderType === 'SWIGGY') {
        resolvedTableNo = 'Swiggy';
      } else {
        resolvedTableNo = 'Online';
      }
    }

    // Freeze captured prices for each line item
    const orderItems = items.map((i, idx) => ({
      lineId: `line-${Date.now()}-${idx}`,
      productId: i.productId || i.id,
      name: i.name,
      code: i.code || '',
      quantity: Number(i.quantity) || 1,
      unitPrice: Number(i.unitPrice !== undefined ? i.unitPrice : i.price) || 0, // CAPTURED PRICE SNAPSHOT
      taxRate: Number(i.taxRate) || 5.0,
      station: i.station || i.kitchenStation || 'Main Curry',
      kotRequired: i.kotRequired !== undefined ? Boolean(i.kotRequired) : true,
      notes: i.notes?.trim() || ''
    }));

    const subtotal = orderItems.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);

    const settings = storageAdapter.getItem(STORAGE_KEYS.SETTINGS) || {};
    const approvalRequired = settings.requireOrderApproval !== undefined
      ? Boolean(settings.requireOrderApproval)
      : true;
    const shouldAutoApprove = !isDraft && (!approvalRequired || Boolean(autoApprove));
    const initialStatus = isDraft
      ? ORDER_STATUS.DRAFT
      : (shouldAutoApprove ? ORDER_STATUS.KOT_SENT : ORDER_STATUS.WAITING_CONFIRMATION);

    const newOrder = {
      id: `ord-${Date.now()}`,
      orderNo,
      orderType: orderType || 'DINE_IN',
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      onlineOrderRef: onlineOrderRef || '',
      branchId: tableObj?.branchId || 'branch-001',
      tableId: resolvedTableId,
      tableNo: resolvedTableNo || 'N/A',
      captainId: captainObj.id,
      captainName: captainObj.name,
      items: orderItems,
      subtotal,
      notes: notes.trim(),
      status: initialStatus,
      rejectionReason: '',
      kotRevision: shouldAutoApprove ? 1 : 0,
      confirmedBy: shouldAutoApprove ? captainObj.name : null,
      confirmedAt: shouldAutoApprove ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    orders.unshift(newOrder);
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);

    let kotTicket = null;
    if (shouldAutoApprove) {
      kotTicket = await kotRepository.createKOT({
        order: newOrder,
        items: newOrder.items,
        type: KOT_TYPE.NEW,
        revision: 1,
        actor: captainObj,
      });
    }

    // Update Table status only if dine in table order
    if (isTableOrder && resolvedTableId && !isDraft) {
      await tableRepository.updateOperationalStatus(
        resolvedTableId,
        shouldAutoApprove ? TABLE_STATUS.KOT_SENT : TABLE_STATUS.OCCUPIED,
        newOrder.id,
        captainObj
      );
    }

    await auditRepository.logEvent({
      actorId: captainObj.id,
      actorName: captainObj.name,
      action: isDraft ? 'ORDER_HELD' : (shouldAutoApprove ? 'ORDER_CONFIRMED' : 'ORDER_SUBMITTED'),
      entityType: 'Order',
      entityId: newOrder.id,
      details: `${newOrder.orderNo} (${newOrder.orderType}) for ${resolvedTableNo} with ${orderItems.length} items (Total: ₹${subtotal}) was ${isDraft ? 'saved as draft' : (shouldAutoApprove ? 'dispatched directly to kitchen (no approval required)' : 'submitted to reception')}.`
    });

    return newOrder;
  }

  /**
   * Submit an existing Draft / Hold order to Reception
   */
  async submitOrder(orderId, actor) {
    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const index = this._findOrderIndex(orders, orderId);
    if (index === -1) {
      throw new Error('Order not found.');
    }

    const order = orders[index];
    if (order.status !== ORDER_STATUS.DRAFT && order.status !== ORDER_STATUS.HOLD) {
      throw new Error(`Cannot submit order with status "${order.status}".`);
    }

    const settings = storageAdapter.getItem(STORAGE_KEYS.SETTINGS) || {};
    const approvalRequired = settings.requireOrderApproval !== undefined
      ? Boolean(settings.requireOrderApproval)
      : true;

    if (!approvalRequired) {
      return this.confirmOrder(orderId, actor);
    }

    order.status = ORDER_STATUS.WAITING_CONFIRMATION;
    order.updatedAt = new Date().toISOString();
    orders[index] = order;
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);

    // Update Table status
    await tableRepository.updateOperationalStatus(
      order.tableId,
      TABLE_STATUS.OCCUPIED,
      order.id,
      actor
    );

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'ORDER_SUBMITTED',
      entityType: 'Order',
      entityId: orderId,
      details: `Held order ${order.orderNo} submitted to reception queue.`
    });

    return order;
  }

  /**
   * Reception Confirmation: Approves order and automatically generates KOT ticket
   */
  async confirmOrder(orderId, actor = { id: 'reception', name: 'Reception' }) {
    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const index = this._findOrderIndex(orders, orderId);
    if (index === -1) {
      throw new Error('Order not found.');
    }

    const order = orders[index];
    if (
      order.status !== ORDER_STATUS.WAITING_CONFIRMATION &&
      order.status !== ORDER_STATUS.SUBMITTED &&
      order.status !== ORDER_STATUS.HOLD &&
      order.status !== ORDER_STATUS.DRAFT
    ) {
      throw new Error(`Order cannot be confirmed from status "${order.status}".`);
    }

    order.status = ORDER_STATUS.KOT_SENT;
    order.held = false;
    order.holdReason = '';
    order.kotRevision = (order.kotRevision || 0) + 1;
    order.confirmedBy = actor.name;
    order.confirmedAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();

    orders[index] = order;
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);

    // Automatically generate KOT Ticket
    const kotTicket = await kotRepository.createKOT({
      order,
      items: order.items,
      type: KOT_TYPE.NEW,
      revision: order.kotRevision,
      actor
    });

    // Update Table status
    await tableRepository.updateOperationalStatus(
      order.tableId,
      TABLE_STATUS.KOT_SENT,
      order.id,
      actor
    );

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'ORDER_CONFIRMED',
      entityType: 'Order',
      entityId: orderId,
      details: `Reception confirmed ${order.orderNo} for Table ${order.tableNo}. Dispatched ${kotTicket.kotNo}.`
    });

    return { order, kotTicket };
  }

  async activateOrder(orderId, actor = { id: 'staff', name: 'Staff' }) {
    return this.confirmOrder(orderId, actor);
  }

  /**
   * Reception Rejection: Returns order with mandatory reason
   */
  async rejectOrder(orderId, reason, actor = { id: 'reception', name: 'Reception' }) {
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory rejection reason must be specified.');
    }

    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const index = this._findOrderIndex(orders, orderId);
    if (index === -1) {
      throw new Error('Order not found.');
    }

    const order = orders[index];
    order.status = ORDER_STATUS.REJECTED;
    order.held = false;
    order.holdReason = '';
    order.rejectionReason = reason.trim();
    order.updatedAt = new Date().toISOString();

    orders[index] = order;
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);

    // Release table
    await tableRepository.updateOperationalStatus(
      order.tableId,
      TABLE_STATUS.AVAILABLE,
      null,
      actor
    );

    // Cancel all associated active KOTs so they are removed from KDS
    if (kotRepository.cancelKOTsByOrderId) {
      await kotRepository.cancelKOTsByOrderId(orderId, reason.trim());
    }

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'ORDER_REJECTED',
      entityType: 'Order',
      entityId: orderId,
      details: `Reception rejected ${order.orderNo} for Table ${order.tableNo}. Reason: "${reason.trim()}".`
    });

    return order;
  }

  /**
   * Order Modification: Add/Remove/Modify items after confirmation
   * Generates a Delta KOT ticket (preserves operational history)
   */
  async modifyOrderItems(orderId, updatedItems, modificationReason, actor) {
    if (!modificationReason || !modificationReason.trim()) {
      throw new Error('Mandatory reason required to modify confirmed order items.');
    }

    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const index = this._findOrderIndex(orders, orderId);
    if (index === -1) {
      throw new Error('Order not found.');
    }

    const order = orders[index];

    // Block modifications once bill is settled
    if (order.status === ORDER_STATUS.COMPLETED || order.status === 'PAID') {
      throw new Error('Cannot modify items on a completed/settled order.');
    }
    const bills = storageAdapter.getItem(STORAGE_KEYS.BILLS) || [];
    const linkedBill = bills.find((b) => b.orderId === order.id || b.orderId === order._id || b.orderId === order.orderNo);
    if (linkedBill && ['COMPLETED', 'PAID'].includes(linkedBill.status)) {
      throw new Error('Cannot modify items on an order once the bill is settled.');
    }
    if (linkedBill && String(actor?.role || '').toLowerCase() === 'captain') {
      throw new Error('Cannot modify items: A bill has already been generated. Captains are not permitted to alter or modify bills.');
    }

    const previousItems = [...order.items];

    // Calculate delta items for kitchen KOT
    // Compare old items vs updated items
    const deltaItems = [];

    // Find added or increased items
    updatedItems.forEach((newItm) => {
      const oldItm = previousItems.find((oi) => oi.productId === newItm.productId);
      if (!oldItm) {
        // Entirely new dish
        if (newItm.kotRequired !== false) {
          deltaItems.push({
            productId: newItm.productId,
            name: newItm.name,
            quantity: `+${newItm.quantity}`,
            station: newItm.station,
            notes: newItm.notes ? `ADD NEW: ${newItm.notes}` : 'ADD NEW'
          });
        }
      } else if (newItm.quantity > oldItm.quantity) {
        // Quantity increased
        if (newItm.kotRequired !== false) {
          const diff = newItm.quantity - oldItm.quantity;
          deltaItems.push({
            productId: newItm.productId,
            name: newItm.name,
            quantity: `+${diff}`,
            station: newItm.station,
            notes: newItm.notes ? `ADDITIONAL: ${newItm.notes}` : 'ADDITIONAL QTY'
          });
        }
      } else if (newItm.quantity < oldItm.quantity) {
        // Quantity decreased
        if (newItm.kotRequired !== false) {
          const diff = oldItm.quantity - newItm.quantity;
          deltaItems.push({
            productId: newItm.productId,
            name: newItm.name,
            quantity: `-${diff}`,
            station: newItm.station,
            notes: 'REDUCED QTY'
          });
        }
      }
    });

    // Find removed items
    previousItems.forEach((oldItm) => {
      const stillExists = updatedItems.some((ni) => ni.productId === oldItm.productId);
      if (!stillExists && oldItm.kotRequired !== false) {
        deltaItems.push({
          productId: oldItm.productId,
          name: oldItm.name,
          quantity: `-${oldItm.quantity}`,
          station: oldItm.station,
          notes: 'CANCELLED DISH'
        });
      }
    });

    // Save updated items snapshot into canonical order:
    // Retain removed items with status: 'CANCELLED' so they show with a strike-through line
    const activeProductIds = new Set(updatedItems.map((ui) => ui.productId || ui.id || ui._id));
    const preservedCancelledItems = previousItems
      .filter((pi) => !activeProductIds.has(pi.productId || pi.id || pi._id))
      .map((pi) => ({
        ...pi,
        status: 'CANCELLED',
        cancellationReason: modificationReason.trim(),
        cancelledAt: new Date().toISOString(),
      }));

    const finalOrderItems = [
      ...updatedItems.map((ui) => ({ ...ui, status: ui.status || 'ACTIVE' })),
      ...preservedCancelledItems,
    ];

    order.items = finalOrderItems;
    order.subtotal = updatedItems.reduce((acc, i) => acc + i.quantity * (i.unitPrice || i.price || 0), 0);
    order.kotRevision = (order.kotRevision || 1) + 1;
    order.updatedAt = new Date().toISOString();

    orders[index] = order;
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);

    // Update operational KOTs if any items were removed
    const removedProductIds = new Set(preservedCancelledItems.map((pi) => pi.productId || pi.id || pi._id));
    if (removedProductIds.size > 0) {
      const allKots = storageAdapter.getItem(STORAGE_KEYS.KOTS) || [];
      const targetOrderIdStr = String(order.id || order._id || order.orderNo);
      const updatedKots = allKots.map((k) => {
        if (String(k.orderId) !== targetOrderIdStr) return k;
        if (k.type === KOT_TYPE.CANCELLATION || k.status === KOT_STATUS.CANCELLED) return k;

        let changed = false;
        const kItems = (k.items || []).map((ki) => {
          if (removedProductIds.has(ki.productId || ki.id || ki._id || ki.name)) {
            changed = true;
            return {
              ...ki,
              status: 'CANCELLED',
              cancelled: true,
              cancellationReason: modificationReason.trim(),
            };
          }
          return ki;
        });

        if (changed) {
          const allCancelled = kItems.every((ki) => ki.status === 'CANCELLED' || ki.cancelled === true);
          return {
            ...k,
            items: kItems,
            status: allCancelled ? KOT_STATUS.CANCELLED : k.status,
            notes: allCancelled ? `KOT CANCELLED: All items were removed from order (${modificationReason.trim()})` : k.notes,
            updatedAt: new Date().toISOString(),
          };
        }
        return k;
      });
      storageAdapter.setItem(STORAGE_KEYS.KOTS, updatedKots);
    }

    // Sync unsettled bill if exists
    if (linkedBill && !['COMPLETED', 'PAID', 'CANCELLED', 'VOIDED'].includes(linkedBill.status)) {
      const billIdx = bills.findIndex((b) => b.id === linkedBill.id);
      if (billIdx !== -1) {
        const subtotal = order.subtotal;
        const discountAmount = Number(linkedBill.discountAmount || 0);
        const taxableValue = Math.max(0, subtotal - discountAmount);
        const taxRate = Number(linkedBill.taxRate || 5);
        const taxAmount = (taxableValue * taxRate) / 100;
        const rawGrandTotal = taxableValue + taxAmount;
        const grandTotal = Math.round(rawGrandTotal);
        const rounding = grandTotal - rawGrandTotal;

        bills[billIdx] = {
          ...linkedBill,
          items: order.items,
          subtotal,
          taxableValue,
          taxAmount,
          rounding,
          grandTotal,
          balance: grandTotal,
          updatedAt: new Date().toISOString(),
        };
        storageAdapter.setItem(STORAGE_KEYS.BILLS, bills);
      }
    }

    // Create Delta KOT
    let deltaKOT = null;
    if (deltaItems.length > 0) {
      deltaKOT = await kotRepository.createKOT({
        order,
        items: deltaItems,
        type: KOT_TYPE.MODIFICATION,
        revision: order.kotRevision,
        modificationReason: modificationReason.trim(),
        actor
      });
    }

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'ORDER_MODIFIED',
      entityType: 'Order',
      entityId: orderId,
      details: `Modified items on ${order.orderNo}. Rev #${order.kotRevision}. Reason: "${modificationReason}".`
    });

    return { order, deltaKOT };
  }

  /**
   * Cancel / Remove an individual item from an order
   * Allowed anytime before/after served, but blocked once bill is settled.
   * Automatically recalculates order subtotal and unsettled bill totals.
   */
  async cancelOrderItem(orderId, itemId, reason = 'Item removed', actor = {}) {
    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const index = this._findOrderIndex(orders, orderId);
    if (index === -1) {
      throw new Error('Order not found.');
    }

    const order = orders[index];
    if (order.status === ORDER_STATUS.COMPLETED || order.status === 'PAID') {
      throw new Error('Cannot remove items from an order once the bill is settled.');
    }

    // Check if linked bill is settled
    const bills = storageAdapter.getItem(STORAGE_KEYS.BILLS) || [];
    const linkedBill = bills.find((b) => b.orderId === orderId);
    if (linkedBill && ['COMPLETED', 'PAID'].includes(linkedBill.status)) {
      throw new Error('Cannot remove items from an order once the bill is settled.');
    }

    const itemIdx = order.items.findIndex(
      (it) => it.lineId === itemId || it.productId === itemId || it.id === itemId || it._id === itemId
    );
    if (itemIdx === -1) {
      throw new Error('Item not found in order.');
    }

    const removedItem = order.items[itemIdx];
    order.items[itemIdx] = {
      ...removedItem,
      status: 'CANCELLED',
      cancellationReason: reason,
      cancelledAt: new Date().toISOString(),
    };
    const activeItems = order.items.filter((it) => (it.status || 'ACTIVE') !== 'CANCELLED');
    order.subtotal = activeItems.reduce((acc, i) => acc + i.quantity * (i.unitPrice || i.price || 0), 0);
    order.kotRevision = (order.kotRevision || 1) + 1;
    order.updatedAt = new Date().toISOString();

    orders[index] = order;
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);

    // Update existing operational KOTs
    const allKots = storageAdapter.getItem(STORAGE_KEYS.KOTS) || [];
    const targetOrderIdStr = String(order.id || order._id || order.orderNo);
    const updatedKots = allKots.map((k) => {
      if (String(k.orderId) !== targetOrderIdStr) return k;
      if (k.type === KOT_TYPE.CANCELLATION || k.status === KOT_STATUS.CANCELLED) return k;

      let changed = false;
      const kItems = (k.items || []).map((ki) => {
        if (
          ki.productId === removedItem.productId ||
          ki.id === removedItem.productId ||
          ki.name === removedItem.name ||
          ki._id === removedItem.id ||
          ki.id === removedItem.id
        ) {
          changed = true;
          return {
            ...ki,
            status: 'CANCELLED',
            cancelled: true,
            cancellationReason: reason,
          };
        }
        return ki;
      });

      if (changed) {
        const allCancelled = kItems.every((ki) => ki.status === 'CANCELLED' || ki.cancelled === true);
        return {
          ...k,
          items: kItems,
          status: allCancelled ? KOT_STATUS.CANCELLED : k.status,
          notes: allCancelled ? `KOT CANCELLED: All items were removed from order (${reason})` : k.notes,
          updatedAt: new Date().toISOString(),
        };
      }
      return k;
    });
    storageAdapter.setItem(STORAGE_KEYS.KOTS, updatedKots);

    // Sync unsettled bill if exists
    if (linkedBill && !['COMPLETED', 'PAID', 'CANCELLED', 'VOIDED'].includes(linkedBill.status)) {
      const billIdx = bills.findIndex((b) => b.id === linkedBill.id);
      if (billIdx !== -1) {
        const subtotal = order.subtotal;
        const discountAmount = Number(linkedBill.discountAmount || 0);
        const taxableValue = Math.max(0, subtotal - discountAmount);
        const taxRate = Number(linkedBill.taxRate || 5);
        const taxAmount = (taxableValue * taxRate) / 100;
        const rawGrandTotal = taxableValue + taxAmount;
        const grandTotal = Math.round(rawGrandTotal);
        const rounding = grandTotal - rawGrandTotal;

        bills[billIdx] = {
          ...linkedBill,
          items: order.items,
          subtotal,
          taxableValue,
          taxAmount,
          rounding,
          grandTotal,
          balance: grandTotal,
          updatedAt: new Date().toISOString(),
        };
        storageAdapter.setItem(STORAGE_KEYS.BILLS, bills);
      }
    }

    // Create Delta KOT for cancellation if item required KOT
    if (removedItem.kotRequired !== false) {
      await kotRepository.createKOT({
        order,
        items: [{
          productId: removedItem.productId,
          name: removedItem.name,
          quantity: `-${removedItem.quantity}`,
          station: removedItem.station,
          notes: `CANCELLED: ${reason}`,
        }],
        type: KOT_TYPE.MODIFICATION,
        revision: order.kotRevision,
        modificationReason: reason,
        actor,
      });
    }

    await auditRepository.logEvent({
      actorId: actor?.id || 'staff',
      actorName: actor?.name || 'Staff',
      action: 'ORDER_ITEM_CANCELLED',
      entityType: 'Order',
      entityId: orderId,
      details: `Removed dish "${removedItem.name}" from ${order.orderNo}. Reason: "${reason}". New Subtotal: ₹${order.subtotal}`,
    });

    return { order, linkedBill: linkedBill ? bills.find((b) => b.id === linkedBill.id) : null };
  }

  /**
   * Cancel an order with mandatory reason
   */
  async cancelOrder(orderId, reason, actor) {
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory cancellation reason is required.');
    }

    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const index = this._findOrderIndex(orders, orderId);
    if (index === -1) {
      throw new Error('Order not found.');
    }

    const order = orders[index];
    if (order.status === ORDER_STATUS.COMPLETED) {
      throw new Error('Completed orders cannot be cancelled.');
    }

    order.status = ORDER_STATUS.CANCELLED;
    order.cancellationReason = reason.trim();
    order.updatedAt = new Date().toISOString();

    orders[index] = order;
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);

    // Release table
    await tableRepository.updateOperationalStatus(
      order.tableId,
      TABLE_STATUS.AVAILABLE,
      null,
      actor
    );

    // Cancel all associated active KOTs
    if (kotRepository.cancelKOTsByOrderId) {
      await kotRepository.cancelKOTsByOrderId(orderId, reason.trim());
    } else {
      const kots = await kotRepository.getKOTs({ orderId });
      for (const k of kots) {
        if (k.status !== KOT_STATUS.CANCELLED) {
          await kotRepository.updateKOTStatus(k.id, KOT_STATUS.CANCELLED, actor);
        }
      }
    }

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'ORDER_CANCELLED',
      entityType: 'Order',
      entityId: orderId,
      details: `${order.orderNo} for Table ${order.tableNo} was cancelled. Reason: "${reason.trim()}".`
    });

    return order;
  }

  /**
   * Propagates Kitchen status updates to the order and table
   */
  async updateStatusFromKitchen(orderId, newKOTStatus, actor) {
    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) return null;

    const order = orders[index];

    if (newKOTStatus === KOT_STATUS.PREPARING) {
      order.status = ORDER_STATUS.PREPARING;
      await tableRepository.updateOperationalStatus(order.tableId, TABLE_STATUS.PREPARING, order.id, actor);
    } else if (newKOTStatus === KOT_STATUS.READY) {
      order.status = ORDER_STATUS.READY;
      await tableRepository.updateOperationalStatus(order.tableId, TABLE_STATUS.READY, order.id, actor);
    }

    order.updatedAt = new Date().toISOString();
    orders[index] = order;
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);
    return order;
  }

  /**
   * Move order to served state
   */
  async markAsServed(orderId, actor) {
    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) throw new Error('Order not found');

    const order = orders[index];
    order.status = ORDER_STATUS.SERVED;
    order.updatedAt = new Date().toISOString();
    orders[index] = order;
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'ORDER_SERVED',
      entityType: 'Order',
      entityId: orderId,
      details: `Food for ${order.orderNo} on Table ${order.tableNo} marked as served to guests.`
    });

    return order;
  }

  async updateOrderStatus(orderId, newStatus, reason = null, actor = { id: 'staff', name: 'Staff' }) {
    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const index = this._findOrderIndex(orders, orderId);
    if (index === -1) throw new Error('Order not found');

    const order = orders[index];
    order.status = newStatus;
    if (newStatus === ORDER_STATUS.CANCELLED) {
      order.cancellationReason = reason || 'Cancelled by staff';
    } else if (newStatus === ORDER_STATUS.REJECTED) {
      order.rejectionReason = reason || 'Rejected by staff';
    }
    order.updatedAt = new Date().toISOString();
    orders[index] = order;
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);

    if (order.tableId) {
      if (newStatus === ORDER_STATUS.COMPLETED || newStatus === ORDER_STATUS.CANCELLED || newStatus === ORDER_STATUS.REJECTED) {
        await tableRepository.releaseTable(order.tableId, actor);
      } else {
        await tableRepository.updateOperationalStatus(order.tableId, newStatus, order.id, actor);
      }
    }

    if (newStatus === ORDER_STATUS.SERVED) {
      const kots = storageAdapter.getItem(STORAGE_KEYS.KOTS) || [];
      let kotsChanged = false;
      kots.forEach((k) => {
        if (k.orderId === order.id && k.status !== 'CANCELLED' && k.status !== 'SERVED') {
          k.status = 'SERVED';
          k.updatedAt = new Date().toISOString();
          kotsChanged = true;
        }
      });
      if (kotsChanged) {
        storageAdapter.setItem(STORAGE_KEYS.KOTS, kots);
      }
    }

    return order;
  }

  async getOrderHistory(filters = {}) {
    const rawOrders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const categories = storageAdapter.getItem(STORAGE_KEYS.CATEGORIES) || [];
    const products = storageAdapter.getItem(STORAGE_KEYS.PRODUCTS) || [];
    const customers = storageAdapter.getItem(STORAGE_KEYS.CUSTOMERS) || [];
    const bills = storageAdapter.getItem(STORAGE_KEYS.BILLS) || [];

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const productMap = new Map(products.map((p) => [p.id, p]));
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const billByOrderId = new Map(bills.map((b) => [b.orderId, b]));

    let start = filters.dateFrom || filters.startDate;
    let end = filters.dateTo || filters.endDate;

    if (filters.month && String(filters.month).trim()) {
      const match = /^(\d{4})-(\d{1,2})$/.exec(String(filters.month).trim());
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

    const processedOrders = [];
    for (const order of rawOrders) {
      const ordTime = new Date(order.createdAt).getTime();
      if (start && ordTime < new Date(start).getTime()) continue;
      if (end && ordTime > new Date(end).getTime()) continue;

      if (filters.status && filters.status !== 'ALL') {
        if (filters.status === 'COMPLETED_PAID' || filters.status === 'COMPLETED') {
          if (order.status !== ORDER_STATUS.COMPLETED && order.status !== 'PAID') continue;
        } else if (filters.status === 'BILLING' || filters.status === 'BILL_PENDING') {
          if (order.status !== ORDER_STATUS.BILLING && order.status !== 'BILL_PENDING') continue;
        } else if (filters.status === 'HOLD' || filters.status === 'DRAFT') {
          if (order.status !== ORDER_STATUS.HOLD && order.status !== ORDER_STATUS.DRAFT) continue;
        } else if (filters.status === 'ACTIVE') {
          if (
            order.status === ORDER_STATUS.COMPLETED ||
            order.status === ORDER_STATUS.CANCELLED ||
            order.status === ORDER_STATUS.REJECTED
          ) continue;
        } else if (filters.status === 'CANCELLED') {
          if (order.status !== ORDER_STATUS.CANCELLED) continue;
        } else if (order.status !== filters.status) {
          continue;
        }
      }

      const linkedBill = billByOrderId.get(order.id);
      let customer = null;
      const custId = order.customerId || linkedBill?.customerId;
      if (custId && customerMap.has(custId)) {
        customer = customerMap.get(custId);
      } else if (linkedBill?.customerName) {
        customer = {
          id: linkedBill.customerId || null,
          name: linkedBill.customerName,
          mobile: linkedBill.customerMobile || '',
        };
      }

      if (filters.customerId && filters.customerId !== 'ALL') {
        if (filters.customerId === 'WALK_IN' || filters.customerId === 'walk-in') {
          if (customer) continue;
        } else {
          if (!customer || String(customer.id) !== String(filters.customerId)) {
            continue;
          }
        }
      }

      const enrichedItems = (order.items || []).map((it) => {
        let catId = it.categoryId;
        let catName = it.categoryName;
        if (!catId && it.productId) {
          const prod = productMap.get(it.productId);
          if (prod) {
            catId = prod.categoryId || null;
          }
        }
        if (catId && !catName) {
          catName = categoryMap.get(catId) || 'General';
        }
        const unitPrice = Number(it.unitPrice !== undefined ? it.unitPrice : it.price || 0);
        const qty = Number(it.quantity || 1);
        return {
          ...it,
          categoryId: catId || 'uncategorized',
          categoryName: catName || 'General',
          unitPrice,
          subtotal: Number(it.lineSubtotal || it.lineTotal || (qty * unitPrice)),
        };
      });

      if (filters.categoryId && filters.categoryId !== 'ALL') {
        const hasCategory = enrichedItems.some(
          (it) => String(it.categoryId) === String(filters.categoryId) && it.status !== 'CANCELLED'
        );
        if (!hasCategory) continue;
      }

      if (filters.search && String(filters.search).trim()) {
        const q = String(filters.search).trim().toLowerCase();
        const orderNo = String(order.orderNo || '').toLowerCase();
        const tableNo = String(order.tableNo || '').toLowerCase();
        const captain = String(order.captainName || '').toLowerCase();
        const custName = String(customer?.name || '').toLowerCase();
        const custPhone = String(customer?.mobile || '').toLowerCase();
        const dishMatch = enrichedItems.some((it) =>
          String(it.name || it.productName || '').toLowerCase().includes(q)
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

      const subtotal = Number(order.subtotal || 0);
      const grandTotal = Number(linkedBill?.grandTotal !== undefined ? linkedBill.grandTotal : (order.grandTotal || subtotal));
      const taxTotal = Number(linkedBill?.taxAmount !== undefined ? linkedBill.taxAmount : (order.taxTotal || 0));
      const discountAmount = Number(linkedBill?.discountAmount !== undefined ? linkedBill.discountAmount : (order.discountAmount || 0));

      processedOrders.push({
        ...order,
        customer,
        bill: linkedBill,
        items: enrichedItems,
        subtotal,
        taxTotal,
        discountAmount,
        grandTotal,
      });
    }

    processedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let totalSales = 0;
    let totalSubtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalItemsSold = 0;

    const categoryStatsMap = new Map();
    const dailyStatsMap = new Map();

    for (const ord of processedOrders) {
      const isCancelled = ord.status === ORDER_STATUS.CANCELLED || ord.status === ORDER_STATUS.REJECTED;

      if (!isCancelled) {
        totalSales += ord.grandTotal;
        totalSubtotal += ord.subtotal;
        totalTax += ord.taxTotal;
        totalDiscount += ord.discountAmount;
      }

      const day = String(ord.createdAt || '').slice(0, 10) || 'unknown';
      const dayAcc = dailyStatsMap.get(day) || {
        date: day,
        ordersCount: 0,
        sales: 0,
        itemsCount: 0,
      };
      dayAcc.ordersCount += 1;
      if (!isCancelled) {
        dayAcc.sales += ord.grandTotal;
      }

      for (const it of ord.items || []) {
        if (it.status === 'CANCELLED') continue;
        const qty = Number(it.quantity || 1);
        const lineTotal = Number(it.subtotal || (qty * (it.unitPrice || 0)));

        if (!isCancelled) {
          totalItemsSold += qty;
          dayAcc.itemsCount += qty;

          const catId = it.categoryId || 'uncategorized';
          const catName = it.categoryName || 'General';
          const catAcc = categoryStatsMap.get(catId) || {
            categoryId: catId,
            categoryName: catName,
            quantity: 0,
            revenue: 0,
          };
          catAcc.quantity += qty;
          catAcc.revenue += lineTotal;
          categoryStatsMap.set(catId, catAcc);
        }
      }

      dailyStatsMap.set(day, dayAcc);
    }

    const categoryBreakdown = [...categoryStatsMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .map((c) => ({
        ...c,
        revenue: Math.round(c.revenue * 100) / 100,
        percentage: totalSales > 0 ? Number(((c.revenue / totalSales) * 100).toFixed(1)) : 0,
      }));

    const dailyBreakdown = [...dailyStatsMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        sales: Math.round(d.sales * 100) / 100,
      }));

    const totalOrders = processedOrders.length;
    const validOrdersCount = processedOrders.filter(
      (o) => o.status !== ORDER_STATUS.CANCELLED && o.status !== ORDER_STATUS.REJECTED
    ).length;

    const averageOrderValue = validOrdersCount > 0
      ? Math.round((totalSales / validOrdersCount) * 100) / 100
      : 0;

    const pageNum = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(filters.limit, 10) || 50, 1);
    const totalPages = Math.ceil(totalOrders / limitNum) || 1;
    const paginatedOrders = processedOrders.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return {
      summary: {
        totalOrders,
        validOrdersCount,
        totalSales: Math.round(totalSales * 100) / 100,
        totalSubtotal: Math.round(totalSubtotal * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        totalItemsSold,
        averageOrderValue,
        dateFrom: start,
        dateTo: end,
      },
      categoryBreakdown,
      dailyBreakdown,
      orders: paginatedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalOrders,
        pages: totalPages,
      },
    };
  }
}

export const orderLocalRepository = new OrderLocalRepository();
