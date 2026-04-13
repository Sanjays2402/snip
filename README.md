# Snip — URL Shortener API

Production-grade URL shortener built with Node.js, Express, TypeScript, PostgreSQL, and Redis.

## Features

- **Auth:** JWT + refresh tokens, API key authentication
- **Links:** Create, read, update, delete, bulk create with custom slugs
- **Redirect Engine:** Redis-cached, bot detection, password-protected links, expiration, max clicks
- **Click Tracking:** Device, browser, OS, referrer detection (GeoIP in Phase 2)
- **Workspaces:** Multi-tenant workspace support (Phase 2 full implementation)

## Quick Start

```bash
# Clone and start everything
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
| GET | `/health` | Health check (DB + Redis) |
| GET | `/api/stats` | Server stats |

## Environment Variables

See `.env.example` for all configuration options.

## Test Credentials

After running `npm run seed`:
- **Email:** test@snip.dev
- **Password:** password123

## Tech Stack

- **Runtime:** Node.js 22 + TypeScript 5
- **Framework:** Express 4
- **Database:** PostgreSQL 16 (Drizzle ORM)
- **Cache:** Redis 7 (ioredis)
- **Auth:** JWT + bcrypt
- **Validation:** Zod
- **Containerization:** Docker + Docker Compose
