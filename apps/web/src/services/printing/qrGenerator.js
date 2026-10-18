import QRCode from 'qrcode';

/**
 * Constructs a standard NPCI UPI Deep Link / QR URI.
 * Format: upi://pay?pa=<UPI_ID>&pn=<NAME>&am=<AMOUNT>&cu=INR&tn=<NOTE>
 */
export function generateUpiUri({
  upiId = 'q705457761@ybl',
  payeeName = 'Green Tandoor Se Garden Restaurant',
  amount = 0,
  transactionNote = 'Dining Bill Payment',
} = {}) {
  const am = Number(amount || 0).toFixed(2);
  const cleanUpi = encodeURIComponent(String(upiId || 'q705457761@ybl').trim());
  const cleanName = encodeURIComponent(String(payeeName || 'Restaurant').trim());
  const cleanNote = encodeURIComponent(String(transactionNote || 'Dining Bill').trim());
  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${am}&cu=INR&tn=${cleanNote}`;
}

/**
 * Generates an offline Base64 PNG data URL for UPI QR code scanning.
 * @returns {Promise<string>} Base64 image data URL
 */
export async function generateUpiQrDataUrl({
  upiId = 'q705457761@ybl',
  payeeName = 'Green Tandoor Se Garden Restaurant',
  amount = 0,
  transactionNote = 'Dining Bill Payment',
  width = 160,
} = {}) {
  try {
    const upiUri = generateUpiUri({ upiId, payeeName, amount, transactionNote });
    const dataUrl = await QRCode.toDataURL(upiUri, {
      width,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return dataUrl;
  } catch (err) {
    console.error('[QRGenerator] Failed to generate UPI QR code:', err);
    return null;
  }
}
