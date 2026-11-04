/**
 * Operational Date & Shift Time Helper for Restaurant POS
 *
 * Operating Schedule:
 * - Breakfast / Lunch: 5:00 AM to 5:00 PM (05:00 to 17:00 IST)
 * - Dinner: 5:00 PM to 5:00 AM next day (17:00 to 05:00+1 IST)
 * - Full Operational Day: 5:00 AM to 5:00 AM next day (05:00 to 05:00+1 IST)
 */

export const SHIFT_SESSIONS = {
  ALL: 'ALL',
  LUNCH: 'LUNCH',
  DINNER: 'DINNER',
};

export const TIMEZONE = 'Asia/Kolkata';
export const TZ_OFFSET = '+05:30';

/**
 * Gets the current operational date (YYYY-MM-DD) and current shift session based on 5AM - 5PM (Lunch) and 5PM - 5AM (Dinner)
 */
export function getCurrentOperationalInfo(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hour = parseInt(partMap.hour, 10);

  let opYear = year;
  let opMonth = month;
  let opDay = day;
  let currentSession = 'LUNCH';

  if (hour < 5) {
    // 00:00 to 04:59: belongs to previous calendar day's DINNER shift
    const prev = new Date(Date.UTC(year, month - 1, day - 1));
    opYear = prev.getUTCFullYear();
    opMonth = prev.getUTCMonth() + 1;
    opDay = prev.getUTCDate();
    currentSession = 'DINNER';
  } else if (hour < 17) {
    // 05:00 to 16:59: LUNCH shift
    currentSession = 'LUNCH';
  } else {
    // 17:00 to 23:59: DINNER shift
    currentSession = 'DINNER';
  }

  const operationalDate = `${opYear}-${String(opMonth).padStart(2, '0')}-${String(opDay).padStart(2, '0')}`;

  return {
    operationalDate,
    currentSession,
    sessionLabel:
      currentSession === 'DINNER'
        ? 'Dinner (5 PM - 5 AM)'
        : 'Lunch & Breakfast (5 AM - 5 PM)',
  };
}

/**
 * Resolves the precise ISO string bounds for querying database documents.
 */
export function resolveOperationalTimeRange({
  date = null,
  session = 'ALL',
  dateFrom = null,
  dateTo = null,
  month = null,
} = {}) {
  const normSession = String(session || 'ALL').toUpperCase();

  // If explicit month provided (YYYY-MM)
  if (month && /^\d{4}-\d{2}$/.test(String(month).trim())) {
    const trimmedMonth = String(month).trim();
    const [yStr, mStr] = trimmedMonth.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const start = new Date(`${trimmedMonth}-01T05:00:00${TZ_OFFSET}`).toISOString();
    // Month ends at 5 AM of the 1st of next month
    const nextMonthFirst = new Date(Date.UTC(y, m, 1));
    const nextY = nextMonthFirst.getUTCFullYear();
    const nextM = String(nextMonthFirst.getUTCMonth() + 1).padStart(2, '0');
    const end = new Date(`${nextY}-${nextM}-01T05:00:00${TZ_OFFSET}`).toISOString();
    return { start, end };
  }

  // Single date query or dateFrom === dateTo
  const targetDate = date || (dateFrom && dateTo && dateFrom === dateTo ? dateFrom : null);

  if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(String(targetDate).trim())) {
    const dStr = String(targetDate).trim();
    const [y, m, d] = dStr.split('-').map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
    const nextDStr = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')}`;

    if (normSession === 'LUNCH') {
      return {
        start: new Date(`${dStr}T05:00:00${TZ_OFFSET}`).toISOString(),
        end: new Date(`${dStr}T17:00:00${TZ_OFFSET}`).toISOString(),
      };
    }
    if (normSession === 'DINNER') {
      return {
        start: new Date(`${dStr}T17:00:00${TZ_OFFSET}`).toISOString(),
        end: new Date(`${nextDStr}T05:00:00${TZ_OFFSET}`).toISOString(),
      };
    }
    // ALL / FULL DAY
    return {
      start: new Date(`${dStr}T05:00:00${TZ_OFFSET}`).toISOString(),
      end: new Date(`${nextDStr}T05:00:00${TZ_OFFSET}`).toISOString(),
    };
  }

  // Range of dates: dateFrom to dateTo
  let start = null;
  let end = null;

  if (dateFrom) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateFrom).trim())) {
      const time = normSession === 'DINNER' ? '17:00:00' : '05:00:00';
      start = new Date(`${String(dateFrom).trim()}T${time}${TZ_OFFSET}`).toISOString();
    } else {
      start = dateFrom;
    }
  }

  if (dateTo) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateTo).trim())) {
      if (normSession === 'LUNCH') {
        end = new Date(`${String(dateTo).trim()}T17:00:00${TZ_OFFSET}`).toISOString();
      } else {
        // DINNER or ALL ends at 05:00 AM next day
        const [y, m, d] = String(dateTo).trim().split('-').map(Number);
        const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
        const nextDStr = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')}`;
        end = new Date(`${nextDStr}T05:00:00${TZ_OFFSET}`).toISOString();
      }
    } else {
      end = dateTo;
    }
  }

  return { start, end };
}
