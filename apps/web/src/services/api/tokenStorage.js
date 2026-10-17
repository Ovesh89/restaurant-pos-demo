/**
 * Centralized Token & Session Storage
 * Manages JWT Access and Refresh Tokens with persistent browser storage.
 */

const ACCESS_TOKEN_KEY = 'restaurant_pos_access_token';
const REFRESH_TOKEN_KEY = 'restaurant_pos_refresh_token';
const SESSION_DATA_KEY = 'restaurant_pos_api_session';

class TokenStorage {
  getAccessToken() {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setAccessToken(token) {
    try {
      if (token) {
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    } catch (err) {
      console.error('[TokenStorage] Error setting access token:', err);
    }
  }

  getRefreshToken() {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setRefreshToken(token) {
    try {
      if (token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } catch (err) {
      console.error('[TokenStorage] Error setting refresh token:', err);
    }
  }

  setTokens({ access, refresh }) {
    if (access) this.setAccessToken(access);
    if (refresh) this.setRefreshToken(refresh);
  }

  clearTokens() {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(SESSION_DATA_KEY);
    } catch (err) {
      console.error('[TokenStorage] Error clearing tokens:', err);
    }
  }

  getSessionData() {
    try {
      const data = localStorage.getItem(SESSION_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  setSessionData(sessionData) {
    try {
      if (sessionData) {
        localStorage.setItem(SESSION_DATA_KEY, JSON.stringify(sessionData));
      } else {
        localStorage.removeItem(SESSION_DATA_KEY);
      }
    } catch (err) {
      console.error('[TokenStorage] Error setting session data:', err);
    }
  }
}

export const tokenStorage = new TokenStorage();
