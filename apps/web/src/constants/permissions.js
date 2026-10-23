export const PERMISSIONS = {
  // Order permissions
  ORDER_VIEW: 'order.view',
  ORDER_CREATE: 'order.create',
  ORDER_SUBMIT: 'order.submit',
  ORDER_CONFIRM: 'order.confirm',
  ORDER_MODIFY: 'order.modify',
  ORDER_HOLD: 'order.hold',
  ORDER_REJECT: 'order.reject',
  ORDER_CANCEL: 'order.cancel',

  // KOT & Kitchen permissions
  KOT_VIEW: 'kot.view',
  KOT_SEND: 'kot.send',
  KOT_MODIFY: 'kot.modify',
  KOT_CANCEL: 'kot.cancel',
  KOT_MANAGE: 'kot.manage',
  KITCHEN_UPDATE: 'kitchen.update',

  // Billing & Payment permissions
  BILLING_VIEW: 'billing.view',
  BILLING_GENERATE: 'billing.generate',
  BILLING_CREATE: 'billing.create',
  BILLING_DISCOUNT: 'billing.discount',
  PAYMENT_COLLECT: 'payment.collect',
  PAYMENT_RECORD: 'payment.record',
  BILL_CANCEL: 'bill.cancel',
  BILLING_PRINT: 'billing.print',
  BILLING_CLOSE: 'billing.close',

  // Menu & Catalog
  MENU_VIEW: 'menu.view',
  MENU_EDIT: 'menu.edit',
  MENU_MANAGE: 'menu.manage',
  MENU_PRICE_CHANGE: 'menu.price_change',

  // Tables & Areas
  TABLE_VIEW: 'table.view',
  TABLE_MANAGE: 'table.manage',
  AREA_VIEW: 'area.view',
  AREA_MANAGE: 'area.manage',

  // User & Role Management
  USER_VIEW: 'user.view',
  USER_MANAGE: 'user.manage',
  ROLE_VIEW: 'role.view',
  ROLE_MANAGE: 'role.manage',

  // Customer Management
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_EDIT: 'customer.edit',
  CUSTOMER_MANAGE: 'customer.manage',

  // Reports & Auditing
  REPORT_VIEW: 'report.view',
  AUDIT_VIEW: 'audit.view',

  // System Settings
  BRANCH_VIEW: 'branch.view',
  BRANCH_MANAGE: 'branch.manage',
  SETTINGS_MANAGE: 'settings.manage',
};

export const PERMISSION_DEFINITIONS = [
  // Orders
  { code: PERMISSIONS.ORDER_VIEW, name: 'View Orders', module: 'Orders', description: 'View live orders, tables, and order history' },
  { code: PERMISSIONS.ORDER_CREATE, name: 'Create Order', module: 'Orders', description: 'Create draft or hold table order' },
  { code: PERMISSIONS.ORDER_SUBMIT, name: 'Submit Order', module: 'Orders', description: 'Submit order to reception for confirmation' },
  { code: PERMISSIONS.ORDER_CONFIRM, name: 'Confirm Order', module: 'Orders', description: 'Approve incoming orders' },
  { code: PERMISSIONS.ORDER_MODIFY, name: 'Modify Order', module: 'Orders', description: 'Add/remove items or change dish instructions' },
  { code: PERMISSIONS.ORDER_HOLD, name: 'Hold / Resume Order', module: 'Orders', description: 'Put orders on hold or resume them' },
  { code: PERMISSIONS.ORDER_REJECT, name: 'Reject Order', module: 'Orders', description: 'Reject submitted orders with mandatory reason' },
  { code: PERMISSIONS.ORDER_CANCEL, name: 'Cancel Order', module: 'Orders', description: 'Cancel an order with mandatory reason' },

  // Kitchen & KOT
  { code: PERMISSIONS.KOT_VIEW, name: 'View KOT', module: 'Kitchen', description: 'View kitchen display (KDS) and KOT queue' },
  { code: PERMISSIONS.KOT_SEND, name: 'Send KOT', module: 'Kitchen', description: 'Generate and dispatch KOT to kitchen' },
  { code: PERMISSIONS.KOT_MODIFY, name: 'Modify KOT', module: 'Kitchen', description: 'Issue delta/modification KOT for changed orders' },
  { code: PERMISSIONS.KOT_CANCEL, name: 'Cancel KOT', module: 'Kitchen', description: 'Cancel KOT tickets or items' },
  { code: PERMISSIONS.KITCHEN_UPDATE, name: 'Kitchen Progress', module: 'Kitchen', description: 'Update status to preparing/ready/served' },

  // Billing & Payments
  { code: PERMISSIONS.BILLING_VIEW, name: 'View Billing Desk', module: 'Billing', description: 'Access billing desk and invoice lists' },
  { code: PERMISSIONS.BILLING_GENERATE, name: 'Generate Bill', module: 'Billing', description: 'Generate final invoice and review totals' },
  { code: PERMISSIONS.BILLING_DISCOUNT, name: 'Apply Discount', module: 'Billing', description: 'Apply bill discount within authorized limits' },
  { code: PERMISSIONS.PAYMENT_COLLECT, name: 'Collect Payment', module: 'Billing', description: 'Accept Cash/UPI/Card/Split payments and settle balance' },
  { code: PERMISSIONS.BILL_CANCEL, name: 'Cancel / Void Bill', module: 'Billing', description: 'Void or cancel generated bill' },
  { code: PERMISSIONS.BILLING_PRINT, name: 'Print Receipts', module: 'Billing', description: 'Print customer tax invoices and bills' },

  // Menu & Catalog
  { code: PERMISSIONS.MENU_VIEW, name: 'View Menu', module: 'Menu', description: 'View categories, items, and pricing' },
  { code: PERMISSIONS.MENU_EDIT, name: 'Edit Menu', module: 'Menu', description: 'Create and edit products, categories, availability' },
  { code: PERMISSIONS.MENU_PRICE_CHANGE, name: 'Change Prices', module: 'Menu', description: 'Update dish prices and maintain price history' },

  // Tables & Areas
  { code: PERMISSIONS.TABLE_VIEW, name: 'View Tables', module: 'Tables', description: 'View floor layout, table statuses, and seating' },
  { code: PERMISSIONS.TABLE_MANAGE, name: 'Manage Tables', module: 'Tables', description: 'Create, edit, and arrange dining tables' },
  { code: PERMISSIONS.AREA_MANAGE, name: 'Manage Areas & Stations', module: 'Tables', description: 'Configure dining areas and kitchen stations' },

  // Staff & Administration
  { code: PERMISSIONS.USER_VIEW, name: 'View Staff', module: 'Administration', description: 'View staff list and profiles' },
  { code: PERMISSIONS.USER_MANAGE, name: 'Manage Staff', module: 'Administration', description: 'Create, edit, and deactivate staff accounts' },
  { code: PERMISSIONS.ROLE_VIEW, name: 'View Roles', module: 'Administration', description: 'View roles and system permission matrix' },
  { code: PERMISSIONS.ROLE_MANAGE, name: 'Manage Roles', module: 'Administration', description: 'Configure roles and assign operational permissions' },

  // Customers
  { code: PERMISSIONS.CUSTOMER_VIEW, name: 'View Customers', module: 'Customers', description: 'Search and view customer records and history' },
  { code: PERMISSIONS.CUSTOMER_EDIT, name: 'Edit Customers', module: 'Customers', description: 'Create and edit customer contact details' },

  // Reports
  { code: PERMISSIONS.REPORT_VIEW, name: 'View Reports', module: 'Reports', description: 'Access sales, item, revenue, and staff reports' },

  // Audit Logs
  { code: PERMISSIONS.AUDIT_VIEW, name: 'View Audit Logs', module: 'Audit', description: 'Inspect system operational activity logs' },

  // System Settings
  { code: PERMISSIONS.BRANCH_VIEW, name: 'View Branch Profile', module: 'Settings', description: 'View restaurant branch details and configuration' },
  { code: PERMISSIONS.SETTINGS_MANAGE, name: 'Manage Settings', module: 'Settings', description: 'Configure branch, taxes, discounts, and system policies' },
];
