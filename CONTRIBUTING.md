# Contributing

Thanks for your interest in improving Family Tree! 🌳

## Development setup

1. Fork and clone the repo.
2. `pnpm install`
3. Copy `.env.example` to `.env` and fill in your keys (Neon + Clerk are the
   minimum; Cloudflare R2 is only needed for photo uploads).
4. `pnpm db:push` to create the database tables.
5. `pnpm dev` and open http://localhost:3000.

## Before opening a pull request

Please make sure the following pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI runs all of these on every pull request.

## Guidelines

- Keep the UI **accessible and mobile-first**: large tap targets, good contrast,
  keyboard and screen-reader support.
- Keep `family-chart` usage behind `src/components/tree/family-chart.tsx` and the
  data shape in `src/lib/gedcom/to-family-chart.ts` so the rendering library
  stays swappable.
- Add or update tests for parsing/transform logic in `src/lib/gedcom`.
- Prefer small, focused PRs with a clear description.

## Database changes

Edit `src/lib/db/schema.ts`, then run `pnpm db:generate` to create a migration
and commit the generated SQL in `drizzle/`.
