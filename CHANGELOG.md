# Changelog

All notable changes to Aurora ERP are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `CONTRIBUTING.md`, `CHANGELOG.md`, and `SECURITY.md` for onboarding, release
  history and private vulnerability reporting.
- Full env-example validation: `npm run check:env` now verifies every variable
  referenced by `server/src/config/env.ts` and the client public env.

### Hardened

- CI runs `npm audit --audit-level=high`, Dependabot covers `/`, `/client`, and
  `/server`, and `npm run verify` gates format, lint, typecheck, tests, and build.

## [1.0.0] - 2026-11-04

### Added

- Production-ready, white-label, multi-tenant ERP monorepo: Next.js 16 web
  app (`client/`) and Express 5 + MongoDB REST API (`server/`).
- Multi-tenancy with shared schema, organization switching, AsyncLocalStorage
  tenant isolation and optional subdomain tenancy.
- Role-based access control: Super Admin, Org Admin, Manager, Employee,
  Accountant with granular `resource:action` permissions and per-member
  grant/revoke overrides.
- Dashboard KPIs, inventory, sales, purchasing, finance (double-entry journal
  and reports), HR/payroll, team, notifications, audit log and super-admin
  platform console.
- JWT access tokens plus rotating refresh tokens in httpOnly cookies with
  reuse detection; bcrypt password hashing, rate limiting, Helmet/CORS and
  structured Pino logging.
- Soft deletes, sequenced document numbering, PDF generation and server-side
  recalculation of all document totals.
- Commercial license verification with Ed25519-signed keys and optional
  enforcement (`LICENSE_ENFORCEMENT`).
- Demo seeder (`npm run seed`), Docker Compose stack (MongoDB 7, API, web),
  `check:env` script and GitHub Actions CI.

### Fixed

- In-memory MongoDB test setup (`mongodb-memory-server`) so `npm test` runs
  without Docker; 70% coverage threshold enforced on `server/src/utils/`.
- Admin console split into `OrganizationsTab`, `UsersTab`, and `AuditTab`
  components with Zod schemas extracted to `client/src/lib/schemas/admin.ts`.
