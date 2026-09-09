# CLAUDE.md

## Overview

Digital Equb Platform — a full-stack platform modernizing traditional Ethiopian rotating savings groups ("Equb"). Members deposit funds, submit bank receipts via a Telegram bot with AI-powered OCR (OpenAI Vision GPT-4o), and lottery draws select cycle winners.

## Monorepo Architecture

- **`apps/api`**: NestJS backend (TypeScript, runs on port 3001)
  - `src/modules/auth`: JWT authentication with Passport
  - `src/modules/users`: Member management CRUD
  - `src/modules/groups`: Equb group lifecycle, membership, and cycles
  - `src/modules/deposits`: Receipt submissions, manual verification, and payment tracking
  - `src/modules/lottery`: Fair lottery draws and payout record management
  - `src/modules/telegram`: grammY bot for user interaction and receipt uploads
  - `src/modules/ocr`: OpenAI Vision receipt OCR (supports Ethiopian banks in English & Amharic)
  - `src/prisma`: Global PrismaService
- **`apps/web`**: Next.js 14 Admin Dashboard (App Router, Tailwind CSS, runs on port 3000)
  - Interactive pages: login, dashboard overview, groups, members, receipts, lottery draws
  - `src/lib/api.ts`: Central Axios client with JWT interceptor
- **`packages/database`**: Prisma schema & migrations (PostgreSQL)
- **`packages/shared`**: Shared TypeScript interfaces and types

## Common Commands

### Development
```bash
# Run both API and Web in parallel
npm run dev

# Run API only (port 3001)
npm run dev:api

# Run Web Dashboard only (port 3000)
npm run dev:web
```

### Database & Docker
```bash
# Start PostgreSQL via Docker
npm run docker:up

# Stop Docker containers
npm run docker:down

# Prisma commands
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Apply migration in dev
npm run db:push       # Push schema directly to DB
npm run db:studio     # Open Prisma Studio GUI
```

### Build & Lint
```bash
# Build packages
npm run build:api
npm run build:web

# Linting
cd apps/api && npm run lint
```

## Key Conventions & Guidelines

- **TypeScript**: Strict mode enabled across all apps.
- **Backend (NestJS)**: Controller/Service pattern, class-validator DTOs, Prisma ORM for database queries.
- **Frontend (Next.js)**: App Router with React client components (`"use client"`) where interactive.
- **Path Aliasing**: `@/*` maps to `src/*` in both `apps/api` and `apps/web`.
- **Database Mapping**: Prisma schema fields use snake_case via `@map()` in DB, camelCase in TypeScript.
- **Environment**: Ensure `.env` is configured (see `.env.example` for `DATABASE_URL`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, etc.).
