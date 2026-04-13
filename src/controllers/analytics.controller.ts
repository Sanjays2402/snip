import { Response, NextFunction } from 'express';
import { analyticsService, linkService } from '../services/index.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

type Granularity = 'hour' | 'day' | 'week' | 'month';

function isValidGranularity(value: string): value is Granularity {
  return ['hour', 'day', 'week', 'month'].includes(value);
}

export async function getLinkAnalytics(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const linkId = req.params.id as string;

    // Verify user owns this link
    await linkService.getLinkById(req.userId!, linkId);

    const from = (req.query.from as string) || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const to = (req.query.to as string) || new Date().toISOString();
    const granularityParam = (req.query.granularity as string) || 'day';

    if (!isValidGranularity(granularityParam)) {
      throw AppError.badRequest('Invalid granularity. Must be one of: hour, day, week, month');
    }

    const analytics = await analyticsService.getAnalytics(linkId, from, to, granularityParam);

    res.json({
      linkId,
      from,
      to,
      granularity: granularityParam,
      ...analytics,
    });
  } catch (err) {
    next(err);
  }
}

export async function getRealtimeAnalytics(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const linkId = req.params.id as string;

    // Verify user owns this link
    await linkService.getLinkById(req.userId!, linkId);

    const clicks = await analyticsService.getRealtimeClicks(linkId);

    res.json({
      linkId,
      windowMinutes: 60,
      clicks,
      count: clicks.length,
    });
  } catch (err) {
    next(err);
  }
}
