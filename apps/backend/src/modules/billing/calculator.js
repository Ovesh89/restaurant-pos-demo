import { Decimal, toDecimal, roundMoney, formatMoney } from '../../utils/decimal.js';

export class BillingCalculator {
  static calculateBill({
    items = [],
    discountInput = null,
    branchTaxConfig = null,
    paidAmountInput = '0.00',
  } = {}) {
    const taxConfig = branchTaxConfig || { rate: '5.00', gstRate: '5.00', mode: 'EXCLUSIVE' };
    const defaultRate = toDecimal(taxConfig.rate ?? taxConfig.gstRate ?? '5.00');
    const defaultMode = String(taxConfig.mode || 'EXCLUSIVE').toUpperCase();

    let subtotal = toDecimal(0);
    const processedItems = [];

    for (const item of items) {
      if ((item.status || 'ACTIVE') === 'CANCELLED') continue;

      const unitPrice = toDecimal(item.unitPrice ?? item.price ?? '0.00');
      const qty = toDecimal(item.quantity ?? 1);
      const lineSubtotal = roundMoney(unitPrice.times(qty));
      subtotal = subtotal.plus(lineSubtotal);

      const itemTaxConf = item.taxConfig || {};
      const rate = toDecimal(itemTaxConf.rate ?? defaultRate);
      const mode = String(itemTaxConf.mode || defaultMode).toUpperCase();

      processedItems.push({
        ...item,
        unitPrice: formatMoney(unitPrice),
        lineSubtotal: formatMoney(lineSubtotal),
        taxConfig: {
          rate: formatMoney(rate),
          mode,
        },
      });
    }

    subtotal = roundMoney(subtotal);

    // Discount calculation
    let discountAmount = toDecimal(0);
    let discountMeta = {
      type: 'NONE',
      value: '0.00',
      amount: '0.00',
      reason: null,
    };

    if (discountInput && discountInput.type) {
      const dType = String(discountInput.type || 'NONE').toUpperCase();
      let dVal = toDecimal(discountInput.value ?? '0.00');
      const dReason = String(discountInput.reason || '').trim() || null;

      if (dType === 'PERCENTAGE') {
        if (dVal.gt(100)) dVal = toDecimal(100);
        if (dVal.lt(0)) dVal = toDecimal(0);
        discountAmount = roundMoney(subtotal.times(dVal.div(100)));
        discountMeta = {
          type: 'PERCENTAGE',
          value: formatMoney(dVal),
          amount: formatMoney(discountAmount),
          reason: dReason,
        };
      } else if (dType === 'FIXED') {
        if (dVal.lt(0)) dVal = toDecimal(0);
        discountAmount = roundMoney(Decimal.min(subtotal, dVal));
        discountMeta = {
          type: 'FIXED',
          value: formatMoney(dVal),
          amount: formatMoney(discountAmount),
          reason: dReason,
        };
      }
    }

    const taxableAmount = roundMoney(Decimal.max(0, subtotal.minus(discountAmount)));

    // GST calculation (2.5% CGST + 2.5% SGST for 5% GST)
    let taxAmount;
    let unroundedTotal;
    if (defaultMode === 'INCLUSIVE') {
      const divisor = toDecimal(1).plus(defaultRate.div(100));
      const base = roundMoney(taxableAmount.div(divisor));
      taxAmount = roundMoney(taxableAmount.minus(base));
      unroundedTotal = taxableAmount;
    } else {
      taxAmount = roundMoney(taxableAmount.times(defaultRate.div(100)));
      unroundedTotal = roundMoney(taxableAmount.plus(taxAmount));
    }

    const cgstRate = roundMoney(defaultRate.div(2));
    const sgstRate = cgstRate;
    const cgstAmount = roundMoney(taxAmount.div(2));
    const sgstAmount = roundMoney(taxAmount.minus(cgstAmount));

    // Mathematical rounding to nearest Rupee (ROUND_HALF_UP)
    const grandTotal = unroundedTotal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    const rounding = roundMoney(grandTotal.minus(unroundedTotal));

    const paidAmount = roundMoney(toDecimal(paidAmountInput ?? '0.00'));
    const balanceAmount = roundMoney(Decimal.max(0, grandTotal.minus(paidAmount)));

    return {
      items: processedItems,
      subtotal: formatMoney(subtotal),
      discount: discountMeta,
      taxableAmount: formatMoney(taxableAmount),
      tax: formatMoney(taxAmount),
      taxRate: formatMoney(defaultRate),
      taxMode: defaultMode,
      cgst: formatMoney(cgstAmount),
      sgst: formatMoney(sgstAmount),
      taxBreakdown: [
        {
          rate: formatMoney(defaultRate),
          mode: defaultMode,
          amount: formatMoney(taxAmount),
          cgstRate: formatMoney(cgstRate),
          cgstAmount: formatMoney(cgstAmount),
          sgstRate: formatMoney(sgstRate),
          sgstAmount: formatMoney(sgstAmount),
        },
      ],
      rounding: formatMoney(rounding),
      grandTotal: formatMoney(grandTotal),
      paidAmount: formatMoney(paidAmount),
      balanceAmount: formatMoney(balanceAmount),
    };
  }
}
