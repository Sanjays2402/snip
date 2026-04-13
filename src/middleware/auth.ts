import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { config } from '../config/env.js';
import { db } from '../config/database.js';
import { users, apiKeys } from '../models/schema.js';
import { AppError } from '../utils/errors.js';
import { hashToken } from '../utils/helpers.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  authMethod?: 'jwt' | 'apikey';
}

interface JwtPayload {
  userId: string;
  email: string;
}

export async function verifyJWT(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.userId),
    });

    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    req.userId = decoded.userId;
    req.authMethod = 'jwt';
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      next(AppError.unauthorized('Invalid token'));
      return;
    }
    next(err);
  }
}

export async function verifyAPIKey(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const apiKeyHeader = req.headers['x-api-key'];
    if (typeof apiKeyHeader !== 'string') {
      throw AppError.unauthorized('Missing API key');
    }

    const keyHash = hashToken(apiKeyHeader);
    const key = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, keyHash),
    });

    if (!key) {
      throw AppError.unauthorized('Invalid API key');
    }

    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      throw AppError.unauthorized('API key expired');
    }

    // Update last used
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id));

    req.userId = key.userId;
    req.authMethod = 'apikey';
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(err);
  }
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Try JWT first, then API key
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  if (authHeader?.startsWith('Bearer ')) {
    return verifyJWT(req, res, next);
  }

  if (apiKeyHeader) {
    return verifyAPIKey(req, res, next);
  }

  next(AppError.unauthorized('No authentication provided'));
}
