import { BaseMongoRepository, utcNowIso } from '../../repositories/BaseMongoRepository.js';

export class NotificationRepository extends BaseMongoRepository {
  constructor() {
    super('notifications');
  }

  async listForUser({
    branchId,
    userRoleCodes = [],
    userId = null,
    unreadOnly = false,
    limit = 50,
  }) {
    const orClauses = [{ recipientRole: { $in: userRoleCodes } }];
    if (userId) {
      orClauses.push({ recipientUserId: userId });
    }
    orClauses.push({ recipientRole: null, recipientUserId: null });

    const query = {
      branchId,
      $or: orClauses,
    };

    if (unreadOnly) {
      query.isRead = false;
    }

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    return this.findMany(query, {
      sort: { createdAt: -1 },
      limit: safeLimit,
    });
  }

  async markRead(notificationId) {
    const now = utcNowIso();
    return this.updateById(notificationId, {
      isRead: true,
      readAt: now,
    });
  }
}

export const notificationRepository = new NotificationRepository();
