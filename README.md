# Snip — URL Shortener API

Production-grade URL shortener built with Node.js, Express, TypeScript, PostgreSQL, Redis, and ClickHouse.

## Features

### Phase 1 — Core
- **Auth:** JWT + refresh tokens, API key authentication
- **Links:** Create, read, update, delete, bulk create with custom slugs
- **Redirect Engine:** Redis-cached, bot detection, password-protected links, expiration, max clicks
- **Click Tracking:** Device, browser, OS, referrer detection
- **Workspaces:** Multi-tenant workspace support

### Phase 2 — Analytics & Infrastructure
- **ClickHouse Analytics:** Real-time click analytics with time-series data, geo breakdowns, device/browser/OS/referrer stats
- **BullMQ Background Jobs:** Geo-lookup, webhook delivery, analytics rollup, link cleanup workers
- **Webhook System:** Subscribe to events (link.clicked, link.created, link.threshold_reached, link.expired) with HMAC-SHA256 signatures
- **Rate Limiting:** Token bucket algorithm per-tier (unauthenticated: 20/min, JWT: 100/min, API key: 200/min)
- **GeoIP Resolution:** Country/city detection from IP addresses via geoip-lite

## Quick Start

```bash
# Clone and start everything (includes PostgreSQL, Redis, ClickHouse)
docker-compose up -d

# Generate and run migrations
npm install
npm run db:generate
npm run db:push

# Seed test data
npm run seed

# Development
npm run dev
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (returns JWT + refresh token) |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Invalidate refresh token |

### Links (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/links` | Create short link |
| POST | `/api/links/bulk` | Bulk create links |
| GET | `/api/links` | List links (paginated) |
| GET | `/api/links/:id` | Get link details + stats |
| PATCH | `/api/links/:id` | Update link |
| DELETE | `/api/links/:id` | Soft delete link |

### Analytics (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/links/:id/analytics` | Detailed click analytics (time-series, geo, devices) |
| GET | `/api/links/:id/analytics/realtime` | Last 60 minutes click stream |

Query params for `/analytics`: `from`, `to` (ISO dates), `granularity` (hour/day/week/month)

### Webhooks (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks` | Create webhook subscription |
| GET | `/api/webhooks` | List user's webhooks |
| DELETE | `/api/webhooks/:id` | Delete webhook |
| GET | `/api/webhooks/:id/deliveries` | View delivery logs |

Webhook events: `link.clicked`, `link.created`, `link.threshold_reached`, `link.expired`

Payloads are signed with HMAC-SHA256 in the `X-Snip-Signature` header.

### API Keys (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/keys` | Create API key |
| GET | `/api/keys` | List API keys |
| DELETE | `/api/keys/:id` | Delete API key |

### Redirect
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:shortCode` | Redirect to original URL |
| POST | `/:shortCode/verify` | Verify password for protected links |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (DB + Redis + ClickHouse) |
| GET | `/api/stats` | Server stats (includes ClickHouse totals) |

## Rate Limiting

All endpoints are rate limited using a Redis-backed token bucket:

| Tier | Limit | Identifier |
|------|-------|------------|
| Unauthenticated | 20 req/min | IP address |
| JWT authenticated | 100 req/min | User ID |
| API key | 200 req/min | User ID |

Headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Background Workers

Workers start automatically with the app:

- **Geo-lookup** — Resolves IP addresses to country/city, writes to ClickHouse
- **Webhook delivery** — Delivers webhooks with HMAC signature, exponential backoff (3 attempts)
- **Analytics rollup** — Aggregates hourly/daily click stats in ClickHouse
- **Link cleanup** — Deactivates expired links and links past max clicks (every 15 min)

## Environment Variables

See `.env.example` for all configuration options.

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://snip:snip_secret@localhost:5432/snip` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `CLICKHOUSE_URL` | ClickHouse HTTP interface URL | `http://localhost:8123` |
| `JWT_SECRET` | JWT signing secret | — |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | — |
| `BASE_URL` | Public base URL for short links | `http://localhost:3000` |
| `SHORT_CODE_LENGTH` | Default short code length | `7` |

## Test Credentials

After running `npm run seed`:
- **Email:** test@snip.dev
- **Password:** password123

## Tech Stack

- **Runtime:** Node.js 22 + TypeScript 5
- **Framework:** Express 4
- **Database:** PostgreSQL 16 (Drizzle ORM)
- **Analytics:** ClickHouse (time-series click data)
- **Cache & Queue:** Redis 7 (ioredis + BullMQ)
- **Auth:** JWT + bcrypt
- **Validation:** Zod
- **GeoIP:** geoip-lite
- **Containerization:** Docker + Docker Compose
