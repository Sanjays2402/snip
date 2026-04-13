import { createApp } from './app.js';
import { config } from './config/env.js';
import { redis } from './config/redis.js';
import { pool } from './config/database.js';

async function main() {
  // Connect to Redis
  await redis.connect();

  // Test DB connection
  const client = await pool.connect();
  console.log('[Database] Connected');
  client.release();

  const app = createApp();

  app.listen(config.port, () => {
    console.log(`[Snip] Server running on port ${config.port}`);
    console.log(`[Snip] Environment: ${config.nodeEnv}`);
    console.log(`[Snip] Base URL: ${config.baseUrl}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Snip] Received ${signal}, shutting down...`);
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
