import { auditService } from './service.js';

let cleanupTimeoutId = null;
let nextScheduledRunTime = null;
const DEFAULT_RETENTION_DAYS = 30;

/**
 * Calculate the number of milliseconds until the next 12:00:00 AM (midnight).
 * Uses the local system clock so it runs precisely at local midnight (IST/local).
 */
export function getMsUntilMidnight() {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );
  const diff = nextMidnight.getTime() - now.getTime();
  // Ensure positive delay (minimum 1 second buffer)
  return Math.max(1000, diff);
}

/**
 * Execute the audit log purge routine.
 * Removes all records older than retention period (default 30 days).
 * @param {number} days - Retention period in days
 */
export async function executeAuditCleanup(days = DEFAULT_RETENTION_DAYS) {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[AuditScheduler] [${timestamp}] Starting scheduled audit trail cleanup (Retention: ${days} days)...`);

    const result = await auditService.purgeOldLogs(days);

    console.log(
      `[AuditScheduler] [${timestamp}] Audit trail cleanup finished. Deleted ${result.deletedCount} log(s) older than ${result.cutoffDate}.`
    );

    // If records were purged, record a system audit event
    if (result.deletedCount > 0) {
      await auditService.logAction({
        action: 'AUDIT_LOGS_PURGED',
        entityType: 'AUDIT_TRAIL',
        entityId: 'RETENTION_POLICY',
        actorName: 'System Scheduler (12:00 AM)',
        reason: 'Automated 30-day operational retention policy purge',
        details: `Automatically removed ${result.deletedCount} operational audit log(s) older than ${result.cutoffDate} during midnight scheduled check.`,
        metadata: {
          deletedCount: result.deletedCount,
          cutoffDate: result.cutoffDate,
          retentionDays: days,
        },
      });
    }

    return result;
  } catch (error) {
    console.error('[AuditScheduler] Error during scheduled audit cleanup:', error);
    return { error: error.message };
  }
}

/**
 * Schedule the next midnight cleanup task.
 */
function scheduleNextMidnightRun() {
  const ms = getMsUntilMidnight();
  const nextDate = new Date(Date.now() + ms);
  nextScheduledRunTime = nextDate.toISOString();

  const hours = (ms / (1000 * 60 * 60)).toFixed(2);
  console.log(
    `[AuditScheduler] Next 12:00 AM audit cleanup scheduled at ${nextScheduledRunTime} (in ~${hours} hours)`
  );

  cleanupTimeoutId = setTimeout(async () => {
    try {
      await executeAuditCleanup(DEFAULT_RETENTION_DAYS);
    } finally {
      // Recursively schedule the subsequent midnight run
      scheduleNextMidnightRun();
    }
  }, ms);
}

/**
 * Initialize the 12:00 AM daily audit cleanup scheduler.
 * Performs an immediate cleanup on startup, then schedules daily execution at 12:00 AM midnight.
 */
export function initAuditCleanupScheduler() {
  console.log('[AuditScheduler] Initializing 30-day audit retention policy scheduler (12:00 AM daily check)...');

  // Cancel any existing timer
  stopAuditScheduler();

  // Run initial cleanup in background to ensure clean state after restart
  executeAuditCleanup(DEFAULT_RETENTION_DAYS).catch((err) => {
    console.error('[AuditScheduler] Initial startup cleanup warning:', err);
  });

  // Schedule next midnight run
  scheduleNextMidnightRun();
}

/**
 * Stop the running audit cleanup scheduler (used during graceful shutdown or testing).
 */
export function stopAuditScheduler() {
  if (cleanupTimeoutId) {
    clearTimeout(cleanupTimeoutId);
    cleanupTimeoutId = null;
    nextScheduledRunTime = null;
  }
}

/**
 * Retrieve current scheduler operational status.
 */
export function getAuditSchedulerStatus() {
  return {
    isRunning: cleanupTimeoutId !== null,
    nextRunAt: nextScheduledRunTime,
    retentionDays: DEFAULT_RETENTION_DAYS,
    schedule: 'Every day at 12:00 AM (midnight)',
  };
}
