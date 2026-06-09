# Guildlight

> The beacon that guides the guild.

Guildlight is an intelligent, multi-tenant HR platform with two products under one
login:

- **Guildlight Leave** — leave & accommodation management (FMLA / ADA / state
  compliance) with the **Ave** AI assistant and the **Ada** accommodation agent.
- **Guildlight Grow** — AI-assisted performance documentation with a
  review-and-sign workflow.

## Repository layout

This is a pnpm workspace monorepo.

```
artifacts/
  api-server/     Express 5 + TypeScript API (Drizzle ORM, JWT auth)
  leaveiq/        React 19 + Vite frontend (Tailwind v4)
  mockup-sandbox/ Design sandbox
lib/
  db/             Drizzle schema + client (@workspace/db)
  api-spec/       OpenAPI spec + orval codegen
  api-zod/        Generated zod schemas (@workspace/api-zod)
  api-client-react/  Generated React query client
  integrations/   Shared integrations
docs/PRD.md       Authoritative product requirements
```

> Note: the workspace package `@workspace/leaveiq` and the `artifacts/leaveiq`
> folder retain their original internal names. They are stable identifiers, not
> display brand strings — renaming them is intentionally out of scope.

## Prerequisites

- Node 20+ and **pnpm** (`packageManager` is pinned in `package.json`)
- A PostgreSQL database (we use [Neon](https://neon.tech))

## Setup

```bash
pnpm install

# API server env
cp artifacts/api-server/.env.example artifacts/api-server/.env
# Frontend env
cp artifacts/leaveiq/.env.example artifacts/leaveiq/.env

# Fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, ANTHROPIC_API_KEY, etc.
# Generate secrets:
#   JWT_SECRET:     openssl rand -base64 32
#   ENCRYPTION_KEY: openssl rand -hex 32

# Push the schema to your database
pnpm --filter @workspace/db run push

# (Optional) seed synthetic demo data — DEV/STAGING ONLY
pnpm --filter @workspace/api-server run db:seed
```

Run the API and frontend:

```bash
pnpm --filter @workspace/api-server run dev   # API on PORT (default 3001)
pnpm --filter @workspace/leaveiq run dev      # Vite on PORT (default 3000)
```

## Environment variables

Every value is supplied via environment — there are no hardcoded URLs, ports, or
secrets in the codebase. See `artifacts/api-server/.env.example` and
`artifacts/leaveiq/.env.example` for the complete, annotated list. Key ones:

| Variable | Where | Purpose |
|----------|-------|---------|
| `NODE_ENV` | both | `development` vs `production` (switches logging, rate limits, dev tooling) |
| `DATABASE_URL` | api | Neon Postgres connection string (`sslmode=require`) |
| `JWT_SECRET` | api | JWT signing secret — **must differ between dev and prod** |
| `ENCRYPTION_KEY` | api | AES-256-GCM key (64 hex chars) for fields at rest |
| `ANTHROPIC_API_KEY` | api | Claude — powers Ave, Ada, and the Grow agent |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | api | Transactional email (logs to console if unset) |
| `R2_*` | api | Cloudflare R2 file storage |
| `APP_URL` | api | Public base URL for email links |
| `PORT` | both | Listen / dev-server port (required) |
| `BASE_PATH` | frontend | Public base path Vite serves from (required) |

**Never commit a real `.env` or real secret values.** Dev and production must use
different secrets and a different database.

## Dev vs production environments

The same codebase runs in both; `NODE_ENV` plus per-environment variables are the
only difference.

| | Development | Production |
|--|-------------|-----------|
| `NODE_ENV` | `development` | `production` |
| Database | a **separate Neon project/branch** | dedicated Neon project |
| Hosting | local or a sleeping Railway dev service | Railway production service |
| Secrets | dev-only `JWT_SECRET` / keys | distinct production secrets |
| Domain | localhost / dev subdomain | `guildlight.co` |

Recommended setup:

- **Separate Neon projects** for dev and production so demo/synthetic data never
  touches real tenant data. Seed the dev database with `db:seed`.
- **Separate Railway environments** (a `dev` service and a `production` service),
  each with its own variables. Configure the dev service to **sleep when idle** to
  save resources; it wakes on the next request.
- Keep a long-lived `main` branch (production) and a `dev` branch for integration.

## Useful scripts

```bash
pnpm run typecheck                                   # whole workspace
pnpm --filter @workspace/db run push                 # apply schema
pnpm --filter @workspace/api-server run db:seed      # synthetic demo data (dev)
pnpm --filter @workspace/api-server run seed-admin   # bootstrap a super admin
pnpm --filter @workspace/api-spec run codegen        # regenerate zod/react client
```
