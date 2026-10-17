import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { ORDER_STATUS, KOT_TYPE, KOT_STATUS } from '../../../constants/orderStatus.js';
import { TABLE_STATUS } from '../../../constants/tableStatus.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { kotRepository } from '../kotRepository.js';
import { tableRepository } from '../tableRepository.js';
import { auditRepository } from '../auditRepository.js';

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

    if (filters.captainId) {
      list = list.filter((o) => o.captainId === filters.captainId);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNo.toLowerCase().includes(q) ||
          o.tableNo.toLowerCase().includes(q) ||
          o.captainName.toLowerCase().includes(q)
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

  async getOrderById(id) {
    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    return orders.find((o) => o.id === id) || null;
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
    isDraft = false
  }) {
    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const count = orders.length + 1;
    const orderNo = `ORD-${String(count).padStart(3, '0')}`;

    if (!items || items.length === 0) {
      throw new Error('Order must contain at least one menu dish.');
    }

    const tableObj = table || { id: tableId, tableNo: tableNo, branchId: 'branch-001' };
    const captainObj = captain || { id: captainId || 'captain-01', name: captainName || 'Captain' };

    // Freeze captured prices for each line item
    const orderItems = items.map((i, idx) => ({
      lineId: `line-${Date.now()}-${idx}`,
      productId: i.productId,
      name: i.name,
      code: i.code || '',
      quantity: Number(i.quantity) || 1,
      unitPrice: Number(i.unitPrice !== undefined ? i.unitPrice : i.price) || 0, // CAPTURED PRICE SNAPSHOT
      taxRate: Number(i.taxRate) || 5.0,
      station: i.station || 'Main Curry',
      notes: i.notes?.trim() || ''
    }));

    const subtotal = orderItems.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);

    const initialStatus = isDraft ? ORDER_STATUS.DRAFT : ORDER_STATUS.WAITING_CONFIRMATION;

    const newOrder = {
      id: `ord-${Date.now()}`,
      orderNo,
      branchId: tableObj.branchId || 'branch-001',
      tableId: tableObj.id,
      tableNo: tableObj.tableNo,
      captainId: captainObj.id,
      captainName: captainObj.name,
      items: orderItems,
      subtotal,
      notes: notes.trim(),
      status: initialStatus,
      rejectionReason: '',
      kotRevision: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    orders.unshift(newOrder);
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);

    // Update Table status
    if (!isDraft) {
      await tableRepository.updateOperationalStatus(
        tableObj.id,
        TABLE_STATUS.OCCUPIED,
        newOrder.id,
        captainObj
      );
    }

    await auditRepository.logEvent({
      actorId: captainObj.id,
      actorName: captainObj.name,
      action: isDraft ? 'ORDER_HELD' : 'ORDER_SUBMITTED',
      entityType: 'Order',
      entityId: newOrder.id,
      details: `${newOrder.orderNo} for Table ${tableObj.tableNo} with ${orderItems.length} items (Total: ₹${subtotal}) was ${isDraft ? 'saved as draft' : 'submitted to reception'}.`
    });

    return newOrder;
  }

  /**
   * Submit an existing Draft / Hold order to Reception
   */
  async submitOrder(orderId, actor) {
    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) {
      throw new Error('Order not found.');
    }

    const order = orders[index];
    if (order.status !== ORDER_STATUS.DRAFT) {
      throw new Error(`Cannot submit order with status "${order.status}".`);
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
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) {
      throw new Error('Order not found.');
    }

    const order = orders[index];
    if (order.status !== ORDER_STATUS.WAITING_CONFIRMATION && order.status !== ORDER_STATUS.SUBMITTED) {
      throw new Error(`Order cannot be confirmed from status "${order.status}".`);
    }

    order.status = ORDER_STATUS.KOT_SENT;
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

  /**
   * Reception Rejection: Returns order with mandatory reason
   */
  async rejectOrder(orderId, reason, actor = { id: 'reception', name: 'Reception' }) {
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory rejection reason must be specified.');
    }

    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) {
      throw new Error('Order not found.');
    }

    const order = orders[index];
    order.status = ORDER_STATUS.REJECTED;
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
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) {
      throw new Error('Order not found.');
    }

    const order = orders[index];
    const previousItems = [...order.items];

    // Calculate delta items for kitchen KOT
    // Compare old items vs updated items
    const deltaItems = [];

    // Find added or increased items
    updatedItems.forEach((newItm) => {
      const oldItm = previousItems.find((oi) => oi.productId === newItm.productId);
      if (!oldItm) {
        // Entirely new dish
        deltaItems.push({
          productId: newItm.productId,
          name: newItm.name,
          quantity: `+${newItm.quantity}`,
          station: newItm.station,
          notes: newItm.notes ? `ADD NEW: ${newItm.notes}` : 'ADD NEW'
        });
      } else if (newItm.quantity > oldItm.quantity) {
        // Quantity increased
        const diff = newItm.quantity - oldItm.quantity;
        deltaItems.push({
          productId: newItm.productId,
          name: newItm.name,
          quantity: `+${diff}`,
          station: newItm.station,
          notes: newItm.notes ? `ADDITIONAL: ${newItm.notes}` : 'ADDITIONAL QTY'
        });
      } else if (newItm.quantity < oldItm.quantity) {
        // Quantity decreased
        const diff = oldItm.quantity - newItm.quantity;
        deltaItems.push({
          productId: newItm.productId,
          name: newItm.name,
          quantity: `-${diff}`,
          station: newItm.station,
          notes: 'REDUCED QTY'
        });
      }
    });

    // Find removed items
    previousItems.forEach((oldItm) => {
      const stillExists = updatedItems.some((ni) => ni.productId === oldItm.productId);
      if (!stillExists) {
        deltaItems.push({
          productId: oldItm.productId,
          name: oldItm.name,
          quantity: `-${oldItm.quantity}`,
          station: oldItm.station,
          notes: 'CANCELLED DISH'
        });
      }
    });

    // Save updated items snapshot into canonical order
    order.items = updatedItems;
    order.subtotal = updatedItems.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
    order.kotRevision = (order.kotRevision || 1) + 1;
    order.updatedAt = new Date().toISOString();

    orders[index] = order;
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);

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
   * Cancel an order with mandatory reason
   */
  async cancelOrder(orderId, reason, actor) {
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory cancellation reason is required.');
    }

    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const index = orders.findIndex((o) => o.id === orderId);
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
    const kots = await kotRepository.getKOTs({ orderId });
    for (const k of kots) {
      if (k.status !== KOT_STATUS.CANCELLED) {
        await kotRepository.updateKOTStatus(k.id, KOT_STATUS.CANCELLED, actor);
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
        if (filters.status === 'COMPLETED_PAID') {
          if (order.status !== ORDER_STATUS.COMPLETED && order.status !== 'PAID') continue;
        } else if (filters.status === 'ACTIVE') {
          if (
            order.status === ORDER_STATUS.COMPLETED ||
            order.status === ORDER_STATUS.CANCELLED ||
            order.status === ORDER_STATUS.REJECTED
          ) continue;
        } else if (filters.status === 'CANCELLED') {
          if (order.status !== ORDER_STATUS.CANCELLED && order.status !== ORDER_STATUS.REJECTED) continue;
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
