# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## Application: Leavara LeaveIQ

California Leave of Absence (LOA) decision-support **multi-tenant SaaS** for HR teams.
Marketing landing page at `leavara.net`. Each customer company gets a dedicated portal at `<slug>.leavara.net`.

### Key Features
- Multi-tenant: all data scoped to `organization` — companies are isolated by `organization_id`
- Case intake for CFRA, FMLA, PDL, and Company Personal Leave
- Deterministic eligibility analysis using rolling 12-month lookback
- State machine: INTAKE → ELIGIBILITY_ANALYSIS → HR_REVIEW_QUEUE / NOTICE_DRAFTED → CLOSED / CANCELLED
- HR always makes the final decision — system never approves or denies independently
- Full audit trail
- JWT auth (8hr expiry); token includes `organizationId`
- Invite-based enrollment; invites scoped to issuing organization
- Interest intake form at `/interest` — submissions emailed to `donnie@leavara.net`

### Super Admin
- `admin@leavara.net` is the Leavara platform super admin (`is_super_admin=true`, `organization_id=NULL`)
- Super admin logs in → redirected to `/superadmin` (not `/dashboard`)
- Super admin can: manage all organizations, toggle org active status, create new organizations, view/restore soft-deleted cases, manage users across all tenants
- API routes under `/api/superadmin/*` require `requireSuperAdmin` middleware
- JWT payload includes `isSuperAdmin` flag; AppLayout shows only "Super Admin" nav item for super admins

### First Organization
- **Soapy Joe's Car Wash** — slug: `soapyjoes`, portal: `soapyjoes.leavara.net`
- Org admin: created via super admin panel

### Palette (warm)
- 60% Cloud Dancer `#F0EEE9`
- 30% Universal Khaki `#B8A992` / Mocha Mousse `#A47864`
- 10% Terracotta `#C97E59` (CTAs) / Muted Rose `#EAA292` (accents)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── leaveiq/            # React + Vite frontend (LeaveIQ UI)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Database Schema

- `organization` — tenant record (id, name, slug unique, is_active)
- `hr_user` — HR staff (organization_id FK → organization)
- `hr_invite` — invite tokens (organization_id FK → organization)
- `leave_case` — main case table (organization_id FK → organization, case_number, state, analysis_result jsonb)
- `hr_decision` — HR decision records linked to cases
- `audit_log` — immutable audit trail for all case events
- `hr_password_reset` — password reset tokens

## API Endpoints

### Public
- `GET /api/healthz` — health check
- `POST /api/auth/login` — HR login (returns JWT with organizationId)
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/invite/validate?token=xxx`
- `POST /api/auth/register` — register from invite token (assigns org from invite)
- `POST /api/cases?org=<slug>` — employee portal case intake (org resolved from slug)
- `POST /api/interest` — company interest form → emails donnie@leavara.net

### Authenticated (JWT required)
- `GET /api/auth/me` — current user profile
- `PATCH /api/auth/me` — update own profile
- `POST /api/auth/change-password`
- `GET /api/cases` — list cases (scoped to caller's org)
- `GET /api/cases/:caseId`
- `POST /api/cases/:caseId/analyze`
- `POST /api/cases/:caseId/transition`
- `POST /api/cases/:caseId/hr-decision`
- `GET /api/cases/:caseId/audit-log`

### Admin only
- `POST /api/auth/invite` — send invite (scoped to caller's org)
- `GET /api/auth/users` — list org users
- `PATCH /api/auth/users/:userId` — activate/deactivate user

## Multi-Tenancy Architecture (Phase 1 complete)

- Shared database, shared schema with `organization_id` row-level isolation
- JWT payload includes `{ sub, email, role, organizationId }`
- HR routes enforce org-scoped queries via the JWT's `organizationId`
- Employee portal detects org from subdomain (`slug.leavara.net`) or `?org=<slug>` query param (dev)
- Phase 2 (planned): Leavara super-admin panel to provision orgs
- Phase 3 (planned): Stripe billing per org

## Subdomain Routing (Production)

- DNS: `*.leavara.net` → Replit deployment
- App reads `window.location.hostname`, extracts subdomain as org slug
- Dev fallback: `?org=soapyjoes` query param on employee portal

## Eligibility Engine

`artifacts/api-server/src/lib/eligibility.ts` implements the deterministic analysis:
- CFRA: 5+ employer employees, 12+ months tenure, 1,250+ hours/year
- FMLA: 50+ employer employees, 12+ months tenure, 1,250+ hours/year
- PDL: pregnancy disability only, 5+ employer employees, no tenure/hours requirement
- PERSONAL: always eligible, 30 calendar days

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client + Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push schema changes to DB
