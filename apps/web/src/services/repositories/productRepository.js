/**
 * Product Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { productLocalRepository } from './local/productLocalRepository.js';
import { productApiRepository } from './api/productApiRepository.js';

export const productRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? productApiRepository
  : productLocalRepository;
