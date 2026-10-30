/**
 * API Table Repository
 * Connects to Django REST API table endpoints (/api/v1/tables/*)
 */

import { apiClient, AppError } from '../../api/apiClient.js';
import { TABLE_STATUS } from '../../../constants/tableStatus.js';

class TableApiRepository {
  normalizeTable(table) {
    if (!table) return null;
    const num = String(table.tableNumber || table.tableNo || '');
    return {
      ...table,
      id: table._id || table.id,
      tableNo: num,
      tableNumber: num,
      areaId: table.areaId,
      capacity: Number(table.capacity) || 4,
      status: table.status || TABLE_STATUS.AVAILABLE,
      activeOrderId: table.activeOrderId || null,
      currentOrderId: table.activeOrderId || null,
      isActive: table.isActive !== undefined ? table.isActive : true
    };
  }

  async getTables(branchId = 'branch-main', areaId = null) {
    let query = `?branchId=${branchId || 'branch-main'}`;
    if (areaId) query += `&areaId=${areaId}`;

    const tables = await apiClient.get(`/tables${query}`);
    const items = Array.isArray(tables) ? tables : [];
    return items
      .map((t) => this.normalizeTable(t))
      .sort((a, b) => a.tableNo.localeCompare(b.tableNo, undefined, { numeric: true }));
  }

  async getTableById(id) {
    const table = await apiClient.get(`/tables/${id}`);
    return this.normalizeTable(table);
  }

  async createTable(tableData) {
    const tableNum = String(tableData.tableNo || tableData.tableNumber || '').trim();
    const payload = {
      branchId: tableData.branchId || 'branch-main',
      areaId: tableData.areaId,
      tableNumber: tableNum,
      capacity: Number(tableData.capacity) || 4,
      isActive: true
    };

    const created = await apiClient.post('/tables', payload);
    return this.normalizeTable(created);
  }

  async updateTable(id, tableData) {
    const payload = {};
    if (tableData.tableNo || tableData.tableNumber) {
      payload.tableNumber = String(tableData.tableNo || tableData.tableNumber).trim();
    }
    if (tableData.areaId) payload.areaId = tableData.areaId;
    if (tableData.capacity !== undefined) payload.capacity = Number(tableData.capacity);
    if (tableData.isActive !== undefined) payload.isActive = Boolean(tableData.isActive);

    const updated = await apiClient.patch(`/tables/${id}`, payload);
    return this.normalizeTable(updated);
  }

  async toggleTableActive(id) {
    const table = await this.getTableById(id);
    const updated = await apiClient.patch(`/tables/${id}`, {
      isActive: !table.isActive
    });
    return this.normalizeTable(updated);
  }

  async updateOperationalStatus(id, newStatus, activeOrderId = null) {
    // In backend, table statuses are managed authoritatively via order & KOT endpoints.
    // Fetch and return the latest canonical table status:
    const table = await this.getTableById(id);
    return table;
  }

  async transferTable({ fromTableId, toTableId, reason = '' } = {}) {
    const payload = {
      fromTableId,
      toTableId,
      reason: reason || ''
    };
    const result = await apiClient.post('/tables/transfer', payload);
    return {
      order: result?.order,
      fromTable: this.normalizeTable(result?.fromTable),
      toTable: this.normalizeTable(result?.toTable)
    };
  }

  async mergeTables() {
    throw new AppError(
      'Table merging is currently in development and will be available in the upcoming release.',
      'FEATURE_DEFERRED'
    );
  }
}

export const tableApiRepository = new TableApiRepository();
