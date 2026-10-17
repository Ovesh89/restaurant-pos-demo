import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';

class AuditLocalRepository {
  async getAuditLogs(filters = {}) {
    const logs = storageAdapter.getItem(STORAGE_KEYS.AUDIT_LOGS) || [];
    let filtered = [...logs];

    if (filters.action) {
      filtered = filtered.filter((log) => log.action === filters.action);
    }

    if (filters.actorId) {
      filtered = filtered.filter((log) => log.actorId === filters.actorId);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.actorName?.toLowerCase().includes(q) ||
          log.action?.toLowerCase().includes(q) ||
          log.entityType?.toLowerCase().includes(q) ||
          log.details?.toLowerCase().includes(q) ||
          log.reason?.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const total = filtered.length;
    let paginated = filtered;
    if (filters.page || filters.limit) {
      const pageNum = Math.max(1, parseInt(filters.page, 10) || 1);
      const limitNum = Math.max(1, parseInt(filters.limit, 10) || 20);
      const totalPages = Math.max(1, Math.ceil(total / limitNum));
      paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);
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

  async logEvent({ actorId = 'system', actorName = 'System', action, entityType, entityId, details, reason, metadata = {} }) {
    const logs = storageAdapter.getItem(STORAGE_KEYS.AUDIT_LOGS) || [];
    const newLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      actorId,
      actorName,
      action,
      entityType,
      entityId,
      details,
      reason,
      metadata,
      timestamp: new Date().toISOString()
    };

    logs.unshift(newLog);
    if (logs.length > 500) {
      logs.length = 500;
    }

    storageAdapter.setItem(STORAGE_KEYS.AUDIT_LOGS, logs);
    return newLog;
  }
}

export const auditLocalRepository = new AuditLocalRepository();
