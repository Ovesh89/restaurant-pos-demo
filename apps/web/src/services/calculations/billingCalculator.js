export const DISCOUNT_TYPES = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED'
};

export const PAYMENT_MODES = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  OTHER: 'OTHER'
};

export class BillingCalculator {
  /**
   * Deterministically calculates bill totals from canonical order items, discounts, and payments
   *
   * @param {Array} items - Canonical order items [{ quantity, unitPrice, taxRate }]
   * @param {Object} discount - { type: 'PERCENTAGE'|'FIXED', value: number, reason: string }
   * @param {number} taxRate - Default tax rate (e.g. 5.0 for 5% GST)
   * @param {Array} payments - Existing payment entries [{ mode, amount }]
   * @returns {Object} Comprehensive calculated financial figures
   */
  calculate({
    items = [],
    discount = { type: DISCOUNT_TYPES.FIXED, value: 0 },
    taxRate = 5.0,
    payments = []
  }) {
    // 1. Calculate food subtotal
    const subtotal = items.reduce((acc, item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.unitPrice) || 0;
      return acc + qty * rate;
    }, 0);

    // 2. Calculate discount amount
    let discountAmount = 0;
    const discountVal = Number(discount?.value) || 0;

    if (discountVal > 0 && subtotal > 0) {
      if (discount.type === DISCOUNT_TYPES.PERCENTAGE) {
        // Percentage cannot exceed 100%
        const safePercent = Math.min(100, Math.max(0, discountVal));
        discountAmount = (subtotal * safePercent) / 100;
      } else {
        // Fixed amount cannot exceed subtotal
        discountAmount = Math.min(subtotal, Math.max(0, discountVal));
      }
    }

    // Keep 2 decimal places precision for financial accuracy
    discountAmount = Math.round(discountAmount * 100) / 100;

    // 3. Taxable value
    const taxableValue = Math.max(0, subtotal - discountAmount);

    // 4. Tax amount (e.g. 5% GST -> 2.5% CGST + 2.5% SGST)
    const effectiveTaxRate = Number(taxRate) >= 0 ? Number(taxRate) : 5.0;
    const taxAmount = Math.round(((taxableValue * effectiveTaxRate) / 100) * 100) / 100;

    const cgst = Math.round((taxAmount / 2) * 100) / 100;
    const sgst = Math.round((taxAmount - cgst) * 100) / 100;

    // 5. Total before rounding
    const exactTotal = taxableValue + taxAmount;

    // 6. Rounding adjustment to nearest whole rupee
    const grandTotal = Math.round(exactTotal);
    const rounding = Math.round((grandTotal - exactTotal) * 100) / 100;

    // 7. Sum of payment entries
    const paidAmount = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    // 8. Remaining balance
    const balance = Math.max(0, grandTotal - paidAmount);
    const isSettled = balance <= 0 && grandTotal > 0 && paidAmount >= grandTotal;

    return {
      subtotal,
      discountType: discount?.type || DISCOUNT_TYPES.FIXED,
      discountValue: discountVal,
      discountAmount,
      discountReason: discount?.reason || '',
      taxableValue,
      taxableAmount: taxableValue,
      taxRate: effectiveTaxRate,
      cgst,
      cgstAmount: cgst,
      sgst,
      sgstAmount: sgst,
      taxAmount,
      rounding,
      grandTotal,
      paidAmount,
      balance,
      isSettled
    };
  }
}

export const billingCalculator = new BillingCalculator();
