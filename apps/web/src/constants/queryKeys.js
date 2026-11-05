/**
 * Centralized TanStack Query Keys for GTS Restaurant POS
 * Scoped by branchId and entity filters to guarantee strict branch isolation
 */

export const queryKeys = {
  // --- Master Data ---
  branches: () => ['branches'],
  branch: (id) => ['branches', 'detail', id],

  areas: (branchId) => ['areas', branchId || 'all'],
  area: (id) => ['areas', 'detail', id],

  tables: (branchId, params = {}) => ['tables', branchId || 'all', params],
  table: (id) => ['tables', 'detail', id],

  categories: (branchId, includeInactive = false) => [
    'categories',
    branchId || 'all',
    { includeInactive: Boolean(includeInactive) }
  ],
  category: (id) => ['categories', 'detail', id],

  products: (branchId, filters = {}) => [
    'products',
    branchId || 'all',
    filters
  ],
  product: (id) => ['products', 'detail', id],

  kitchenStations: (branchId) => ['kitchenStations', branchId || 'all'],
  kitchenStation: (id) => ['kitchenStations', 'detail', id],

  settings: (branchId) => ['settings', branchId || 'all'],
  branding: (branchId) => ['branding', branchId || 'all'],

  roles: () => ['roles'],
  permissions: () => ['permissions'],
  users: (branchId) => ['users', branchId || 'all'],

  // Freshness & Versioning
  masterDataVersions: (branchId) => ['meta', 'master-data-versions', branchId || 'all'],

  // --- Operational Data (Short lived, strictly in-memory) ---
  orders: (branchId, filters = {}) => ['orders', branchId || 'all', filters],
  order: (id) => ['orders', 'detail', id],
  orderApprovals: (branchId) => ['orders', 'approvals', branchId || 'all'],
  pendingSettlement: (branchId) => ['pending-settlement', branchId || 'all'],

  kotQueue: (branchId, filters = {}) => ['kot-queue', branchId || 'all', filters],
  kotActive: (branchId) => ['kot-active', branchId || 'all'],
  kot: (id) => ['kot', 'detail', id],

  bills: (branchId, filters = {}) => ['bills', branchId || 'all', filters],
  recentSettledBills: (branchId) => ['bills', 'recent-settled', branchId || 'all'],
  bill: (id) => ['bills', 'detail', id],

  tableStatus: (branchId) => ['tables', 'status', branchId || 'all'],
  notifications: (userId) => ['notifications', userId || 'all'],
  customers: (params = {}) => ['customers', params],
  shifts: (branchId) => ['shifts', branchId || 'all']
};
