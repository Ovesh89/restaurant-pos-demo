/**
 * Kitchen Station Repository (Facade)
 * Dynamically switches between LocalStorage and Express/MongoDB REST API
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { kitchenStationLocalRepository } from './local/kitchenStationLocalRepository.js';
import { kitchenStationApiRepository } from './api/kitchenStationApiRepository.js';

export const kitchenStationRepository =
  APP_CONFIG.DATA_PROVIDER === 'api'
    ? kitchenStationApiRepository
    : kitchenStationLocalRepository;
