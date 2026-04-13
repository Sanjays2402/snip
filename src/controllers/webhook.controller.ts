import { Response, NextFunction } from 'express';
import { webhookService } from '../services/index.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export async function createWebhook(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const webhook = await webhookService.createWebhook(req.userId!, req.body);
    res.status(201).json(webhook);
  } catch (err) {
    next(err);
  }
}

export async function getWebhooks(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const webhooks = await webhookService.getUserWebhooks(req.userId!);
    res.json({ webhooks });
  } catch (err) {
    next(err);
  }
}

export async function deleteWebhook(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await webhookService.deleteWebhook(req.userId!, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getWebhookDeliveries(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const deliveries = await webhookService.getWebhookDeliveries(
      req.userId!,
      req.params.id as string,
    );
    res.json({ deliveries });
  } catch (err) {
    next(err);
  }
}
