/**
 * Branch & Area Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { branchLocalRepository } from './local/branchLocalRepository.js';
import { branchApiRepository } from './api/branchApiRepository.js';

export const branchRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? branchApiRepository
  : branchLocalRepository;
