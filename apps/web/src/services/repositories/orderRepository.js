/**
 * Order Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { orderLocalRepository } from './local/orderLocalRepository.js';
import { orderApiRepository } from './api/orderApiRepository.js';

export const orderRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? orderApiRepository
  : orderLocalRepository;
