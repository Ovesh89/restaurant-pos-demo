/**
 * Restaurant Logo Processor Utility
 * 
 * Takes a single uploaded logo (File, Blob, or base64 DataURL)
 * and generates all required variants to fix in all places in the app:
 *   - logo: Standard full-color logo (max 400x400) for Login, Topbar, Dashboard
 *   - logoWhite: Pure monochrome white on transparent background for dark sidebar/banners
 *   - logoBlack: Pure monochrome black on transparent background
 *   - logoReceipt: High-contrast monochrome black on transparent/white for 80mm/58mm thermal receipts
 *   - logoRedReceipt: High-contrast red receipt variant (#D9383C)
 *   - favicon: 64x64 square favicon for browser tab
 */

import { RESTAURANT_LOGO_B64, RESTAURANT_LOGO_RED_B64 } from '../assets/logoBase64.js';

export const DEFAULT_LOGOS = {
  logo: '/logo.png',
  logoWhite: '/logo-white.png',
  logoBlack: '/logo-black.png',
  logoReceipt: RESTAURANT_LOGO_B64 || '/logo-receipt.png',
  logoRedReceipt: RESTAURANT_LOGO_RED_B64 || '/logo-red-receipt.png',
  favicon: '/favicon.png'
};

/**
 * Loads an image from File, Blob, or data URL
 */
function loadImageSource(src) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return reject(new Error('Canvas/DOM not available in current environment'));
    }

    if (typeof src === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image from data URL.'));
      img.src = src;
    } else if (src instanceof File || src instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to parse uploaded image.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(src);
    } else if (src && src.width && src.height) {
      resolve(src);
    } else {
      reject(new Error('Unsupported image input.'));
    }
  });
}

/**
 * Computes dimensions preserving aspect ratio
 */
function getTargetDimensions(width, height, maxW, maxH) {
  if (width <= maxW && height <= maxH) {
    return { width, height };
  }
  const ratio = Math.min(maxW / width, maxH / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

/**
 * Detects if an image has a solid white/light background that should be treated as transparent
 */
function hasSolidLightBackground(data, width, height) {
  // Check corner pixels (0,0), (w-1, 0), (0, h-1), (w-1, h-1)
  const cornerCoords = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4
  ];

  let lightCornerCount = 0;
  for (const idx of cornerCoords) {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    if (a > 200 && r > 235 && g > 235 && b > 235) {
      lightCornerCount++;
    }
  }
  return lightCornerCount >= 3;
}

/**
 * Main generator: Converts a single uploaded image into all logo variants
 * 
 * @param {File|Blob|string} imageSource
 * @returns {Promise<{ logo: string, logoWhite: string, logoBlack: string, logoReceipt: string, logoRedReceipt: string, favicon: string }>}
 */
export async function generateLogoVariants(imageSource) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ...DEFAULT_LOGOS };
  }

  const img = await loadImageSource(imageSource);
  const origW = img.naturalWidth || img.width || 400;
  const origH = img.naturalHeight || img.height || 400;

  // 1. Generate Standard Color Logo (max 400x400)
  const stdDims = getTargetDimensions(origW, origH, 400, 400);
  const stdCanvas = document.createElement('canvas');
  stdCanvas.width = stdDims.width;
  stdCanvas.height = stdDims.height;
  const stdCtx = stdCanvas.getContext('2d');
  stdCtx.imageSmoothingEnabled = true;
  stdCtx.imageSmoothingQuality = 'high';
  stdCtx.drawImage(img, 0, 0, stdDims.width, stdDims.height);
  const logoDataUrl = stdCanvas.toDataURL('image/png');

  // Inspect pixels to know transparency and background
  const imgData = stdCtx.getImageData(0, 0, stdDims.width, stdDims.height);
  const pixels = imgData.data;
  const isLightBg = hasSolidLightBackground(pixels, stdDims.width, stdDims.height);

  // 2. Generate White Logo (for dark sidebar / dark headers)
  const whiteCanvas = document.createElement('canvas');
  whiteCanvas.width = stdDims.width;
  whiteCanvas.height = stdDims.height;
  const whiteCtx = whiteCanvas.getContext('2d');
  const whiteImgData = whiteCtx.createImageData(stdDims.width, stdDims.height);
  const whitePixels = whiteImgData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    if (a < 15) {
      // transparent
      whitePixels[i] = 255;
      whitePixels[i + 1] = 255;
      whitePixels[i + 2] = 255;
      whitePixels[i + 3] = 0;
    } else if (isLightBg && r > 230 && g > 230 && b > 230) {
      // Solid light background made transparent
      whitePixels[i] = 255;
      whitePixels[i + 1] = 255;
      whitePixels[i + 2] = 255;
      whitePixels[i + 3] = 0;
    } else {
      // Foreground made pure white
      whitePixels[i] = 255;
      whitePixels[i + 1] = 255;
      whitePixels[i + 2] = 255;
      whitePixels[i + 3] = a;
    }
  }
  whiteCtx.putImageData(whiteImgData, 0, 0);
  const logoWhiteDataUrl = whiteCanvas.toDataURL('image/png');

  // 3. Generate Black Logo (monochrome black)
  const blackCanvas = document.createElement('canvas');
  blackCanvas.width = stdDims.width;
  blackCanvas.height = stdDims.height;
  const blackCtx = blackCanvas.getContext('2d');
  const blackImgData = blackCtx.createImageData(stdDims.width, stdDims.height);
  const blackPixels = blackImgData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    if (a < 15 || (isLightBg && r > 230 && g > 230 && b > 230)) {
      blackPixels[i] = 0;
      blackPixels[i + 1] = 0;
      blackPixels[i + 2] = 0;
      blackPixels[i + 3] = 0;
    } else {
      blackPixels[i] = 0;
      blackPixels[i + 1] = 0;
      blackPixels[i + 2] = 0;
      blackPixels[i + 3] = a;
    }
  }
  blackCtx.putImageData(blackImgData, 0, 0);
  const logoBlackDataUrl = blackCanvas.toDataURL('image/png');

  // 4. Generate Thermal Receipt Logo (high-contrast monochrome, max 240x240 for 80mm/58mm rolls)
  const rcptDims = getTargetDimensions(origW, origH, 240, 240);
  const rcptCanvas = document.createElement('canvas');
  rcptCanvas.width = rcptDims.width;
  rcptCanvas.height = rcptDims.height;
  const rcptCtx = rcptCanvas.getContext('2d');
  rcptCtx.imageSmoothingEnabled = true;
  rcptCtx.imageSmoothingQuality = 'high';
  rcptCtx.drawImage(img, 0, 0, rcptDims.width, rcptDims.height);
  const rcptRaw = rcptCtx.getImageData(0, 0, rcptDims.width, rcptDims.height);
  const rcptPixels = rcptRaw.data;

  const receiptImgData = rcptCtx.createImageData(rcptDims.width, rcptDims.height);
  const receiptPixels = receiptImgData.data;

  const redReceiptImgData = rcptCtx.createImageData(rcptDims.width, rcptDims.height);
  const redReceiptPixels = redReceiptImgData.data;

  for (let i = 0; i < rcptPixels.length; i += 4) {
    const r = rcptPixels[i];
    const g = rcptPixels[i + 1];
    const b = rcptPixels[i + 2];
    const a = rcptPixels[i + 3];

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const isDark = a > 40 && (isLightBg ? gray < 210 : gray < 240);

    if (isDark) {
      // Pure black for thermal receipt
      receiptPixels[i] = 0;
      receiptPixels[i + 1] = 0;
      receiptPixels[i + 2] = 0;
      receiptPixels[i + 3] = 255;

      // Red receipt (#D9383C)
      redReceiptPixels[i] = 217;
      redReceiptPixels[i + 1] = 56;
      redReceiptPixels[i + 2] = 60;
      redReceiptPixels[i + 3] = 255;
    } else {
      // Transparent
      receiptPixels[i] = 255;
      receiptPixels[i + 1] = 255;
      receiptPixels[i + 2] = 255;
      receiptPixels[i + 3] = 0;

      redReceiptPixels[i] = 255;
      redReceiptPixels[i + 1] = 255;
      redReceiptPixels[i + 2] = 255;
      redReceiptPixels[i + 3] = 0;
    }
  }

  rcptCtx.putImageData(receiptImgData, 0, 0);
  const logoReceiptDataUrl = rcptCanvas.toDataURL('image/png');

  rcptCtx.putImageData(redReceiptImgData, 0, 0);
  const logoRedReceiptDataUrl = rcptCanvas.toDataURL('image/png');

  // 5. Generate Favicon (64x64 square)
  const favCanvas = document.createElement('canvas');
  favCanvas.width = 64;
  favCanvas.height = 64;
  const favCtx = favCanvas.getContext('2d');
  favCtx.imageSmoothingEnabled = true;
  favCtx.imageSmoothingQuality = 'high';

  // Center the image inside 64x64
  const favDims = getTargetDimensions(origW, origH, 64, 64);
  const offsetX = Math.round((64 - favDims.width) / 2);
  const offsetY = Math.round((64 - favDims.height) / 2);
  favCtx.drawImage(img, offsetX, offsetY, favDims.width, favDims.height);
  const faviconDataUrl = favCanvas.toDataURL('image/png');

  return {
    logo: logoDataUrl,
    logoWhite: logoWhiteDataUrl,
    logoBlack: logoBlackDataUrl,
    logoReceipt: logoReceiptDataUrl,
    logoRedReceipt: logoRedReceiptDataUrl,
    favicon: faviconDataUrl
  };
}
