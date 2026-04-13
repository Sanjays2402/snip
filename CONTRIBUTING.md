# Contributing to Snip

Thanks for your interest in contributing!

## Getting Started

1. Fork the repo
2. Clone your fork: `git clone https://github.com/your-username/snip.git`
3. Install dependencies: `npm install`
4. Copy env: `cp .env.example .env`
5. Start services: `docker compose up -d`
6. Push schema: `npm run db:push`
7. Run dev server: `npm run dev`

## Development

- **Code style:** Prettier + ESLint (run `npm run format` and `npm run lint`)
- **Type checking:** `npm run typecheck` — must pass with zero errors
- **No `any` types** — use proper types or `unknown` with type guards

## Pull Request Process

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Ensure `npm run typecheck` passes
4. Commit with conventional commits: `feat:`, `fix:`, `docs:`, etc.
5. Push and open a PR

## Code Patterns

- **Services:** Business logic in `src/services/`
- **Controllers:** HTTP layer in `src/controllers/`
- **Routes:** Route definitions with OpenAPI annotations in `src/routes/`
- **Validation:** Zod schemas in `src/utils/validators.ts`
- **Errors:** Use `AppError` static methods for HTTP errors

## Adding a New Endpoint

1. Add Zod schema to `src/utils/validators.ts`
2. Add service function to appropriate service file
3. Add controller function
4. Add route with OpenAPI JSDoc annotation
5. Register route in `src/app.ts`
6. Run `npm run typecheck`
