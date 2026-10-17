/**
 * Settings Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { settingsLocalRepository, DEFAULT_SETTINGS } from './local/settingsLocalRepository.js';
import { settingsApiRepository } from './api/settingsApiRepository.js';

export { DEFAULT_SETTINGS };

export const settingsRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? settingsApiRepository
  : settingsLocalRepository;
