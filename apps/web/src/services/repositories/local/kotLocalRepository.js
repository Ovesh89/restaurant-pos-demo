import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { KOT_STATUS, KOT_TYPE } from '../../../constants/orderStatus.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

class KOTLocalRepository {
  async getKOTs(filters = {}) {
    const kots = storageAdapter.getItem(STORAGE_KEYS.KOTS) || [];
    let list = [...kots];

    if (filters.station && filters.station !== 'ALL') {
      list = list.filter((k) => k.station === filters.station || k.station === 'All Stations');
    }

    if (filters.status) {
      list = list.filter((k) => k.status === filters.status);
    }

    if (filters.orderId) {
      list = list.filter((k) => k.orderId === filters.orderId);
    }

    if (filters.tableId) {
      list = list.filter((k) => k.tableId === filters.tableId);
    }

    // Sort descending by creation time (or ascending for kitchen queue)
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getKOTById(id) {
    const kots = storageAdapter.getItem(STORAGE_KEYS.KOTS) || [];
    return kots.find((k) => k.id === id) || null;
  }

  async createKOT({
    order,
    items,
    type = KOT_TYPE.NEW,
    revision = 1,
    modificationReason = '',
    station = 'All Stations',
    actor = { id: 'reception', name: 'Reception' }
  }) {
    const kots = storageAdapter.getItem(STORAGE_KEYS.KOTS) || [];
    const count = kots.length + 1;
    const kotNo = `KOT-${String(count).padStart(3, '0')}`;

    const newKOT = {
      id: `kot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      kotNo,
      orderId: order.id,
      orderNo: order.orderNo,
      tableId: order.tableId,
      tableNo: order.tableNo,
      captainId: order.captainId,
      captainName: order.captainName,
      type,
      revision,
      modificationReason,
      station,
      items: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        station: i.station || 'Main Kitchen',
        notes: i.notes || ''
      })),
      status: KOT_STATUS.NEW,
      printStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    kots.unshift(newKOT);
    storageAdapter.setItem(STORAGE_KEYS.KOTS, kots);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'KOT_GENERATED',
      entityType: 'KOT',
      entityId: newKOT.id,
      details: `${newKOT.kotNo} (${type} Rev #${revision}) created for Table ${order.tableNo} with ${newKOT.items.length} dishes.`
    });

    return newKOT;
  }

  async updateKOTStatus(kotId, newStatus, actor = { id: 'kitchen', name: 'Kitchen Staff' }) {
    const kots = storageAdapter.getItem(STORAGE_KEYS.KOTS) || [];
    const index = kots.findIndex((k) => k.id === kotId);
    if (index === -1) {
      throw new Error('KOT ticket not found.');
    }

    const currentKOT = kots[index];
    const oldStatus = currentKOT.status;
    currentKOT.status = newStatus;
    currentKOT.updatedAt = new Date().toISOString();

    kots[index] = currentKOT;
    storageAdapter.setItem(STORAGE_KEYS.KOTS, kots);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'KOT_STATUS_UPDATED',
      entityType: 'KOT',
      entityId: kotId,
      details: `${currentKOT.kotNo} moved from ${oldStatus} to ${newStatus}.`
    });

    if (newStatus === 'SERVED' && currentKOT.orderId) {
      const orderKots = kots.filter((k) => k.orderId === currentKOT.orderId && k.status !== 'CANCELLED');
      const allServed = orderKots.length > 0 && orderKots.every((k) => k.status === 'SERVED');
      if (allServed) {
        const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
        const ordIdx = orders.findIndex((o) => o.id === currentKOT.orderId);
        if (ordIdx !== -1) {
          orders[ordIdx].status = 'SERVED';
          orders[ordIdx].updatedAt = new Date().toISOString();
          storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);
        }
      }
    }

    return currentKOT;
  }

  async cancelKOTsByOrderId(orderId, reason = 'Order cancelled or rejected') {
    const kots = storageAdapter.getItem(STORAGE_KEYS.KOTS) || [];
    let modified = false;
    const targetIdStr = String(orderId);
    const updatedKots = kots.map((k) => {
      if (String(k.orderId) === targetIdStr && k.status !== KOT_STATUS.CANCELLED && k.status !== 'SERVED') {
        modified = true;
        return {
          ...k,
          status: KOT_STATUS.CANCELLED,
          notes: `CANCELLED: ${reason}`,
          updatedAt: new Date().toISOString()
        };
      }
      return k;
    });
    if (modified) {
      storageAdapter.setItem(STORAGE_KEYS.KOTS, updatedKots);
    }
  }
}

export const kotLocalRepository = new KOTLocalRepository();
