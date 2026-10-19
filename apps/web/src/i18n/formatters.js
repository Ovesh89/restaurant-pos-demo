/**
 * Internationalization and English Numeral Formatters
 *
 * CRITICAL BUSINESS RULE:
 * Numbers, currency amounts, item counts, and monetary values must always
 * be displayed in standard English numerals (0-9).
 * Even when the interface is in Gujarati, Hindi, Urdu, Telugu, Tamil, Kannada, or Malayalam,
 * numerals MUST NOT be converted to regional script digits.
 */

export const formatEnglishNumber = (value, options = {}) => {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('en-US', options);
};

export const formatEnglishCurrency = (value, symbol = '₹') => {
  if (value === null || value === undefined || value === '') return `${symbol}0.00`;
  const num = Number(value);
  if (Number.isNaN(num)) return `${symbol}0.00`;
  return `${symbol}${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export const formatEnglishPrice = (value, symbol = '₹') => {
  if (value === null || value === undefined || value === '') return `${symbol}0`;
  const num = Number(value);
  if (Number.isNaN(num)) return `${symbol}0`;
  return Number.isInteger(num)
    ? `${symbol}${num.toLocaleString('en-US')}`
    : `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Replaces {param} in string with English-formatted values
 */
export const interpolateString = (template, params = {}) => {
  if (!template) return '';
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return String(template);
  }
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    if (key in params) {
      const val = params[key];
      if (typeof val === 'number') {
        return formatEnglishNumber(val);
      }
      return val !== undefined && val !== null ? String(val) : '';
    }
    return match;
  });
};
