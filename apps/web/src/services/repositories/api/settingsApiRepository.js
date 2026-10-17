import { apiClient } from '../../api/apiClient.js';
import { APP_CONFIG } from '../../../config/appConfig.js';
import { DEFAULT_SETTINGS } from '../local/settingsLocalRepository.js';

class SettingsApiRepository {
  async getSettings() {
    const branchId = APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main';
    try {
      const branch = await apiClient.get(`/branches/${branchId}`);
      if (!branch) return { ...DEFAULT_SETTINGS };

      const taxRate = Number(branch.taxConfig?.rate !== undefined ? branch.taxConfig.rate : DEFAULT_SETTINGS.defaultTaxRate);
      const gstin = branch.taxConfig?.gstin || DEFAULT_SETTINGS.gstin;
      const invoicePrefix = branch.invoiceConfig?.prefix || DEFAULT_SETTINGS.invoicePrefix;
      const receiptFooter = branch.invoiceConfig?.terms || DEFAULT_SETTINGS.receiptFooter;

      return {
        ...DEFAULT_SETTINGS,
        restaurantName: branch.name || DEFAULT_SETTINGS.restaurantName,
        branchName: branch.name || DEFAULT_SETTINGS.branchName,
        address: branch.address || DEFAULT_SETTINGS.address,
        phone: branch.phone || DEFAULT_SETTINGS.phone,
        gstin,
        defaultTaxRate: taxRate,
        invoicePrefix,
        receiptFooter
      };
    } catch (err) {
      console.warn('Failed to load branch settings from API, using defaults:', err.message);
      return { ...DEFAULT_SETTINGS };
    }
  }

  async updateSettings(newSettings, actor = { id: 'admin', name: 'Admin' }) {
    const branchId = APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main';

    const payload = {
      name: newSettings.branchName || newSettings.restaurantName,
      address: newSettings.address,
      phone: newSettings.phone,
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

    return await this.getSettings();
  }

  async resetToDefaults(actor = { id: 'admin', name: 'Admin' }) {
    return await this.updateSettings(DEFAULT_SETTINGS, actor);
  }
}

export const settingsApiRepository = new SettingsApiRepository();
