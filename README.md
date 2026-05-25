# 🇪🇹 Digital Equb Platform

A modern platform for managing traditional Ethiopian Equb (rotating savings groups). Members deposit money, verify payments via Telegram bot with AI-powered OCR receipt processing, and winners are selected by lottery each cycle.

## Features

- **Multi-Group Management** — Create and manage multiple Equb groups with custom contribution amounts and cycle durations
- **Telegram Bot Integration** — Members send receipt screenshots to verify deposits
- **AI-Powered OCR** — OpenAI Vision (GPT-4o) extracts transaction details from bank receipts (CBE, Telebirr, Awash, BOA, Dashen, etc.)
- **Lottery System** — Fair random selection of winners with full rotation tracking
- **Admin Dashboard** — Professional Next.js dashboard for managing groups, members, receipts, and draws
- **Ethiopian Bank Support** — Handles receipts in both English and Amharic

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS (TypeScript) |
| Frontend | Next.js 14 (App Router) |
| Database | PostgreSQL + Prisma ORM |
| Telegram Bot | grammY |
| OCR | OpenAI Vision API (GPT-4o) |
| Styling | Tailwind CSS |
| Auth | JWT + Passport |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (or Docker)
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- OpenAI API Key

### 1. Clone & Install

```bash
git clone <repo-url>
cd equb-platform
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start Database

```bash
docker-compose up -d
```

### 4. Run Migrations

```bash
npm run db:migrate
npm run db:generate
```

### 5. Start Development Servers

```bash
# Terminal 1 - API
npm run dev:api

# Terminal 2 - Web Dashboard
npm run dev:web
```

- **API**: http://localhost:3001
- **Dashboard**: http://localhost:3000

## Project Structure

```
equb-platform/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/       # JWT Authentication
│   │       │   ├── users/      # Member Management
│   │       │   ├── groups/     # Equb Group CRUD
│   │       │   ├── deposits/   # Receipt/Deposit Management
│   │       │   ├── lottery/    # Lottery Draw System
│   │       │   ├── telegram/   # Telegram Bot
│   │       │   └── ocr/       # OpenAI Vision OCR
│   │       └── prisma/         # Database Service
│   └── web/                    # Next.js Admin Dashboard
│       └── src/
│           ├── app/            # App Router Pages
│           ├── components/     # Reusable UI Components
│           └── lib/            # API Client & Utilities
├── packages/
│   ├── database/              # Prisma Schema & Migrations
│   └── shared/                # Shared Types
├── docker-compose.yml
└── .env.example
```

## API Endpoints

### Auth
- `POST /api/auth/register` — Register admin
- `POST /api/auth/login` — Login

### Groups
- `GET /api/groups` — List all groups
- `POST /api/groups` — Create group
- `GET /api/groups/:id` — Get group details
- `POST /api/groups/:id/members` — Add member
- `POST /api/groups/:id/cycles` — Create new cycle

### Deposits
- `GET /api/deposits` — List deposits (with filters)
- `PATCH /api/deposits/:id/verify` — Verify receipt
- `PATCH /api/deposits/:id/reject` — Reject receipt

### Lottery
- `POST /api/lottery/draw/:cycleId` — Trigger draw
- `GET /api/lottery/results/:groupId` — Get results

### Users
- `GET /api/users` — List members
- `POST /api/users` — Create member

## Telegram Bot Commands

| Command | Description |
|---------|------------|
| `/start` | Register and get welcome message |
| `/status` | Check payment status for current cycles |
| `/groups` | View your active groups |
| `/help` | Get help and instructions |
| *Send photo* | Submit a deposit receipt for OCR processing |

## License

MIT
