import { Request, Response, NextFunction } from 'express';
import UAParser from 'ua-parser-js';
import { linkService, clickService, webhookService } from '../services/index.js';
import { isBot, hashIp } from '../utils/helpers.js';
import { AppError } from '../utils/errors.js';
import { geoLookupQueue, webhookDeliveryQueue } from '../jobs/queues.js';

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
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const botDetected = isBot(userAgent);

    if (!botDetected) {
      const parser = new UAParser(userAgent);
      const browser = parser.getBrowser();
      const os = parser.getOS();
      const device = parser.getDevice();

      // Record to Postgres (fallback)
      clickService
        .recordClick({
          linkId: link.id,
          ip,
          userAgent,
          referrer: req.get('referrer'),
        })
        .catch((err) => console.error('[Click] Failed to record to PG:', err));

      // Increment count async
      linkService.incrementClickCount(link.id).catch((err) => console.error('[Click] Failed to increment:', err));

      // Enqueue geo-lookup + ClickHouse write job
      geoLookupQueue
        .add('geo-lookup', {
          clickLinkId: link.id,
          shortCode,
          ip,
          ipHash: hashIp(ip),
          userAgent,
          device: device.type || 'desktop',
          browser: browser.name || 'unknown',
          os: os.name || 'unknown',
          referrer: req.get('referrer') || '',
          isBot: false,
        })
        .catch((err) => console.error('[Click] Failed to enqueue geo-lookup:', err));

      // Fire webhooks for link.clicked event
      fireWebhooksForClick(link.id, shortCode).catch((err) =>
        console.error('[Webhook] Failed to fire:', err),
      );
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
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    if (!isBot(userAgent)) {
      const parser = new UAParser(userAgent);
      const browser = parser.getBrowser();
      const os = parser.getOS();
      const device = parser.getDevice();

      clickService
        .recordClick({
          linkId: link.id,
          ip,
          userAgent,
          referrer: req.get('referrer'),
        })
        .catch((err) => console.error('[Click] Failed to record:', err));

      linkService.incrementClickCount(link.id).catch((err) => console.error('[Click] Failed to increment:', err));

      geoLookupQueue
        .add('geo-lookup', {
          clickLinkId: link.id,
          shortCode,
          ip,
          ipHash: hashIp(ip),
          userAgent,
          device: device.type || 'desktop',
          browser: browser.name || 'unknown',
          os: os.name || 'unknown',
          referrer: req.get('referrer') || '',
          isBot: false,
        })
        .catch((err) => console.error('[Click] Failed to enqueue geo-lookup:', err));

      fireWebhooksForClick(link.id, shortCode).catch((err) =>
        console.error('[Webhook] Failed to fire:', err),
      );
    }

    const statusCode = link.isPermanent ? 301 : 302;
    res.redirect(statusCode, link.url);
  } catch (err) {
    next(err);
  }
}

async function fireWebhooksForClick(linkId: string, shortCode: string): Promise<void> {
  // We need the link's userId to find webhooks. Grab from DB.
  const { db } = await import('../config/database.js');
  const { links } = await import('../models/schema.js');
  const { eq } = await import('drizzle-orm');

  const link = await db.query.links.findFirst({
    where: eq(links.id, linkId),
    columns: { userId: true },
  });

  if (!link) return;

  const webhooks = await webhookService.getWebhooksForEvent(link.userId, 'link.clicked');

  for (const webhook of webhooks) {
    const payload = {
      event: 'link.clicked',
      timestamp: new Date().toISOString(),
      data: { linkId, shortCode },
    };

    const delivery = await webhookService.createDelivery(
      webhook.id,
      'link.clicked',
      payload,
    );

    await webhookDeliveryQueue.add(
      'webhook-delivery',
      {
        deliveryId: delivery.id,
        webhookId: webhook.id,
        url: webhook.url,
        secret: webhook.secret,
        event: 'link.clicked',
        payload: JSON.stringify(payload),
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
  }
}
