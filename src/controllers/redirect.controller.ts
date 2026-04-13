import { Request, Response, NextFunction } from 'express';
import { linkService } from '../services/index.js';
import { clickService } from '../services/index.js';
import { isBot } from '../utils/helpers.js';
import { AppError } from '../utils/errors.js';

export async function redirect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const shortCode = req.params.shortCode as string;
    const link = await linkService.resolveShortCode(shortCode);

    if (!link || !link.isActive) {
      throw AppError.notFound('Link not found');
    }

    // Check expiration
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      throw AppError.gone('This link has expired');
    }

    // Check max clicks
    if (link.maxClicks !== null && link.clickCount >= link.maxClicks) {
      throw AppError.gone('This link has reached its maximum number of clicks');
    }

    // Check password protection
    if (link.passwordHash) {
      res.status(401).json({
        error: 'This link is password protected',
        code: 'PASSWORD_REQUIRED',
        verifyUrl: `${req.protocol}://${req.get('host')}/${shortCode}/verify`,
      });
      return;
    }

    // Record click async (don't block redirect)
    const userAgent = req.get('user-agent') || '';
    if (!isBot(userAgent)) {
      // Fire and forget
      clickService
        .recordClick({
          linkId: link.id,
          ip: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent,
          referrer: req.get('referrer'),
        })
        .catch((err) => console.error('[Click] Failed to record:', err));

      // Increment count async
      linkService.incrementClickCount(link.id).catch((err) => console.error('[Click] Failed to increment:', err));
    }

    // Redirect
    const statusCode = link.isPermanent ? 301 : 302;
    res.redirect(statusCode, link.url);
  } catch (err) {
    next(err);
  }
}

export async function verifyPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const shortCode = req.params.shortCode as string;
    const { password } = req.body;

    const link = await linkService.resolveShortCode(shortCode);

    if (!link || !link.isActive) {
      throw AppError.notFound('Link not found');
    }

    if (!link.passwordHash) {
      // Not password protected, just redirect
      const statusCode = link.isPermanent ? 301 : 302;
      res.redirect(statusCode, link.url);
      return;
    }

    const valid = await linkService.verifyLinkPassword(link.passwordHash, password);
    if (!valid) {
      throw AppError.unauthorized('Invalid password');
    }

    // Check expiration
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      throw AppError.gone('This link has expired');
    }

    // Check max clicks
    if (link.maxClicks !== null && link.clickCount >= link.maxClicks) {
      throw AppError.gone('This link has reached its maximum number of clicks');
    }

    // Record click
    const userAgent = req.get('user-agent') || '';
    if (!isBot(userAgent)) {
      clickService
        .recordClick({
          linkId: link.id,
          ip: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent,
          referrer: req.get('referrer'),
        })
        .catch((err) => console.error('[Click] Failed to record:', err));

      linkService.incrementClickCount(link.id).catch((err) => console.error('[Click] Failed to increment:', err));
    }

    const statusCode = link.isPermanent ? 301 : 302;
    res.redirect(statusCode, link.url);
  } catch (err) {
    next(err);
  }
}
