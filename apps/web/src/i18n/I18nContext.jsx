import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, getLanguageConfig } from './languages.js';
import { LOCALES } from './locales/index.js';
import {
  formatEnglishNumber,
  formatEnglishCurrency,
  formatEnglishPrice,
  interpolateString
} from './formatters.js';
import { useAuth } from '../hooks/useAuth.js';

export const I18nContext = createContext(null);

const STORAGE_LANG_KEY = 'pos_language';

export const I18nProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  // Determine initial language:
  // If user is authenticated, use their profile language; otherwise always default to 'en' (Login screen is in English)
  const [language, setLanguageState] = useState(() => {
    if (user?.language && LOCALES[user.language]) {
      return user.language;
    }
    return DEFAULT_LANGUAGE;
  });

  // Keep language in sync with authentication and user profile:
  // When user is logged in, use their saved language preference.
  // When logged out, reset to default English ('en').
  useEffect(() => {
    if (isAuthenticated && user?.language && LOCALES[user.language]) {
      if (user.language !== language) {
        setLanguageState(user.language);
        localStorage.setItem(STORAGE_LANG_KEY, user.language);
      }
    } else if (!isAuthenticated) {
      if (language !== DEFAULT_LANGUAGE) {
        setLanguageState(DEFAULT_LANGUAGE);
        localStorage.setItem(STORAGE_LANG_KEY, DEFAULT_LANGUAGE);
      }
    }
  }, [isAuthenticated, user?.language, language]);

  // Update HTML tag attributes for accessibility and text direction
  useEffect(() => {
    const config = getLanguageConfig(language);
    document.documentElement.lang = language;
    document.documentElement.dir = config.dir || 'ltr';
  }, [language]);

  const currentLanguageConfig = useMemo(() => {
    return getLanguageConfig(language);
  }, [language]);

  // Apply a new language to the active UI state
  const setLanguage = useCallback((newLang) => {
    if (!LOCALES[newLang]) return;
    setLanguageState(newLang);
    localStorage.setItem(STORAGE_LANG_KEY, newLang);
  }, []);

  /**
   * Main translation function
   * Supports:
   *   t(path, 'Fallback String')
   *   t(path, { count: 4 }, 'Fallback String')
   */
  const t = useCallback(
    (path, params = null, fallback = '') => {
      if (!path) return '';

      // Normalize parameters to support both t(path, fallback) and t(path, params, fallback)
      let actualParams = params;
      let actualFallback = fallback;
      if (typeof params === 'string') {
        actualFallback = params;
        actualParams = null;
      }

      const keys = path.split('.');
      let current = LOCALES[language];

      // Navigate down the object hierarchy for the chosen language
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          current = undefined;
          break;
        }
      }

      // If missing in current language, fallback to English dictionary
      if (current === undefined || current === null) {
        let fallbackDict = LOCALES.en;
        for (const k of keys) {
          if (fallbackDict && typeof fallbackDict === 'object' && k in fallbackDict) {
            fallbackDict = fallbackDict[k];
          } else {
            fallbackDict = undefined;
            break;
          }
        }
        current = fallbackDict;
      }

      // Final fallback
      if (current === undefined || current === null) {
        current = actualFallback || path;
      }

      // String interpolation (with numbers strictly formatted in English digits)
      if (actualParams && typeof actualParams === 'object' && typeof current === 'string') {
        return interpolateString(current, actualParams);
      }

      return current;
    },
    [language]
  );

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      currentLanguageConfig,
      supportedLanguages: SUPPORTED_LANGUAGES,
      // Formatters that guarantee English digits
      formatNumber: formatEnglishNumber,
      formatCurrency: formatEnglishCurrency,
      formatPrice: formatEnglishPrice
    }),
    [language, setLanguage, t, currentLanguageConfig]
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
