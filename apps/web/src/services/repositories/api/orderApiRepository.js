import { apiClient } from '../../api/apiClient.js';
import { APP_CONFIG } from '../../../config/appConfig.js';
import { ORDER_STATUS } from '../../../constants/orderStatus.js';
import { kotApiRepository } from './kotApiRepository.js';

class OrderApiRepository {
  normalizeOrder(order) {
    if (!order) return null;

    const items = (order.items || []).map((it, idx) => {
      const qty = Number(it.quantity) || 1;
      const unitPrice = Number(it.unitPrice !== undefined ? it.unitPrice : it.price) || 0;
      const taxRate = Number(
        it.taxConfig?.rate !== undefined
          ? it.taxConfig.rate
          : it.taxRate !== undefined
          ? it.taxRate
          : 5
      );

      return {
        id: it.id || it._id || `line-${idx}`,
        lineId: it.lineId || it._id || it.id || `line-${idx}`,
        productId: it.productId,
        name: it.productName || it.name || '',
        productName: it.productName || it.name || '',
        code: it.code || '',
        quantity: qty,
        unitPrice,
        price: unitPrice,
        taxRate,
        station: it.station || 'Main Kitchen',
        note: it.note || it.notes || '',
        notes: it.notes || it.note || '',
        status: it.status || 'ACTIVE',
        subtotal: qty * unitPrice
      };
    });

    const activeItems = items.filter((i) => i.status !== 'CANCELLED');
    const calculatedSubtotal = activeItems.reduce((acc, i) => acc + i.subtotal, 0);
    const subtotal = order.financials?.subtotal !== undefined
      ? Number(order.financials.subtotal)
      : calculatedSubtotal;
    const orderNo = order.orderNumber || order.orderNo || '';
    const tableNo = order.tableNumber || order.tableNo || '';
    const kots = (order.kots || []).map((k) => kotApiRepository.normalizeKOT(k));

    return {
      id: order.id || order._id,
      _id: order.id || order._id,
      orderNo,
      orderNumber: orderNo,
      branchId: order.branchId || APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main',
      tableId: order.tableId,
      tableNo,
      tableNumber: tableNo,
      captainId: order.captainId,
      captainName: order.captainName || 'Staff',
      customerId: order.customerId || null,
      items,
      subtotal,
      notes: order.notes || '',
      status: order.status || ORDER_STATUS.DRAFT,
      orderType: order.orderType || (order.tableId ? 'DINE_IN' : 'TAKEAWAY'),
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      onlineOrderRef: order.onlineOrderRef || '',
      rejectionReason: order.rejectionReason || '',
      cancellationReason: order.cancellationReason || '',
      kotRevision: Number(order.kotRevision) || (kots.length > 0 ? kots.length : 1),
      kots,
      confirmedBy: order.confirmedBy || '',
      confirmedAt: order.confirmedAt || null,
      submittedAt: order.submittedAt || null,
      servedAt: order.servedAt || null,
      completedAt: order.completedAt || null,
      cancelledAt: order.cancelledAt || null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }


  async getOrders(filters = {}) {
    const params = {
      branchId: filters.branchId || APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main',
    };

    if (filters.page) {
      params.page = filters.page;
    }
    if (filters.limit) {
      params.limit = filters.limit;
    } else if (!filters.page) {
      params.limit = 100;
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        params.status = filters.status.join(',');
      } else {
        params.status = filters.status;
      }
    }

    if (filters.tableId) {
      params.tableId = filters.tableId;
    }

    if (filters.captainId) {
      params.captainId = filters.captainId;
    }

    if (filters.search && String(filters.search).trim()) {
      params.search = String(filters.search).trim();
    }

    const res = await apiClient.get('/orders', { params });
    const rawList = Array.isArray(res) ? res : (res?.items || []);
    let list = rawList.map((o) => this.normalizeOrder(o));

    const total = Number(res?.pagination?.total ?? list.length);
    const pageNum = Number(res?.pagination?.page ?? filters.page ?? 1);
    const limitNum = Number(res?.pagination?.limit ?? filters.limit ?? list.length ?? 20);
    const totalPages = Number(res?.pagination?.totalPages ?? res?.pagination?.pages ?? Math.max(1, Math.ceil(total / (limitNum || 1))));

    list.pagination = res?.pagination || {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      pages: totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1,
    };
    list.items = list;

    return list;
  }

  async getOrderById(id) {
    if (!id) return null;
    const res = await apiClient.get(`/orders/${id}`);
    return this.normalizeOrder(res);
  }

  async getActiveOrderByTable(tableId) {
    if (!tableId) return null;
    const orders = await this.getOrders({ tableId });
    return (
      orders.find(
        (o) =>
          o.status !== ORDER_STATUS.COMPLETED &&
          o.status !== ORDER_STATUS.CANCELLED &&
          o.status !== ORDER_STATUS.REJECTED
      ) || null
    );
  }

  async createOrder({
    table,
    tableId,
    tableNo,
    orderType = 'DINE_IN',
    customerName = '',
    customerPhone = '',
    onlineOrderRef = '',
    captain,
    captainId,
    captainName,
    items,
    notes = '',
    isDraft = false,
    autoApprove = false,
  }) {
    if (!items || items.length === 0) {
      throw new Error('Order must contain at least one menu dish.');
    }

    const isTableOrder = orderType === 'DINE_IN';
    const tId = isTableOrder ? (table?.id || tableId) : null;
    const branchId = table?.branchId || APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main';

    let resolvedTableNumber = table?.tableNo || tableNo || '';
    if (!isTableOrder) {
      if (orderType === 'TAKEAWAY') resolvedTableNumber = 'Take Away';
      else if (orderType === 'ZOMATO') resolvedTableNumber = onlineOrderRef ? `Zomato #${onlineOrderRef}` : 'Zomato';
      else if (orderType === 'SWIGGY') resolvedTableNumber = onlineOrderRef ? `Swiggy #${onlineOrderRef}` : 'Swiggy';
      else resolvedTableNumber = 'Online';
    }

    const payload = {
      branchId,
      orderType,
      tableId: tId,
      tableNumber: resolvedTableNumber,
      customerName,
      customerPhone,
      onlineOrderRef,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: Number(i.quantity) || 1,
        note: i.notes?.trim() || i.note?.trim() || (notes ? notes.trim() : '')
      })),
      held: Boolean(isDraft),
      submitImmediately: !isDraft,
      autoApprove: Boolean(autoApprove),
    };

    const res = await apiClient.post('/orders', payload);
    return this.normalizeOrder(res);
  }


  async submitOrder(orderId, actor) {
    const res = await apiClient.post(`/orders/${orderId}/submit`);
    return this.normalizeOrder(res);
  }

  async confirmOrder(orderId, actor = { id: 'reception', name: 'Reception Staff' }) {
    const res = await apiClient.post(`/orders/${orderId}/confirm`);
    const order = this.normalizeOrder(res?.order || res);
    const kotTicket = res?.kot ? kotApiRepository.normalizeKOT(res.kot) : null;
    return { order, kotTicket };
  }

  async activateOrder(orderId, actor = { id: 'staff', name: 'Staff' }) {
    return this.confirmOrder(orderId, actor);
  }

  async rejectOrder(orderId, reason, actor = { id: 'reception', name: 'Reception Staff' }) {
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory rejection reason must be specified.');
    }

    const res = await apiClient.post(`/orders/${orderId}/reject`, {
      reason: reason.trim()
    });
    return this.normalizeOrder(res);
  }

  async updateOrderStatus(orderId, status, reason = null) {
    const res = await apiClient.post(`/orders/${orderId}/status`, {
      status,
      reason: reason ? reason.trim() : undefined,
    });
    return this.normalizeOrder(res);
  }

  async modifyOrderItems(orderId, updatedItems, modificationReason, actor) {
    if (!modificationReason || !modificationReason.trim()) {
      throw new Error('Mandatory reason required to modify confirmed order items.');
    }

    const currentOrder = await this.getOrderById(orderId);
    if (!currentOrder) {
      throw new Error('Order not found.');
    }
    if (currentOrder.bill && String(actor?.role || '').toLowerCase() === 'captain') {
      throw new Error('Cannot modify items: A bill has already been generated. Captains are not permitted to alter or modify bills.');
    }
    const targetOrderId = currentOrder.id || currentOrder._id || orderId;
    const prevItems = currentOrder?.items || [];

    // 1. Detect removed items and cancel them on the server
    const removedItems = prevItems.filter(
      (pi) => (pi.status || 'ACTIVE') !== 'CANCELLED' && !updatedItems.some((ui) => ui.productId === pi.productId)
    );
    for (const rem of removedItems) {
      await apiClient.post(`/orders/${targetOrderId}/cancel-item`, {
        itemId: rem.id || rem._id,
        reason: modificationReason.trim(),
      });
    }

    // 2. Detect added items or increased quantities
    let itemsToAdd = [];
    const hasExistingProducts = updatedItems.some((ni) =>
      prevItems.some((pi) => pi.productId === ni.productId)
    );

    if (hasExistingProducts) {
      updatedItems.forEach((newItm) => {
        const oldItm = prevItems.find((oi) => oi.productId === newItm.productId && (oi.status || 'ACTIVE') !== 'CANCELLED');
        if (!oldItm) {
          itemsToAdd.push({
            productId: newItm.productId,
            quantity: Number(newItm.quantity) || 1,
            note: newItm.notes || newItm.note || ''
          });
        } else if (newItm.quantity > oldItm.quantity) {
          itemsToAdd.push({
            productId: newItm.productId,
            quantity: newItm.quantity - oldItm.quantity,
            note: newItm.notes || newItm.note || ''
          });
        }
      });
    } else {
      itemsToAdd = updatedItems.map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity) || 1,
        note: it.notes || it.note || ''
      }));
    }

    let deltaKOT = null;
    if (itemsToAdd.length > 0) {
      const res = await apiClient.post(`/orders/${targetOrderId}/items`, {
        items: itemsToAdd,
        reason: modificationReason.trim()
      });
      deltaKOT = res?.modificationKot
        ? kotApiRepository.normalizeKOT(res.modificationKot)
        : null;
    }

    const freshOrder = await this.getOrderById(targetOrderId);
    return { order: freshOrder, deltaKOT };
  }

  async cancelOrderItem(orderId, itemId, reason) {
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory cancellation reason is required.');
    }
    const res = await apiClient.post(`/orders/${orderId}/cancel-item`, {
      itemId,
      reason: reason.trim(),
    });
    return this.normalizeOrder(res?.order || res);
  }


  async cancelOrder(orderId, reason, actor) {
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory cancellation reason is required.');
    }

    const res = await apiClient.post(`/orders/${orderId}/cancel`, {
      reason: reason.trim()
    });
    return this.normalizeOrder(res);
  }

  async updateStatusFromKitchen(orderId, newKOTStatus, actor) {
    // In API mode, backend kitchen service automatically updates the order and table
    // in MongoDB. We return the fresh canonical order state.
    if (!orderId) return null;
    return await this.getOrderById(orderId);
  }

  async markAsServed(orderId, actor) {
    const kots = await kotApiRepository.getKOTs({ orderId });
    const activeKots = kots.filter((k) => k.status !== 'CANCELLED' && k.status !== 'SERVED');
    for (const kot of activeKots) {
      if (kot.status === 'NEW') {
        await kotApiRepository.updateKOTStatus(kot.id, 'PREPARING', actor);
        await kotApiRepository.updateKOTStatus(kot.id, 'READY', actor);
      } else if (kot.status === 'PREPARING') {
        await kotApiRepository.updateKOTStatus(kot.id, 'READY', actor);
      }
      await kotApiRepository.updateKOTStatus(kot.id, 'SERVED', actor);
    }
    return await this.getOrderById(orderId);
  }

  async getOrderHistory(filters = {}) {
    const params = {
      branchId: filters.branchId || APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main',
    };
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.month) params.month = filters.month;
    if (filters.customerId) params.customerId = filters.customerId;
    if (filters.categoryId) params.categoryId = filters.categoryId;
    if (filters.status) params.status = filters.status;
    if (filters.search) params.search = filters.search;
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;

    const res = await apiClient.get('/orders/history', { params });
    const rawOrders = Array.isArray(res?.orders) ? res.orders : (Array.isArray(res) ? res : []);
    const orders = rawOrders.map((o) => {
      const norm = this.normalizeOrder(o);
      return {
        ...norm,
        customer: o.customer || null,
        bill: o.bill || null,
        subtotal: Number(o.subtotal !== undefined ? o.subtotal : norm.subtotal),
        grandTotal: Number(o.grandTotal !== undefined ? o.grandTotal : norm.subtotal),
        taxTotal: Number(o.taxTotal || 0),
        discountAmount: Number(o.discountAmount || 0),
        items: (o.items || []).map((it) => ({
          ...it,
          categoryId: it.categoryId || 'uncategorized',
          categoryName: it.categoryName || 'General',
          subtotal: Number(it.lineSubtotal || it.lineTotal || (it.quantity * (it.unitPrice || it.price || 0))),
        })),
      };
    });

    return {
      summary: {
        totalOrders: Number(res?.summary?.totalOrders || orders.length),
        validOrdersCount: Number(res?.summary?.validOrdersCount || orders.length),
        totalSales: Number(res?.summary?.totalSales || 0),
        totalSubtotal: Number(res?.summary?.totalSubtotal || 0),
        totalTax: Number(res?.summary?.totalTax || 0),
        totalDiscount: Number(res?.summary?.totalDiscount || 0),
        totalItemsSold: Number(res?.summary?.totalItemsSold || 0),
        averageOrderValue: Number(res?.summary?.averageOrderValue || 0),
        dateFrom: res?.summary?.dateFrom,
        dateTo: res?.summary?.dateTo,
      },
      categoryBreakdown: Array.isArray(res?.categoryBreakdown) ? res.categoryBreakdown : [],
      dailyBreakdown: Array.isArray(res?.dailyBreakdown) ? res.dailyBreakdown : [],
      orders,
      pagination: res?.pagination || { page: 1, limit: 50, total: orders.length, pages: 1 }
    };
  }
}

export const orderApiRepository = new OrderApiRepository();
