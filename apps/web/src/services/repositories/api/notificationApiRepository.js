import { apiClient } from '../../api/apiClient.js';
import { APP_CONFIG } from '../../../config/appConfig.js';

class NotificationApiRepository {
  async getNotifications(unreadOnly = false) {
    const params = {
      branchId: APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main',
      unreadOnly: Boolean(unreadOnly),
      limit: 50
    };

    const res = await apiClient.get('/notifications', { params });
    return Array.isArray(res) ? res : (res?.items || []);
  }

  async markAsRead(notificationId) {
    if (!notificationId) return;
    return await apiClient.post(`/notifications/${notificationId}/read`);
  }

  async createNotification(notificationData) {
    const payload = {
      branchId: notificationData.branchId || APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main',
      eventType: notificationData.eventType || 'CUSTOM_NOTIFICATION',
      title: notificationData.title || 'Notification',
      message: notificationData.message || '',
      recipientRole: notificationData.recipientRole || null,
      recipientUserId: notificationData.recipientUserId || null,
      metadata: notificationData.metadata || {}
    };
    return await apiClient.post('/notifications', payload);
  }
}

export const notificationApiRepository = new NotificationApiRepository();
