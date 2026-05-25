# Repository Guidelines

## What This Project Is

Digital Equb Platform — a full-stack app that modernizes the traditional Ethiopian rotating savings group ("Equb"). Members deposit money, verify payments via a Telegram bot with AI-powered OCR (OpenAI Vision GPT-4o), and winners are selected by lottery each cycle.

## Project Structure

Monorepo with npm workspaces:

- `apps/api/` — NestJS backend (TypeScript, port 3001)
  - `src/modules/auth/` — JWT authentication (Passport)
  - `src/modules/users/` — Member CRUD
  - `src/modules/groups/` — Equb group management + membership + cycles
  - `src/modules/deposits/` — Receipt/deposit verification
  - `src/modules/lottery/` — Random draw + payout creation
  - `src/modules/telegram/` — grammY bot (photo receipt handling)
  - `src/modules/ocr/` — OpenAI Vision receipt extraction
  - `src/prisma/` — PrismaService (global module)
- `apps/web/` — Next.js 14 admin dashboard (App Router, Tailwind CSS, port 3000)
  - Pages: login, dashboard, groups, groups/[id], members, receipts, lottery
  - `src/lib/api.ts` — Axios client with JWT interceptor
- `packages/database/` — Prisma schema & migrations (PostgreSQL)
- `packages/shared/` — Shared TypeScript types

## Build, Test, and Development Commands

```bash
# Start PostgreSQL
npm run docker:up          # docker-compose up -d

# Database
npm run db:generate        # prisma generate
npm run db:migrate         # prisma migrate dev
npm run db:push            # prisma db push (no migration file)
npm run db:studio          # prisma studio GUI

# Development
npm run dev:api            # NestJS watch mode (port 3001)
npm run dev:web            # Next.js dev server (port 3000)

# Build
npm run build:api          # nest build
npm run build:web          # next build

# Within apps/api
cd apps/api && npm run lint  # ESLint
```

## Coding Style & Conventions

- **Language:** TypeScript throughout (strict null checks in API, strict mode in web)
- **Backend:** NestJS with decorators, class-validator DTOs, Prisma for DB access
- **Frontend:** Next.js App Router, Tailwind CSS utility classes, `"use client"` for interactive pages
- **Path aliases:** `@/*` maps to `src/*` in both apps
- **Database:** Prisma schema uses `@map()` for snake_case table/column names, camelCase in code
- **API prefix:** Routes are at `/auth/*`, `/users/*`, `/groups/*`, `/deposits/*`, `/lottery/*`
- **Auth:** JWT tokens, `JwtAuthGuard` on protected endpoints

## Environment Variables

Required in `.env` (see `.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing key
- `TELEGRAM_BOT_TOKEN` — From @BotFather
- `OPENAI_API_KEY` — For Vision OCR
- `NEXT_PUBLIC_API_URL` — API base URL for frontend (default: http://localhost:3001)

## Key Dependencies

| Package | Used In | Purpose |
|---------|---------|---------|
| grammy | API | Telegram bot framework |
| openai | API | GPT-4o Vision for receipt OCR |
| @prisma/client | API | Database ORM |
| passport-jwt | API | JWT authentication strategy |
| recharts | Web | Dashboard charts |
| lucide-react | Web | Icon library |
| axios | Web | HTTP client |
