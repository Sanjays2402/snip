import { Router, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';
import { clickhouse } from '../config/clickhouse.js';
import { links, clicks } from '../models/schema.js';

const router = Router();

const startTime = Date.now();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: All services healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded]
 *                 uptime:
 *                   type: integer
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                     redis:
 *                       type: string
 *                     clickhouse:
 *                       type: string
 *       503:
 *         description: One or more services unhealthy
 */
router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  try {
    await clickhouse.query({ query: 'SELECT 1', format: 'JSONEachRow' });
    checks.clickhouse = 'ok';
  } catch {
    checks.clickhouse = 'error';
  }

  const healthy = Object.values(checks).every((v) => v === 'ok');
  const status = healthy ? 200 : 503;

  res.status(status).json({
    status: healthy ? 'healthy' : 'degraded',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  });
});

/**
 * @openapi
 * /api/stats:
 *   get:
 *     tags: [Health]
 *     summary: Get system stats
 *     responses:
 *       200:
 *         description: System statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalLinks:
 *                   type: integer
 *                 totalClicks:
 *                   type: integer
 *                 totalClicksClickHouse:
 *                   type: integer
 *                 uptime:
 *                   type: integer
 */
router.get('/api/stats', async (_req: Request, res: Response) => {
  try {
    const [linkCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(links);

    const [clickCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clicks);

    // ClickHouse total (best-effort)
    let clickhouseTotal = 0;
    try {
      const chResult = await clickhouse.query({
        query: 'SELECT count() as total FROM snip.clicks_analytics',
        format: 'JSONEachRow',
      });
      const chData = await chResult.json<{ total: string }>();
      clickhouseTotal = Number(chData[0]?.total ?? 0);
    } catch {
      // ClickHouse might not be ready
    }

    res.json({
      totalLinks: linkCount?.count ?? 0,
      totalClicks: clickCount?.count ?? 0,
      totalClicksClickHouse: clickhouseTotal,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats', code: 'INTERNAL_ERROR' });
  }
});

export default router;
