import { apiClient } from '../../api/apiClient.js';
import { APP_CONFIG } from '../../../config/appConfig.js';

class KOTApiRepository {
  normalizeKOT(kot) {
    if (!kot) return null;

    const items = (kot.items || []).map((it) => ({
      productId: it.productId,
      name: it.productName || it.name || '',
      productName: it.productName || it.name || '',
      quantity: Number(it.quantity) || 1,
      note: it.note || it.notes || '',
      notes: it.notes || it.note || '',
      station: it.station || kot.kitchenStation || 'Main Kitchen',
      changeType: it.changeType || 'ADD'
    }));

    const kotNo = kot.kotNumber || kot.kotNo || '';
    const orderNo = kot.orderNumber || kot.orderNo || '';
    const tableNo = kot.tableNumber || kot.tableNo || '';
    const station = kot.kitchenStation || kot.station || 'Main Kitchen';
    const notes = kot.notes || kot.modificationReason || '';

    return {
      id: kot.id || kot._id,
      _id: kot.id || kot._id,
      kotNo,
      kotNumber: kotNo,
      orderId: kot.orderId,
      orderNo,
      orderNumber: orderNo,
      branchId: kot.branchId,
      tableId: kot.tableId,
      tableNo,
      tableNumber: tableNo,
      captainId: kot.captainId,
      captainName: kot.captainName || '',
      revision: Number(kot.revision) || 1,
      type: kot.type || 'NEW',
      status: kot.status || 'NEW',
      station,
      kitchenStation: station,
      items,
      modificationReason: kot.modificationReason || notes,
      notes,
      orderStatus: kot.orderStatus || null,
      isOrderCompleted: Boolean(kot.isOrderCompleted),
      printStatus: (kot.printStatus || 'PENDING').toLowerCase(),
      createdAt: kot.createdAt,
      updatedAt: kot.updatedAt
    };
  }

  async getKOTs(filters = {}) {
    const params = {
      branchId: filters.branchId || APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main',
      limit: 100
    };

    if (filters.station && filters.station !== 'ALL' && filters.station !== 'All Stations') {
      params.kitchenStation = filters.station;
    }

    if (filters.status) {
      params.status = filters.status;
    }

    if (filters.orderId) {
      params.orderId = filters.orderId;
    }

    const res = await apiClient.get('/kots', { params });
    const rawList = Array.isArray(res) ? res : (res?.items || []);
    let list = rawList.map((k) => this.normalizeKOT(k));

    if (filters.tableId) {
      list = list.filter((k) => k.tableId === filters.tableId);
    }

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getKOTById(id) {
    if (!id) return null;
    const res = await apiClient.get(`/kots/${id}`);
    return this.normalizeKOT(res);
  }

  async createKOT(kotData) {
    // In Django backend architecture, KOTs are issued via Order Confirmation
    // or Order Modification endpoints. If invoked manually, fallback gracefully.
    return {
      id: `kot-${Date.now()}`,
      kotNo: `KOT-${Date.now()}`,
      orderId: kotData.order?.id,
      ...kotData
    };
  }

  async updateKOTStatus(kotId, newStatus, actor = { id: 'kitchen', name: 'Kitchen Staff' }) {
    const payload = {
      status: newStatus,
      notes: actor?.name ? `Updated by ${actor.name}` : ''
    };

    const res = await apiClient.post(`/kots/${kotId}/status`, payload);
    return this.normalizeKOT(res);
  }

  async getPrintPayload(kotId) {
    return await apiClient.get(`/kots/${kotId}/print`);
  }

  async updatePrintStatus(kotId, status) {
    const backendStatus = String(status).toUpperCase();
    const res = await apiClient.post(`/kots/${kotId}/print-status`, {
      printStatus: backendStatus
    });
    return this.normalizeKOT(res);
  }
}

export const kotApiRepository = new KOTApiRepository();
