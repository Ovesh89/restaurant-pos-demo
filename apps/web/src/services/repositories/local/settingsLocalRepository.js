import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

export const DEFAULT_SETTINGS = {
  restaurantName: 'Green Garden Pure Veg',
  tagline: 'Pure Vegetarian Dining & Banquet',
  branchName: 'Main Branch (Gandhinagar)',
  address: '101, City Centre, Near Central Park, Sector 11, Gandhinagar - 382010',
  phone: '+91 98765 43210',
  email: 'info@greengardenveg.demo',
  gstin: '24AABCG1234F1Z8',
  fssai: '13320001000123',
  currencySymbol: '₹',
  defaultTaxRate: 5.0,
  maxDiscountPercent: 25.0,
  invoicePrefix: 'INV-',
  kotPrefix: 'KOT-',
  thermalWidth: '80mm',
  receiptFooter: 'Order once placed will not be cancelled. 100% Pure Vegetarian Kitchen.'
};

class SettingsLocalRepository {
  async getSettings() {
    const saved = storageAdapter.getItem(STORAGE_KEYS.SETTINGS);
    if (!saved) {
      storageAdapter.setItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...saved };
  }

  async updateSettings(newSettings, actor = { id: 'admin', name: 'Admin' }) {
    const current = await this.getSettings();
    const updated = {
      ...current,
      ...newSettings,
      updatedAt: new Date().toISOString()
    };

    storageAdapter.setItem(STORAGE_KEYS.SETTINGS, updated);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'SETTINGS_UPDATED',
      entityType: 'Settings',
      entityId: 'restaurant-settings',
      details: `Restaurant configuration updated by ${actor.name}. Default Tax: ${updated.defaultTaxRate}%, Prefix: ${updated.invoicePrefix}.`
    });

    return updated;
  }

  async resetToDefaults(actor = { id: 'admin', name: 'Admin' }) {
    storageAdapter.setItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'SETTINGS_RESET',
      entityType: 'Settings',
      entityId: 'restaurant-settings',
      details: `Settings reset to default factory parameters by ${actor.name}.`
    });

    return { ...DEFAULT_SETTINGS };
  }
}

export const settingsLocalRepository = new SettingsLocalRepository();
