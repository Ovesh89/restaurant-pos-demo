/**
 * Canonical RBAC Permission Registry and Default System Roles
 * Authoritative Permission Codes & Default System Role Definitions.
 */

export const ALL_PERMISSIONS = [
  // Branch & Floor
  'branch.view',
  'branch.manage',
  'area.view',
  'area.manage',
  'table.view',
  'table.manage',

  // Menu & Pricing
  'menu.view',
  'menu.edit',
  'menu.manage',
  'menu.price_change',

  // Orders
  'order.view',
  'order.create',
  'order.modify',
  'order.hold',
  'order.resume',
  'order.submit',
  'order.confirm',
  'order.reject',
  'order.cancel',

  // KOT & Kitchen
  'kot.view',
  'kot.send',
  'kot.modify',
  'kot.cancel',
  'kot.manage',
  'kitchen.update',

  // Billing, Discounts & Payments
  'billing.view',
  'billing.create',
  'billing.generate',
  'billing.print',
  'billing.close',
  'billing.discount',
  'discount.apply',
  'discount.approve',
  'payment.record',
  'payment.collect',
  'bill.cancel',

  // Customers
  'customer.view',
  'customer.edit',
  'customer.manage',

  // Reports & Audit
  'report.view',
  'audit.view',

  // Staff & Administration
  'user.view',
  'user.manage',
  'role.view',
  'role.manage',

  // System Settings
  'settings.manage',
];

export const PERMISSION_ALIASES = {
  // Menu
  'menu.edit': ['menu.manage'],
  'menu.manage': ['menu.edit'],

  // Billing
  'billing.generate': ['billing.create'],
  'billing.create': ['billing.generate'],
  'billing.discount': ['discount.apply'],
  'payment.collect': ['payment.record'],
  'payment.record': ['payment.collect'],
  'bill.cancel': ['billing.close'],
  'billing.close': ['bill.cancel'],

  // Customer
  'customer.edit': ['customer.manage'],
  'customer.manage': ['customer.edit'],

  // Settings / Branch
  'settings.manage': ['branch.manage'],
  'branch.manage': ['settings.manage'],

  // KOT
  'kot.manage': ['kot.send', 'kot.modify', 'kot.cancel'],
  'kot.send': ['kot.manage'],
  'kot.modify': ['kot.manage'],
  'kot.cancel': ['kot.manage'],
};

/**
 * Expand a list of permissions to include all reciprocal aliases.
 */
export function expandPermissions(permissions = []) {
  const set = new Set(permissions);
  for (const perm of permissions) {
    const aliases = PERMISSION_ALIASES[perm];
    if (aliases) {
      for (const a of aliases) {
        set.add(a);
      }
    }
  }
  return Array.from(set);
}

export const DEFAULT_ROLE_PERMISSIONS = {
  OWNER: [...ALL_PERMISSIONS],
  ADMIN: [...ALL_PERMISSIONS],
  MANAGER: [
    'branch.view',
    'branch.manage',
    'area.view',
    'area.manage',
    'table.view',
    'table.manage',
    'menu.view',
    'menu.edit',
    'menu.manage',
    'menu.price_change',
    'order.view',
    'order.create',
    'order.modify',
    'order.hold',
    'order.resume',
    'order.submit',
    'order.confirm',
    'order.reject',
    'order.cancel',
    'kot.view',
    'kot.send',
    'kot.modify',
    'kot.cancel',
    'kot.manage',
    'kitchen.update',
    'billing.view',
    'billing.create',
    'billing.generate',
    'billing.print',
    'billing.close',
    'billing.discount',
    'discount.apply',
    'discount.approve',
    'payment.record',
    'payment.collect',
    'bill.cancel',
    'customer.view',
    'customer.edit',
    'customer.manage',
    'report.view',
    'audit.view',
    'user.view',
    'role.view',
    'settings.manage',
  ],
  RECEPTION: [
    'branch.view',
    'area.view',
    'table.view',
    'table.manage',
    'menu.view',
    'order.view',
    'order.create',
    'order.modify',
    'order.hold',
    'order.resume',
    'order.submit',
    'order.confirm',
    'order.reject',
    'order.cancel',
    'kot.view',
    'kot.send',
    'kot.modify',
    'kot.manage',
    'billing.view',
    'billing.create',
    'billing.generate',
    'billing.print',
    'payment.record',
    'payment.collect',
    'customer.view',
    'customer.edit',
    'customer.manage',
  ],
  CASHIER: [
    'branch.view',
    'area.view',
    'table.view',
    'menu.view',
    'order.view',
    'kot.view',
    'billing.view',
    'billing.create',
    'billing.generate',
    'billing.print',
    'billing.close',
    'discount.apply',
    'payment.record',
    'payment.collect',
    'bill.cancel',
    'customer.view',
    'customer.edit',
    'customer.manage',
    'report.view',
  ],
  CAPTAIN: [
    'branch.view',
    'area.view',
    'table.view',
    'menu.view',
    'order.view',
    'order.create',
    'order.modify',
    'order.hold',
    'order.resume',
    'order.submit',
    'kot.view',
    'kot.send',
    'billing.create',
    'billing.generate',
    'billing.print',
    'billing.close',
    'payment.record',
    'payment.collect',
    'customer.edit',
  ],
  KITCHEN: [
    'branch.view',
    'menu.view',
    'order.view',
    'kot.view',
    'kitchen.update',
  ],
};
