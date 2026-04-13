import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../config/database.js';
import { webhooks, webhookDeliveries } from '../models/schema.js';
import { AppError } from '../utils/errors.js';

interface CreateWebhookInput {
  url: string;
  events: string[];
}

interface WebhookRecord {
  id: string;
  userId: string;
  url: string;
  secret: string;
  events: string[] | null;
  isActive: boolean;
  createdAt: Date;
}

interface WebhookDeliveryRecord {
  id: string;
  webhookId: string;
  event: string;
  payload: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  lastAttemptAt: Date | null;
  responseStatus: number | null;
  responseBody: string | null;
  createdAt: Date;
}

export async function createWebhook(userId: string, input: CreateWebhookInput): Promise<WebhookRecord> {
  const secret = crypto.randomBytes(32).toString('hex');

  const [webhook] = await db
    .insert(webhooks)
    .values({
      userId,
      url: input.url,
      secret,
      events: input.events,
      isActive: true,
    })
    .returning();

  return webhook as WebhookRecord;
}

export async function getUserWebhooks(userId: string): Promise<WebhookRecord[]> {
  const results = await db.query.webhooks.findMany({
    where: eq(webhooks.userId, userId),
    orderBy: (webhooks, { desc }) => [desc(webhooks.createdAt)],
  });

  return results as WebhookRecord[];
}

export async function deleteWebhook(userId: string, webhookId: string): Promise<void> {
  const existing = await db.query.webhooks.findFirst({
    where: and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)),
  });

  if (!existing) {
    throw AppError.notFound('Webhook not found');
  }

  await db.delete(webhooks).where(eq(webhooks.id, webhookId));
}

export async function getWebhookDeliveries(
  userId: string,
  webhookId: string,
): Promise<WebhookDeliveryRecord[]> {
  // Verify ownership
  const webhook = await db.query.webhooks.findFirst({
    where: and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)),
  });

  if (!webhook) {
    throw AppError.notFound('Webhook not found');
  }

  const results = await db.query.webhookDeliveries.findMany({
    where: eq(webhookDeliveries.webhookId, webhookId),
    orderBy: (deliveries, { desc }) => [desc(deliveries.createdAt)],
    limit: 50,
  });

  return results as WebhookDeliveryRecord[];
}

export async function getWebhooksForEvent(userId: string, event: string): Promise<WebhookRecord[]> {
  const userWebhooks = await db.query.webhooks.findMany({
    where: and(eq(webhooks.userId, userId), eq(webhooks.isActive, true)),
  });

  return userWebhooks.filter((w) => {
    const events = w.events ?? [];
    return events.includes(event);
  }) as WebhookRecord[];
}

export async function createDelivery(
  webhookId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<WebhookDeliveryRecord> {
  const [delivery] = await db
    .insert(webhookDeliveries)
    .values({
      webhookId,
      event,
      payload: JSON.stringify(payload),
      status: 'pending',
      attempts: 0,
    })
    .returning();

  return delivery as WebhookDeliveryRecord;
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: 'pending' | 'success' | 'failed',
  attempts: number,
  responseStatus: number | null,
  responseBody: string | null,
): Promise<void> {
  await db
    .update(webhookDeliveries)
    .set({
      status,
      attempts,
      lastAttemptAt: new Date(),
      responseStatus,
      responseBody: responseBody?.slice(0, 1000) ?? null,
    })
    .where(eq(webhookDeliveries.id, deliveryId));
}

export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
