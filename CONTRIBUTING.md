# Contributing

Thanks for taking the time to improve Aurora ERP. This guide covers the
day-to-day workflow so changes land consistently.

## Getting set up

```bash
npm ci
cp server/.env.example server/.env
cp client/.env.example client/.env.local
npm run seed
npm run dev
```

See the [README](README.md) for database details and the seeded demo
accounts (`admin@aurora.com` etc., password `Admin@12345`).

## Before opening a pull request

Run the same checks as CI:

```bash
npm run check:env   # every env var must appear in .env.example
npm run lint
npm run typecheck
npm test            # server tests + client tests (in-memory MongoDB, no Docker needed)
npm run test:coverage  # enforces 70% on server utils
npm run build
```

Or run everything at once:

```bash
npm run verify      # format, lint, typecheck, tests, build
npm audit --audit-level=high
```

## Tests

- API specs live in `server/tests/` and use Vitest with Supertest and
  `mongodb-memory-server`; no live MongoDB is required.
- Storefront specs live in `client/tests/` and use Vitest with React
  Testing Library.
- Every behaviour change should come with a spec that fails without the
  change. New API endpoints need at least a happy-path spec and a
  validation or authorisation spec.
- `npm run test:coverage` enforces the coverage gates in
  `server/vitest.config.mjs`. Add real tests rather than lowering a
  threshold; if a threshold genuinely must move, explain why in the pull
  request.
- Pair new features with their specs in the same commit so history stays
  reviewable.

## Code style

- Prettier owns formatting; do not hand-format code.
- ESLint runs across the API and the web app. Unused variables must be
  prefixed with `_`.
- Server and client are both TypeScript (ESM). Keep controllers thin:
  validate with Zod, let the error middleware shape responses, and log
  through `server/src/config/logger.ts` rather than `console`.

## Commit messages

Use a short conventional prefix and keep each commit focused:

```text
feat(server): verify database connectivity in the health endpoint
fix(client): keep the suspense boundary on the product catalogue
test(server): add order endpoint specs
docs: document the Docker workflow
chore: update dependencies
```

Prefixes in use: `feat`, `fix`, `test`, `docs`, `chore`, `ci`, `build`,
`style`, `refactor`.

## Git history and hygiene

- Keep commits small, focused, and buildable on their own; the test suite and
  CI gate are the safety net, not a substitute for reviewable history.
- Ship features together with their tests in the same commit (e.g.
  `test(server): add invoice issuance specs` alongside the service change).
- Avoid bulk commits that mix formatting, refactors and features; split them
  so the mineable work in each commit can be reviewed and reverted safely.
- Each commit must pass `npm run verify` (format, lint, typecheck, tests,
  build) from a fresh `npm ci` checkout.
- Verify history looks incremental:

  ```bash
  git log --oneline
  ```

- Use conventional prefixes (`feat`, `fix`, `test`, `docs`, `chore`, `ci`,
  `build`, `style`, `refactor`) so the log conveys rationale.
- Before pushing, run `npm audit --audit-level=high` and `npm run
  test:coverage`; do not lower coverage thresholds to make a commit pass.
- `.gitattributes` normalizes line endings (`* text=auto eol=lf`), keeps
  binary assets intact, and marks `package-lock.json` as `-diff`; keep it
  committed and do not hand-edit the lockfile.

## Database changes

1. Edit the Mongoose schemas under `server/src/models/`.
2. Commit the schema change and, if the seed data needs to reflect it, update
   `server/seed/seed.ts`.
3. Verify with `npm run seed:fresh` against a disposable database.

## Security

- Never commit `.env` files, database dumps or uploaded files.
- Do not log credentials; the Pino logger redacts common secret fields, but
  do not pass them in the first place.
- Report vulnerabilities privately instead of opening a public issue. See
  [SECURITY.md](SECURITY.md).
