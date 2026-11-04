# Aurora ERP

[![Node](https://img.shields.io/badge/node-%3E%3D20.9.0-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

Aurora ERP is a production-ready, white-label, multi-tenant enterprise resource planning platform. It ships as an npm-workspaces monorepo with a Next.js web application and an Express + MongoDB REST API.

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [Seed data](#seed-data)
- [Docker](#docker)
- [Licensing](#licensing)
- [Quality checks](#quality-checks)
- [Architecture notes](#architecture-notes)
- [License](#license)

## Features

- Multi-tenant, shared-schema workspaces with organization switching
- Role-based access control: Super Admin, Org Admin, Manager, Employee, Accountant
- Granular permission grants/revokes per member
- Dashboard with KPIs, charts, recent activity
- Inventory: products, categories, warehouses, stock levels, adjustments, transfers
- Sales: customers, quotations, sales orders, invoices, payments, PDF export
- Purchasing: suppliers, purchase orders, goods receipts, vendor bills
- Finance: chart of accounts, transactions, journal entries, reports (P&L, trial balance, balance sheet, cash flow, aging)
- HR: employees, attendance, leave requests, payroll with payslips
- Team management with invite flow and temporary passwords
- Notifications, audit log, organization & profile settings
- Super-admin console: workspaces, users, audits, license status
- Commercial license verification (Ed25519-signed keys, optional enforcement)
- Soft deletes, audit trail, document numbering, PDF generation

## Tech stack

| Layer | Technologies |
| --- | --- |
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Recharts, Zustand, React Hook Form + Zod |
| API | Express 5, TypeScript, MongoDB / Mongoose, Zod, Pino, JWT access + refresh tokens |
| Tooling | ESLint, Prettier, Vitest, Supertest, tsx, Docker, GitHub Actions |

## Repository layout

```text
aurora-erp/
├── client/                 # Next.js web application
├── server/                 # Express + MongoDB API
├── scripts/                # Utility scripts (env check, license generation)
├── docker-compose.yml
├── package.json            # Root workspace orchestration
├── LICENSE
├── README.md
└── THIRD_PARTY_NOTICES.md
```

## Prerequisites

- Node.js `>= 20.9.0`
- npm `>= 10.0.0`
- MongoDB `7+` (local or via Docker)

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment files
cp server/.env.example server/.env
cp client/.env.example client/.env.local

# 3. Start both apps
npm run dev
```

The API runs on `http://localhost:4000` and the web app on `http://localhost:3000`.

## Environment variables

Server (`server/.env`):

- `MONGODB_URI` / `MONGODB_DB` — database connection
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — auth secrets (>= 32 chars)
- `CLIENT_URL` / `CORS_ORIGINS` — web origin
- `LICENSE_KEY` / `LICENSE_PUBLIC_KEY` — optional commercial license
- `LICENSE_ENFORCEMENT` — `true` to require a valid license

Client (`client/.env.local`):

- `NEXT_PUBLIC_API_URL` — API base URL (default `http://localhost:4000/api/v1`)
- `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_DEFAULT_CURRENCY`

Validate example files with:

```bash
npm run check:env
```

## Available scripts

Root:

| Script | Description |
| --- | --- |
| `npm run dev` | Run API and web in parallel |
| `npm run build` | Build server then client |
| `npm run lint` | Lint server and client |
| `npm run typecheck` | Typecheck server and client |
| `npm run test` | Run server tests |
| `npm run seed` | Seed demo data |
| `npm run seed:fresh` | Reset and re-seed |
| `npm run check:env` | Validate `.env.example` files |
| `npm run license:generate` | Generate an Ed25519 license key |
| `npm run docker:up` | Start with Docker Compose |
| `npm run docker:down` | Stop Docker Compose |
| `npm run verify` | Format check, lint, typecheck, tests, build |

Workspace-specific scripts live in `client/package.json` and `server/package.json`.

## Seed data

```bash
npm run seed
```

Demo accounts (password `Admin@12345`):

| Email | Role |
| --- | --- |
| `admin@aurora.com` | Super admin |
| `manager@aurora.com` | Manager |
| `accountant@aurora.com` | Accountant |
| `employee@aurora.com` | Employee |
| `viewer@aurora.com` | Viewer |

## Docker

```bash
npm run docker:up
```

This starts MongoDB, the API, and the web app. Data persists in the `mongo_data` volume.

## Licensing

Generate an Ed25519-signed commercial license key:

```bash
npm run license:generate -- --licensee="Acme Corp" --edition=enterprise --expires=2027-12-31
```

Set `LICENSE_PUBLIC_KEY` and `LICENSE_KEY` in `server/.env`. Keep the private key secret and never commit it. Set `LICENSE_ENFORCEMENT=true` in production to require a valid license.

## Quality checks

```bash
npm run check:env
npm run lint
npm run typecheck
npm test
npm run build
```

Or run everything at once:

```bash
npm run verify
```

## Architecture notes

- **Multi-tenancy:** shared schema with an `organization` discriminator and an AsyncLocalStorage tenant plugin; all tenant-scoped queries are filtered by organization.
- **Auth:** JWT access tokens (short-lived) + rotating refresh tokens in httpOnly cookies with reuse detection.
- **RBAC:** global `User` + per-org `Membership` with role defaults and grant/revoke overrides.
- **Totals:** server recalculates all document totals; invoices issue stock and post journals; payments update balances/ledgers; payroll posts a journal on paid.
- **Soft deletes:** master and transactional models support soft delete; super-admins can include deleted records.
- **Frontend:** access token kept in memory; persisted store holds only user/org/membership/organizations; bootstrap via refresh cookie then `/auth/me`.

## License

See [LICENSE](./LICENSE). Aurora ERP is proprietary software. Contact sales for licensing. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for open-source dependencies.