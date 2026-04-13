import { Worker } from 'bullmq';
import { config } from '../../config/env.js';
import { webhookService } from '../../services/index.js';
import type { WebhookDeliveryJobData } from '../queues.js';

function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || '127.0.0.1',
    port: parseInt(parsed.port || '6379', 10),
  };
}

const MAX_ATTEMPTS = 3;

export function createWebhookDeliveryWorker(): Worker<WebhookDeliveryJobData> {
  const connection = parseRedisUrl(config.redisUrl);

  const worker = new Worker<WebhookDeliveryJobData>(
    'webhook-delivery',
    async (job) => {
      const { deliveryId, url, secret, event, payload } = job.data;
      const attemptNum = (job.attemptsMade ?? 0) + 1;

      const signature = webhookService.signPayload(payload, secret);

      let responseStatus: number | null = null;
      let responseBody: string | null = null;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Snip-Signature': signature,
            'X-Snip-Event': event,
            'User-Agent': 'Snip-Webhook/1.0',
          },
          body: payload,
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        responseStatus = response.status;
        responseBody = await response.text();

        if (response.ok) {
          await webhookService.updateDeliveryStatus(
            deliveryId,
            'success',
            attemptNum,
            responseStatus,
            responseBody,
          );
        } else {
          throw new Error(`HTTP ${response.status}: ${responseBody.slice(0, 200)}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        if (attemptNum >= MAX_ATTEMPTS) {
          // Final attempt failed
          await webhookService.updateDeliveryStatus(
            deliveryId,
            'failed',
            attemptNum,
            responseStatus,
            responseBody ?? errorMessage,
          );
        } else {
          // Update attempt count
          await webhookService.updateDeliveryStatus(
            deliveryId,
            'pending',
            attemptNum,
            responseStatus,
            responseBody ?? errorMessage,
          );
        }

        throw err; // Let BullMQ handle retry
      }
    },
    {
      connection,
      concurrency: 5,
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 2000 },
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[WebhookDelivery] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });

  return worker;
}
