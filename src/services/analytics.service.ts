import { clickhouse } from '../config/clickhouse.js';

interface ClickAnalyticsInput {
  linkId: string;
  shortCode: string;
  ipHash: string;
  country: string;
  city: string;
  device: string;
  browser: string;
  os: string;
  referrer: string;
  isBot: boolean;
  userAgent: string;
}

interface TimeSeriesPoint {
  period: string;
  clicks: number;
}

interface TopEntry {
  name: string;
  count: number;
}

interface AnalyticsResult {
  timeSeries: TimeSeriesPoint[];
  topCountries: TopEntry[];
  topDevices: TopEntry[];
  topBrowsers: TopEntry[];
  topReferrers: TopEntry[];
  botVsHuman: { bots: number; humans: number };
  totalClicks: number;
}

interface RealtimeClick {
  timestamp: string;
  country: string;
  city: string;
  device: string;
  browser: string;
  os: string;
  referrer: string;
  isBot: boolean;
}

type Granularity = 'hour' | 'day' | 'week' | 'month';

export async function insertClick(data: ClickAnalyticsInput): Promise<void> {
  await clickhouse.insert({
    table: 'snip.clicks_analytics',
    values: [
      {
        link_id: data.linkId,
        short_code: data.shortCode,
        timestamp: new Date().toISOString(),
        ip_hash: data.ipHash,
        country: data.country,
        city: data.city,
        device: data.device,
        browser: data.browser,
        os: data.os,
        referrer: data.referrer,
        is_bot: data.isBot ? 1 : 0,
        user_agent: data.userAgent,
      },
    ],
    format: 'JSONEachRow',
  });
}

export async function getAnalytics(
  linkId: string,
  from: string,
  to: string,
  granularity: Granularity,
): Promise<AnalyticsResult> {
  const truncFn = getGranularityFunction(granularity);

  // Time series
  const timeSeriesResult = await clickhouse.query({
    query: `
      SELECT ${truncFn}(timestamp) as period, count() as clicks
      FROM snip.clicks_analytics
      WHERE link_id = {linkId:String}
        AND timestamp >= {from:String}
        AND timestamp <= {to:String}
      GROUP BY period
      ORDER BY period
    `,
    query_params: { linkId, from, to },
    format: 'JSONEachRow',
  });
  const timeSeries = await timeSeriesResult.json<{ period: string; clicks: string }>();

  // Top countries
  const countriesResult = await clickhouse.query({
    query: `
      SELECT country as name, count() as count
      FROM snip.clicks_analytics
      WHERE link_id = {linkId:String}
        AND timestamp >= {from:String}
        AND timestamp <= {to:String}
        AND country != ''
      GROUP BY country
      ORDER BY count DESC
      LIMIT 10
    `,
    query_params: { linkId, from, to },
    format: 'JSONEachRow',
  });
  const topCountries = await countriesResult.json<{ name: string; count: string }>();

  // Top devices
  const devicesResult = await clickhouse.query({
    query: `
      SELECT device as name, count() as count
      FROM snip.clicks_analytics
      WHERE link_id = {linkId:String}
        AND timestamp >= {from:String}
        AND timestamp <= {to:String}
      GROUP BY device
      ORDER BY count DESC
      LIMIT 10
    `,
    query_params: { linkId, from, to },
    format: 'JSONEachRow',
  });
  const topDevices = await devicesResult.json<{ name: string; count: string }>();

  // Top browsers
  const browsersResult = await clickhouse.query({
    query: `
      SELECT browser as name, count() as count
      FROM snip.clicks_analytics
      WHERE link_id = {linkId:String}
        AND timestamp >= {from:String}
        AND timestamp <= {to:String}
      GROUP BY browser
      ORDER BY count DESC
      LIMIT 10
    `,
    query_params: { linkId, from, to },
    format: 'JSONEachRow',
  });
  const topBrowsers = await browsersResult.json<{ name: string; count: string }>();

  // Top referrers
  const referrersResult = await clickhouse.query({
    query: `
      SELECT referrer as name, count() as count
      FROM snip.clicks_analytics
      WHERE link_id = {linkId:String}
        AND timestamp >= {from:String}
        AND timestamp <= {to:String}
        AND referrer != ''
      GROUP BY referrer
      ORDER BY count DESC
      LIMIT 10
    `,
    query_params: { linkId, from, to },
    format: 'JSONEachRow',
  });
  const topReferrers = await referrersResult.json<{ name: string; count: string }>();

  // Bot vs human
  const botResult = await clickhouse.query({
    query: `
      SELECT
        countIf(is_bot = 1) as bots,
        countIf(is_bot = 0) as humans
      FROM snip.clicks_analytics
      WHERE link_id = {linkId:String}
        AND timestamp >= {from:String}
        AND timestamp <= {to:String}
    `,
    query_params: { linkId, from, to },
    format: 'JSONEachRow',
  });
  const botData = await botResult.json<{ bots: string; humans: string }>();

  // Total clicks
  const totalResult = await clickhouse.query({
    query: `
      SELECT count() as total
      FROM snip.clicks_analytics
      WHERE link_id = {linkId:String}
        AND timestamp >= {from:String}
        AND timestamp <= {to:String}
    `,
    query_params: { linkId, from, to },
    format: 'JSONEachRow',
  });
  const totalData = await totalResult.json<{ total: string }>();

  return {
    timeSeries: timeSeries.map((r) => ({ period: r.period, clicks: Number(r.clicks) })),
    topCountries: topCountries.map((r) => ({ name: r.name, count: Number(r.count) })),
    topDevices: topDevices.map((r) => ({ name: r.name, count: Number(r.count) })),
    topBrowsers: topBrowsers.map((r) => ({ name: r.name, count: Number(r.count) })),
    topReferrers: topReferrers.map((r) => ({ name: r.name, count: Number(r.count) })),
    botVsHuman: {
      bots: Number(botData[0]?.bots ?? 0),
      humans: Number(botData[0]?.humans ?? 0),
    },
    totalClicks: Number(totalData[0]?.total ?? 0),
  };
}

export async function getRealtimeClicks(linkId: string): Promise<RealtimeClick[]> {
  const result = await clickhouse.query({
    query: `
      SELECT
        timestamp,
        country,
        city,
        device,
        browser,
        os,
        referrer,
        is_bot
      FROM snip.clicks_analytics
      WHERE link_id = {linkId:String}
        AND timestamp >= now() - INTERVAL 60 MINUTE
      ORDER BY timestamp DESC
      LIMIT 100
    `,
    query_params: { linkId },
    format: 'JSONEachRow',
  });

  const rows = await result.json<{
    timestamp: string;
    country: string;
    city: string;
    device: string;
    browser: string;
    os: string;
    referrer: string;
    is_bot: number;
  }>();

  return rows.map((r) => ({
    timestamp: r.timestamp,
    country: r.country,
    city: r.city,
    device: r.device,
    browser: r.browser,
    os: r.os,
    referrer: r.referrer,
    isBot: r.is_bot === 1,
  }));
}

export async function getTotalClicksFromClickHouse(): Promise<number> {
  const result = await clickhouse.query({
    query: `SELECT count() as total FROM snip.clicks_analytics`,
    format: 'JSONEachRow',
  });
  const data = await result.json<{ total: string }>();
  return Number(data[0]?.total ?? 0);
}

export async function rollupHourly(): Promise<number> {
  const result = await clickhouse.command({
    query: `
      INSERT INTO snip.clicks_hourly
      SELECT
        link_id,
        short_code,
        toStartOfHour(timestamp) as hour,
        count() as click_count,
        uniq(ip_hash) as unique_visitors,
        countIf(is_bot = 1) as bot_count,
        topK(1)(country)[1] as top_country,
        topK(1)(browser)[1] as top_browser,
        topK(1)(os)[1] as top_os,
        topK(1)(device)[1] as top_device
      FROM snip.clicks_analytics
      WHERE timestamp >= now() - INTERVAL 2 HOUR
        AND timestamp < toStartOfHour(now())
      GROUP BY link_id, short_code, hour
    `,
  });
  return Number(result.query_id.length > 0 ? 1 : 0);
}

export async function rollupDaily(): Promise<number> {
  const result = await clickhouse.command({
    query: `
      INSERT INTO snip.clicks_daily
      SELECT
        link_id,
        short_code,
        toDate(timestamp) as day,
        count() as click_count,
        uniq(ip_hash) as unique_visitors,
        countIf(is_bot = 1) as bot_count,
        topK(1)(country)[1] as top_country,
        topK(1)(browser)[1] as top_browser,
        topK(1)(os)[1] as top_os,
        topK(1)(device)[1] as top_device
      FROM snip.clicks_analytics
      WHERE timestamp >= today() - 1
        AND timestamp < today()
      GROUP BY link_id, short_code, day
    `,
  });
  return Number(result.query_id.length > 0 ? 1 : 0);
}

function getGranularityFunction(granularity: Granularity): string {
  switch (granularity) {
    case 'hour':
      return 'toStartOfHour';
    case 'day':
      return 'toDate';
    case 'week':
      return 'toStartOfWeek';
    case 'month':
      return 'toStartOfMonth';
  }
}
