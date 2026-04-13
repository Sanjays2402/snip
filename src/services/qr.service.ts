import QRCode from 'qrcode';
import sharp from 'sharp';
import { redis } from '../config/redis.js';

const QR_CACHE_TTL = 3600; // 1 hour

interface QROptions {
  size: number;
  format: 'png' | 'svg';
  fgColor: string;
  bgColor: string;
  logoUrl?: string;
}

function buildCacheKey(url: string, opts: QROptions): string {
  return `qr:${url}:${opts.size}:${opts.format}:${opts.fgColor}:${opts.bgColor}:${opts.logoUrl ?? 'none'}`;
}

export async function generateQR(
  url: string,
  opts: QROptions,
): Promise<{ data: Buffer; contentType: string }> {
  const cacheKey = buildCacheKey(url, opts);

  // Check Redis cache
  const cached = await redis.getBuffer(cacheKey);
  if (cached) {
    const contentType = opts.format === 'svg' ? 'image/svg+xml' : 'image/png';
    return { data: cached, contentType };
  }

  let result: { data: Buffer; contentType: string };

  if (opts.format === 'svg') {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      width: opts.size,
      color: {
        dark: opts.fgColor,
        light: opts.bgColor,
      },
      margin: 2,
    });
    result = { data: Buffer.from(svg, 'utf-8'), contentType: 'image/svg+xml' };
  } else {
    const pngBuffer = await QRCode.toBuffer(url, {
      width: opts.size,
      color: {
        dark: opts.fgColor,
        light: opts.bgColor,
      },
      margin: 2,
      type: 'png',
    });

    // If logoUrl provided, composite the logo onto the QR code
    if (opts.logoUrl) {
      const composited = await overlayLogo(pngBuffer, opts.logoUrl, opts.size);
      result = { data: composited, contentType: 'image/png' };
    } else {
      result = { data: pngBuffer, contentType: 'image/png' };
    }
  }

  // Cache the result
  await redis.setex(cacheKey, QR_CACHE_TTL, result.data);

  return result;
}

async function overlayLogo(qrBuffer: Buffer, logoUrl: string, qrSize: number): Promise<Buffer> {
  // Fetch the logo image
  const response = await fetch(logoUrl);
  if (!response.ok) {
    // If logo fetch fails, return QR without logo
    return qrBuffer;
  }

  const logoBuffer = Buffer.from(await response.arrayBuffer());
  const logoSize = Math.round(qrSize * 0.25);
  const offset = Math.round((qrSize - logoSize) / 2);

  // Resize logo and composite onto QR code center
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp(qrBuffer)
    .composite([{ input: resizedLogo, left: offset, top: offset }])
    .png()
    .toBuffer();
}
