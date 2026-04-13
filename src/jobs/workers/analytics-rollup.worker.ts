import { Worker } from 'bullmq';
import { config } from '../../config/env.js';
import { analyticsService } from '../../services/index.js';
import type { AnalyticsRollupJobData } from '../queues.js';

function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || '127.0.0.1',
    port: parseInt(parsed.port || '6379', 10),
  };
}

export function createAnalyticsRollupWorker(): Worker<AnalyticsRollupJobData> {
  const connection = parseRedisUrl(config.redisUrl);

  const worker = new Worker<AnalyticsRollupJobData>(
    'analytics-rollup',
    async (job) => {
      const { type } = job.data;

      if (type === 'hourly') {
        await analyticsService.rollupHourly();
        console.log('[AnalyticsRollup] Hourly rollup completed');
      } else if (type === 'daily') {
        await analyticsService.rollupDaily();
        console.log('[AnalyticsRollup] Daily rollup completed');
      }
    },
    {
      connection,
      concurrency: 1,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[AnalyticsRollup] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
