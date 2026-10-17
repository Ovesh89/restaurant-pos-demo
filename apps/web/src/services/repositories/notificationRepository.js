/**
 * Notification Repository (Facade)
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { notificationApiRepository } from './api/notificationApiRepository.js';

// Local stub for notification repository
const notificationLocalRepository = {
  async getNotifications() {
    return [];
  },
  async markAsRead() {
    return { success: true };
  }
};

export const notificationRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? notificationApiRepository
  : notificationLocalRepository;
