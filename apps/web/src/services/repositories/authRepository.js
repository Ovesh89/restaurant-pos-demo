/**
 * Auth Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { authLocalRepository } from './local/authLocalRepository.js';
import { authApiRepository } from './api/authApiRepository.js';

export const authRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? authApiRepository
  : authLocalRepository;
