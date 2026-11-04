# Aurora ERP

Aurora ERP is a production-ready, white-label, multi-tenant enterprise resource planning platform. It ships as a monorepo with a Next.js web application and an Express + MongoDB API.

## Stack

- **Web:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Recharts, Zustand, React Hook Form + Zod
- **API:** Express 5, TypeScript, MongoDB / Mongoose, Zod, Pino, JWT access + refresh tokens
- **Platform:** shared-schema multi-tenancy, RBAC, soft deletes, audit trail, commercial license keys

## Getting started

### Prerequisites

- Node.js 20.9+
- npm 10+
- MongoDB 7+ (local or Docker)

### Install

```bash
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

### Run

```bash
npm run dev
```

The API runs on `http://localhost:4000` and the web app on `http://localhost:3000`.

### Seed demo data

```bash
npm run seed
```

Demo accounts (password `Admin@12345`):

- `admin@aurora.com` — super admin
- `manager@aurora.com` — manager
- `accountant@aurora.com` — accountant
- `employee@aurora.com` — employee
- `viewer@aurora.com` — viewer

### Quality checks

```bash
npm run check:env
npm run lint
npm run typecheck
npm test
npm run build
```

### Docker

```bash
npm run docker:up
```

### Licensing

Generate an Ed25519-signed commercial license key:

```bash
npm run license:generate -- --licensee="Acme Corp" --edition=enterprise --expires=2027-12-31
```

Set `LICENSE_PUBLIC_KEY` and `LICENSE_KEY` in `server/.env`. Keep the private key secret.

## License

See [LICENSE](./LICENSE). Aurora ERP is proprietary software. Contact sales for licensing.
