import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { apiKeys } from '../models/schema.js';
import { AppError } from '../utils/errors.js';
import { generateApiKey, hashToken } from '../utils/helpers.js';

export async function createApiKey(userId: string, name: string, scopes: string[], expiresAt?: string) {
  const rawKey = generateApiKey();
  const keyHash = hashToken(rawKey);

  const [key] = await db
    .insert(apiKeys)
    .values({
      userId,
      keyHash,
      name,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      scopes: apiKeys.scopes,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    });

  // Return the raw key only on creation
  return { ...key, key: rawKey };
}

export async function listApiKeys(userId: string) {
  return db.query.apiKeys.findMany({
    where: eq(apiKeys.userId, userId),
    columns: {
      id: true,
      name: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: (k, { desc }) => [desc(k.createdAt)],
  });
}

export async function deleteApiKey(userId: string, keyId: string) {
  const key = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.id, keyId),
  });

  if (!key || key.userId !== userId) {
    throw AppError.notFound('API key not found');
  }

  await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
}
