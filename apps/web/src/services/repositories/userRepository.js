/**
 * User Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { userLocalRepository } from './local/userLocalRepository.js';
import { userApiRepository } from './api/userApiRepository.js';

export const userRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? userApiRepository
  : userLocalRepository;
