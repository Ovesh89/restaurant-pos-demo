import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

import { DEFAULT_LOGOS } from '../../../utils/logoProcessor.js';

export const DEFAULT_SETTINGS = {
  restaurantName: 'Green Tandoor Se',
  tagline: 'Garden Restaurant',
  branchName: 'Main Branch (Gandhinagar)',
  address: 'Opp. SP Petrol Pump, Gandhinagar, Chiloda Cross Road, Gandhinagar.',
  phone: '+91 97375 81238',
  email: 'greentandoorse@gmail.com',
  gstin: '24ABCDE1234F1Z5',
  fssai: '13320001000123',
  currencySymbol: '₹',
  defaultTaxRate: 5.0,
  maxDiscountPercent: 25.0,
  upiId: 'q705457761@ybl',
  invoicePrefix: 'INV-',
  kotPrefix: 'KOT-',
  thermalWidth: '80mm',
  receiptFooter: 'Order once placed will not be cancelled. Thank You for Dining With Us!',
  logo: DEFAULT_LOGOS.logo,
  logoWhite: DEFAULT_LOGOS.logoWhite,
  logoBlack: DEFAULT_LOGOS.logoBlack,
  logoReceipt: DEFAULT_LOGOS.logoReceipt,
  logoRedReceipt: DEFAULT_LOGOS.logoRedReceipt,
  favicon: DEFAULT_LOGOS.favicon
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
