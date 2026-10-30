import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { TABLE_STATUS } from '../../../constants/tableStatus.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

class TableLocalRepository {
  async getTables(branchId = 'branch-001', areaId = null) {
    const tables = storageAdapter.getItem(STORAGE_KEYS.TABLES) || [];
    let list = [...tables];

    if (areaId) {
      list = list.filter((t) => t.areaId === areaId);
    }

    return list.sort((a, b) => a.tableNo.localeCompare(b.tableNo, undefined, { numeric: true }));
  }

  async getTableById(id) {
    const tables = storageAdapter.getItem(STORAGE_KEYS.TABLES) || [];
    return tables.find((t) => t.id === id) || null;
  }

  async createTable(tableData, actor = { id: 'admin', name: 'Admin' }) {
    const tables = storageAdapter.getItem(STORAGE_KEYS.TABLES) || [];

    // Check duplicate table number in area/branch
    const duplicate = tables.some(
      (t) => t.tableNo.trim() === tableData.tableNo.trim() && t.areaId === tableData.areaId
    );
    if (duplicate) {
      throw new Error(`Table number "${tableData.tableNo}" already exists in this area.`);
    }

    const newTable = {
      id: `tbl-${Date.now()}`,
      tableNo: tableData.tableNo.trim(),
      areaId: tableData.areaId,
      capacity: Number(tableData.capacity) || 4,
      status: TABLE_STATUS.AVAILABLE,
      isActive: true,
      activeOrderId: null,
      createdAt: new Date().toISOString()
    };

    tables.push(newTable);
    storageAdapter.setItem(STORAGE_KEYS.TABLES, tables);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'TABLE_CREATED',
      entityType: 'Table',
      entityId: newTable.id,
      details: `Created Table ${newTable.tableNo} (Capacity: ${newTable.capacity} pax).`
    });

    return newTable;
  }

  async updateTable(id, tableData, actor = { id: 'admin', name: 'Admin' }) {
    const tables = storageAdapter.getItem(STORAGE_KEYS.TABLES) || [];
    const index = tables.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error('Table not found.');
    }

    if (tableData.tableNo) {
      const duplicate = tables.find(
        (t) =>
          t.id !== id &&
          t.tableNo.trim() === tableData.tableNo.trim() &&
          t.areaId === (tableData.areaId || tables[index].areaId)
      );
      if (duplicate) {
        throw new Error(`Table number "${tableData.tableNo}" already exists in this area.`);
      }
    }

    tables[index] = {
      ...tables[index],
      tableNo: tableData.tableNo?.trim() || tables[index].tableNo,
      areaId: tableData.areaId || tables[index].areaId,
      capacity: tableData.capacity !== undefined ? Number(tableData.capacity) : tables[index].capacity,
      updatedAt: new Date().toISOString()
    };

    storageAdapter.setItem(STORAGE_KEYS.TABLES, tables);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'TABLE_UPDATED',
      entityType: 'Table',
      entityId: id,
      details: `Updated details for Table ${tables[index].tableNo}.`
    });

    return tables[index];
  }

  async toggleTableActive(id, actor = { id: 'admin', name: 'Admin' }) {
    const tables = storageAdapter.getItem(STORAGE_KEYS.TABLES) || [];
    const index = tables.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error('Table not found.');
    }

    // Don't deactivate if table is occupied
    if (tables[index].status !== TABLE_STATUS.AVAILABLE && tables[index].isActive) {
      throw new Error('Cannot deactivate table with active dining or pending order.');
    }

    tables[index].isActive = !tables[index].isActive;
    tables[index].updatedAt = new Date().toISOString();
    storageAdapter.setItem(STORAGE_KEYS.TABLES, tables);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: tables[index].isActive ? 'TABLE_ACTIVATED' : 'TABLE_DEACTIVATED',
      entityType: 'Table',
      entityId: id,
      details: `Table ${tables[index].tableNo} was ${tables[index].isActive ? 'activated' : 'deactivated'}.`
    });

    return tables[index];
  }

  async updateOperationalStatus(id, newStatus, activeOrderId = null, actor = { id: 'system', name: 'System' }) {
    const tables = storageAdapter.getItem(STORAGE_KEYS.TABLES) || [];
    const index = tables.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error('Table not found.');
    }

    const oldStatus = tables[index].status;
    tables[index].status = newStatus;
    tables[index].activeOrderId = activeOrderId;
    tables[index].currentOrderId = activeOrderId;
    tables[index].updatedAt = new Date().toISOString();

    storageAdapter.setItem(STORAGE_KEYS.TABLES, tables);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'TABLE_STATUS_CHANGED',
      entityType: 'Table',
      entityId: id,
      details: `Table ${tables[index].tableNo} status changed from ${oldStatus} to ${newStatus}.`
    });

    return tables[index];
  }

  async updateTableStatus(id, newStatus, activeOrderId = null, actor = { id: 'system', name: 'System' }) {
    return this.updateOperationalStatus(id, newStatus, activeOrderId, actor);
  }

  async releaseTable(id, actor = { id: 'system', name: 'System' }) {
    return this.updateOperationalStatus(id, TABLE_STATUS.AVAILABLE, null, actor);
  }

  async transferTable({ fromTableId, toTableId, reason = '', actor = { id: 'staff', name: 'Staff' } }) {
    if (!fromTableId || !toTableId) {
      throw new Error('Both source and destination tables are required.');
    }
    if (fromTableId === toTableId) {
      throw new Error('Destination table cannot be the same as source table.');
    }

    const tables = storageAdapter.getItem(STORAGE_KEYS.TABLES) || [];
    const fromIdx = tables.findIndex((t) => t.id === fromTableId);
    const toIdx = tables.findIndex((t) => t.id === toTableId);

    if (fromIdx === -1 || toIdx === -1) {
      throw new Error('One or both tables not found.');
    }

    const fromTable = tables[fromIdx];
    const toTable = tables[toIdx];

    if (toTable.status !== TABLE_STATUS.AVAILABLE) {
      throw new Error(`Destination Table ${toTable.tableNo} is currently occupied (${toTable.status}).`);
    }

    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const ordIdx = orders.findIndex(
      (o) =>
        o.tableId === fromTableId &&
        o.status !== 'COMPLETED' &&
        o.status !== 'CANCELLED' &&
        o.status !== 'REJECTED'
    );

    if (ordIdx === -1) {
      throw new Error(`No active order found on Table ${fromTable.tableNo} to transfer.`);
    }

    const activeOrder = orders[ordIdx];
    const previousStatus = fromTable.status;

    activeOrder.tableId = toTable.id;
    activeOrder.tableNo = toTable.tableNo;
    activeOrder.notes = activeOrder.notes
      ? `${activeOrder.notes} (Transferred from Table ${fromTable.tableNo})`
      : `Transferred from Table ${fromTable.tableNo}`;
    activeOrder.updatedAt = new Date().toISOString();
    orders[ordIdx] = activeOrder;
    storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);

    fromTable.status = TABLE_STATUS.AVAILABLE;
    fromTable.activeOrderId = null;
    fromTable.currentOrderId = null;
    fromTable.updatedAt = new Date().toISOString();

    toTable.status = previousStatus;
    toTable.activeOrderId = activeOrder.id;
    toTable.currentOrderId = activeOrder.id;
    toTable.updatedAt = new Date().toISOString();

    tables[fromIdx] = fromTable;
    tables[toIdx] = toTable;
    storageAdapter.setItem(STORAGE_KEYS.TABLES, tables);

    // Also update associated KOTs and Bills in local mode
    const kots = storageAdapter.getItem(STORAGE_KEYS.KOTS) || [];
    let kotsUpdated = false;
    kots.forEach((k) => {
      if (k.orderId === activeOrder.id) {
        k.tableId = toTable.id;
        k.tableNo = toTable.tableNo;
        k.tableNumber = toTable.tableNo;
        kotsUpdated = true;
      }
    });
    if (kotsUpdated) storageAdapter.setItem(STORAGE_KEYS.KOTS, kots);

    const bills = storageAdapter.getItem(STORAGE_KEYS.BILLS) || [];
    let billsUpdated = false;
    bills.forEach((b) => {
      if (b.orderId === activeOrder.id) {
        b.tableId = toTable.id;
        b.tableNo = toTable.tableNo;
        b.tableNumber = toTable.tableNo;
        billsUpdated = true;
      }
    });
    if (billsUpdated) storageAdapter.setItem(STORAGE_KEYS.BILLS, bills);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'TABLE_TRANSFERRED',
      entityType: 'Table',
      entityId: fromTable.id,
      details: `Shifted order ${activeOrder.orderNo || activeOrder.orderNumber || ''} from Table ${fromTable.tableNo} to Table ${toTable.tableNo}${reason ? ` (Reason: ${reason})` : ''}.`
    });

    return { order: activeOrder, fromTable, toTable };
  }

  async mergeTables({ primaryTableId, secondaryTableId, reason = '', actor = { id: 'staff', name: 'Staff' } }) {
    if (!primaryTableId || !secondaryTableId) {
      throw new Error('Both primary and secondary tables are required.');
    }
    const tables = storageAdapter.getItem(STORAGE_KEYS.TABLES) || [];
    const primIdx = tables.findIndex((t) => t.id === primaryTableId);
    const secIdx = tables.findIndex((t) => t.id === secondaryTableId);

    if (primIdx === -1 || secIdx === -1) {
      throw new Error('Table not found.');
    }

    const primaryTable = tables[primIdx];
    const secondaryTable = tables[secIdx];

    const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
    const primOrd = orders.find(
      (o) =>
        o.tableId === primaryTableId &&
        o.status !== 'COMPLETED' &&
        o.status !== 'CANCELLED' &&
        o.status !== 'REJECTED'
    );
    const secOrd = orders.find(
      (o) =>
        o.tableId === secondaryTableId &&
        o.status !== 'COMPLETED' &&
        o.status !== 'CANCELLED' &&
        o.status !== 'REJECTED'
    );

    if (!primOrd) {
      throw new Error(`Primary Table ${primaryTable.tableNo} has no active order to merge into.`);
    }

    if (secOrd) {
      primOrd.items = [...primOrd.items, ...secOrd.items];
      primOrd.subtotal = primOrd.items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
      primOrd.notes = `${primOrd.notes || ''} [Merged items from Table ${secondaryTable.tableNo}]`.trim();
      primOrd.updatedAt = new Date().toISOString();

      secOrd.status = 'CANCELLED';
      secOrd.cancellationReason = `Merged into Table ${primaryTable.tableNo}`;
      secOrd.updatedAt = new Date().toISOString();

      storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);
    }

    secondaryTable.status = TABLE_STATUS.AVAILABLE;
    secondaryTable.activeOrderId = null;
    secondaryTable.currentOrderId = null;
    secondaryTable.updatedAt = new Date().toISOString();

    tables[secIdx] = secondaryTable;
    storageAdapter.setItem(STORAGE_KEYS.TABLES, tables);

    return { primaryTable, secondaryTable, order: primOrd };
  }
}

export const tableLocalRepository = new TableLocalRepository();
