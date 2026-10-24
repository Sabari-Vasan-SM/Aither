/**
 * QR Renderer Module
 * High-performance canvas QR rendering using qrcode library with memory reuse
 */

import QRCode from 'qrcode';

export interface QRRenderOptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  width?: number;
  darkColor?: string;
  lightColor?: string;
}

const DEFAULT_OPTIONS: QRRenderOptions = {
  errorCorrectionLevel: 'M',
  margin: 2,
  width: 440,
  darkColor: '#000000',
  lightColor: '#ffffff'
};

/**
 * Renders a payload directly onto an existing HTMLCanvasElement
 */
export async function renderQRToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options: QRRenderOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  await QRCode.toCanvas(canvas, text, {
    errorCorrectionLevel: opts.errorCorrectionLevel,
    margin: opts.margin,
    width: opts.width,
    color: {
      dark: opts.darkColor,
      light: opts.lightColor
    }
  });
}

/**
 * Generates a data URL for a QR code string
 */
export async function generateQRDataURL(
  text: string,
  options: QRRenderOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return QRCode.toDataURL(text, {
    errorCorrectionLevel: opts.errorCorrectionLevel,
    margin: opts.margin,
    width: opts.width,
    color: {
      dark: opts.darkColor,
      light: opts.lightColor
    }
  });
}
