export const TABLE_STATUS = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  KOT_SENT: 'KOT_SENT',
  PREPARING: 'PREPARING',
  READY: 'READY',
  BILL_PENDING: 'BILL_PENDING',
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
  [TABLE_STATUS.BILL_PENDING]: {
    label: 'Bill Pending',
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
  const base = TABLE_STATUS_CONFIG[status] || TABLE_STATUS_CONFIG[TABLE_STATUS.AVAILABLE];
  if (!t) return base;

  const keyMap = {
    [TABLE_STATUS.AVAILABLE]: 'common.available',
    [TABLE_STATUS.OCCUPIED]: 'common.occupied',
    [TABLE_STATUS.KOT_SENT]: 'orders.kotSent',
    [TABLE_STATUS.PREPARING]: 'common.preparing',
    [TABLE_STATUS.READY]: 'common.ready',
    [TABLE_STATUS.BILL_PENDING]: 'common.billed',
    [TABLE_STATUS.PAID]: 'common.paid'
  };

  const key = keyMap[status];
  const translated = key ? t(key, null, base.label) : base.label;

  return {
    ...base,
    label: translated
  };
};
