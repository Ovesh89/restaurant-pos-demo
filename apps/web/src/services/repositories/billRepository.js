/**
 * Bill Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { billLocalRepository, BILL_STATUS } from './local/billLocalRepository.js';
import { billApiRepository } from './api/billApiRepository.js';

export { BILL_STATUS };

export const billRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? billApiRepository
  : billLocalRepository;
