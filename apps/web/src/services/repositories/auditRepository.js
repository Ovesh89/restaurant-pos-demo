/**
 * Audit Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { auditLocalRepository } from './local/auditLocalRepository.js';
import { auditApiRepository } from './api/auditApiRepository.js';

export const auditRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? auditApiRepository
  : auditLocalRepository;
