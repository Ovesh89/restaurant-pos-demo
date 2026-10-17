/**
 * Category Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { categoryLocalRepository } from './local/categoryLocalRepository.js';
import { categoryApiRepository } from './api/categoryApiRepository.js';

export const categoryRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? categoryApiRepository
  : categoryLocalRepository;
