/**
 * Centralized API Client for GTS Restaurant POS
 * Features:
 * - Base URL resolution
 * - Unified JWT Bearer token attachment
 * - Distributed Correlation ID propagation (X-Correlation-ID)
 * - Automatic standard response envelope unwrapping ({ success, data, message })
 * - Unified error normalization via AppError
 * - Mutex-queued 401 token refresh & transparent request replay
 * - Idempotency-Key header support
 */

import { APP_CONFIG } from '../../config/appConfig.js';
import { tokenStorage } from './tokenStorage.js';

export class AppError extends Error {
  constructor(message, code = 'ERROR', status = 400, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class ApiClient {
  constructor() {
    this.refreshPromise = null;
  }

  getBaseUrl() {
    return APP_CONFIG.API_BASE_URL || '/api/v1';
  }

  generateCorrelationId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Performs an HTTP request with automatic token injection, error handling, and 401 retry
   */
  async request(endpoint, options = {}) {
    const baseUrl = this.getBaseUrl();
    const isAbsolute = endpoint.startsWith('http://') || endpoint.startsWith('https://');
    let url = isAbsolute ? endpoint : `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (options.params) {
      let queryString = '';
      if (options.params instanceof URLSearchParams) {
        queryString = options.params.toString();
      } else if (typeof options.params === 'object') {
        const queryParams = new URLSearchParams();
        Object.entries(options.params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (Array.isArray(value)) {
              queryParams.append(key, value.join(','));
            } else {
              queryParams.append(key, String(value));
            }
          }
        });
        queryString = queryParams.toString();
      }
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Correlation-ID': this.generateCorrelationId(),
      ...options.headers
    };

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const token = tokenStorage.getAccessToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchConfig = {
      ...options,
      headers
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      fetchConfig.body = JSON.stringify(options.body);
    }

    let response;
    try {
      response = await fetch(url, fetchConfig);
    } catch (networkErr) {
      console.error(`[ApiClient] Network connection failure to ${url}:`, networkErr);
      throw new AppError(
        'Unable to connect to the restaurant backend server. Please check your network connection or verify that the backend is running.',
        'NETWORK_ERROR',
        0
      );
    }

    // 401 Unauthorized handling with single-flight token refresh
    const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh');
    if (response.status === 401 && !options._isRetry && !isAuthEndpoint) {
      const refreshed = await this.handleTokenRefresh();
      if (refreshed) {
        return this.request(endpoint, { ...options, _isRetry: true });
      }
    }

    return this.parseResponse(response);
  }

  async parseResponse(response) {
    let payload = null;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
    } else {
      payload = await response.text();
    }

    if (!response.ok) {
      let code = 'HTTP_' + response.status;
      let message = response.statusText || 'An error occurred during request.';
      let details = {};

      if (payload && typeof payload === 'object') {
        if (payload.error) {
          code = payload.error.code || code;
          message = payload.error.message || message;
          details = payload.error.details || {};
        } else if (payload.message) {
          message = payload.message;
        } else if (payload.detail) {
          message = payload.detail;
        }
      }

      throw new AppError(message, code, response.status, details);
    }

    // Standard backend envelope unwrap
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return payload.data;
    }

    return payload;
  }

  /**
   * Refreshes access token with mutex promise to prevent concurrent refresh races
   */
  async handleTokenRefresh() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      this.handleAuthFailure();
      return false;
    }

    this.refreshPromise = (async () => {
      try {
        const baseUrl = this.getBaseUrl();
        const refreshUrl = `${baseUrl}/auth/refresh`;

        const res = await fetch(refreshUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken })
        });

        if (!res.ok) {
          throw new Error('Refresh rejected');
        }

        const data = await res.json();
        const newTokens = data?.data?.tokens || data?.tokens;
        if (newTokens?.access) {
          tokenStorage.setAccessToken(newTokens.access);
          return true;
        }
        return false;
      } catch (err) {
        console.warn('[ApiClient] Token refresh failed:', err);
        this.handleAuthFailure();
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  handleAuthFailure() {
    tokenStorage.clearTokens();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
  }

  // --- HTTP Method Shorthands ---

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body = null, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  patch(endpoint, body = null, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  put(endpoint, body = null, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
