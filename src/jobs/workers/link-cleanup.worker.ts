import { Worker } from 'bullmq';
import { lt, or, and, eq, sql, isNotNull } from 'drizzle-orm';
import { config } from '../../config/env.js';
import { db } from '../../config/database.js';
import { links } from '../../models/schema.js';
import type { LinkCleanupJobData } from '../queues.js';

function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || '127.0.0.1',
    port: parseInt(parsed.port || '6379', 10),
  };
}

export function createLinkCleanupWorker(): Worker<LinkCleanupJobData> {
  const connection = parseRedisUrl(config.redisUrl);

  const worker = new Worker<LinkCleanupJobData>(
    'link-cleanup',
    async () => {
      const now = new Date();

      // Find expired links
      const expiredCondition = and(
        eq(links.isActive, true),
        isNotNull(links.expiresAt),
        lt(links.expiresAt, now),
      );

      // Find links past max_clicks
      const maxClicksCondition = and(
        eq(links.isActive, true),
        isNotNull(links.maxClicks),
        sql`${links.clickCount} >= ${links.maxClicks}`,
      );

      const condition = or(expiredCondition, maxClicksCondition);

      const result = await db
        .update(links)
        .set({ isActive: false, updatedAt: now })
        .where(condition!)
        .returning({ id: links.id });

      if (result.length > 0) {
        console.log(`[LinkCleanup] Deactivated ${result.length} links`);
      }
    },
    {
      connection,
      concurrency: 1,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[LinkCleanup] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
