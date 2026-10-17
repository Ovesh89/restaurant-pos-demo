/**
 * KOT Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { kotLocalRepository } from './local/kotLocalRepository.js';
import { kotApiRepository } from './api/kotApiRepository.js';

export const kotRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? kotApiRepository
  : kotLocalRepository;
