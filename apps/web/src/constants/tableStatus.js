export const TABLE_STATUS = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  ORDER_IN_PROGRESS: 'ORDER_IN_PROGRESS',
  WAITING_CONFIRMATION: 'WAITING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  KOT_SENT: 'KOT_SENT',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  BILL_PENDING: 'BILL_PENDING',
  BILLING: 'BILLING',
  PAID: 'PAID'
};

export const TABLE_STATUS_CONFIG = {
  [TABLE_STATUS.AVAILABLE]: {
    label: 'Available',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dot: 'bg-emerald-500'
  },
  [TABLE_STATUS.OCCUPIED]: {
    label: 'Occupied',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    dot: 'bg-blue-500'
  },
  [TABLE_STATUS.ORDER_IN_PROGRESS]: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    dot: 'bg-blue-500'
  },
  [TABLE_STATUS.WAITING_CONFIRMATION]: {
    label: 'Waiting Approval',
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    dot: 'bg-amber-500'
  },
  [TABLE_STATUS.CONFIRMED]: {
    label: 'Confirmed',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    dot: 'bg-indigo-500'
  },
  [TABLE_STATUS.KOT_SENT]: {
    label: 'KOT Sent',
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    dot: 'bg-amber-500'
  },
  [TABLE_STATUS.PREPARING]: {
    label: 'Preparing',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    dot: 'bg-orange-500'
  },
  [TABLE_STATUS.READY]: {
    label: 'Ready',
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    dot: 'bg-purple-500'
  },
  [TABLE_STATUS.SERVED]: {
    label: 'Served',
    color: 'bg-teal-100 text-teal-800 border-teal-300',
    dot: 'bg-teal-500'
  },
  [TABLE_STATUS.BILL_PENDING]: {
    label: 'Bill Pending',
    color: 'bg-rose-100 text-rose-800 border-rose-300',
    dot: 'bg-rose-500'
  },
  [TABLE_STATUS.BILLING]: {
    label: 'In Billing',
    color: 'bg-rose-100 text-rose-800 border-rose-300',
    dot: 'bg-rose-500'
  },
  [TABLE_STATUS.PAID]: {
    label: 'Paid / Cleaning',
    color: 'bg-teal-100 text-teal-800 border-teal-300',
    dot: 'bg-teal-500'
  }
};

export const getTableStatusConfig = (status, t = null) => {
  if (!status) return TABLE_STATUS_CONFIG[TABLE_STATUS.AVAILABLE];
  const normalized = String(status).trim().toUpperCase().replace(/[-\s]/g, '_');

  // Alias resolution
  let resolvedKey = normalized;
  if (
    resolvedKey === 'IN_PROGRESS' ||
    resolvedKey === 'ORDERING' ||
    resolvedKey === 'DRAFT' ||
    resolvedKey === 'HOLD'
  ) {
    resolvedKey = TABLE_STATUS.ORDER_IN_PROGRESS;
  } else if (resolvedKey === 'SEATED') {
    resolvedKey = TABLE_STATUS.OCCUPIED;
  } else if (resolvedKey === 'SENT') {
    resolvedKey = TABLE_STATUS.KOT_SENT;
  } else if (resolvedKey === 'COOKING') {
    resolvedKey = TABLE_STATUS.PREPARING;
  } else if (resolvedKey === 'BILLED' || resolvedKey === 'PAYMENT_PENDING') {
    resolvedKey = TABLE_STATUS.BILL_PENDING;
  }

  // Safety fallback: if status is not AVAILABLE and unknown, default to Occupied style rather than Available
  const base = TABLE_STATUS_CONFIG[resolvedKey] || (
    normalized === 'AVAILABLE'
      ? TABLE_STATUS_CONFIG[TABLE_STATUS.AVAILABLE]
      : {
          label: String(status).charAt(0).toUpperCase() + String(status).slice(1),
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          dot: 'bg-blue-500'
        }
  );

  if (!t) return base;

  const keyMap = {
    [TABLE_STATUS.AVAILABLE]: 'common.available',
    [TABLE_STATUS.OCCUPIED]: 'common.occupied',
    [TABLE_STATUS.ORDER_IN_PROGRESS]: 'common.inProgress',
    [TABLE_STATUS.WAITING_CONFIRMATION]: 'dashboard.waitingApproval',
    [TABLE_STATUS.CONFIRMED]: 'common.confirmed',
    [TABLE_STATUS.KOT_SENT]: 'orders.kotSent',
    [TABLE_STATUS.PREPARING]: 'common.preparing',
    [TABLE_STATUS.READY]: 'common.ready',
    [TABLE_STATUS.SERVED]: 'common.served',
    [TABLE_STATUS.BILL_PENDING]: 'common.billed',
    [TABLE_STATUS.BILLING]: 'common.billed',
    [TABLE_STATUS.PAID]: 'common.paid'
  };

  const key = keyMap[resolvedKey];
  const translated = key ? t(key, null, base.label) : base.label;

  return {
    ...base,
    label: translated
  };
};
