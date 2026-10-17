/**
 * Role Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { roleLocalRepository } from './local/roleLocalRepository.js';
import { roleApiRepository } from './api/roleApiRepository.js';

export const roleRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? roleApiRepository
  : roleLocalRepository;
