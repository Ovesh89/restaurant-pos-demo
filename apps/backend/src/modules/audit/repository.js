import { BaseMongoRepository } from '../../repositories/BaseMongoRepository.js';

export class AuditLogRepository extends BaseMongoRepository {
  constructor() {
    super('audit_logs', 'audit_logs');
  }
}

export const auditLogRepository = new AuditLogRepository();
