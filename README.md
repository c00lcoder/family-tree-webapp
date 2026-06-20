# Family Tree

An open-source, mobile-first web app to **view, edit and import family trees**.
Built to be **easy to deploy, cheap to host, accessible and lightweight** — with
an optional native app via Capacitor and a deep auth tie-in with
[memorynest.app](https://memorynest.app).

- 🌳 Interactive family tree (pan / zoom / navigate) powered by
  [`family-chart`](https://github.com/donatso/family-chart)
- 📥 **GEDCOM import** (5.5.1) from Ancestry, FamilySearch, Gramps, and more
- 🖼️ **Media attachments** — person photos / avatars stored on Cloudflare R2
- 👨‍👩‍👧 **Sharing** — invite relatives as members, with up to two admins per tree
- 📱 **PWA + Capacitor** — installable on phones and shippable to the app stores
  from a single codebase
- ♿ **Accessibility-first** — large text & tap targets, high contrast, keyboard
  and screen-reader friendly

## Tech stack

| Area      | Choice                                                   |
| --------- | -------------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript            |
| Styling   | Tailwind CSS 4, accessible component primitives          |
| Auth      | Clerk (own app) + optional MemoryNest OIDC connection    |
| Database  | Neon Postgres + Drizzle ORM                              |
| Storage   | Cloudflare R2 (S3-compatible, behind a storage adapter)  |
| Tree viz  | `family-chart` (d3), isolated behind one wrapper         |
| Mobile    | PWA (`next-pwa`) + Capacitor                             |
| Hosting   | Vercel                                                   |

## Getting started

```bash
pnpm install
cp .env.example .env        # fill in your keys
pnpm db:push                # create tables in your Neon database
pnpm dev                    # http://localhost:3000
```

### Required environment variables

See [`.env.example`](./.env.example). At minimum you need a Neon `DATABASE_URL`
and Clerk keys. Cloudflare R2 variables are only needed for photo uploads.

### Auth & the MemoryNest tie-in

This app runs its **own** Clerk application, so standard email / social sign-in
works out of the box for self-hosters.

To let MemoryNest families reuse their identity, add a **custom OIDC connection**
in the Clerk dashboard (MemoryNest's Clerk instance as the identity provider).
The Clerk webhook (`/api/webhooks/clerk`) syncs users into the database and
captures their MemoryNest id when present, so trees can later be linked to
MemoryNest "nests" (the `trees.source_nest_id` seam).

## Scripts

| Script               | Description                                       |
| -------------------- | ------------------------------------------------- |
| `pnpm dev`           | Run the dev server                                |
| `pnpm build`         | Production build (webpack, required by `next-pwa`)|
| `pnpm test`          | Run unit tests (Vitest)                           |
| `pnpm typecheck`     | Type-check with `tsc`                             |
| `pnpm lint`          | Lint with ESLint                                  |
| `pnpm db:generate`   | Generate SQL migrations from the schema           |
| `pnpm db:push`       | Push the schema to the database                   |
| `pnpm cap:sync`      | Build the static bundle and sync native projects  |

## Mobile app (Capacitor)

The same web app ships to iOS / Android. The `build:static` script produces a
static export that the native shell loads, calling the hosted API over HTTPS.

```bash
pnpm add -D @capacitor/ios @capacitor/android
pnpm cap:sync
npx cap add ios        # first time only
npx cap add android    # first time only
npx cap open ios       # or android
```

## GEDCOM import

GEDCOM files are parsed server-side and mapped to a normalized INDI/FAM model
(`persons`, `families`, `family_children`, `events`). The parser is
dependency-free and unit-tested against [`fixtures/sample.ged`](./fixtures/sample.ged).

## Family tree rendering

The `family-chart` library is wrapped in a single component
(`src/components/tree/family-chart.tsx`) and fed a stable internal data shape
(`src/lib/gedcom/to-family-chart.ts`). This isolation means we can patch, fork,
or swap the rendering library without touching the rest of the app.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Licensed under [MIT](./LICENSE).
