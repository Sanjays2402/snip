import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';
import type { AuthenticatedRequest } from './auth.js';

interface RateLimitConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
  windowSeconds: number;
}

const TIERS: Record<string, RateLimitConfig> = {
  unauthenticated: {
    maxTokens: 20,
    refillRate: 20 / 60, // 20 per minute
    windowSeconds: 60,
  },
  jwt: {
    maxTokens: 100,
    refillRate: 100 / 60, // 100 per minute
    windowSeconds: 60,
  },
  apikey: {
    maxTokens: 200,
    refillRate: 200 / 60, // 200 per minute
    windowSeconds: 60,
  },
};

function getTierKey(req: AuthenticatedRequest): { tier: string; identifier: string } {
  if (req.userId && req.authMethod === 'apikey') {
    return { tier: 'apikey', identifier: `apikey:${req.userId}` };
  }
  if (req.userId && req.authMethod === 'jwt') {
    return { tier: 'jwt', identifier: `jwt:${req.userId}` };
  }
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return { tier: 'unauthenticated', identifier: `ip:${ip}` };
}

// Token bucket implemented in Redis with Lua for atomicity
const TOKEN_BUCKET_SCRIPT = `
  local key = KEYS[1]
  local max_tokens = tonumber(ARGV[1])
  local refill_rate = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local window = tonumber(ARGV[4])

  local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
  local tokens = tonumber(bucket[1])
  local last_refill = tonumber(bucket[2])

  if tokens == nil then
    tokens = max_tokens
    last_refill = now
  end

  -- Refill tokens based on elapsed time
  local elapsed = now - last_refill
  local new_tokens = elapsed * refill_rate
  tokens = math.min(max_tokens, tokens + new_tokens)
  last_refill = now

  local allowed = 0
  local remaining = tokens

  if tokens >= 1 then
    tokens = tokens - 1
    remaining = tokens
    allowed = 1
  end

  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
  redis.call('EXPIRE', key, window)

  return {allowed, math.floor(remaining), math.ceil((1 - remaining) / refill_rate)}
`;

export function rateLimit() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { tier, identifier } = getTierKey(authReq);
      const config = TIERS[tier] ?? TIERS.unauthenticated;
      const redisKey = `ratelimit:${identifier}`;
      const nowSeconds = Date.now() / 1000;

      const result = await redis.eval(
        TOKEN_BUCKET_SCRIPT,
        1,
        redisKey,
        config.maxTokens,
        config.refillRate,
        nowSeconds,
        config.windowSeconds,
      ) as [number, number, number];

      const [allowed, remaining, retryAfter] = result;

      // Set rate limit headers
      res.set('X-RateLimit-Limit', String(config.maxTokens));
      res.set('X-RateLimit-Remaining', String(Math.max(0, remaining)));
      res.set('X-RateLimit-Reset', String(Math.ceil(nowSeconds + config.windowSeconds)));

      if (!allowed) {
        res.set('Retry-After', String(Math.max(1, retryAfter)));
        res.status(429).json({
          error: 'Too many requests',
          code: 'TOO_MANY_REQUESTS',
          retryAfter: Math.max(1, retryAfter),
        });
        return;
      }

      next();
    } catch (err) {
      // If Redis is down, allow the request (fail-open)
      console.error('[RateLimit] Redis error, allowing request:', err);
      next();
    }
  };
}
