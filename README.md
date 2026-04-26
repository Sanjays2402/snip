# Snip — Production-Grade URL Shortener

A full-featured URL shortener API built with TypeScript, Express, PostgreSQL, Redis, and ClickHouse.

## Features

- **Link Management** — Create, update, delete short links with custom slugs, tags, expiration, and password protection
- **Analytics** — Real-time and historical click analytics powered by ClickHouse
- **Authentication** — JWT-based auth with refresh tokens + API key support
- **Workspaces** — Team collaboration with RBAC (admin/editor/viewer roles)
- **QR Codes** — Generate branded QR codes with custom colors and logo overlays
- **Webhooks** — HMAC-SHA256 signed webhook delivery for link events
- **Performance** — Redis caching, token bucket rate limiting, background job processing
- **Bulk Operations** — CSV import/export for managing links at scale
- **API Docs** — Interactive Swagger UI at `/docs`
- **CLI Tool** — Full-featured command-line interface

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- ClickHouse (optional, for analytics)

### Docker Compose

```bash
# Start all services
docker compose up -d

# Run the API
cp .env.example .env
npm install
npm run db:push
npm run dev
```

### Docker Compose Services

```yaml
# docker-compose.yml
version: '3.8'
services:
 postgres:
 image: postgres:16-alpine
 environment:
 POSTGRES_USER: snip
 POSTGRES_PASSWORD: snip_secret
 POSTGRES_DB: snip
 ports:
 - '5432:5432'
 volumes:
 - pgdata:/var/lib/postgresql/data

 redis:
 image: redis:7-alpine
 ports:
 - '6379:6379'

 clickhouse:
 image: clickhouse/clickhouse-server:latest
 ports:
 - '8123:8123'
 volumes:
 - chdata:/var/lib/clickhouse

volumes:
 pgdata:
 chdata:
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment (development/production) |
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | `postgresql://snip:snip_secret@localhost:5432/snip` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `CLICKHOUSE_URL` | `http://localhost:8123` | ClickHouse HTTP URL |
| `JWT_SECRET` | — | JWT signing secret (required in production) |
| `JWT_REFRESH_SECRET` | — | Refresh token secret (required in production) |
| `JWT_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token TTL |
| `BASE_URL` | `http://localhost:3000` | Public base URL for short links |
| `SHORT_CODE_LENGTH` | `7` | Default short code length |

## API Documentation

Interactive API docs are available at **`/docs`** when the server is running.

Raw OpenAPI JSON: **`GET /docs/json`**

### Key Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/links` | Create short link |
| GET | `/api/links` | List links |
| GET | `/api/links/:id` | Get link details |
| PATCH | `/api/links/:id` | Update link |
| DELETE | `/api/links/:id` | Delete link |
| GET | `/api/links/:id/qr` | Generate QR code |
| GET | `/api/links/:id/analytics` | Link analytics |
| POST | `/api/links/import` | CSV import |
| GET | `/api/links/export` | CSV export |
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces` | List workspaces |
| POST | `/api/workspaces/:id/members` | Invite member |
| POST | `/api/keys` | Create API key |
| POST | `/api/webhooks` | Create webhook |
| GET | `/:shortCode` | Redirect |

## CLI Tool

```bash
# Install globally
npm link

# Configure
snip config --api-url http://localhost:3000 --api-key snip_your_api_key

# Create a link
snip create https://example.com --slug my-link --tags marketing,social

# List links
snip list --limit 10 --tag marketing

# View stats
snip stats my-link

# Delete a link
snip delete my-link

# Bulk import from CSV
snip bulk links.csv
```

### CSV Format

```csv
original_url,custom_slug,tags,expires_at
https://example.com,example,marketing;social,2025-12-31T23:59:59.000Z
https://google.com,,,
```

## Architecture

```
┌─────────────┐ ┌──────────────┐ ┌───────────────┐
│ Clients │────▶│ Express API │────▶│ PostgreSQL │
│ (Web/CLI) │ │ + Swagger │ │ (Drizzle) │
└─────────────┘ └──────┬───────┘ └───────────────┘
 │
 ┌──────┴───────┐
 │ │
 ┌────▼────┐ ┌─────▼──────┐
 │ Redis │ │ ClickHouse │
 │ (Cache) │ │(Analytics) │
 └────┬────┘ └────────────┘
 │
 ┌─────▼──────┐
 │ BullMQ │
 │ Workers │
 │ - geo │
 │ - webhooks │
 │ - rollup │
 │ - cleanup │
 └────────────┘
```

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (Drizzle ORM)
- **Cache:** Redis (ioredis)
- **Analytics:** ClickHouse
- **Queue:** BullMQ
- **Auth:** JWT + API Keys
- **Validation:** Zod
- **QR Codes:** qrcode + sharp
- **Docs:** swagger-jsdoc + swagger-ui-express
- **CLI:** Commander + Chalk + cli-table3

## Development

```bash
# Install dependencies
npm install

# Push schema to database
npm run db:push

# Start development server
npm run dev

# Type check
npm run typecheck

# Build for production
npm run build
npm start
```

## License

MIT — see [LICENSE](LICENSE) for details.
