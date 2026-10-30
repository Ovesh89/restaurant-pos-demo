import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsRepository, DEFAULT_SETTINGS } from '../services/repositories/settingsRepository.js';
import { storageAdapter } from '../services/storage/localStorageAdapter.js';
import { STORAGE_KEYS } from '../constants/storageKeys.js';
import { apiClient } from '../services/api/apiClient.js';
import { APP_CONFIG } from '../config/appConfig.js';

const RestaurantContext = createContext(null);

export const RestaurantProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    try {
      const cached = storageAdapter.getItem(STORAGE_KEYS.SETTINGS);
      if (cached && (cached.restaurantName || cached.logo)) {
        return { ...DEFAULT_SETTINGS, ...cached };
      }
    } catch (e) {
      console.warn('[RestaurantContext] Cache init warning:', e);
    }
    return { ...DEFAULT_SETTINGS };
  });

  const updateDocumentBranding = useCallback((currentSettings) => {
    if (typeof document === 'undefined') return;

    // 1. Update Document Title
    const rName = currentSettings.restaurantName || DEFAULT_SETTINGS.restaurantName;
    const expectedTitle = `${rName} — Restaurant POS & KOT`;
    if (document.title !== expectedTitle) {
      document.title = expectedTitle;
    }

    // 2. Update Favicon Link
    const iconUrl = currentSettings.favicon || currentSettings.logo || DEFAULT_SETTINGS.favicon;
    if (iconUrl) {
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.type = 'image/png';
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = iconUrl;
    }
  }, []);

  const reloadSettings = useCallback(async () => {
    try {
      let data = null;
      // Try full settings repository first to get complete branch & tax parameters
      try {
        data = await settingsRepository.getSettings();
      } catch (repoErr) {
        // Fall back to public branding endpoint if unauthenticated
      }

      if (!data && APP_CONFIG.DATA_PROVIDER === 'api') {
        try {
          const publicBranding = await apiClient.get('/restaurant/branding');
          if (publicBranding) {
            data = { ...DEFAULT_SETTINGS, ...publicBranding };
          }
        } catch (pubErr) {
          // ignore
        }
      }

      if (!data) {
        const cached = storageAdapter.getItem(STORAGE_KEYS.SETTINGS);
        data = { ...DEFAULT_SETTINGS, ...(cached || {}) };
      }

      if (data) {
        setSettings(data);
        storageAdapter.setItem(STORAGE_KEYS.SETTINGS, data);
        updateDocumentBranding(data);
      }
    } catch (err) {
      console.warn('[RestaurantContext] Failed to load restaurant settings:', err.message);
    }
  }, [updateDocumentBranding]);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  useEffect(() => {
    updateDocumentBranding(settings);
  }, [settings, updateDocumentBranding]);

  const updateBranding = async (updates, actor) => {
    const updated = await settingsRepository.updateSettings(updates, actor);
    setSettings(updated);
    storageAdapter.setItem(STORAGE_KEYS.SETTINGS, updated);
    updateDocumentBranding(updated);
    return updated;
  };

  const contextValue = {
    settings,
    restaurantName: settings.restaurantName || DEFAULT_SETTINGS.restaurantName,
    restaurantTitle: settings.tagline !== undefined ? settings.tagline : DEFAULT_SETTINGS.tagline,
    tagline: settings.tagline !== undefined ? settings.tagline : DEFAULT_SETTINGS.tagline,
    branchName: settings.branchName || DEFAULT_SETTINGS.branchName,
    address: settings.address || DEFAULT_SETTINGS.address,
    phone: settings.phone || DEFAULT_SETTINGS.phone,
    email: settings.email || DEFAULT_SETTINGS.email,
    gstin: settings.gstin || DEFAULT_SETTINGS.gstin,
    fssai: settings.fssai || DEFAULT_SETTINGS.fssai,
    logo: settings.logo || DEFAULT_SETTINGS.logo,
    logoWhite: settings.logoWhite || DEFAULT_SETTINGS.logoWhite,
    logoBlack: settings.logoBlack || DEFAULT_SETTINGS.logoBlack,
    logoReceipt: settings.logoReceipt || settings.logo || DEFAULT_SETTINGS.logoReceipt,
    logoRedReceipt: settings.logoRedReceipt || DEFAULT_SETTINGS.logoRedReceipt,
    favicon: settings.favicon || DEFAULT_SETTINGS.favicon,
    reloadSettings,
    updateBranding,
  };

  return (
    <RestaurantContext.Provider value={contextValue}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => {
  const ctx = useContext(RestaurantContext);
  if (!ctx) {
    return {
      settings: DEFAULT_SETTINGS,
      restaurantName: DEFAULT_SETTINGS.restaurantName,
      restaurantTitle: DEFAULT_SETTINGS.tagline,
      tagline: DEFAULT_SETTINGS.tagline,
      branchName: DEFAULT_SETTINGS.branchName,
      address: DEFAULT_SETTINGS.address,
      phone: DEFAULT_SETTINGS.phone,
      email: DEFAULT_SETTINGS.email,
      gstin: DEFAULT_SETTINGS.gstin,
      fssai: DEFAULT_SETTINGS.fssai,
      logo: DEFAULT_SETTINGS.logo,
      logoWhite: DEFAULT_SETTINGS.logoWhite,
      logoBlack: DEFAULT_SETTINGS.logoBlack,
      logoReceipt: DEFAULT_SETTINGS.logoReceipt,
      logoRedReceipt: DEFAULT_SETTINGS.logoRedReceipt,
      favicon: DEFAULT_SETTINGS.favicon,
      reloadSettings: () => {},
      updateBranding: () => {}
    };
  }
  return ctx;
};
