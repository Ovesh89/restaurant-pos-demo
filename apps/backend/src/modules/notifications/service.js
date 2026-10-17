import crypto from 'node:crypto';
import { utcNowIso } from '../../repositories/BaseMongoRepository.js';
import { notificationRepository } from './repository.js';

class NotificationService {
  async notify({
    branchId,
    eventType,
    title,
    message,
    recipientRole = null,
    recipientUserId = null,
    metadata = {},
  }) {
    const now = utcNowIso();
    const doc = {
      _id: crypto.randomUUID(),
      branchId: branchId || 'branch-main',
      eventType,
      title,
      message,
      recipientRole,
      recipientUserId,
      metadata: metadata || {},
      isRead: false,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    };

    return notificationRepository.insertOne(doc);
  }

  async createNotification(params) {
    return this.notify(params);
  }

  async listNotifications({
    branchId,
    userRoleCodes = [],
    userId = null,
    unreadOnly = false,
    limit = 50,
  }) {
    return notificationRepository.listForUser({
      branchId: branchId || 'branch-main',
      userRoleCodes,
      userId,
      unreadOnly,
      limit,
    });
  }

  async markAsRead(notificationId) {
    return notificationRepository.markRead(notificationId);
  }
}

export const notificationService = new NotificationService();
