import { createClient } from '@clickhouse/client';
import { config } from './env.js';

export const clickhouse = createClient({
  url: config.clickhouseUrl,
  database: 'snip',
  clickhouse_settings: {
    async_insert: 1,
    wait_for_async_insert: 0,
  },
});

export async function initClickHouse(): Promise<void> {
  // Create database
  await clickhouse.command({
    query: `CREATE DATABASE IF NOT EXISTS snip`,
  });

  // Create clicks_analytics table
  await clickhouse.command({
    query: `
      CREATE TABLE IF NOT EXISTS snip.clicks_analytics (
        link_id String,
        short_code String,
        timestamp DateTime64(3, 'UTC'),
        ip_hash String,
        country String DEFAULT '',
        city String DEFAULT '',
        device String DEFAULT 'desktop',
        browser String DEFAULT 'unknown',
        os String DEFAULT 'unknown',
        referrer String DEFAULT '',
        is_bot UInt8 DEFAULT 0,
        user_agent String DEFAULT ''
      )
      ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (short_code, timestamp, link_id)
      TTL toDateTime(timestamp) + INTERVAL 2 YEAR
    `,
  });

  // Create hourly rollup table
  await clickhouse.command({
    query: `
      CREATE TABLE IF NOT EXISTS snip.clicks_hourly (
        link_id String,
        short_code String,
        hour DateTime,
        click_count UInt64,
        unique_visitors UInt64,
        bot_count UInt64,
        top_country String DEFAULT '',
        top_browser String DEFAULT '',
        top_os String DEFAULT '',
        top_device String DEFAULT ''
      )
      ENGINE = SummingMergeTree(click_count)
      PARTITION BY toYYYYMM(hour)
      ORDER BY (short_code, hour, link_id)
    `,
  });

  // Create daily rollup table
  await clickhouse.command({
    query: `
      CREATE TABLE IF NOT EXISTS snip.clicks_daily (
        link_id String,
        short_code String,
        day Date,
        click_count UInt64,
        unique_visitors UInt64,
        bot_count UInt64,
        top_country String DEFAULT '',
        top_browser String DEFAULT '',
        top_os String DEFAULT '',
        top_device String DEFAULT ''
      )
      ENGINE = SummingMergeTree(click_count)
      PARTITION BY toYYYYMM(day)
      ORDER BY (short_code, day, link_id)
    `,
  });

  console.log('[ClickHouse] Initialized tables');
}
