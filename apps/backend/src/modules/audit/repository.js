import { BaseMongoRepository } from '../../repositories/BaseMongoRepository.js';

export class AuditLogRepository extends BaseMongoRepository {
  constructor() {
    super('audit_logs', 'audit_logs');
  }

  /**
   * Purge all audit log entries older than the retention period (default: 30 days / 1 month).
   * @param {number} days - Retention period in days (default 30)
   * @returns {Promise<{ deletedCount: number, cutoffDate: string, retentionDays: number }>}
   */
  async purgeOlderThanDays(days = 30) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoffDate.toISOString();
    const col = await this.collection();

    const result = await col.deleteMany({
      $or: [
        { createdAt: { $lt: cutoffIso } },
        { createdAt: { $lt: cutoffDate } },
        { timestamp: { $lt: cutoffIso } },
        { timestamp: { $lt: cutoffDate } },
      ],
    });

    return {
      deletedCount: result.deletedCount || 0,
      cutoffDate: cutoffIso,
      retentionDays: days,
    };
  }
}

export const auditLogRepository = new AuditLogRepository();

