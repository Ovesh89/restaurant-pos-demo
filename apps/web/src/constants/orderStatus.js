export const ORDER_STATUS = {
  DRAFT: 'DRAFT',
  HOLD: 'HOLD',
  SUBMITTED: 'SUBMITTED',
  WAITING_CONFIRMATION: 'WAITING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  KOT_SENT: 'KOT_SENT',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  BILLING: 'BILLING',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED'
};

export const ORDER_STATUS_CONFIG = {
  [ORDER_STATUS.DRAFT]: { label: 'Draft', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  [ORDER_STATUS.HOLD]: { label: 'Hold / Paused', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  [ORDER_STATUS.SUBMITTED]: { label: 'Submitted', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  [ORDER_STATUS.WAITING_CONFIRMATION]: { label: 'Waiting Approval', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  [ORDER_STATUS.CONFIRMED]: { label: 'Confirmed', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  [ORDER_STATUS.KOT_SENT]: { label: 'KOT Sent', color: 'bg-sky-100 text-sky-800 border-sky-300' },
  [ORDER_STATUS.PREPARING]: { label: 'In Kitchen', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  [ORDER_STATUS.READY]: { label: 'Ready to Serve', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  [ORDER_STATUS.SERVED]: { label: 'Served', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  [ORDER_STATUS.BILLING]: { label: 'In Billing', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  [ORDER_STATUS.PAYMENT_PENDING]: { label: 'Payment Pending', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  [ORDER_STATUS.COMPLETED]: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  [ORDER_STATUS.CANCELLED]: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-300' },
  [ORDER_STATUS.REJECTED]: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-300' }
};

export const KOT_STATUS = {
  NEW: 'NEW',
  PREPARING: 'PREPARING',
  READY: 'READY',
  CANCELLED: 'CANCELLED'
};

export const KOT_STATUS_CONFIG = {
  [KOT_STATUS.NEW]: { label: 'New Ticket', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  [KOT_STATUS.PREPARING]: { label: 'Cooking', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  [KOT_STATUS.READY]: { label: 'Ready for Pickup', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  [KOT_STATUS.CANCELLED]: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-300' }
};

export const KOT_TYPE = {
  NEW: 'NEW',
  MODIFICATION: 'MODIFICATION',
  CANCELLATION: 'CANCELLATION'
};

export const getOrderStatusConfig = (status, t = null) => {
  const base = ORDER_STATUS_CONFIG[status] || { label: status, color: 'bg-slate-100 text-slate-700' };
  if (!t) return base;

  const keyMap = {
    [ORDER_STATUS.DRAFT]: 'common.draft',
    [ORDER_STATUS.HOLD]: 'orders.holdOrder',
    [ORDER_STATUS.SUBMITTED]: 'common.submitted',
    [ORDER_STATUS.WAITING_CONFIRMATION]: 'dashboard.waitingApproval',
    [ORDER_STATUS.CONFIRMED]: 'common.confirmed',
    [ORDER_STATUS.KOT_SENT]: 'orders.kotSent',
    [ORDER_STATUS.PREPARING]: 'common.preparing',
    [ORDER_STATUS.READY]: 'common.ready',
    [ORDER_STATUS.SERVED]: 'common.served',
    [ORDER_STATUS.BILLING]: 'orders.inBilling',
    [ORDER_STATUS.PAYMENT_PENDING]: 'orders.billPending',
    [ORDER_STATUS.COMPLETED]: 'common.completed',
    [ORDER_STATUS.CANCELLED]: 'common.cancelled',
    [ORDER_STATUS.REJECTED]: 'common.rejected'
  };

  const key = keyMap[status];
  const translated = key ? t(key, null, base.label) : base.label;

  return {
    ...base,
    label: translated
  };
};

export const getKotStatusConfig = (status, t = null) => {
  const base = KOT_STATUS_CONFIG[status] || { label: status, color: 'bg-slate-100 text-slate-700' };
  if (!t) return base;

  const keyMap = {
    [KOT_STATUS.NEW]: 'common.new',
    [KOT_STATUS.PREPARING]: 'common.preparing',
    [KOT_STATUS.READY]: 'common.ready',
    [KOT_STATUS.CANCELLED]: 'common.cancelled'
  };

  const key = keyMap[status];
  const translated = key ? t(key, null, base.label) : base.label;

  return {
    ...base,
    label: translated
  };
};
