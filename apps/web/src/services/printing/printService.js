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
export const truncateReceiptName = (name, maxChars = 15) => {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.substring(0, maxChars - 3) + '...';
};

/**
 * Formats order, KOT, or bill numbers into clean sequence numbers for receipts.
 * Returns only the last three digits (e.g., '001', '002') as required for thermal receipts.
 */
export const formatReceiptSequence = (code, fallback = '001') => {
  if (!code) return fallback;
  const str = String(code).trim();
  // Strip out standard UUID/GUID if present
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return fallback;
  }
  // If hyphen separated (e.g. BILL-251026-001, ORD-251026-1, KOT-002)
  const parts = str.split('-');
  const lastPart = parts[parts.length - 1];
  const digitsMatch = lastPart.match(/\d+$/);
  if (digitsMatch) {
    const num = digitsMatch[0];
    return num.length >= 3 ? num.slice(-3) : num.padStart(3, '0');
  }
  const anyDigits = str.match(/\d+$/);
  if (anyDigits) {
    const num = anyDigits[0];
    return num.length >= 3 ? num.slice(-3) : num.padStart(3, '0');
  }
  return fallback;
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
  /**
   * Browser-based printing for KOT ticket using a printable window
   */
  printKOT(kot, order, table, options = {}) {
    try {
      const cfg = this.getEffectiveSettings(options);
      const receiptLogo = cfg.logoReceipt || cfg.logo || RESTAURANT_LOGO_B64;
      const rName = (cfg.restaurantName || 'GREEN TANDOOR SE').toUpperCase();
      const rTitle = cfg.tagline ? cfg.tagline.toUpperCase() : 'GARDEN RESTAURANT';

      const printWindow = window.open('', '_blank', 'width=420,height=600');
      if (!printWindow) {
        throw new Error('Pop-up was blocked. Please allow pop-ups for browser printing.');
      }

      const cleanKotNo = formatReceiptSequence(kot.kotNo);
      const rawOrderNo = order ? order.orderNo : (kot.orderNumber || kot.orderId);
      const cleanOrderNo = formatReceiptSequence(rawOrderNo);

      let rawTable = table ? table.tableNo : (kot.tableNo || '');
      let cleanKotTable = String(rawTable).trim();
      if (!cleanKotTable || cleanKotTable === 'N/A' || cleanKotTable === 'undefined' || cleanKotTable === '-') {
        cleanKotTable = (order?.orderType) && order.orderType !== 'DINE_IN'
          ? (order.orderType === 'TAKEAWAY' ? 'Take Away' : order.orderType)
          : 'Direct';
      } else {
        const stripped = cleanKotTable.replace(/^(T-?)+/i, '').trim();
        cleanKotTable = stripped ? `T-${stripped}` : cleanKotTable;
      }

      let cleanCaptain = String(kot.captainName || (order ? order.captainName : 'Staff')).trim();
      if (cleanCaptain.length > 12) cleanCaptain = cleanCaptain.substring(0, 12);

      let cleanStation = String(kot.station || 'Kitchen').trim();
      if (cleanStation.length > 12) cleanStation = cleanStation.substring(0, 12);

      const timeStr = new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>KOT - ${cleanKotNo}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
            }
            body {
              font-family: 'Consolas', 'Courier New', Courier, monospace;
              font-size: 11.5px;
              font-weight: 600;
              line-height: 1.35;
              color: #000;
            }
            .receipt-container {
              width: 250px;
              max-width: 250px;
              margin: 0 auto;
              padding: 2mm 0 6mm 0;
            }
            .center { text-align: center; }
            .bold { font-weight: 800; }
            .divider {
              width: 250px;
              border-top: 1.5px dashed #000;
              margin: 5px 0;
            }
            .header {
              width: 250px;
              text-align: center;
              margin-bottom: 4px;
            }
            .receipt-logo {
              width: 55px;
              height: auto;
              max-height: 55px;
              margin: 0 auto 4px auto;
              display: block;
              object-fit: contain;
            }
            .title {
              font-size: 13.5px;
              font-weight: 900;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              width: 250px;
              padding: 1.5px 0;
            }
            .meta-left {
              width: 140px;
              max-width: 140px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              text-align: left;
            }
            .meta-right {
              width: 110px;
              max-width: 110px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              text-align: right;
            }
            .kot-head-row {
              display: flex;
              align-items: center;
              width: 250px;
              font-size: 11.5px;
              font-weight: 800;
              border-bottom: 1.5px dashed #000;
              padding-bottom: 3px;
              margin-bottom: 2px;
            }
            .kot-row {
              display: flex;
              align-items: center;
              width: 250px;
              padding: 2px 0;
              font-size: 12px;
            }
            .kot-qty {
              width: 35px;
              text-align: left;
              font-weight: 800;
            }
            .kot-item {
              width: 215px;
              max-width: 215px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              font-weight: 800;
              text-align: left;
            }
            .note {
              font-style: italic;
              font-size: 10.5px;
              padding-left: 35px;
              color: #000;
            }
            .badge {
              border: 1.5px solid #000;
              padding: 1px 4px;
              font-size: 11px;
              font-weight: 800;
              display: inline-block;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="center header">
              <img src="${receiptLogo}" class="receipt-logo" alt="${rName}" />
              <div class="title">*** KITCHEN ORDER TICKET ***</div>
              <div style="font-size: 10.5px; font-weight: 700;">${rName}${rTitle ? ' ' + rTitle : ''}</div>
            </div>

            <div class="divider"></div>
            <div class="meta-row">
              <span class="meta-left"><b>KOT NO :</b> ${cleanKotNo} <span class="badge">${kot.type || 'NEW'}</span></span>
              <span class="meta-right"><b>TABLE:</b> ${cleanKotTable}</span>
            </div>
            <div class="meta-row">
              <span class="meta-left"><b>ORDER  :</b> ${cleanOrderNo}</span>
              <span class="meta-right"><b>TIME :</b> ${timeStr}</span>
            </div>
            <div class="meta-row">
              <span class="meta-left"><b>CAPTAIN:</b> ${cleanCaptain}</span>
              <span class="meta-right"><b>STN  :</b> ${cleanStation}</span>
            </div>

            <div class="divider"></div>
            <div class="kot-head-row">
              <span class="kot-qty">QTY</span>
              <span class="kot-item">ITEM</span>
            </div>
            ${kot.items
              .map(
                (item) => `
              <div class="kot-row">
                <span class="kot-qty">${item.quantity}x</span>
                <span class="kot-item" title="${item.name}">${truncateReceiptName(item.name, 20)}</span>
              </div>
              ${item.notes ? `<div class="note">* Note: ${item.notes}</div>` : ''}
            `
              )
              .join('')}
            <div class="divider"></div>
            ${
              kot.revision > 1
                ? `<div class="center bold" style="margin-top: 4px;">REVISION #${kot.revision}</div>`
                : ''
            }
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

    const rawBillNo = bill.billNo || bill.billNumber || 'INV-000';
    const rawOrderNo = bill.orderNo || bill.orderNumber || order?.orderNo || order?.orderNumber || 'N/A';
    const rawTableNo = bill.tableNo || bill.tableNumber || order?.tableNo || order?.tableNumber || '';
    const cashierName = bill.generatedByName || bill.generatedBy || 'Staff';

    // Sequence format: strictly 3 digits (e.g. 001, 002)
    const cleanBillNo = formatReceiptSequence(rawBillNo);
    const cleanOrderNo = formatReceiptSequence(rawOrderNo);

    // Clean table label
    let cleanTableNo = String(rawTableNo).trim();
    if (!cleanTableNo || cleanTableNo === 'N/A' || cleanTableNo === 'undefined' || cleanTableNo === '-') {
      cleanTableNo = (bill.orderType || order?.orderType) && (bill.orderType || order?.orderType) !== 'DINE_IN'
        ? ((bill.orderType || order?.orderType) === 'TAKEAWAY' ? 'Take Away' : (bill.orderType || order?.orderType))
        : 'Direct';
    } else {
      const stripped = cleanTableNo.replace(/^(T-?)+/i, '').trim();
      cleanTableNo = stripped ? `T-${stripped}` : cleanTableNo;
    }

    // Clean cashier name so it never overflows
    let cleanCashier = String(cashierName || 'Staff').trim();
    cleanCashier = cleanCashier.replace(/administrator/i, 'Admin').trim();
    if (cleanCashier.length > 12) {
      cleanCashier = cleanCashier.substring(0, 12);
    }

    const invoiceDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
    const dateStr = !isNaN(invoiceDate.getTime())
      ? invoiceDate.toLocaleDateString('en-GB')
      : new Date().toLocaleDateString('en-GB');
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
        <meta name="bill-number" content="${rawBillNo}" />
        <style>
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
          }
          body {
            font-family: 'Consolas', 'Courier New', Courier, monospace;
            font-size: 11.5px;
            font-weight: 600;
            line-height: 1.35;
            color: #000;
          }
          .receipt-container {
            width: 250px;
            max-width: 250px;
            margin: 0 auto;
            padding: 2mm 0 6mm 0;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: 800; }
          .divider {
            width: 250px;
            border-top: 1.5px dashed #000;
            margin: 5px 0;
          }
          .double-divider {
            width: 250px;
            border-top: 2px solid #000;
            margin: 5px 0;
          }
          .header {
            width: 250px;
            text-align: center;
            margin-bottom: 4px;
          }
          .receipt-logo {
            width: 60px;
            height: auto;
            max-height: 60px;
            margin: 0 auto 4px auto;
            display: block;
            object-fit: contain;
          }
          .title {
            font-size: 15px;
            font-weight: 900;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
            word-break: break-word;
          }
          .subtitle {
            font-size: 10px;
            font-weight: 600;
            margin-bottom: 4px;
            line-height: 1.3;
          }
          .invoice-badge {
            font-size: 12.5px;
            font-weight: 900;
            margin: 4px 0 2px 0;
            letter-spacing: 0.5px;
          }

          .meta-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 250px;
            padding: 1.5px 0;
          }
          .meta-left {
            width: 140px;
            max-width: 140px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: left;
          }
          .meta-right {
            width: 110px;
            max-width: 110px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: right;
          }
          .meta-full {
            width: 250px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: left;
          }

          .item-head-row {
            display: flex;
            align-items: center;
            width: 250px;
            border-bottom: 1.5px dashed #000;
            padding-bottom: 3px;
            margin-bottom: 2px;
            font-size: 11.5px;
            font-weight: 800;
          }
          .item-row {
            display: flex;
            align-items: center;
            width: 250px;
            padding: 2px 0;
            font-size: 11.5px;
            font-weight: 600;
          }
          .col-item {
            width: 115px;
            max-width: 115px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: left;
          }
          .col-qty {
            width: 25px;
            text-align: center;
            font-weight: 700;
          }
          .col-rate {
            width: 52px;
            text-align: right;
          }
          .col-amount {
            width: 58px;
            text-align: right;
            font-weight: 800;
          }

          .tot-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 250px;
            padding: 1.5px 0;
          }
          .tot-label {
            width: 140px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: left;
          }
          .tot-val {
            width: 110px;
            text-align: right;
            white-space: nowrap;
          }

          .grand-total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 250px;
            font-size: 14.5px;
            font-weight: 900;
            padding: 4px 0;
          }
          .upi-qr-container {
            width: 250px;
            text-align: center;
            margin: 6px 0;
          }
          .upi-qr-img {
            width: 120px;
            height: 120px;
            margin: 0 auto;
            display: block;
            image-rendering: pixelated;
          }
          .footer {
            font-size: 10px;
            font-weight: 600;
            margin-top: 8px;
            line-height: 1.35;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="center header">
            <img src="${receiptLogo}" class="receipt-logo" alt="${rName}" />
            <div class="title">${rName}</div>
            <div class="subtitle">
              ${rSubtitle ? `<div>${rSubtitle}</div>` : ''}
              ${rAddress ? `<div>${rAddress}</div>` : ''}
              ${(rGstin || rPhone) ? `<div>${rGstin ? 'GSTIN: ' + rGstin : ''}${rGstin && rPhone ? ' | ' : ''}${rPhone ? 'Ph: ' + rPhone : ''}</div>` : ''}
            </div>
            <div class="invoice-badge">*** TAX INVOICE ***</div>
          </div>

          <div class="divider"></div>
          <div class="meta-row">
            <span class="meta-left"><b>INVOICE NO:</b> ${cleanBillNo}</span>
            <span class="meta-right"><b>TABLE:</b> ${cleanTableNo}</span>
          </div>
          <div class="meta-row">
            <span class="meta-left"><b>ORDER NO :</b> ${cleanOrderNo}</span>
            <span class="meta-right"><b>DATE :</b> ${dateStr}</span>
          </div>
          <div class="meta-row">
            <span class="meta-left"><b>CASHIER  :</b> ${cleanCashier}</span>
            <span class="meta-right"><b>TIME :</b> ${timeStr}</span>
          </div>
          ${guest && guest.name ? `
          <div class="meta-row">
            <span class="meta-full"><b>GUEST    :</b> ${guest.name}${guest.mobile ? ' (' + guest.mobile + ')' : ''}</span>
          </div>` : ''}

          <div class="divider"></div>
          <div class="item-head-row">
            <span class="col-item">ITEM</span>
            <span class="col-qty">QTY</span>
            <span class="col-rate">RATE</span>
            <span class="col-amount">AMOUNT</span>
          </div>
          ${items
            .map((item) => {
              const qty = Number(item.quantity) || 1;
              const unitPrice = normalizeMoney(item.unitPrice !== undefined ? item.unitPrice : item.price);
              const lineSubtotal = normalizeMoney(item.lineSubtotal !== undefined ? item.lineSubtotal : qty * unitPrice);
              const rawDishName = item.name || item.productName || 'Dish';
              const dishName = truncateReceiptName(rawDishName, 15);
              return `
            <div class="item-row">
              <span class="col-item" title="${rawDishName}">${dishName}</span>
              <span class="col-qty">${qty}</span>
              <span class="col-rate">${formatMoney(unitPrice)}</span>
              <span class="col-amount">${formatMoney(lineSubtotal)}</span>
            </div>
          `;
            })
            .join('')}

          <div class="divider"></div>
          <div class="tot-row">
            <span class="tot-label">Subtotal:</span>
            <span class="bold tot-val">₹${formatMoney(subtotal)}</span>
          </div>
          ${
            discountAmount > 0
              ? `<div class="tot-row">
                  <span class="tot-label">Discount (${discountReason}):</span>
                  <span class="bold tot-val">-₹${formatMoney(discountAmount)}</span>
                </div>`
              : ''
          }
          <div class="tot-row">
            <span class="tot-label">Taxable Value:</span>
            <span class="tot-val">₹${formatMoney(taxableValue)}</span>
          </div>
          <div class="tot-row">
            <span class="tot-label">CGST (${halfRate}%):</span>
            <span class="tot-val">₹${formatMoney(cgst)}</span>
          </div>
          <div class="tot-row">
            <span class="tot-label">SGST (${halfRate}%):</span>
            <span class="tot-val">₹${formatMoney(sgst)}</span>
          </div>
          ${rounding !== 0 ? `
          <div class="tot-row">
            <span class="tot-label">Rounding:</span>
            <span class="tot-val">₹${formatMoney(rounding)}</span>
          </div>` : ''}

          <div class="double-divider"></div>
          <div class="grand-total-row">
            <span>GRAND TOTAL:</span>
            <span>₹${formatMoney(grandTotal)}</span>
          </div>
          <div class="double-divider"></div>

          <div class="bold" style="margin-top: 5px; font-size: 11.5px;">Payment Breakdown:</div>
          ${payments
            .map(
              (p) => `
            <div class="tot-row">
              <span class="tot-label">* ${p.mode || 'CASH'}${p.reference ? ' (' + p.reference + ')' : ''}</span>
              <span class="bold tot-val">₹${formatMoney(p.amount)}</span>
            </div>
          `
            )
            .join('')}
          <div class="tot-row" style="margin-top: 3px;">
            <span class="tot-label">Total Paid:</span>
            <span class="bold tot-val">₹${formatMoney(paidAmount)}</span>
          </div>
          <div class="tot-row">
            <span class="tot-label">Balance Due:</span>
            <span class="bold tot-val">₹${formatMoney(balance)}</span>
          </div>

          ${
            options.qrDataUrl
              ? `
          <div class="divider"></div>
          <div class="center upi-qr-container">
            <div class="bold" style="font-size: 11px; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px;">Scan &amp; Pay via UPI</div>
            <img src="${options.qrDataUrl}" alt="UPI QR Code" class="upi-qr-img" />
            <div style="font-size: 10px; font-weight: 800; margin-top: 3px; color: #000;">${options.upiId || 'q705457761@ybl'}</div>
            <div style="font-size: 9px; font-weight: 700; color: #000; margin-top: 1px;">Google Pay / PhonePe / Paytm / BHIM</div>
          </div>
          `
              : ''
          }

          <div class="divider"></div>
          <div class="center footer">
            <div>${rFooter}</div>
            <div>Please Visit Again.</div>
          </div>
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

