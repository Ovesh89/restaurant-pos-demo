/**
 * Customer Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { customerLocalRepository } from './local/customerLocalRepository.js';
import { customerApiRepository } from './api/customerApiRepository.js';

export const customerRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? customerApiRepository
  : customerLocalRepository;
