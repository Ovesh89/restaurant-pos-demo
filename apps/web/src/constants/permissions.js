export const PERMISSIONS = {
  // Order permissions
  ORDER_CREATE: 'order.create',
  ORDER_SUBMIT: 'order.submit',
  ORDER_CONFIRM: 'order.confirm',
  ORDER_MODIFY: 'order.modify',
  ORDER_CANCEL: 'order.cancel',

  // KOT & Kitchen permissions
  KOT_VIEW: 'kot.view',
  KOT_SEND: 'kot.send',
  KOT_MODIFY: 'kot.modify',
  KOT_CANCEL: 'kot.cancel',
  KITCHEN_UPDATE: 'kitchen.update',

  // Billing & Payment permissions
  BILLING_GENERATE: 'billing.generate',
  BILLING_DISCOUNT: 'billing.discount',
  PAYMENT_COLLECT: 'payment.collect',
  BILL_CANCEL: 'bill.cancel',

  // Menu & Catalog
  MENU_VIEW: 'menu.view',
  MENU_EDIT: 'menu.edit',

  // Tables & Areas
  TABLE_VIEW: 'table.view',
  TABLE_MANAGE: 'table.manage',

  // User & Role Management
  USER_MANAGE: 'user.manage',
  ROLE_MANAGE: 'role.manage',

  // Customer Management
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_EDIT: 'customer.edit',

  // Reports & Auditing
  REPORT_VIEW: 'report.view',
  AUDIT_VIEW: 'audit.view',

  // System Settings
  SETTINGS_MANAGE: 'settings.manage'
};

export const PERMISSION_DEFINITIONS = [
  { code: PERMISSIONS.ORDER_CREATE, name: 'Create Order', module: 'Orders', description: 'Create draft or hold table order' },
  { code: PERMISSIONS.ORDER_SUBMIT, name: 'Submit Order', module: 'Orders', description: 'Submit order to reception' },
  { code: PERMISSIONS.ORDER_CONFIRM, name: 'Confirm Order', module: 'Orders', description: 'Approve or reject submitted orders' },
  { code: PERMISSIONS.ORDER_MODIFY, name: 'Modify Order', module: 'Orders', description: 'Add/remove items or change notes' },
  { code: PERMISSIONS.ORDER_CANCEL, name: 'Cancel Order', module: 'Orders', description: 'Cancel an order with mandatory reason' },

  { code: PERMISSIONS.KOT_VIEW, name: 'View KOT', module: 'Kitchen', description: 'View kitchen display and KOT queue' },
  { code: PERMISSIONS.KOT_SEND, name: 'Send KOT', module: 'Kitchen', description: 'Generate and dispatch KOT to kitchen' },
  { code: PERMISSIONS.KOT_MODIFY, name: 'Modify KOT', module: 'Kitchen', description: 'Issue delta/modification KOT' },
  { code: PERMISSIONS.KOT_CANCEL, name: 'Cancel KOT', module: 'Kitchen', description: 'Cancel KOT or items' },
  { code: PERMISSIONS.KITCHEN_UPDATE, name: 'Kitchen Progress', module: 'Kitchen', description: 'Update status to preparing/ready' },

  { code: PERMISSIONS.BILLING_GENERATE, name: 'Generate Bill', module: 'Billing', description: 'Generate final invoice' },
  { code: PERMISSIONS.BILLING_DISCOUNT, name: 'Apply Discount', module: 'Billing', description: 'Apply bill discount within limits' },
  { code: PERMISSIONS.PAYMENT_COLLECT, name: 'Collect Payment', module: 'Billing', description: 'Accept Cash/UPI/Card and settle balance' },
  { code: PERMISSIONS.BILL_CANCEL, name: 'Cancel Bill', module: 'Billing', description: 'Void or cancel generated bill' },

  { code: PERMISSIONS.MENU_VIEW, name: 'View Menu', module: 'Menu', description: 'View categories, items, and prices' },
  { code: PERMISSIONS.MENU_EDIT, name: 'Edit Menu', module: 'Menu', description: 'Create/edit products, categories, prices' },

  { code: PERMISSIONS.TABLE_VIEW, name: 'View Tables', module: 'Tables', description: 'View floor status and tables' },
  { code: PERMISSIONS.TABLE_MANAGE, name: 'Manage Tables', module: 'Tables', description: 'Create and update tables and areas' },

  { code: PERMISSIONS.USER_MANAGE, name: 'Manage Users', module: 'Administration', description: 'Create and edit staff accounts' },
  { code: PERMISSIONS.ROLE_MANAGE, name: 'Manage Roles', module: 'Administration', description: 'Configure roles and assign permissions' },

  { code: PERMISSIONS.CUSTOMER_VIEW, name: 'View Customers', module: 'Customers', description: 'Search and view customer records' },
  { code: PERMISSIONS.CUSTOMER_EDIT, name: 'Edit Customers', module: 'Customers', description: 'Create/edit customer contact details' },

  { code: PERMISSIONS.REPORT_VIEW, name: 'View Reports', module: 'Reports', description: 'Access sales, item, and staff reports' },
  { code: PERMISSIONS.AUDIT_VIEW, name: 'View Audit Logs', module: 'Audit', description: 'Inspect system operational activity log' },
  { code: PERMISSIONS.SETTINGS_MANAGE, name: 'Manage Settings', module: 'Settings', description: 'Configure branch, taxes, and system policies' }
];
