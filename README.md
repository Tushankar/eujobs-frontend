# Local WorkMan (LWM) — AI Job Portal

An EU job portal with three role workspaces (**Candidate**, **Recruiter**, **Admin**), recruiter onboarding, payments, learning and AI matching.

| Folder | What it is |
|---|---|
| `client/` | React + Vite (JavaScript/JSX). Every screen reads and writes the API through RTK Query; there is no mock data in the client any more (`node e2e/audit-static.js` checks this). |
| `server/` | Node.js API: Express 5 + Mongoose (MongoDB Atlas), Stripe test mode, OpenAI, Gmail SMTP, Google Places proxy. `server/.env` is local only and never committed. |
| `e2e/` | Browser checks in the local Chrome (puppeteer-core) against a test stack. |

## Run it locally

Needs Node 24, the Stripe CLI and `server/.env` (the variable names are listed in [docs/BACKEND_PLAN.md](docs/BACKEND_PLAN.md) §1.3).

```bash
cd server
npm install
npm run seed:catalog   # countries, plans + Stripe prices, permissions, roles, FAQs, legal texts (idempotent)
npm run seed:demo      # wipes and recreates the demo data and accounts in the database `eujobs`
npm run dev            # API on the PORT in server/.env, with the 60 s scheduler
npm run stripe:listen  # in a second terminal: forwards Stripe test webhooks to the API

cd ../client
npm install
npm run dev            # http://localhost:5173 (proxies /api to the local API)
```

**After pulling new code, run `cd server && npm run seed:catalog` before you restart the server.** New plan records, prices, permissions or roles come from the catalogue seed. Without it the server starts on data it does not know: on 2026-11-05 the dev database missed the Recruiter Plus plan record, and the start-up step paused seeded recruiters' extra jobs.

Demo accounts (password `SEED_PASSWORD`): the Owner admin uses `SEED_ADMIN_EMAIL`; Alex Morgan and Emma Wilson (candidates), Sarah Miller (recruiter, Recruiter Plus) and James Chen (recruiter waiting for review) use its plus-aliases (`<local>+alex@<domain>`, `+emma`, `+sarah`, `+james`). Every other seeded person uses `@example.com` and is never emailed.

Payments are Stripe test mode: card `4242 4242 4242 4242`, any future date, any CVC.

## Checks

```bash
cd server && npm test            # API tests on the database eujobs_test (takes the test lock, see below)
cd server && npm test -- test/privacy.test.js   # one file (also through the lock)
cd server && npm run lint
cd client && npm run lint
cd client && npm run build       # runs check-i18n first: es and fr must match en
cd client && npm run check:i18n
node e2e/run.js phase-12         # one phase's browser scenarios; also: a scenario name, several comma-separated, or sweep
node e2e/run.js all              # every scenario of every phase + the sweep, eujobs_test reseeded per phase
node e2e/audit-static.js         # static-data audit of client/src: must report 0 findings
```

`node e2e/run.js` seeds `eujobs_test`, starts its own API (port 5100), Vite (5174) and `stripe listen`, runs the scenarios at 1440 px (D) and 375 px (M) and writes screenshots and `results.json` under `e2e/artifacts/`.

### One test run at a time (test lock)

Every session on this machine shares `eujobs_test` and the e2e ports, and a run reseeds the database. Two runs at once break each other, so `npm test` and `node e2e/run.js` take a lock first: `C:/eujobs-data/eujobs_test.lock` (`server/test/lock.js`), recording the command, the Claude session id, the process id and the start time.

- A second run exits at once (exit code 3) with a message naming the holder. Wait for it to finish and run again.
- A lock left by a process that is no longer running is cleared automatically.
- A test file started directly (`node --test …`) stops while another run holds the lock. It does not take the lock itself, so use `npm test -- <file>`.
- If the lock names a live process that is not a test run (a reused process id), delete the file.

There is one test database on purpose: the Atlas cluster is shared with other projects, so no extra databases are created.

## Docs

| File | What it covers |
|---|---|
| [docs/BACKEND_PLAN.md](docs/BACKEND_PLAN.md) | the build plan: decisions, architecture, data model, API, phases with their browser checks and handoffs, the owner's answers |
| [docs/backend/DECISIONS.md](docs/backend/DECISIONS.md) | the 210 product decisions (audits and review in `docs/backend/`) |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | tokens, typography, components extracted from Figma |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | client architecture and how to add a screen |
| [docs/FIGMA_SCREEN_INVENTORY.md](docs/FIGMA_SCREEN_INVENTORY.md) | every Figma frame → node id, route, role |
| [docs/USER_FLOW.md](docs/USER_FLOW.md) | screen flow per role (Mermaid) |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | the original frontend plan (history only) |

Code paths in the docs (`src/...`) are relative to `client/`. On Vercel, set the project's **Root Directory** to `client` and `VITE_API_URL` to the API.
