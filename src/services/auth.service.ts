import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { config } from '../config/env.js';
import { users, refreshTokens } from '../models/schema.js';
import { AppError } from '../utils/errors.js';
import { hashToken } from '../utils/helpers.js';

const SALT_ROUNDS = 12;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  userId: string;
  email: string;
}

export async function register(email: string, password: string, name?: string) {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (existing) {
    throw AppError.conflict('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      name: name ?? null,
    })
    .returning({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt });

  return user;
}

export async function login(email: string, password: string): Promise<TokenPair & { user: { id: string; email: string; name: string | null } }> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const tokens = await generateTokenPair(user.id, user.email);

  return {
    ...tokens,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function refreshAccessToken(token: string): Promise<TokenPair> {
  const tokenHash = hashToken(token);

  const stored = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, tokenHash),
  });

  if (!stored) {
    throw AppError.unauthorized('Invalid refresh token');
  }

  if (new Date(stored.expiresAt) < new Date()) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
    throw AppError.unauthorized('Refresh token expired');
  }

  // Delete old token
  await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

  const user = await db.query.users.findFirst({
    where: eq(users.id, stored.userId),
  });

  if (!user) {
    throw AppError.unauthorized('User not found');
  }

  return generateTokenPair(user.id, user.email);
}

export async function logout(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
}

async function generateTokenPair(userId: string, email: string): Promise<TokenPair> {
  const payload: JwtPayload = { userId, email };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);

  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashToken(refreshToken);

  // Parse refresh expiry
  const expiresIn = config.jwt.refreshExpiresIn;
  const ms = parseDuration(expiresIn);
  const expiresAt = new Date(Date.now() + ms);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return { accessToken, refreshToken };
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}
