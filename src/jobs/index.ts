import type { Worker } from 'bullmq';
import { createGeoLookupWorker } from './workers/geo-lookup.worker.js';
import { createWebhookDeliveryWorker } from './workers/webhook-delivery.worker.js';
import { createAnalyticsRollupWorker } from './workers/analytics-rollup.worker.js';
import { createLinkCleanupWorker } from './workers/link-cleanup.worker.js';
import { analyticsRollupQueue, linkCleanupQueue } from './queues.js';

interface WorkerSet {
  geoLookup: Worker;
  webhookDelivery: Worker;
  analyticsRollup: Worker;
  linkCleanup: Worker;
}

let workers: WorkerSet | null = null;

export async function startWorkers(): Promise<void> {
  // Create workers
  workers = {
    geoLookup: createGeoLookupWorker(),
    webhookDelivery: createWebhookDeliveryWorker(),
    analyticsRollup: createAnalyticsRollupWorker(),
    linkCleanup: createLinkCleanupWorker(),
  };

  // Schedule recurring jobs
  // Hourly analytics rollup — every hour
  await analyticsRollupQueue.upsertJobScheduler(
    'hourly-rollup',
    { every: 3600000 }, // 1 hour in ms
    { name: 'analytics-rollup', data: { type: 'hourly' as const } },
  );

  // Daily analytics rollup — every 24 hours
  await analyticsRollupQueue.upsertJobScheduler(
    'daily-rollup',
    { every: 86400000 }, // 24 hours in ms
    { name: 'analytics-rollup', data: { type: 'daily' as const } },
  );

  // Link cleanup — every 15 minutes
  await linkCleanupQueue.upsertJobScheduler(
    'link-cleanup',
    { every: 900000 }, // 15 min in ms
    { name: 'link-cleanup', data: { trigger: 'scheduled' as const } },
  );

  console.log('[Workers] All workers started');
  console.log('[Workers] Scheduled: hourly rollup, daily rollup, link cleanup (15min)');
}

export async function stopWorkers(): Promise<void> {
  if (!workers) return;

  await Promise.all([
    workers.geoLookup.close(),
    workers.webhookDelivery.close(),
    workers.analyticsRollup.close(),
    workers.linkCleanup.close(),
  ]);

  workers = null;
  console.log('[Workers] All workers stopped');
}
