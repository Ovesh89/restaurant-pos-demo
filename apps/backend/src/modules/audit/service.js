import { utcNowIso } from '../../repositories/BaseMongoRepository.js';
import { NotFoundAppError } from '../../middleware/errorHandler.js';
import { auditLogRepository } from './repository.js';

export class AuditService {
  constructor() {
    this.repo = auditLogRepository;
  }

  async logAction({
    branchId = null,
    action,
    entityType,
    entityId,
    actorId = null,
    actorUserId = null,
    actorName = 'System',
    reason = null,
    details = null,
    before = null,
    after = null,
    metadata = {},
  }) {
    const resolvedActorId = actorUserId || actorId || null;
    const now = utcNowIso();
    const resolvedDetails =
      details ||
      (metadata && Object.keys(metadata).length > 0
        ? `${action} on ${entityType} (${entityId}): ${Object.entries(metadata)
            .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(', ')}`
        : `${action} on ${entityType} (${entityId})`);

    const doc = {
      branchId,
      action,
      entityType,
      entityId: String(entityId),
      actorId: resolvedActorId,
      actorUserId: resolvedActorId,
      actorName,
      reason,
      details: resolvedDetails,
      before,
      after,
      metadata: metadata || {},
      timestamp: now,
      createdAt: now,
    };
    return this.repo.insertOne(doc);
  }

  async getAuditLog(logId) {
    const doc = await this.repo.findById(logId);
    if (!doc) {
      throw new NotFoundAppError('Audit log entry not found.');
    }
    return doc;
  }

  async listAuditLogs({
    branchId = null,
    entityType = null,
    entityId = null,
    action = null,
    actorId = null,
    actorUserId = null,
    dateFrom = null,
    dateTo = null,
    search = null,
    page = 1,
    limit = 50,
  } = {}) {
    const query = {};
    if (branchId) query.branchId = branchId;
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    if (action) query.action = action;

    // Decision 6 Compatibility Shim: support both actorId and actorUserId
    const resolvedActor = actorUserId || actorId;
    if (resolvedActor) {
      query.$or = [{ actorUserId: resolvedActor }, { actorId: resolvedActor }];
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = dateFrom;
      if (dateTo) {
        query.createdAt.$lte = /^\d{4}-\d{2}-\d{2}$/.test(dateTo)
          ? `${dateTo}T23:59:59.999Z`
          : dateTo;
      }
    }

    if (search && String(search).trim()) {
      const qClean = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchConditions = [
        { actorName: { $regex: qClean, $options: 'i' } },
        { action: { $regex: qClean, $options: 'i' } },
        { entityType: { $regex: qClean, $options: 'i' } },
        { details: { $regex: qClean, $options: 'i' } },
        { reason: { $regex: qClean, $options: 'i' } },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    return this.repo.findPaginated(query, {
      page,
      limit,
      sort: { createdAt: -1 },
    });
  }

  async purgeOldLogs(days = 30) {
    const parsedDays = parseInt(days, 10);
    const retentionDays = Number.isInteger(parsedDays) && parsedDays > 0 ? parsedDays : 30;
    const result = await this.repo.purgeOlderThanDays(retentionDays);
    return result;
  }
}

export const auditService = new AuditService();

