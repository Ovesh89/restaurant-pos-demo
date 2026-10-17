/**
 * Shift Repository (Facade)
 * Switches dynamically between LocalStorage and Django REST API based on APP_CONFIG.DATA_PROVIDER
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import {
  shiftLocalRepository,
  SHIFT_STATUS,
  CASH_MOVEMENT_TYPE
} from './local/shiftLocalRepository.js';
import { shiftApiRepository } from './api/shiftApiRepository.js';

export { SHIFT_STATUS, CASH_MOVEMENT_TYPE };

export const shiftRepository = APP_CONFIG.DATA_PROVIDER === 'api'
  ? shiftApiRepository
  : shiftLocalRepository;
