import bcrypt from 'bcrypt';
import { db } from '../config/database.js';
import { pool } from '../config/database.js';
import { redis } from '../config/redis.js';
import { users, links } from '../models/schema.js';
import { config } from '../config/env.js';

async function seed() {
  console.log('[Seed] Starting...');

  await redis.connect();

  // Create test user
  const passwordHash = await bcrypt.hash('password123', 12);

  const [user] = await db
    .insert(users)
    .values({
      email: 'test@snip.dev',
      passwordHash,
      name: 'Test User',
    })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    console.log('[Seed] Test user already exists');
    await cleanup();
    return;
  }

  console.log(`[Seed] Created user: ${user.email} (id: ${user.id})`);

  // Create sample links
  const sampleLinks = [
    { shortCode: 'github', originalUrl: 'https://github.com', title: 'GitHub' },
    { shortCode: 'google', originalUrl: 'https://google.com', title: 'Google' },
    { shortCode: 'docs', originalUrl: 'https://docs.google.com', title: 'Google Docs' },
    { shortCode: 'yt', originalUrl: 'https://youtube.com', title: 'YouTube' },
    { shortCode: 'reddit', originalUrl: 'https://reddit.com', title: 'Reddit', tags: ['social'] },
  ];

  for (const link of sampleLinks) {
    const [created] = await db
      .insert(links)
      .values({
        userId: user.id,
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        title: link.title,
        tags: link.tags || [],
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      console.log(`[Seed] Created link: ${config.baseUrl}/${created.shortCode} -> ${created.originalUrl}`);
    }
  }

  console.log('[Seed] Done!');
  console.log('\n📋 Test credentials:');
  console.log('   Email: test@snip.dev');
  console.log('   Password: password123');

  await cleanup();
}

async function cleanup() {
  await redis.quit();
  await pool.end();
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
