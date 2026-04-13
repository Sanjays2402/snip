import { Worker } from 'bullmq';
import geoip from 'geoip-lite';
import { config } from '../../config/env.js';
import { analyticsService } from '../../services/index.js';
import type { GeoLookupJobData } from '../queues.js';

function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || '127.0.0.1',
    port: parseInt(parsed.port || '6379', 10),
  };
}

export function createGeoLookupWorker(): Worker<GeoLookupJobData> {
  const connection = parseRedisUrl(config.redisUrl);

  const worker = new Worker<GeoLookupJobData>(
    'geo-lookup',
    async (job) => {
      const data = job.data;

      // Resolve IP to country/city
      let country = '';
      let city = '';

      const geo = geoip.lookup(data.ip);
      if (geo) {
        country = geo.country || '';
        city = geo.city || '';
      }

      // Write to ClickHouse with geo data
      await analyticsService.insertClick({
        linkId: data.clickLinkId,
        shortCode: data.shortCode,
        ipHash: data.ipHash,
        country,
        city,
        device: data.device,
        browser: data.browser,
        os: data.os,
        referrer: data.referrer,
        isBot: data.isBot,
        userAgent: data.userAgent,
      });
    },
    {
      connection,
      concurrency: 10,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[GeoLookup] Job ${job?.id} failed:`, err.message);
  });

  worker.on('completed', (job) => {
    if (job.id && parseInt(job.id, 10) % 100 === 0) {
      console.log(`[GeoLookup] Processed ${job.id} jobs`);
    }
  });

  return worker;
}
