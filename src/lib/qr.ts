import QRCode from 'qrcode';

export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export function verifyUrl(code: string): string {
  return `${appUrl()}/verify/${code}`;
}

/** Inline SVG QR code that opens the verification page for a Gem Key. */
export function verifyQrSvg(code: string): Promise<string> {
  return QRCode.toString(verifyUrl(code), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
}
