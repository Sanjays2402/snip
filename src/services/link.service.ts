import { eq, and, sql, arrayContains } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';
import { config } from '../config/env.js';
import { links, clicks } from '../models/schema.js';
import { AppError } from '../utils/errors.js';
import type { CreateLinkInput, UpdateLinkInput, PaginationInput } from '../utils/validators.js';

const CACHE_TTL = 3600; // 1 hour
const SALT_ROUNDS = 10;

interface CachedLink {
  url: string;
  passwordHash: string | null;
  expiresAt: string | null;
  maxClicks: number | null;
  clickCount: number;
  isActive: boolean;
  isPermanent: boolean;
  id: string;
}

export async function createLink(userId: string, input: CreateLinkInput) {
  const shortCode = input.customSlug || nanoid(config.shortCodeLength);

  // Check for duplicate slug
  if (input.customSlug) {
    const existing = await db.query.links.findFirst({
      where: eq(links.shortCode, input.customSlug),
    });
    if (existing) {
      throw AppError.conflict(`Short code "${input.customSlug}" is already taken`);
    }
  }

  let passwordHash: string | null = null;
  if (input.password) {
    passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  }

  const [link] = await db
    .insert(links)
    .values({
      userId,
      shortCode,
      originalUrl: input.url,
      title: input.title ?? null,
      tags: input.tags,
      passwordHash,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      maxClicks: input.maxClicks ?? null,
      isPermanent: input.isPermanent,
    })
    .returning();

  // Cache in Redis
  await cacheLink(link);

  return {
    ...link,
    shortUrl: `${config.baseUrl}/${link.shortCode}`,
  };
}

export async function bulkCreateLinks(userId: string, inputs: CreateLinkInput[]) {
  const results = [];
  for (const input of inputs) {
    const link = await createLink(userId, input);
    results.push(link);
  }
  return results;
}

export async function getUserLinks(userId: string, pagination: PaginationInput) {
  const { page, limit, tag } = pagination;
  const offset = (page - 1) * limit;

  let whereClause = eq(links.userId, userId);
  if (tag) {
    whereClause = and(whereClause, arrayContains(links.tags, [tag])) as typeof whereClause;
  }

  const [userLinks, countResult] = await Promise.all([
    db.query.links.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: (links, { desc }) => [desc(links.createdAt)],
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(links)
      .where(whereClause),
  ]);

  const total = countResult[0]?.count ?? 0;

  return {
    links: userLinks.map((l) => ({
      ...l,
      shortUrl: `${config.baseUrl}/${l.shortCode}`,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getLinkById(userId: string, linkId: string) {
  const link = await db.query.links.findFirst({
    where: and(eq(links.id, linkId), eq(links.userId, userId)),
  });

  if (!link) {
    throw AppError.notFound('Link not found');
  }

  // Get click stats
  const clickStats = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clicks)
    .where(eq(clicks.linkId, linkId));

  return {
    ...link,
    shortUrl: `${config.baseUrl}/${link.shortCode}`,
    totalClicks: clickStats[0]?.count ?? 0,
  };
}

export async function updateLink(userId: string, linkId: string, input: UpdateLinkInput) {
  const existing = await db.query.links.findFirst({
    where: and(eq(links.id, linkId), eq(links.userId, userId)),
  });

  if (!existing) {
    throw AppError.notFound('Link not found');
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.url !== undefined) updateData.originalUrl = input.url;
  if (input.title !== undefined) updateData.title = input.title;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.expiresAt !== undefined) updateData.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (input.maxClicks !== undefined) updateData.maxClicks = input.maxClicks;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.isPermanent !== undefined) updateData.isPermanent = input.isPermanent;

  if (input.password !== undefined) {
    updateData.passwordHash = input.password ? await bcrypt.hash(input.password, SALT_ROUNDS) : null;
  }

  const [updated] = await db
    .update(links)
    .set(updateData)
    .where(eq(links.id, linkId))
    .returning();

  // Invalidate and re-cache
  await invalidateCache(existing.shortCode);
  await cacheLink(updated);

  return {
    ...updated,
    shortUrl: `${config.baseUrl}/${updated.shortCode}`,
  };
}

export async function deleteLink(userId: string, linkId: string) {
  const existing = await db.query.links.findFirst({
    where: and(eq(links.id, linkId), eq(links.userId, userId)),
  });

  if (!existing) {
    throw AppError.notFound('Link not found');
  }

  // Soft delete
  await db
    .update(links)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(links.id, linkId));

  await invalidateCache(existing.shortCode);
}

export async function resolveShortCode(shortCode: string): Promise<CachedLink | null> {
  // Try Redis first
  const cached = await redis.get(`link:${shortCode}`);
  if (cached) {
    return JSON.parse(cached) as CachedLink;
  }

  // Fallback to DB
  const link = await db.query.links.findFirst({
    where: eq(links.shortCode, shortCode),
  });

  if (!link) return null;

  const cachedLink: CachedLink = {
    url: link.originalUrl,
    passwordHash: link.passwordHash,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    maxClicks: link.maxClicks,
    clickCount: link.clickCount,
    isActive: link.isActive,
    isPermanent: link.isPermanent,
    id: link.id,
  };

  // Cache for next time
  await redis.setex(`link:${shortCode}`, CACHE_TTL, JSON.stringify(cachedLink));

  return cachedLink;
}

export async function incrementClickCount(linkId: string): Promise<void> {
  await db
    .update(links)
    .set({ clickCount: sql`${links.clickCount} + 1` })
    .where(eq(links.id, linkId));
}

export async function verifyLinkPassword(passwordHash: string, password: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

async function cacheLink(link: typeof links.$inferSelect): Promise<void> {
  const cached: CachedLink = {
    url: link.originalUrl,
    passwordHash: link.passwordHash,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    maxClicks: link.maxClicks,
    clickCount: link.clickCount,
    isActive: link.isActive,
    isPermanent: link.isPermanent,
    id: link.id,
  };
  await redis.setex(`link:${link.shortCode}`, CACHE_TTL, JSON.stringify(cached));
}

async function invalidateCache(shortCode: string): Promise<void> {
  await redis.del(`link:${shortCode}`);
}
