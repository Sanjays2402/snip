import { Response, NextFunction } from 'express';
import { linkService, qrService } from '../services/index.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { qrQuerySchema } from '../utils/validators.js';
import { config } from '../config/env.js';

export async function generateQRCode(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const linkId = req.params.id as string;

    // Verify user owns the link
    const link = await linkService.getLinkById(req.userId!, linkId);

    const opts = qrQuerySchema.parse(req.query);
    const shortUrl = `${config.baseUrl}/${link.shortCode}`;

    const { data, contentType } = await qrService.generateQR(shortUrl, {
      size: opts.size,
      format: opts.format,
      fgColor: opts.fg_color,
      bgColor: opts.bg_color,
      logoUrl: opts.logo_url,
    });

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(data);
  } catch (err) {
    next(err);
  }
}
