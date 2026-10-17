import { ValidationAppError } from '../middleware/errorHandler.js';

/**
 * Normalize and validate a phone number to a 10-digit Indian mobile number.
 * Mirrors apps/customers/utils.py in Django source backend 1:1.
 */
export function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new ValidationAppError('Phone number is required.');
  }
  const digits = rawPhone.replace(/\D/g, '');
  let normalized = digits;

  if (digits.length === 12 && digits.startsWith('91')) {
    normalized = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    normalized = digits.slice(1);
  }

  if (normalized.length !== 10 || !/^[6-9]\d{9}$/.test(normalized)) {
    throw new ValidationAppError(
      'Invalid phone number. Must be a valid 10-digit mobile number starting with 6-9.'
    );
  }

  return normalized;
}
