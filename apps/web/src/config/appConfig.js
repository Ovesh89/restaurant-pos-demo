const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : (typeof process !== 'undefined' && process.env)
  ? process.env
  : {};

export const APP_CONFIG = {
  APP_NAME: 'Green Garden Pure Veg POS',
  APP_VERSION: '1.0.0',
  DATA_PROVIDER: env.VITE_DATA_PROVIDER || 'api',
  API_BASE_URL: env.VITE_API_BASE_URL || '/api/v1',
  DEFAULT_BRANCH_ID: env.VITE_DEFAULT_BRANCH_ID || 'branch-main',
  DEFAULT_CURRENCY: '₹',
  DEFAULT_TAX_RATE: 5.0, // 5% GST
  INVOICE_PREFIX: 'INV-',
  KOT_PREFIX: 'KOT-',
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10
  },
  DEFAULT_KITCHEN_STATIONS: [
    { id: 'station-tandoor', name: 'Tandoor Station' },
    { id: 'station-curry', name: 'Main Curry Station' },
    { id: 'station-bar', name: 'Bar & Beverages' },
    { id: 'station-bakery', name: 'Breads & Bakery' },
    { id: 'station-dessert', name: 'Dessert Station' }
  ]
};
