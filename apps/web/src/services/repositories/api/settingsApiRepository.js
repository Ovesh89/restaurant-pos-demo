import { apiClient } from '../../api/apiClient.js';
import { APP_CONFIG } from '../../../config/appConfig.js';
import { DEFAULT_SETTINGS } from '../local/settingsLocalRepository.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { STORAGE_KEYS } from '../../../constants/storageKeys.js';

class SettingsApiRepository {
  async getSettings() {
    const branchId = APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main';
    try {
      const branch = await apiClient.get(`/branches/${branchId}`);
      if (!branch) {
        const cached = storageAdapter.getItem(STORAGE_KEYS.SETTINGS);
        return { ...DEFAULT_SETTINGS, ...(cached || {}) };
      }

      const taxRate = Number(branch.taxConfig?.rate !== undefined ? branch.taxConfig.rate : DEFAULT_SETTINGS.defaultTaxRate);
      const gstin = branch.taxConfig?.gstin || DEFAULT_SETTINGS.gstin;
      const invoicePrefix = branch.invoiceConfig?.prefix || DEFAULT_SETTINGS.invoicePrefix;
      const receiptFooter = branch.invoiceConfig?.terms || DEFAULT_SETTINGS.receiptFooter;
      const cached = storageAdapter.getItem(STORAGE_KEYS.SETTINGS);
      const requireOrderApproval = branch.requireOrderApproval !== undefined
        ? Boolean(branch.requireOrderApproval)
        : (cached?.requireOrderApproval !== undefined ? Boolean(cached.requireOrderApproval) : DEFAULT_SETTINGS.requireOrderApproval);

      const merged = {
        ...DEFAULT_SETTINGS,
        restaurantName: branch.restaurantName || branch.name || DEFAULT_SETTINGS.restaurantName,
        tagline: branch.tagline !== undefined ? branch.tagline : DEFAULT_SETTINGS.tagline,
        branchName: branch.name || DEFAULT_SETTINGS.branchName,
        address: branch.address || DEFAULT_SETTINGS.address,
        phone: branch.phone || DEFAULT_SETTINGS.phone,
        email: branch.email || DEFAULT_SETTINGS.email,
        gstin,
        fssai: branch.fssai || DEFAULT_SETTINGS.fssai,
        defaultTaxRate: taxRate,
        invoicePrefix,
        receiptFooter,
        requireOrderApproval,
        logo: branch.logo || DEFAULT_SETTINGS.logo,
        logoWhite: branch.logoWhite || DEFAULT_SETTINGS.logoWhite,
        logoBlack: branch.logoBlack || DEFAULT_SETTINGS.logoBlack,
        logoReceipt: branch.logoReceipt || DEFAULT_SETTINGS.logoReceipt,
        logoRedReceipt: branch.logoRedReceipt || DEFAULT_SETTINGS.logoRedReceipt,
        favicon: branch.favicon || DEFAULT_SETTINGS.favicon
      };

      storageAdapter.setItem(STORAGE_KEYS.SETTINGS, merged);
      return merged;
    } catch (err) {
      console.warn('Failed to load branch settings from API, using cached or defaults:', err.message);
      const cached = storageAdapter.getItem(STORAGE_KEYS.SETTINGS);
      return { ...DEFAULT_SETTINGS, ...(cached || {}) };
    }
  }

  async updateSettings(newSettings, actor = { id: 'admin', name: 'Admin' }) {
    const branchId = APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main';

    const payload = {
      restaurantName: newSettings.restaurantName || newSettings.branchName,
      tagline: newSettings.tagline !== undefined ? newSettings.tagline : '',
      name: newSettings.branchName || newSettings.restaurantName,
      address: newSettings.address,
      phone: newSettings.phone,
      email: newSettings.email,
      gstin: newSettings.gstin,
      fssai: newSettings.fssai,
      logo: newSettings.logo,
      logoWhite: newSettings.logoWhite,
      logoBlack: newSettings.logoBlack,
      logoReceipt: newSettings.logoReceipt,
      logoRedReceipt: newSettings.logoRedReceipt,
      favicon: newSettings.favicon,
      requireOrderApproval: newSettings.requireOrderApproval !== undefined
        ? Boolean(newSettings.requireOrderApproval)
        : true,
      taxConfig: {
        rate: String(newSettings.defaultTaxRate || 5),
        gstin: newSettings.gstin || '',
        mode: 'EXCLUSIVE'
      },
      invoiceConfig: {
        prefix: newSettings.invoicePrefix || 'INV-',
        terms: newSettings.receiptFooter || 'Thank you for dining with us.'
      }
    };

    try {
      await apiClient.patch(`/branches/${branchId}`, payload);
    } catch (err) {
      console.warn('Branch update API call warning:', err.message);
    }

    const currentCached = storageAdapter.getItem(STORAGE_KEYS.SETTINGS) || {};
    const updated = { ...DEFAULT_SETTINGS, ...currentCached, ...newSettings };
    storageAdapter.setItem(STORAGE_KEYS.SETTINGS, updated);

    return updated;
  }

  async resetToDefaults(actor = { id: 'admin', name: 'Admin' }) {
    return await this.updateSettings(DEFAULT_SETTINGS, actor);
  }
}


export const settingsApiRepository = new SettingsApiRepository();
