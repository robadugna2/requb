# AGENTS.md

## What This Project Is

Digital Equb Platform — a full-stack app modernizing traditional Ethiopian rotating savings groups ("Equb"). Members deposit funds, submit bank receipts via a Telegram bot with AI OCR (OpenAI Vision GPT-4o, Ethiopian banks in English & Amharic), and lottery draws select cycle winners.

## Monorepo Layout (npm workspaces)

- `apps/api/` — NestJS backend (port 3001). Modules under `src/modules/`: `auth` (JWT/Passport), `users`, `groups` (lifecycle + cycles), `deposits` (receipt verification), `lottery`, `telegram` (grammY bot), `ocr` (GPT-4o Vision), `admins`, `dashboard`, `notifications`, `rule-templates`, `uploads`. Global PrismaService in `src/prisma/`.
- `apps/web/` — Next.js 14 admin dashboard (App Router, Tailwind, port 3000).
- `packages/database/` — Prisma schema & migrations (PostgreSQL). Schema lives at `packages/database/prisma/schema.prisma`; all prisma CLI calls from root pass `--schema=` to it.
- `packages/shared/` — Shared TypeScript types.
- Root docs worth reading: `CLAUDE.md`, `knowledge.md` (conventions + env vars), `README.md`.

## Commands

```bash
npm run dev            # API + Web in parallel (concurrently)
npm run dev:api        # NestJS watch mode, port 3001
npm run dev:web        # Next.js dev, port 3000
npm run build:api / build:web
npm run docker:up / docker:down   # PostgreSQL via docker-compose

npm run db:generate    # prisma generate
npm run db:migrate     # prisma migrate dev
npm run db:push        # prisma db push (no migration file)
npm run db:studio      # Prisma Studio GUI
npm run db:push:neon / db:seed:neon   # Neon-hosted DB helpers

cd apps/api && npm run lint       # ESLint (only lint setup in repo)
```

There is no test suite; verify changes by building (`build:api` / `build:web`) and linting the API.

## Conventions

- TypeScript strict mode everywhere.
- Backend: NestJS Controller/Service pattern, class-validator DTOs, Prisma for all DB access, `JwtAuthGuard` on protected routes. Routes mounted at `/auth/*`, `/users/*`, `/groups/*`, `/deposits/*`, `/lottery/*`.
- Frontend: App Router, Tailwind utilities, `"use client"` for interactive pages; Axios client with JWT interceptor in `src/lib/api.ts`.
- Path alias `@/*` → `src/*` in both apps.
- Prisma schema uses `@map()` for snake_case DB names; code stays camelCase.
- Env vars required in `.env` (see `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `NEXT_PUBLIC_API_URL`.

## Known Gotchas

- The `prisma` CLI is pinned as a root devDependency (5.22.0, matching `@prisma/client` in `apps/api`). Keep it pinned — `npm run db:generate` uses `npx prisma`, and without the pin npx pulls the latest major version, whose new CLI fails with `CLI.UNKNOWN_COMMAND` ("No command registered for `generate`"). This broke the Render build once already.
- Deployment: Render builds with `npm install && npm run db:generate && npm run build:api`, so anything that breaks `packages/database/prisma/schema.prisma` or the root prisma pin breaks deploys.
- Root has helper scripts (`seed-admin.js`, `test-auth.js`, `test-db.js`) that assume a running local Postgres from `docker-compose`.
