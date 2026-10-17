/**
 * Table Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { tableLocalRepository } from './local/tableLocalRepository.js';
import { tableApiRepository } from './api/tableApiRepository.js';

export const tableRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? tableApiRepository
  : tableLocalRepository;
