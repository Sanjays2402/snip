import { Queue } from 'bullmq';
import { config } from '../config/env.js';

function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || '127.0.0.1',
    port: parseInt(parsed.port || '6379', 10),
  };
}

const connection = parseRedisUrl(config.redisUrl);

export const geoLookupQueue = new Queue('geo-lookup', { connection });
export const webhookDeliveryQueue = new Queue('webhook-delivery', { connection });
export const analyticsRollupQueue = new Queue('analytics-rollup', { connection });
export const linkCleanupQueue = new Queue('link-cleanup', { connection });

// Types for job data
export interface GeoLookupJobData {
  clickLinkId: string;
  shortCode: string;
  ip: string;
  ipHash: string;
  userAgent: string;
  device: string;
  browser: string;
  os: string;
  referrer: string;
  isBot: boolean;
}

export interface WebhookDeliveryJobData {
  deliveryId: string;
  webhookId: string;
  url: string;
  secret: string;
  event: string;
  payload: string;
}

export interface AnalyticsRollupJobData {
  type: 'hourly' | 'daily';
}

export interface LinkCleanupJobData {
  trigger: 'scheduled';
}
