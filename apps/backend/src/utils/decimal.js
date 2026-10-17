import Decimal from 'decimal.js';
import { ValidationAppError } from '../middleware/errorHandler.js';

// Configure Decimal to match Python's ROUND_HALF_UP
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/**
 * Convert a number, string, or Decimal into a Decimal instance.
 * Throws ValidationAppError if invalid.
 */
export function toDecimal(value, fieldName = 'amount') {
  if (value instanceof Decimal) {
    return value;
  }
  if (value === null || value === undefined || value === '') {
    throw new ValidationAppError(`Invalid decimal value for ${fieldName}.`);
  }
  try {
    const d = new Decimal(String(value).trim());
    if (!d.isFinite()) {
      throw new Error('Non-finite decimal');
    }
    return d;
  } catch {
    throw new ValidationAppError(`Invalid numeric value for ${fieldName}: "${value}".`);
  }
}

/**
 * Format any numeric/Decimal value as a 2-decimal string ("240.00") using ROUND_HALF_UP.
 */
export function formatMoney(value) {
  const d = value instanceof Decimal ? value : toDecimal(value ?? '0.00');
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/**
 * Round a Decimal value to 2 decimal places using ROUND_HALF_UP and return a Decimal.
 */
export function roundMoney(value) {
  const d = value instanceof Decimal ? value : toDecimal(value ?? '0.00');
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
