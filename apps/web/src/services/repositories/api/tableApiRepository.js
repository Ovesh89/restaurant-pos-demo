/**
 * API Table Repository
 * Connects to Django/Express REST API table endpoints (/api/v1/tables/*)
 * Integrated with central TanStack Query client for unified cross-screen caching
 */

import { apiClient, AppError } from '../../api/apiClient.js';
import { TABLE_STATUS } from '../../../constants/tableStatus.js';
import { queryClient } from '../../../config/queryClient.js';
import { queryKeys } from '../../../constants/queryKeys.js';
import { CACHE_POLICIES } from '../../../config/cachePolicies.js';
import { cacheInvalidationService } from '../../cache/cacheInvalidationService.js';

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
    const currentBranch = branchId || 'branch-main';
    return queryClient.fetchQuery({
      queryKey: queryKeys.tables(currentBranch, { areaId: areaId || null }),
      queryFn: async () => {
        let query = `?branchId=${currentBranch}`;
        if (areaId) query += `&areaId=${areaId}`;

        const tables = await apiClient.get(`/tables${query}`);
        const items = Array.isArray(tables) ? tables : [];
        return items
          .map((t) => this.normalizeTable(t))
          .sort((a, b) => a.tableNo.localeCompare(b.tableNo, undefined, { numeric: true }));
      },
      staleTime: CACHE_POLICIES.TABLES.staleTime,
      gcTime: CACHE_POLICIES.TABLES.gcTime,
    });
  }

  async getTableById(id) {
    return queryClient.fetchQuery({
      queryKey: queryKeys.table(id),
      queryFn: async () => {
        const table = await apiClient.get(`/tables/${id}`);
        return this.normalizeTable(table);
      },
      staleTime: CACHE_POLICIES.TABLES.staleTime,
      gcTime: CACHE_POLICIES.TABLES.gcTime,
    });
  }

  async createTable(tableData) {
    const tableNum = String(tableData.tableNo || tableData.tableNumber || '').trim();
    const branchId = tableData.branchId || 'branch-main';
    const payload = {
      branchId,
      areaId: tableData.areaId,
      tableNumber: tableNum,
      capacity: Number(tableData.capacity) || 4,
      isActive: true
    };

    const created = await apiClient.post('/tables', payload);
    const normalized = this.normalizeTable(created);
    cacheInvalidationService.invalidateTables(branchId);
    return normalized;
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
    const normalized = this.normalizeTable(updated);
    cacheInvalidationService.invalidateTables(tableData.branchId || 'branch-main');
    return normalized;
  }

  async toggleTableActive(id) {
    const table = await this.getTableById(id);
    const updated = await apiClient.patch(`/tables/${id}`, {
      isActive: !table.isActive
    });
    const normalized = this.normalizeTable(updated);
    cacheInvalidationService.invalidateTables('branch-main');
    return normalized;
  }

  async updateOperationalStatus(id, newStatus, activeOrderId = null) {
    // In backend, table statuses are managed authoritatively via order & KOT endpoints.
    // Invalidate local cache and return fresh status:
    cacheInvalidationService.invalidateTables('branch-main');
    const table = await this.getTableById(id);
    return table;
  }

  async updateTableStatus(id, newStatus, activeOrderId = null) {
    return this.updateOperationalStatus(id, newStatus, activeOrderId);
  }

  async releaseTable(id) {
    return this.updateOperationalStatus(id, TABLE_STATUS.AVAILABLE, null);
  }

  async transferTable({ fromTableId, toTableId, reason = '' } = {}) {
    const payload = {
      fromTableId,
      toTableId,
      reason: reason || ''
    };
    const result = await apiClient.post('/tables/transfer', payload);
    cacheInvalidationService.invalidateTables('branch-main');
    cacheInvalidationService.invalidateOrders('branch-main');
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
