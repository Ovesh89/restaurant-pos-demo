/**
 * Operational Date & Shift Time Helper for Restaurant POS Web Client
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
 * Gets current operational date and active meal shift session
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
    currentSession = 'LUNCH';
  } else {
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
 * Returns formatted session display string
 */
export function getSessionBadge(session) {
  const norm = String(session || 'ALL').toUpperCase();
  if (norm === 'LUNCH') {
    return {
      label: 'Lunch / Breakfast (5 AM - 5 PM)',
      shortLabel: 'Lunch (5AM - 5PM)',
      icon: '☀️',
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  if (norm === 'DINNER') {
    return {
      label: 'Dinner (5 PM - 5 AM)',
      shortLabel: 'Dinner (5PM - 5AM)',
      icon: '🌙',
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    };
  }
  return {
    label: 'All Day (5 AM - 5 AM)',
    shortLabel: 'All Day (24 Hrs)',
    icon: '🕒',
    color: 'bg-slate-100 text-slate-700 border-slate-300',
  };
}
