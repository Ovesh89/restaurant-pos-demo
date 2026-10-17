/**
 * API Audit Repository
 * Connects to Django REST API audit log endpoint (/api/v1/audit)
 */

import { apiClient } from '../../api/apiClient.js';

class AuditApiRepository {
  normalizeAuditLog(log) {
    if (!log) return null;
    return {
      ...log,
      id: log._id || log.id,
      timestamp: log.timestamp || log.createdAt || new Date().toISOString()
    };
  }

  async getAuditLogs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.action) params.append('action', filters.action);
    if (filters.actorId) params.append('actorId', filters.actorId);
    if (filters.branchId) params.append('branchId', filters.branchId);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    else if (!filters.page) params.append('limit', '100');

    const res = await apiClient.get(`/audit?${params.toString()}`);
    let items = Array.isArray(res) ? res : res?.items || [];
    items = items.map((l) => this.normalizeAuditLog(l));

    const total = Number(res?.pagination?.total ?? items.length);
    const pageNum = Number(res?.pagination?.page ?? filters.page ?? 1);
    const limitNum = Number(res?.pagination?.limit ?? filters.limit ?? items.length ?? 20);
    const totalPages = Number(res?.pagination?.totalPages ?? res?.pagination?.pages ?? Math.max(1, Math.ceil(total / (limitNum || 1))));

    items.pagination = res?.pagination || {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      pages: totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1,
    };
    items.items = items;

    return items;
  }

  async logEvent(eventData) {
    // In backend API mode, mutations automatically create immutable server-side audit logs.
    // Client-side logging returns event object to maintain contract compatibility.
    return {
      id: `audit-client-${Date.now()}`,
      ...eventData,
      timestamp: new Date().toISOString()
    };
  }
}

export const auditApiRepository = new AuditApiRepository();
