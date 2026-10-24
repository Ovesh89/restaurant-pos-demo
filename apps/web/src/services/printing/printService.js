import { RESTAURANT_LOGO_B64 } from '../../assets/logoBase64.js';
import { generateUpiQrDataUrl } from './qrGenerator.js';
import { DEFAULT_SETTINGS } from '../repositories/local/settingsLocalRepository.js';
import { storageAdapter } from '../storage/localStorageAdapter.js';
import { STORAGE_KEYS } from '../../constants/storageKeys.js';

export const normalizeMoney = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const num = Number(value);
  if (isNaN(num)) {
    console.warn(`[normalizeMoney] Invalid numeric value: ${value}`);
    return fallback;
  }
  return num;
};

export const formatMoney = (value, fallback = 0) => {
  const num = normalizeMoney(value, fallback);
  return num.toFixed(2);
};

/**
 * Truncates dish name so it fits on exactly one line and preserves thermal receipt alignment.
 */
export const truncateReceiptName = (name, maxChars = 18) => {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.substring(0, maxChars - 3) + '...';
};

/**
 * Formats order, KOT, or bill numbers into clean daily sequence numbers for receipts.
 * Removes messy GUIDs and prefixes, returning clean sequences like '001', '002'.
 */
export const formatReceiptSequence = (code, fallback = '001') => {
  if (!code) return fallback;
  const str = String(code).trim();
  // Strip out standard UUID/GUID if present
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return fallback;
  }
  // If it contains hyphens like ORD-191026-001 or KOT-191026-002 or BILL-191026-001
  const parts = str.split('-');
  const lastPart = parts[parts.length - 1];
  if (/^\d+$/.test(lastPart)) {
    return lastPart.padStart(3, '0');
  }
  return str;
};

export class PrintService {
  /**
   * Resolves runtime settings merging defaults, localStorage cache, and call options
   */
  getEffectiveSettings(options = {}) {
    let cached = {};
    try {
      cached = storageAdapter.getItem(STORAGE_KEYS.SETTINGS) || {};
    } catch (e) {}

    return {
      ...DEFAULT_SETTINGS,
      ...cached,
      ...options,
    };
  }

  /**
   * Generates formatted plain text for standard 80mm / 48-column thermal printers
   */
  generateKOTReceiptText(kot, order, table, options = {}) {
    const divider = '------------------------------------------------';
    const lines = [];

    const cfg = this.getEffectiveSettings(options);
    const rName = (cfg.restaurantName || 'GREEN TANDOOR SE').toUpperCase();

    const cleanKotNo = formatReceiptSequence(kot.kotNo);
    const rawOrderNo = order ? order.orderNo : (kot.orderNumber || kot.orderId);
    const cleanOrderNo = formatReceiptSequence(rawOrderNo);

    lines.push('             *** KITCHEN ORDER TICKET ***       ');
    lines.push(`               ${rName}               `);
    lines.push(`KOT NO: ${cleanKotNo} (${kot.type || 'NEW'})`);
    lines.push(`TABLE : ${table ? 'Table ' + table.tableNo : kot.tableNo || 'N/A'}`);
    lines.push(`ORDER : ${cleanOrderNo}`);
    lines.push(`CAPTAIN: ${kot.captainName || (order ? order.captainName : 'Staff')}`);
    lines.push(`STATION: ${kot.station || 'All Stations'}`);
    lines.push(`TIME  : ${new Date(kot.createdAt).toLocaleString()}`);
    lines.push(divider);
    lines.push('QTY   ITEM NAME                                 ');
    lines.push(divider);

    kot.items.forEach((item) => {
      const qtyStr = String(item.quantity).padEnd(5, ' ');
      lines.push(`${qtyStr} ${truncateReceiptName(item.name, 28)}`);
      if (item.notes) {
        lines.push(`      * Note: ${item.notes}`);
      }
    });

    lines.push(divider);
    if (kot.revision > 1) {
      lines.push(`** MODIFICATION REVISION #${kot.revision} **`);
      if (kot.modificationReason) {
        lines.push(`Reason: ${kot.modificationReason}`);
      }
    }
    lines.push('\n\n\n');

    return lines.join('\n');
  }

  /**
   * Browser-based printing for KOT ticket using a printable window
   */
  printKOT(kot, order, table, options = {}) {
    try {
      const cfg = this.getEffectiveSettings(options);
      const receiptLogo = cfg.logoReceipt || cfg.logo || RESTAURANT_LOGO_B64;
      const rName = (cfg.restaurantName || 'GREEN TANDOOR SE').toUpperCase();
      const rTitle = cfg.tagline ? cfg.tagline.toUpperCase() : 'GARDEN RESTAURANT';

      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (!printWindow) {
        throw new Error('Pop-up was blocked. Please allow pop-ups for browser printing.');
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>KOT Print - ${kot.kotNo}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 13px;
              line-height: 1.3;
              color: #000;
              margin: 10px;
              width: 74mm;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .header { margin-bottom: 8px; }
            .receipt-logo {
              width: 60px;
              height: auto;
              max-height: 60px;
              margin: 0 auto 5px auto;
              display: block;
              object-fit: contain;
            }
            .title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
            .item-row { display: flex; justify-content: space-between; margin: 4px 0; }
            .item-qty { font-weight: bold; width: 35px; }
            .item-name { flex-grow: 1; }
            .note { font-style: italic; font-size: 11px; margin-left: 35px; }
            .badge { border: 1px solid #000; padding: 2px 4px; font-size: 11px; display: inline-block; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="center header">
            <img src="${receiptLogo}" class="receipt-logo" alt="${rName}" />
            <div class="title">*** KITCHEN ORDER TICKET ***</div>
            <div>${rName}${rTitle ? ' ' + rTitle : ''}</div>
          </div>

          <div class="divider"></div>
          <div><b>KOT NO :</b> ${formatReceiptSequence(kot.kotNo)} <span class="badge">${kot.type || 'NEW'}</span></div>
          <div><b>TABLE  :</b> ${table ? 'Table ' + table.tableNo : kot.tableNo || 'N/A'}</div>
          <div><b>ORDER  :</b> ${formatReceiptSequence(order ? order.orderNo : (kot.orderNumber || kot.orderId))}</div>
          <div><b>CAPTAIN:</b> ${kot.captainName || (order ? order.captainName : 'Staff')}</div>
          <div><b>STATION:</b> ${kot.station || 'Main Kitchen'}</div>
          <div><b>TIME   :</b> ${new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div class="divider"></div>
          <div class="item-row bold">
            <span class="item-qty">QTY</span>
            <span class="item-name">ITEM</span>
          </div>
          <div class="divider"></div>
          ${kot.items
            .map(
              (item) => `
            <div>
              <div class="item-row" style="display: flex; align-items: center; justify-content: space-between; margin: 3px 0; white-space: nowrap;">
                <span class="item-qty" style="width: 35px; font-weight: bold;">${item.quantity}x</span>
                <span class="item-name bold" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.name}">${truncateReceiptName(item.name, 24)}</span>
              </div>
              ${item.notes ? `<div class="note">* Note: ${item.notes}</div>` : ''}
            </div>
          `
            )
            .join('')}
          <div class="divider"></div>
          ${
            kot.revision > 1
              ? `<div class="center bold">REVISION #${kot.revision}</div>`
              : ''
          }
          <script>
            function triggerPrint() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
            if (document.readyState === 'complete') {
              triggerPrint();
            } else {
              window.onload = triggerPrint;
            }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      if (printWindow.focus) {
        printWindow.focus();
      }
      return { status: 'printed', timestamp: new Date().toISOString() };
    } catch (err) {
      console.warn('Browser print invocation failed or blocked:', err);
      return { status: 'failed', error: err.message };
    }
  }

  /**
   * Generates thermal invoice receipt HTML (80mm)
   */
  generateInvoiceHTML(bill, order = null, customer = null, options = {}) {
    if (!bill) {
      throw new Error('Cannot generate invoice HTML without bill data.');
    }

    const cfg = this.getEffectiveSettings(options);
    const receiptLogo = cfg.logoReceipt || cfg.logo || RESTAURANT_LOGO_B64;
    const rName = (cfg.restaurantName || 'GREEN TANDOOR SE').toUpperCase();
    const rSubtitle = cfg.tagline !== undefined ? cfg.tagline : 'Garden Restaurant';
    const rAddress = cfg.address || 'Opp. SP Petrol Pump, Gandhinagar, Chiloda Cross Road';
    const rGstin = cfg.gstin || '';
    const rPhone = cfg.phone || '';
    const rFooter = cfg.receiptFooter || 'Order once placed will not be cancelled. Thank You for Dining With Us!';

    const billNo = bill.billNo || bill.billNumber || 'INV-000';
    const orderNo = bill.orderNo || bill.orderNumber || order?.orderNo || order?.orderNumber || 'N/A';
    const tableNo = bill.tableNo || bill.tableNumber || order?.tableNo || order?.tableNumber || 'N/A';
    const cashierName = bill.generatedByName || bill.generatedBy || 'Staff';

    const cleanBillNo = formatReceiptSequence(billNo);
    const cleanOrderNo = formatReceiptSequence(orderNo);

    const invoiceDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
    const dateStr = !isNaN(invoiceDate.getTime()) ? invoiceDate.toLocaleDateString() : new Date().toLocaleDateString();
    const timeStr = !isNaN(invoiceDate.getTime())
      ? invoiceDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const guest = customer || (bill.customerName ? { name: bill.customerName, mobile: bill.customerMobile } : null);

    const items = Array.isArray(bill.items) && bill.items.length > 0
      ? bill.items
      : (Array.isArray(order?.items) ? order.items : []);

    const subtotal = normalizeMoney(bill.subtotal);
    const discountAmount = normalizeMoney(bill.discountAmount ?? bill.discount?.amount);
    const discountReason = bill.discountReason || bill.discount?.reason || 'Discount';

    const taxableValue = normalizeMoney(
      bill.taxableValue ?? bill.taxableAmount ?? (subtotal - discountAmount)
    );

    const taxRate = normalizeMoney(bill.taxRate, 5);
    const halfRate = (taxRate / 2).toFixed(1).replace(/\.0$/, '');
    const taxAmount = normalizeMoney(
      bill.taxAmount ?? bill.tax ?? ((taxableValue * taxRate) / 100)
    );

    let cgst = normalizeMoney(bill.cgst ?? bill.cgstAmount);
    let sgst = normalizeMoney(bill.sgst ?? bill.sgstAmount);
    if (cgst === 0 && sgst === 0 && taxAmount > 0) {
      cgst = Math.round((taxAmount / 2) * 100) / 100;
      sgst = Math.round((taxAmount - cgst) * 100) / 100;
    }

    const rounding = normalizeMoney(bill.rounding);
    const grandTotal = normalizeMoney(bill.grandTotal ?? (taxableValue + taxAmount + rounding));

    const payments = Array.isArray(bill.payments) ? bill.payments : [];
    const paidAmount = normalizeMoney(
      bill.paidAmount ?? payments.reduce((acc, p) => acc + normalizeMoney(p.amount), 0)
    );
    const balance = normalizeMoney(
      bill.balance ?? bill.balanceAmount ?? Math.max(0, grandTotal - paidAmount)
    );

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${cleanBillNo}</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 13px;
            line-height: 1.3;
            color: #000;
            margin: 10px;
            width: 74mm;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .double-divider { border-top: 2px solid #000; margin: 8px 0; }
          .receipt-logo {
            width: 70px;
            height: auto;
            max-height: 70px;
            margin: 0 auto 6px auto;
            display: block;
            object-fit: contain;
          }
          .title { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
          .subtitle { font-size: 11px; margin-bottom: 6px; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .item-row { display: flex; align-items: center; justify-content: space-between; margin: 3px 0; white-space: nowrap; }
          .item-name { width: 130px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
          .item-qty { width: 32px; text-align: center; }
          .item-rate { width: 52px; text-align: right; }
          .item-amount { width: 62px; text-align: right; font-weight: bold; }
          .grand-total { font-size: 16px; font-weight: bold; margin: 6px 0; }
          .footer { font-size: 11px; margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class="center">
          <img src="${receiptLogo}" class="receipt-logo" alt="${rName}" />
          <div class="title">${rName}</div>
          <div class="subtitle">
            ${rSubtitle ? `<div>${rSubtitle}</div>` : ''}
            ${rAddress ? `<div>${rAddress}</div>` : ''}
            ${(rGstin || rPhone) ? `<div>${rGstin ? 'GSTIN: ' + rGstin : ''}${rGstin && rPhone ? ' | ' : ''}${rPhone ? 'Ph: ' + rPhone : ''}</div>` : ''}
          </div>
          <div class="bold">*** TAX INVOICE ***</div>
        </div>

        <div class="divider"></div>
        <div class="row"><span><b>INVOICE NO:</b> ${billNo}</span><span><b>TABLE:</b> ${tableNo}</span></div>
        <div class="row"><span><b>ORDER NO  :</b> ${orderNo}</span><span><b>DATE :</b> ${dateStr}</span></div>
        <div class="row"><span><b>CASHIER   :</b> ${cashierName}</span><span><b>TIME :</b> ${timeStr}</span></div>
        ${guest ? `<div class="row"><span><b>GUEST     :</b> ${guest.name}${guest.mobile ? ' (' + guest.mobile + ')' : ''}</span></div>` : ''}
        <div class="divider"></div>
        <div class="row bold" style="border-bottom: 1px dashed #000; padding-bottom: 3px;">
          <span style="width: 130px; text-align: left;">ITEM</span>
          <span style="width: 32px; text-align: center;">QTY</span>
          <span style="width: 52px; text-align: right;">RATE</span>
          <span style="width: 62px; text-align: right;">AMOUNT</span>
        </div>
        <div class="divider"></div>
        ${items
          .map((item) => {
            const qty = Number(item.quantity) || 1;
            const unitPrice = normalizeMoney(item.unitPrice !== undefined ? item.unitPrice : item.price);
            const lineSubtotal = normalizeMoney(item.lineSubtotal !== undefined ? item.lineSubtotal : qty * unitPrice);
            const rawDishName = item.name || item.productName || 'Dish';
            const dishName = truncateReceiptName(rawDishName, 18);
            return `
          <div class="item-row">
            <span class="item-name" title="${rawDishName}">${dishName}</span>
            <span class="item-qty">${qty}</span>
            <span class="item-rate">${formatMoney(unitPrice)}</span>
            <span class="item-amount">${formatMoney(lineSubtotal)}</span>
          </div>
        `;
          })
          .join('')}
        <div class="divider"></div>
        <div class="row"><span>Subtotal:</span><span class="bold">₹${formatMoney(subtotal)}</span></div>
        ${
          discountAmount > 0
            ? `<div class="row"><span>Discount (${discountReason}):</span><span class="bold">-₹${formatMoney(discountAmount)}</span></div>`
            : ''
        }
        <div class="row"><span>Taxable Value:</span><span>₹${formatMoney(taxableValue)}</span></div>
        <div class="row"><span>CGST (${halfRate}%):</span><span>₹${formatMoney(cgst)}</span></div>
        <div class="row"><span>SGST (${halfRate}%):</span><span>₹${formatMoney(sgst)}</span></div>
        ${rounding !== 0 ? `<div class="row"><span>Rounding:</span><span>₹${formatMoney(rounding)}</span></div>` : ''}
        <div class="double-divider"></div>
        <div class="row grand-total"><span>GRAND TOTAL:</span><span>₹${formatMoney(grandTotal)}</span></div>
        <div class="double-divider"></div>
        <div class="bold" style="margin-top: 6px;">Payment Breakdown:</div>
        ${payments
          .map(
            (p) => `
          <div class="row">
            <span>* ${p.mode || 'CASH'}${p.reference ? ' (' + p.reference + ')' : ''}</span>
            <span class="bold">₹${formatMoney(p.amount)}</span>
          </div>
        `
          )
          .join('')}
        <div class="row" style="margin-top: 4px;"><span>Total Paid:</span><span class="bold">₹${formatMoney(paidAmount)}</span></div>
        <div class="row"><span>Balance Due:</span><span class="bold">₹${formatMoney(balance)}</span></div>
        ${
          options.qrDataUrl
            ? `
        <div class="divider"></div>
        <div class="center upi-qr-container" style="margin: 8px 0;">
          <div class="bold" style="font-size: 11px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Scan &amp; Pay via UPI</div>
          <img src="${options.qrDataUrl}" alt="UPI QR Code" style="width: 135px; height: 135px; margin: 0 auto; display: block; image-rendering: pixelated;" />
          <div style="font-size: 10px; font-weight: bold; margin-top: 3px;">${options.upiId || 'q705457761@ybl'}</div>
          <div style="font-size: 9px; color: #444; margin-top: 1px;">Google Pay / PhonePe / Paytm / BHIM</div>
        </div>
        `
            : ''
        }
        <div class="divider"></div>
        <div class="center footer">
          <div>${rFooter}</div>
          <div>Please Visit Again.</div>
        </div>
        <script>
          function triggerPrint() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
          if (document.readyState === 'complete') {
            triggerPrint();
          } else {
            window.onload = triggerPrint;
          }
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Browser-based thermal printing for Final Tax Invoice / Bill
   * Automatically generates dynamic UPI QR code if payment mode is UPI / QR Code.
   */
  async printInvoice(bill, order = null, customer = null, targetWindow = null, options = {}) {
    try {
      if (!bill) {
        throw new Error('Cannot print invoice without valid bill data.');
      }

      const cfg = this.getEffectiveSettings(options);
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      const isUpiMode =
        (options.paymentMode && String(options.paymentMode).toUpperCase().includes('UPI')) ||
        payments.some((p) => ['UPI', 'QR', 'UPI/QR'].includes(String(p.mode || '').toUpperCase())) ||
        String(bill.paymentMode || '').toUpperCase().includes('UPI') ||
        Boolean(options.forceQr);

      let qrDataUrl = options.qrDataUrl || null;
      const upiId = options.upiId || cfg.upiId || 'q705457761@ybl';
      const payeeName = cfg.restaurantName ? `${cfg.restaurantName} ${cfg.tagline || ''}`.trim() : 'Green Tandoor Se Garden Restaurant';

      if (!qrDataUrl && isUpiMode) {
        const grandTotal = normalizeMoney(bill.grandTotal ?? bill.balance);
        const billNo = bill.billNo || bill.billNumber || 'INV';
        qrDataUrl = await generateUpiQrDataUrl({
          upiId,
          payeeName,
          amount: grandTotal,
          transactionNote: `Bill ${billNo}`,
        });
      }

      // Generate HTML before opening popup to avoid blank windows on errors
      const html = this.generateInvoiceHTML(bill, order, customer, {
        ...options,
        qrDataUrl,
        upiId,
      });

      let printWindow = targetWindow;
      if (!printWindow && typeof window !== 'undefined') {
        printWindow = window.open('', '_blank', 'width=420,height=700');
      }
      if (!printWindow) {
        if (typeof window === 'undefined') {
          return { status: 'skipped_in_node' };
        }
        throw new Error('Pop-up was blocked. Please allow pop-ups for printing invoices.');
      }

      printWindow.document.write(html);
      printWindow.document.close();
      if (printWindow.focus) {
        printWindow.focus();
      }
      return { status: 'printed', timestamp: new Date().toISOString() };
    } catch (err) {
      console.warn('Browser print invocation failed or blocked:', err);
      return { status: 'failed', error: err.message };
    }
  }
}

export const printService = new PrintService();

