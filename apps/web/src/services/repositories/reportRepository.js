/**
 * Report Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { reportLocalRepository } from './local/reportLocalRepository.js';
import { reportApiRepository } from './api/reportApiRepository.js';

export const reportRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? reportApiRepository
  : reportLocalRepository;
