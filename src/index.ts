import { createApp } from './app.js';
import { config } from './config/env.js';
import { redis } from './config/redis.js';
import { pool } from './config/database.js';
import { initClickHouse, clickhouse } from './config/clickhouse.js';
import { startWorkers, stopWorkers } from './jobs/index.js';

async function main() {
  // Connect to Redis
  await redis.connect();

  // Test DB connection
  const client = await pool.connect();
  console.log('[Database] Connected');
  client.release();

  // Initialize ClickHouse tables
  try {
    await initClickHouse();
    console.log('[ClickHouse] Connected');
  } catch (err) {
    console.warn('[ClickHouse] Failed to initialize (analytics will be unavailable):', err);
  }

  // Start background workers
  try {
    await startWorkers();
  } catch (err) {
    console.warn('[Workers] Failed to start:', err);
  }

  const app = createApp();

  app.listen(config.port, () => {
    console.log(`[Snip] Server running on port ${config.port}`);
    console.log(`[Snip] Environment: ${config.nodeEnv}`);
    console.log(`[Snip] Base URL: ${config.baseUrl}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Snip] Received ${signal}, shutting down...`);
    await stopWorkers();
    await clickhouse.close();
    await redis.quit();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[Snip] Failed to start:', err);
  process.exit(1);
});
