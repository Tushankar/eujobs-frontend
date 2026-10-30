# Local WorkMan: backend build plan

This file is the single build guide for the Node.js backend of **Local WorkMan** (EU AI job portal) and for the client changes that go with it. A fresh Claude Code session builds the system from this file, one phase at a time. The owner reads along.

**Precedence when sources disagree:** settled facts (§1) and this plan, then `docs/backend/DECISIONS.md` (its own header says this plan's §3 wins), then the audits in `docs/backend/audits/`. The audits give per-screen detail (file:line of every static item). Where an audit proposal conflicts with a decision, the decision wins.

**Citation key**

| Tag | Meaning | Where to read it |
|---|---|---|
| M-001 … M-210 | final decisions (the owner accepted every recommendation) | `docs/backend/DECISIONS.md` |
| OD1 … OD16 | owner decisions taken after the 210 (all recommended defaults accepted) | Appendix C |
| C1 … C26 | contradictions, with the adopted resolution | Appendix A |
| U1 … U44 | under-specified items, with the adopted default | Appendix B |
| P1 … P17 | prep checklist | §7 |
| S | settled fact (binding; listed in §1) | §1 |
| OQ-n | question the owner answered on 2026-10-30 (now a settled rule) | "Open questions" below |
| A: file §x | audit reference | `docs/backend/audits/<file>.md` |

---

## 0. Start here

### 0.1 Reading order

1. This §0 and **Open questions for the owner** (right after §0; all answered, kept as the record).
2. `CLAUDE.md` (working rules; they apply to every step).
3. §1 (environment), §2 (architecture) and §3 (product rules) of this file.
4. The section of the phase you are building in §6, plus the §4 (data model) and §5 (API) rows it touches.
5. For per-screen detail, the audit sections listed for that phase in Appendix D (each static item with file:line, storage call sites, copy to replace).
6. `docs/CONVENTIONS.md` and `docs/DESIGN_SYSTEM.md` for client structure and styling. Three conventions change with the backend: data comes from the API through RTK Query (not `useLocalStorage`), copy lives in i18n files (English copy still follows Figma), and the "no backend / saved on this device" wording goes away.
7. `DECISIONS.md` for the full text of any cited M-id. `IMPLEMENTATION_PLAN.md` is frontend history only; do not follow it for this work.

### 0.2 Working rules for the build session

- **CLAUDE.md first.** Before each step, state a short plan with a verify check per item. Write the minimum code that solves the step. Make surgical changes and match the existing style.
- **No silent assumptions.** Anything not covered by this plan, `DECISIONS.md` or the audit detail is asked with **AskUserQuestion** (batch the questions, recommended option first). Append each answer under "Owner answers" at the end of the Open questions section, so later phases see it.
- **Nothing static.** Every number, list, name, date, price and label comes from the database, is computed, or is a translation key. Enum labels are i18n keys. Validation limits come from the server (`GET /api/v1/meta/config`). Each phase deletes the mock `data/` files, hooks and `useLocalStorage`/`useSharedLocalStorage` call sites that it replaces.
- **Plain JavaScript only** (ES modules, `.js`/`.jsx`). No TypeScript, no Docker, no Redis, no queue services (S).
- **Secrets.** Never print, log, echo, paste or commit any `.env` value or key prefix. Refer to variable names only. Test output must not contain tokens or keys.
- **Git.** Do not commit or push unless the owner asks.
- **Verify in a real browser.** Every phase ends with its API tests and its browser verification (§6), run in the local Chrome through the e2e harness at 1440 px and 375 px where UI changed. Report results honestly: pass or fail per scenario, with screenshot paths. Never end a phase with "not tested". If a check cannot run, stop and ask.
- **Stop at every phase boundary.** Report what was built, the decisions implemented, test results and any open item. Wait for the owner before starting the next phase.
- **Keep the app green.** At every phase end: `npm run lint` and `npm run build` in `client/`, `npm test` and `npm run lint` in `server/`, and the full route sweep (`node e2e/run.js sweep`).
- **New screens without Figma** (U44) are built from existing components and `docs/DESIGN_SYSTEM.md`, then checked in a real browser (OD16).

### 0.3 Per-phase protocol

1. **Start.** Re-read the phase. Check its prep items (§7). Every open question is answered (see below). Ask the owner only about something this plan does not cover. Write the step plan with a verify check per step.
2. **Build, in this order:** server (model → schemas → service → routes → API tests), then client (API slice → screens → delete the replaced mocks), then the `seed:demo` additions, then the e2e scenarios.
3. **End.** Run `npm test` (server), `npm run lint && npm run build` (client), `node e2e/run.js phase-N` and `node e2e/run.js sweep`. Report and stop.

---

## Open questions for the owner (all answered 2026-10-30)

These came up while writing this plan. The owner accepted the recommended option for every item on 2026-10-30. The rules are applied in §3–§6 and cited as OQ-n. The questions stay here as the record.

**OQ-1. Moderation outcomes for company and message reports** (Phase 10; M-164, M-167)
M-164 lets users report jobs, profiles, companies and messages. M-167 defines "Restrict" only for a job (paused + locked) and a profile (hidden from discovery).
- **(a) Chosen.** Company and message cases offer **Dismiss** only. To act, the admin uses decided account actions: Suspend the recruiter through Account review (M-165), or Restrict the candidate's profile (M-167). The thread excerpt is the reported message plus up to 5 earlier messages of that thread.
- (b) Not chosen: new effects (restricting a company pauses all its jobs; restricting a message hides it).

**OQ-2. Lifting a recruiter suspension** (Phase 4; M-165, M-151)
- **(a) Chosen.** A suspended recruiter is listed in Account review with an **Approve** action (reactivation, permission `users.deactivate` plus `moderation.manage`). The "approved" email is sent (M-092).
- (b), (c) Not chosen: suspension is final; reactivation from the detail page.

**OQ-3. Course suggestion rules** (Phase 8; M-114)
- **Candidates, (a) chosen.** Gap skills = required skills missing from the profile across the candidate's saved jobs, applied jobs and the first 10 jobs of the For-you list (M-053, U8 for Free). Published candidate courses not yet enrolled are ranked by how many gap skills their skill tags match; courses that match none are not suggested.
- **Recruiters, (a) chosen.** The admin tags each recruiter course with one pipeline category (OD5). Suggest up to 3 published recruiter courses the recruiter has not enrolled in, whose category holds the most active applications in the company's pipeline. Reason: "{n} active applications at {stage}". Courses whose category holds no active applications are not suggested.

**OQ-4. Seed identities, applicant history and salary rates** (Phases 3–5; M-208, M-210, OD8, OD9, U42)
1. **(a) Chosen.** Two accounts named James Chen:
   - the candidate from the recruiter mock data (`@example.com`);
   - the recruiter applicant, which is the admin row's demo account (`+james` plus-alias), with a company and KYC files, status `pending_review`.
2. **(a) Chosen.**
   - Every seeded applicant has a complete profile with approved checks.
   - Applicants other than Emma Wilson get one historical Plus payment row (`source: seed`, no receipt link, dated before their first application) and no active subscription, which is the M-119 lapsed state.
3. **(a) Chosen.** Seed salaries are converted from the USD mock values at 1 USD = 0.75 GBP = 0.87 EUR = 3.75 PLN = 9.6 SEK, then rounded to 1,000 (U42).

**OQ-5. Admin metric definitions** (Phase 10; M-208, A: admin §1.1, §1.20). Chosen definitions:
- Overview "Applications": all applications except withdrawn.
- Overview "Companies registered" and Analytics "Company registrations": every company created at onboarding step 2, any status.
- Analytics "Recruiter accounts": every recruiter user.
- Overview "Verification checks in review": candidate verification submissions in review only (recruiter KYC is counted in "Pending user reviews").

**OQ-6. Small interpretations** (all adopted as recommended)
- a. "Open to remote" in discovery (M-055, M-132) = profile work preference `remote`.
- b. Admin format locale (M-133) = the language's default region, as for Remote (M-132): en-IE, es-ES, fr-FR.
- c. Email cap (OD9): over-cap non-critical emails are not sent and are logged `skipped_cap`. The CV-request email (U19) counts as non-critical.
- d. Server-built CSV files (admin exports, report snapshots under M-183, the recruiter export summary under M-190) use the requester's language for headers and labels, with a UTF-8 BOM.
- e. The U33 "undo window" = choosing a stage again in that application's stage select; within 10 minutes no email goes out.
- f. "Verified" (discovery filter M-056, admin column state M-169, the Overview KPI) = every check M-023 requires for that candidate is approved. While partial, the column shows "n of 3 verified".
- g. The U5 location mismatch caps the score at 49. It applies when either of these is true:
  - the candidate's profile country is not the job's country (on-site or hybrid), or is not in a remote job's non-empty eligible list;
  - the candidate's work preference differs from the job's.
- h. Recruiter sign-up with an already-registered email returns 409 `EMAIL_TAKEN`; the screen offers sign-in and reset links.
- i. A remote job's eligible-countries list is optional; empty means all EU 27 + UK. It is shown as a badge on cards and details, and as an "Eligible in" filter inside the Remote view.
- j. The admin permission catalogue in §3.13 is adopted as written.
- k. Recruiter deletion also deletes the company's notes, shortlist and activity timeline. The company record keeps its display name and logo for past applications and threads.

### Owner answers

| Question | Answer | Date |
|---|---|---|
| OQ-1 | (a) Dismiss only for company and message cases; excerpt = reported message + up to 5 earlier | 2026-10-30 |
| OQ-2 | (a) Approve (reactivate) a suspended recruiter from Account review | 2026-10-30 |
| OQ-3 candidates | (a) gap skills from saved + applied + first 10 For-you jobs | 2026-10-30 |
| OQ-3 recruiters | (a) course pipeline category; top 3 by active applications | 2026-10-30 |
| OQ-4.1 | (a) two James Chen accounts (candidate; recruiter applicant) | 2026-10-30 |
| OQ-4.2 | (a) complete applicants; one historical Plus seed payment each (Emma active) | 2026-10-30 |
| OQ-4.3 | (a) 1 USD = 0.75 GBP = 0.87 EUR = 3.75 PLN = 9.6 SEK, rounded to 1,000 | 2026-10-30 |
| OQ-5 | all recommended definitions | 2026-10-30 |
| OQ-6 a–k | all as recommended | 2026-10-30 |
| P1-Q1 permission groups | keep the 5 Figma groups; new ids appended: `dashboard.view` → Finance & reporting, `jobs.view` → Recruitment, `documents.view`, `learning.view`, `ai.view`, `ai.manage` → Governance | 2026-10-30 |
| P1-Q2 Owner name | the seeded Owner admin is named "Workspace admin" | 2026-10-30 |
| P1-Q3 demo cities | Alex, Emma and Sarah (Acme Studio) in London (GB); James's applicant company in Dublin (IE) | 2026-10-30 |

_(Answers to any new question asked during the build are appended to this table.)_

---

## 1. Current state & environment

### 1.1 Repository

Repo `Tushankar/eujobs-frontend`, branch `main`. Phase 0 (restructure into `client/` and `server/`) is done and committed.

| Path | State |
|---|---|
| `client/` | React 19 + Vite 8 app (JavaScript, CSS Modules, react-router 7). Every screen still runs on mock data in `localStorage`. Lint, build and the 69-route sweep were green at the end of the planning session. Vercel will serve it later with Root Directory = `client` (S). |
| `server/` | Only `.env`, which is gitignored. No code yet. |
| `docs/` | `CONVENTIONS.md`, `DESIGN_SYSTEM.md`, `FIGMA_SCREEN_INVENTORY.md`, `USER_FLOW.md`, `BACKEND_PLAN.md` (this file), `backend/` (`DECISIONS.md`, `decisions.json`, `blocker-review.md`, `audits/{candidate,recruiter,admin,shared}.md`) |
| root | `CLAUDE.md`, `README.md`, `IMPLEMENTATION_PLAN.md`, `.gitignore` (ignores `.env`, `.env.*` except `.env.example`, and `server/uploads/`) |

Paths in the audits are relative to `client/` (shared audit) or start with `client/src/` (other audits).

### 1.2 Verified services

| Service | What was verified | When | Used for |
|---|---|---|---|
| MongoDB Atlas | Reachable; database `eujobs` exists and is empty | planning session | `MONGODB_URI`. Tests use database `eujobs_test` on the same cluster. |
| Stripe sandbox `acct_1QxYbXLUXYC1nS7o` (US, default USD), test mode | Checkout in EUR, GBP, PLN, SEK, DKK, CZK, HUF and RON. Subscription in PLN, then cancel and re-subscribe the same Customer in EUR. `adaptive_pricing[enabled]=false` accepted. No Customer Portal configuration exists yet. | 2026-10-30 | Hosted Checkout + webhook (S); the Stripe CLI forwards webhooks using the secret key (§2.10), so no CLI browser login is ever needed |
| OpenAI | `gpt-5.5`, `gpt-5.4-mini`, `text-embedding-3-large` (3072 dims), `gpt-4o-mini-transcribe` with `whisper-1` as fallback; a real transcription test passed | planning session | OD7 is resolved (P4 done) |
| Gmail SMTP | Sends mail (personal Gmail, about 500 recipients per day) | planning session | All email (S) |
| Uploads folder | `C:/eujobs-data/uploads` exists outside OneDrive | P2 | `UPLOAD_DIR` (C17) |

### 1.3 Environment variables (`server/.env`)

Names only. Never print values. Node's `--env-file` loads them; variables already present in the environment win over the file, which the e2e harness uses for test overrides.

| Name | Meaning | First used |
|---|---|---|
| `NODE_ENV` | `development` or `test`. `test` switches to database `eujobs_test`, captured mail, uploads under `UPLOAD_DIR/_test`, the `/_test` routes, and no automatic scheduler timer. | Phase 1 |
| `PORT` | API port (5000 in development; the e2e harness overrides it with 5100) | 1 |
| `CLIENT_ORIGIN` | `http://localhost:5173`. CORS origin and the base of every link in emails, Stripe return URLs and the certificate QR (M-204). The e2e harness overrides it with `http://localhost:5174`. | 1 |
| `MONGODB_URI` | Atlas connection string | 1 |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | HS256 signing key; token lifetime (7d, M-007) | 1 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Gmail SMTP transport and sender | 1 |
| `SEED_PASSWORD` | Password of every seeded account. It must pass the password rules (M-006, U2); the seed refuses to run otherwise. | 1 |
| `SEED_ADMIN_EMAIL` | Inbox of the seeded Owner admin. Demo candidate and recruiter accounts use plus-aliases of it (S, OD9). | 1 |
| `UPLOAD_DIR` | Root folder for uploaded and generated files, outside OneDrive (C17) | 3 |
| `FILE_URL_SECRET` | HMAC key for signed file URLs (U39) | 3 |
| `STRIPE_SECRET_KEY` | Stripe test-mode key | 5 |
| `STRIPE_WEBHOOK_SECRET` | Must equal the signing secret printed by `stripe listen` (P8) | 5 |
| `OPENAI_API_KEY` | OpenAI key | 9 (Phase 10 for transcription) |
| `OPENAI_MODEL` | `gpt-5.5` (U4 "large" features) | 9 |
| `OPENAI_FAST_MODEL` | `gpt-5.4-mini` (U4 "fast" features) | 9 |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-large`, 3072 dims | 9 |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe`; the code falls back to `whisper-1` (OD7) | 10 |

Do not add new server variables without asking the owner. The client dev server reads one non-secret variable, `VITE_API_PROXY` (the proxy target; default `http://localhost:5000`), which the e2e harness sets.

### 1.4 Tools on this machine

Node 24.19, npm 11, Git, Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`, Stripe CLI 1.55.3 (always run with `--api-key` taken from `server/.env` by a script, never typed or printed, so the 90-day CLI login does not matter; P8), cloudflared 2026.8.2 (not needed for the build, P17).

**ffmpeg is not installed.** There is no transcoding (M-102). Video duration is read in the browser (D8). Media fixtures are generated or downloaded (P11).

### 1.5 Stripe sandbox facts

- Test mode only; prices are VAT-inclusive; no Stripe Tax (M-127).
- Stripe does not email receipts for test-mode payments. Use the stored receipt or hosted-invoice link instead, and do not test for receipt emails (C12).
- All 8 currencies use two-decimal minor units in Stripe, HUF included, and every planned price is above Stripe's minimums (D2).
- There is no Customer Portal configuration yet. Phase 5 creates one through the API (P6).
- The failed-payment retry settings (Dashboard only) are **optional** (P7). Lapse handling works from subscription and invoice webhooks whatever the final retry action is (§2.10).
- `stripe listen --api-key <key> --forward-to …` forwards webhooks to localhost (M-204, P8). The key is read from `server/.env` by `npm run stripe:listen`. No CLI browser login is needed.

### 1.6 Remaining prep and the phase that does it

| Prep | Phase | Prep | Phase |
|---|---|---|---|
| P5 (rest: end-to-end paid Checkout per currency) | 5 | P11 test fixtures | 3, 4, 8, 10 |
| P6 Customer Portal configuration | 5 | P12 plus-alias demo accounts | 1 (seed derives them) |
| P7 failed-payment settings (owner, Dashboard) | optional; not a prerequisite | P13 Atlas headroom check | 1 (and again in 9) |
| P8 `stripe listen --api-key` signing-secret check | 5 | P14 logo file | not needed (OD11) |
| P9 fonts | 2 (client), 8 (server PDFs) | P15 Imprint identity | before go-live (§8) |
| P10 common-password list | 1 | P16 npm packages | per phase (§2.14) |
| P17 cloudflared | not needed now (§8) | P1–P4 | done |

---

## 2. Architecture

### 2.1 Server layout

```
server/
  package.json          "type": "module"; scripts in §2.2
  server.js             connects the DB, starts HTTP, starts the scheduler (not when NODE_ENV=test)
  app.js                builds and exports the Express app without listening (imported by tests)
  config/
    env.js              reads and validates process.env with zod; exports `config`; never logs values
    enums.js            the key catalogue (§4.1), the only place enum keys are defined
    limits.js           every field, size and count limit (M-031, M-033, U26, M-102, …)
  lib/
    db.js               mongoose connect; dbName = eujobs | eujobs_test; syncIndexes at start
    errors.js           AppError + the stable error codes (§2.3)
    validate.js         zod middleware → VALIDATION_FAILED with field keys
    audit.js            audit writer (M-162)
    mailer.js           send pipeline (§2.8); mail/templates.js renders from i18n
    i18n.js             server dictionaries (§2.11)
    files.js            storage paths, type checks, signed URLs (§2.6)
    images.js           sharp helpers;  pdfText.js  pdfjs-dist + mammoth;  pdf.js  certificate PDF
    markdown.js         marked + DOMPurify;  svg.js  DOMPurify SVG profile
    money.js  locale.js  time.js (luxon)  phone.js (libphonenumber-js)
    ai.js               OpenAI client, cache, daily cap, embeddings, transcription (§2.9)
    stripe.js           Stripe client and helpers (§2.10)
  middleware/           auth.js  permissions.js  entitlements.js  rateLimit.js  upload.js  error.js
  modules/<name>/       <name>.model.js  <name>.schemas.js  <name>.service.js  <name>.routes.js
  routes/v1.js          mounts every module router under /api/v1, plus /_test when NODE_ENV=test
  jobs/scheduler.js     60-second tick (OD10);  jobs/tasks/<type>.js  one handler per task type
  i18n/en.json es.json fr.json   server texts: emails, certificate PDF, CSV labels, AI language names
  seed/catalog.js  seed/demo.js  seed/data/   (U41)
  assets/fonts/         Inter and Manrope TTF with Latin Extended (P9)
  data/common-passwords.txt                   (P10)
  test/setup.js  test/helpers/  test/<module>.test.js
```

| Module | Owns |
|---|---|
| `auth` | register (candidate, recruiter), login, email link and code, forgot/reset, admin invite acceptance |
| `users` | `/me`, preferences, password change, notification toggle, legal acceptance, counters |
| `meta` | countries, languages, config (limits and enums), plans list, legal texts, FAQs |
| `files` | the signed file endpoint and the File model |
| `candidates` | profile, sections, photo, onboarding, privacy, completeness, overview |
| `cv` | CV versions, extraction, earlier-version requests, download log |
| `verification` | phone code, evidence submissions, admin verification queue |
| `companies` | company, logo, recruiter onboarding steps, KYC, account review |
| `jobs` | jobs, wizard drafts, quality checks, saved jobs, skill suggestions |
| `discovery` | recruiter candidate search, profile view, shortlist, notes, activity, profile views |
| `applications` | applications, pipeline stages, status emails |
| `messaging` | conversations, messages |
| `alerts` | job alerts, alert matching and digests |
| `payments` | plans, checkout, webhook, subscriptions, payments, portal |
| `learning` | courses (admin builder and learner views), enrollments, progress, quiz, certificates |
| `matching` | embeddings, policies and versions, scores, relevance |
| `ai` | AI summaries, insights narratives, CV AI, translations |
| `admin` | access management, user tables and details, metrics, reports, audit log, admin payments |
| `moderation` | user reports, cases, decisions |
| `privacy` | export, erasure, retention sweep |

### 2.2 Runtime and scripts

Express 5: rejected promises reach the error handler, so no async wrapper package is needed. Express 5 path syntax applies (named wildcards). Node's `--env-file` replaces `dotenv`.

| Script (`server/package.json`) | Command |
|---|---|
| `dev` | `node --watch --env-file=.env server.js` |
| `start` | `node --env-file=.env server.js` |
| `test` | `node --env-file=.env --import ./test/setup.js --test --test-concurrency=1 "test/**/*.test.js"` (`setup.js` sets `NODE_ENV=test` before any import) |
| `seed:catalog` | `node --env-file=.env seed/catalog.js` |
| `seed:demo` | `node --env-file=.env seed/demo.js` |
| `mail:test` | `node --env-file=.env scripts/mailTest.js <type> <to>`, development only: one live email for the owner to confirm (§2.13) |
| `lint` | `oxlint` |
| `stripe:listen` | `node --env-file=.env scripts/stripeListen.js` spawns `stripe listen --api-key <STRIPE_SECRET_KEY> --forward-to http://localhost:<PORT>/api/v1/stripe/webhook`. The key goes straight from `process.env` into the child process and is never printed. Added in Phase 5. |
| `stripe:check-secret` | `node --env-file=.env scripts/stripeCheckSecret.js` runs `stripe listen --api-key <key> --print-secret`, captures the output in memory, compares it with `STRIPE_WEBHOOK_SECRET` and prints only `match` or `mismatch` (P8). Added in Phase 5. |

Local run: `cd server && npm run dev`; `cd client && npm run dev` (Vite proxies `/api` to the server, M-204); from Phase 5 also `cd server && npm run stripe:listen`.

### 2.3 API conventions

- Base path `/api/v1`, JSON only. Auth header `Authorization: Bearer <jwt>` (S).
- **Lists:** `{ items, total, page, pageSize }`. Server pagination (`page`, `pageSize`) on the four admin tables of M-206 (Users, Applications, Payments, Audit); other lists return all rows.
- **Errors:** `{ "error": { "code": "VALIDATION_FAILED", "fields": { "title": "too_short" }, "params": { "min": 3 } } }`. Codes are stable UPPER_SNAKE keys, and field messages are keys such as `required`, `too_short`, `too_long`, `invalid` and `not_allowed`. The client translates both (M-143). The server never sends English sentences.
- **Money:** `{ amountMinor, currency }`: integer minor units plus an ISO 4217 code (U24). **Salary:** `{ min, max, currency, period }`: integer major units, period `year` or `month` (M-131, U26).
- **Dates:** ISO 8601 UTC strings. Month precision (work history, education) is stored as `YYYY-MM`; date-only values (permit expiry) as `YYYY-MM-DD` (M-133).
- **IDs:** MongoDB ObjectIds (M-205). **Enums:** keys from §4.1 (M-142).
- **Country scope:** discovery endpoints read the signed-in user's `pickerCountry` on the server (M-135, M-137). Admin lists take an optional `country` query (M-138). Chart endpoints take `tz` (IANA) from the browser (M-170).

| Code | HTTP | When |
|---|---|---|
| `AUTH_REQUIRED` | 401 | No token, an invalid or expired token, or a tokenVersion mismatch. The client clears the token and goes to sign-in with `?next` (M-011). |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password; also a non-admin on the admin portal and an admin on another portal (M-005) |
| `EMAIL_UNVERIFIED` | 403 | Candidate login before the link is opened (M-001); recruiter endpoints before the email code, except code verify, code resend and `/me` (U37) |
| `ACCOUNT_SUSPENDED` | 403 | Suspended recruiter (M-165) |
| `RECRUITER_NOT_APPROVED` | 403 | Recruiter workspace endpoint while not approved; payload `{ status, step }` (M-151) |
| `FORBIDDEN` | 403 | Wrong role, or not the owner of the resource |
| `PERMISSION_DENIED` | 403 | Admin without the route's permission; payload `{ permission }` (M-155) |
| `PLAN_REQUIRED` | 402 | Candidate without the entitlement; payload `{ entitlement }` (M-118) |
| `PROFILE_INCOMPLETE` | 403 | Apply with an incomplete profile; payload `{ missing: [itemKey] }` |
| `NOT_FOUND` | 404 | Missing, or not visible to this user |
| `JOB_NOT_ACCEPTING` | 410 | Apply to a paused, closed, restricted or invisible job (M-043, M-044) |
| `TOKEN_INVALID` / `TOKEN_EXPIRED` / `TOKEN_USED` | 400 / 410 / 409 | Email-link tokens (M-001, M-009, U21) |
| `CODE_INVALID` / `CODE_EXPIRED` / `CODE_LOCKED` | 422 / 410 / 429 | Email and phone codes; payload `{ attemptsLeft }` (M-004) |
| `EMAIL_TAKEN` | 409 | Recruiter sign-up with a registered email (OQ-6h) |
| `CONFLICT` | 409 | Duplicate (already applied, already enrolled, …) |
| `IN_USE` | 409 | Stage with active applications (M-072); role with assigned users (M-158) |
| `LOCKED` | 409 | Restricted job republish (M-167); course lessons or quiz after enrollment (M-108); KYC replacement after submit (M-185) |
| `OWNER_PROTECTED` | 409 | Lock-out rules (M-160) |
| `VALIDATION_FAILED` | 422 | zod or business validation; `fields`; job publish adds `step` (M-039) |
| `FILE_TYPE_NOT_ALLOWED` / `FILE_TOO_LARGE` | 422 / 413 | Upload rules (M-185) |
| `RATE_LIMITED` | 429 | Payload `{ retryAfter }` in seconds (M-008, U1) |
| `AI_DAILY_LIMIT` | 429 | Payload `{ resetAt }` (OD13) |
| `AI_UNAVAILABLE` | 503 | The OpenAI call failed |
| `PAYMENT_PROVIDER_ERROR` | 502 | A Stripe call failed |

### 2.4 Validation

One zod schema file per module (`<name>.schemas.js`). The middleware `validate({ body, query, params })` maps zod issues to field keys. Business rules that need the database (uniqueness, state transitions) live in the service and throw `AppError`. Every limit lives in `config/limits.js`. `GET /api/v1/meta/config` serves the limits and the enum keys, so client forms never hard-code them. Client validators return `{ key, params }` and are translated in the field component (A: shared §4.7).

### 2.5 Auth and sessions

- **Passwords (M-006, U2):** 8 to 128 characters and at most 72 bytes; not in the top-10,000 list (P10); not equal to the email local part (case-insensitive); no composition rules. `bcryptjs` cost 12.
- **JWT (M-007):** HS256 with `JWT_SECRET`; lifetime `JWT_EXPIRES_IN` (7d); claims `{ sub, role, tv }`. Every request loads the user and checks `tv === tokenVersion` and the status. Admin effective permissions are computed per request from the database (A: admin §4.3).
- **tokenVersion** increases on password reset (M-009) and on suspension (M-165). A password change does not sign out other sessions; no decision asks for it. Logout is client-side (M-007).
- **Email links (M-001, M-009, U21):** 32 random bytes, stored as a SHA-256 hash, single use. Lifetimes: email verification 24 h, reset 1 h, admin invite 72 h. Verification resend at most 1 per minute and 5 per day per email (M-001); the "already registered" email shares those limits (U36).
- **Codes (M-002, M-003, M-004):** 6 random digits, stored hashed; 10-minute expiry; 5 wrong attempts lock the code; resend after 60 s, at most 5 per hour. The recruiter email code is emailed. The phone code is returned in the API response and shown on screen (no SMS).
- **Login (M-005):** one endpoint with `portal: candidate | recruiter | admin`. A candidate/recruiter mismatch signs in and the client goes to the account's own workspace with a notice. The admin portal accepts only admins, and admins sign in only there; otherwise `INVALID_CREDENTIALS`.
- **Rate limits (M-008, U1):** in memory (`express-rate-limit`), no lockout.

| Limit | Key | Value |
|---|---|---|
| Failed logins | email | 5 per 15 min |
| Logins | IP | 20 per 15 min |
| Forgot password | email | 5 per hour |
| Sign-up | IP | 10 per hour |
| Certificate verification page | IP | 30 per minute (U17) |

- **Middleware:** `requireAuth`, `requireRole(role)`, `requireVerifiedEmail` (recruiters, U37), `requireApprovedRecruiter` (M-151), `requirePermission(id)` (M-155, Owner bypass M-160), `requireEntitlement(key)` (U38).

### 2.6 Files and signed URLs

- **Storage (M-185, C17):** root `UPLOAD_DIR` (development) or `UPLOAD_DIR/_test` (test); one subfolder per purpose; random 32-hex file names; never under the client or a web root. A `File` record holds owner, purpose, path, original name, MIME, size, sha256 and `deleteAfter`.
- **Checks (M-185):** extension, declared MIME, magic bytes (`file-type`) and size (multer `limits.fileSize`). Images are re-encoded with sharp, which strips metadata.

| Purpose | Types | Max | Notes |
|---|---|---|---|
| Profile photo | JPG, PNG, WebP | 5 MB | square cover crop; stored 400×400 and 96×96 (M-013) |
| CV | PDF, DOCX | 10 MB | max 20 versions (M-031, U18) |
| Verification evidence, KYC, external certificate file | PDF, JPEG, PNG | 10 MB | KYC replaceable only while onboarding is in progress or rejected (M-185) |
| Company logo | PNG, JPG, SVG | 2 MB | SVG sanitised with DOMPurify's SVG profile (M-150) |
| Course cover | JPG, PNG, WebP | 5 MB | M-107 |
| Lesson video | MP4 (H.264/AAC), WebM | 500 MB | Range streaming, no transcoding (M-102). The server checks the container; the admin page reads duration and playability in the browser. Upload on localhost only (C26). |
| Lesson document | PDF | 50 MB | M-102 |
| Report voice note | mp3, m4a, wav, webm, ogg | 25 MB | M-182 |
| Generated | certificate PDF, report CSV, export ZIP | — | written by the server |

- **Signed URLs (U39, C16):** `GET /api/v1/files/:fileId?u=<userId>&exp=<unix>&sig=<hex>`, where `sig` = HMAC-SHA256(`FILE_URL_SECRET`, `<path>|<userId>|<exp>`). URLs are valid 15 minutes for images, PDFs and CVs, and 6 hours for video. DTOs contain them only after the ownership or visibility check. The endpoint checks the signature and expiry, then streams with `res.sendFile` (Range support for video and PDF, D8), `Cache-Control: private`, and `inline` or `attachment` disposition.
- **Download log (M-187):** when a CV file is served to someone other than its owner, a log row is written; the candidate sees the list.
- **Admin access:** KYC, evidence, right-to-work, certificate and voice-note files need `documents.view`.

### 2.7 Scheduler (OD10)

- In process: `setInterval(tick, 60_000)`, plus one tick at startup, which catches up on anything missed while the server was off.
- `ScheduledTask { type, key, dueAt, payload, status: pending|running|done|failed, attempts, lastError, lockedAt }`. Each tick claims due tasks atomically (`findOneAndUpdate` pending → running). A unique `key` while pending makes collapse and dedupe trivial. A failed task is retried on the next tick up to 3 attempts, then marked `failed` and logged.
- Daily slots use `JobRun { name, lastRunAt }`: `relevance-nightly` at 03:00 server time, run at startup if the last run is over 24 h old (U7); `retention-sweep` at 03:00 (U32). Digests are evaluated each tick per user time zone (U12).
- Task types: `email.message` (U13), `email.stage` (M-091, U13, U33), `email.new-applications` (OD14), `alerts.instant` (M-097), `matching.recompute` (M-048, M-051).
- Test mode starts no timer. `POST /api/v1/_test/scheduler/tick { now }` runs one tick as of `now`.

### 2.8 Mailer (OD9, M-092, M-095, U43)

- nodemailer over Gmail SMTP (`SMTP_*`), sender `MAIL_FROM`. Templates live in `server/i18n/<lang>.json` (subject, text and HTML through one shared layout) and are rendered in the recipient's language. Links are built from `CLIENT_ORIGIN`.
- `sendEmail({ type, to, userId, language, params })` runs these checks in order:
  1. Reserved domains (`example.com/.org/.net`, `.test`, `.invalid`, `.localhost`): log only, status `suppressed_reserved`.
  2. Non-critical type and the user's email toggle is off: `skipped_toggle`.
  3. Non-critical and 400 non-critical sends already in the rolling 24 h: `skipped_cap` (OQ-6c).
  4. Otherwise send: `sent` or `failed`.
- **Classes** (full list in §3.17):
  - **Critical, always sent:** verify link, already registered, recruiter code, password reset, admin invite.
  - **Decision, always sent and never capped (M-095):** recruiter approved/rejected/suspended, verification approved/rejected, content restricted, certificate issued, renewal failed, plan ended.
  - **Non-critical (email toggle and cap):** alerts (instant, daily, weekly), application status, rejection, new message, new applications, CV request.
- `EmailLog { type, class, userId, to, language, status, error, createdAt }` stores no body. In test mode the transport is an in-memory capture readable through `/_test/mail`.

### 2.9 AI service

- `openai` SDK. Models come from the environment and follow U4:

| Model variable | Features |
|---|---|
| `OPENAI_FAST_MODEL` | job summaries, match explanations, insight narratives, translations, profile AI summary |
| `OPENAI_MODEL` | CV snapshot proposal, CV assisted draft, policy suggestion, report-brief summary |
| `OPENAI_EMBEDDING_MODEL` | embeddings |
| `OPENAI_TRANSCRIBE_MODEL` | voice-note transcription; falls back to `whisper-1` (OD7) |

- `generate({ kind, userId, language, cacheKey, model, input })`:
  1. Look up `AiCache` by (kind, key, language).
  2. On a miss, check the daily cap: 50 generations per user per UTC day, admins exempt (OD13). Cache hits, embeddings and admin "Regenerate" are not counted (U3).
  3. Call OpenAI, store the result, increment `AiUsage`.
  The prompt asks for the answer in the user's language (S, M-057, M-062, M-181).
- Errors become `AI_UNAVAILABLE`. Code-computed evidence still renders without the AI part.
- Embeddings (U6): input truncated to about 8,000 tokens (estimate 4 characters per token; no tokenizer package), full 3072 dims, stored as a Float32 `Buffer`, cosine computed in Node.
- In test mode `lib/ai.js` uses a deterministic stub, so API tests never call OpenAI. The browser e2e of Phase 9 and Phase 10 uses the real API.

### 2.10 Stripe service (U40, M-120 … M-128)

- `stripe` SDK with `STRIPE_SECRET_KEY`. Pin `apiVersion` to the SDK default at install time.
- `seed:catalog` (from Phase 5) creates idempotently: one Product "Plus"; 8 Prices with `lookup_key` `plus_monthly_<cur>` (OD1 amounts × 100); and the Customer Portal configuration (P6: cancel at period end, payment-method update, invoice history, plan switching off). Their ids are stored in `AppConfig('stripe')`.
- **Checkout sessions** always send `currency`, `payment_method_types: ['card','link']`, `locale` (en/es/fr), `adaptive_pricing: { enabled: false }`, `client_reference_id` (user id), `metadata { kind, itemId, userId }`, a `success_url` to the role's return route with `{CHECKOUT_SESSION_ID}`, and a `cancel_url` back to the starting page. The plan uses the Price for the currency; courses use inline `price_data`.
- **Customers:** one per user, on `User.stripeCustomerId`. If Stripe ever refuses a currency on an existing Customer, use one Customer per currency (U40).
- **Webhook** `POST /api/v1/stripe/webhook`: raw body, mounted before `express.json`, signature checked with `STRIPE_WEBHOOK_SECRET`. Insert `StripeEvent { eventId }` first; a duplicate key returns 200 and does nothing. Events handled: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created|updated|deleted`, `charge.refunded`. If a handler throws, delete the marker and return 500, so Stripe retries.
- **Entitlement from webhooks (U38, M-120).** No Dashboard setting is needed; any final retry action leads to a correct state.
  - `Subscription.status` mirrors Stripe from `customer.subscription.created|updated|deleted`.
  - `Subscription.retrying` is set from `invoice.payment_failed` (`next_payment_attempt` not null) and cleared by `invoice.paid`.
  - Paid = status `active` or `trialing`, or `past_due` while `retrying` is true ("keep access while Stripe retries", M-120).
  - Free = `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, or `past_due` with no further attempt.
  - So the final action may be "cancel", "mark unpaid" or "leave past due" (P7 is optional).
- **Webhook forwarding (P8).** `npm run stripe:listen` (development) and the e2e harness both spawn `stripe listen --api-key …` with the key from the environment. No CLI browser login is needed. If `npm run stripe:check-secret` prints `mismatch`, stop and ask the owner to update `STRIPE_WEBHOOK_SECRET` in `server/.env` (never paste the value into chat or logs).
- **Seed objects (OD8):** customers and subscriptions created by `seed:demo` carry `metadata.seed=true` and `metadata.db=<dbName>`. Re-seeding deletes only those for the same database.
- **Tests:** API tests sign payloads with `stripe.webhooks.generateTestHeaderString` (no network). Renewals and failures use Test Clocks and card `4000 0000 0000 0341`, advanced through the whole retry schedule. The e2e completes real hosted Checkouts.

### 2.11 Server i18n

`server/i18n/{en,es,fr}.json` hold email templates, certificate PDF text, CSV labels (OQ-6d) and language names for AI prompts. The recipient's `User.language` decides; the sign-up language decides for the sign-up emails. Everything else is a code that the client translates (M-143). A test asserts that es and fr have every en key.

### 2.12 Security

- `helmet`; `cors` with origin `CLIENT_ORIGIN`; `express.json` limit 1 MB; no stack traces in responses; logs never contain env values, tokens or codes.
- `app.set('trust proxy', 'loopback')`. The rate-limit key uses `CF-Connecting-IP` when the request arrives through a local cloudflared tunnel (C26).
- The `/_test` router is mounted only when `NODE_ENV=test`.

### 2.13 Testing architecture

**API tests** (`server/test`, `node:test` + `supertest`):
- They import `app.js` directly and use database `eujobs_test`.
- Each file resets the collections it uses. Mail is captured, OpenAI is stubbed, and Stripe webhooks use signed test payloads.
- Rate limits are tested with `X-Forwarded-For` (trust proxy loopback).

**e2e harness** (repo root `e2e/`, its own `package.json` with `puppeteer-core`):
- `node e2e/run.js <phase-N | sweep | scenario-name>` does the following:
  1. Seeds `eujobs_test` (`seed:catalog`, then `seed:demo`, with `NODE_ENV=test`).
  2. Starts the server with `NODE_ENV=test`, `PORT=5100`, `CLIENT_ORIGIN=http://localhost:5174`.
  3. Starts Vite on port 5174 with `VITE_API_PROXY=http://localhost:5100`.
  4. From Phase 5, starts `stripe listen --api-key <key from the environment> --forward-to http://localhost:5100/api/v1/stripe/webhook`. The key is never printed.
  5. Launches the local Chrome and runs the scenarios at 1440×900 and 375×812.
- Every page fails the scenario on: console errors, unexpected 4xx/5xx responses, i18n missing-key reports, and horizontal overflow at 375 px.
- Screenshots go to `e2e/artifacts/<run>/` (add it to `.gitignore`). The run prints a PASS/FAIL table and exits non-zero on any failure.
- Scenarios live in `e2e/scenarios/pNN-*.js`, each exporting `{ name, viewports, run(ctx) }`. `e2e/routes.js` lists every route per role (the 69 current routes plus each new screen as it is added); the `sweep` target visits all of them.

**`/_test` routes** (test mode only):

| Route | Purpose |
|---|---|
| `POST /_test/reset` | clear the rate-limit stores and the mail capture |
| `GET /_test/mail?to=&type=` | captured messages, including links and codes |
| `POST /_test/scheduler/tick { now }` | run one scheduler tick as of `now` |
| `POST /_test/db { collection, op, filter, update }` | shift dates, read counts, create test-only admins |
| `POST /_test/ai/fail-next` | make the next OpenAI call fail |

**Live checks** (cannot be automated): each new email type is sent once with `npm run mail:test` in development to a plus-alias of `SEED_ADMIN_EMAIL`. The owner confirms it arrived; if the session has a Gmail connector, it may confirm instead. Hosted Checkout and OpenAI are exercised for real by the e2e.

### 2.14 Packages (P16 resolved)

| Package | Where | Phase | Why |
|---|---|---|---|
| express (5), mongoose, zod, jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit, nodemailer, luxon | server | 1 | core, auth, mail, time zones (U12) |
| multer, file-type, sharp, pdfjs-dist, mammoth, pdfkit, libphonenumber-js, iso-639-1, archiver | server | 3 | uploads, CV text, seed CV PDFs, phone, languages, DOCX fixtures and (Phase 12) exports |
| dompurify, jsdom, marked | server | 4 (SVG), 8 (Markdown) | one sanitizer |
| stripe | server | 5 | payments |
| qrcode | server | 8 | certificate QR |
| openai | server | 9 | AI |
| supertest, oxlint | server (dev) | 1 | tests, lint |
| @reduxjs/toolkit, react-redux, i18next, react-i18next, @fontsource/inter, @fontsource/manrope | client | 2 | data layer, i18n, self-hosted fonts (M-192) |
| puppeteer-core | `e2e/` | 1 | browser verification with the local Chrome |

Resolved duplicates and dropped packages:
- **One HTML sanitizer: `dompurify` (with `jsdom` on the server).** It has a vetted SVG profile that M-150 needs and also sanitises the Markdown HTML of M-102. `sanitize-html` is not used.
- **One PDF text extractor: `pdfjs-dist`** (legacy build in Node). It is maintained, ESM, and used directly. `pdf-parse` (an old wrapper of the same engine) is not used.
- **No `dotenv`:** Node's `--env-file`.
- **No `node-cron`:** the 60-second scheduler plus `luxon`.
- **No TanStack Query** (S), **no `@stripe/stripe-js`** (hosted Checkout is a redirect), **no language-detector package** (`navigator.language`), **no `uuid`** (`crypto`).
- **No client Markdown library:** the course builder preview calls the server renderer.

Install each package in the phase that first needs it. Record exact versions in the lock files.

### 2.15 Client architecture

- **Store:** `client/src/app/store.js` (`configureStore` with the API reducer and a `session` slice). `main.jsx` wraps the app in `<Provider>` and initialises i18n.
- **API:** `client/src/app/api.js`:
  - `createApi` with `fetchBaseQuery({ baseUrl: (import.meta.env.VITE_API_URL ?? '') + '/api/v1', prepareHeaders })` adds the Bearer token.
  - `baseQueryWithReauth`: on `AUTH_REQUIRED` it clears the token, resets the API state and goes to the role's sign-in with `?next=<same-origin path>` (M-011).
  - `tagTypes` cover every entity.
  - Each feature group injects its endpoints in `features/<role>/<group>/api.js` (`api.injectEndpoints`). Every storage-hook call site listed in A: shared §11.2 (53 sites), A: recruiter §0.1, A: candidate §31a and A: admin §10.2 is replaced by these hooks.
- **Session:** the token is stored under `lwm-auth-token`. It must not start with `lwm.` while legacy key-wiping code exists (A: shared §4.6). `useMe()` reads `GET /me`. Anonymous language and country use `lwm-pref-language` and `lwm-pref-country` (M-135). A `storage` event signs other tabs out.
- **Router:** the workspace loader awaits `getMe` and applies the §3.1 state machine. The public routes come from `features/auth/routes.jsx` plus new `features/public/routes.jsx` (legal pages, certificate page). Workspace routes stay auto-collected (CONVENTIONS).
- **Browser storage allowed after migration:** the auth token; anonymous language and country; the candidate's dismissed overview insight; the recruiter's selected match job (M-041). Nothing else.
- **i18n:**
  - `i18next` + `react-i18next`; resources in `src/i18n/locales/{en,es,fr}/<namespace>.json`.
  - Namespaces: `common`, `shell`, `auth`, `errors` (one key per §2.3 code), `validation`, `enums` (one key per §4.1 key), and one per feature group.
  - en is bundled; es and fr are loaded on demand.
  - `<html lang>` and `document.title` (route `handle.titleKey`) follow the language.
  - Missing keys are reported as console errors in development and test, which the e2e treats as failures.
  - Plurals use i18next plural keys (A: shared §12.12); line breaks in headings use `<Trans>`.
- **Formatting** (`src/lib/format.js`, rules in §3.11):
  - `formatMoney(amountMinor, currency)` shows 0 decimals for whole amounts (U24).
  - Also: `formatSalary`, `formatDate`, `formatDateTime`, `formatMonth` (`YYYY-MM`), `formatRelative` (`Intl.RelativeTimeFormat`), `formatNumber`, weekday labels.
  - Country and language names come from `Intl.DisplayNames`; sorting uses `localeCompare` with the UI locale.
  - `StatCard` takes a number plus a formatter, which fixes the `useCountUp` decimal-comma bug (A: shared §3).
- **Plan gates:** `usePlan()` reads `me.plan` and `me.entitlements`. `RequirePlan` (route layout, generalised `PlusGate`) and `PlanGate` (inline) gate the UI. A global `PLAN_REQUIRED` handler opens the upgrade dialog (A: shared §8.3).
- **Mock removal:** each phase deletes the `data/` files, hooks and storage call sites it replaces. `useSharedLocalStorage.js` and `utils/downloadCsv.js` are deleted when their last caller goes (Phase 12 at the latest).

---

## 3. Product rules

The behaviour spec. Each rule cites its source. Where `DECISIONS.md` and this section differ, this section wins: it includes OD1–OD16, the C resolutions and the U defaults.

### 3.1 Accounts, sign-in and the state machine

One role per account: `candidate`, `recruiter` or `admin` (S). Candidates and recruiters sign up separately; the header workspace switch is removed (S). The first admin is seeded as Owner (S); further admins are invited (M-159).

**Candidate**

| State (`User.status`) | Entered by | Sign-in result | Lands on |
|---|---|---|---|
| `unverified` | `POST /auth/candidate/register` (no token, M-001) | 403 `EMAIL_UNVERIFIED`; the alert offers Resend | `/sign-up/check-email` right after sign-up |
| `active`, onboarding not done | opening the verification link | token | `/candidate/onboarding/story` until `onboardingCompletedAt` is set (M-001, M-014) |
| `active`, onboarding done | onboarding plan step completed | token | `?next` or `/candidate` |

**Recruiter**

| State | Entered by | Sign-in result | Lands on |
|---|---|---|---|
| `unverified` | `POST /auth/recruiter/register` returns a token and emails a code (U37) | token | `/recruiter/onboarding/email-code` (M-002) |
| `onboarding` | correct email code | token | first incomplete step (M-151): company → KYC → verify (phone) |
| `pending_review` | submit after the phone code (M-003) | token | `/recruiter/onboarding/review`: under review |
| `rejected` | admin Reject with a reason (M-165) | token | review page with the reason and Resubmit; the recruiter edits data or documents, then resubmits (M-152) |
| `active` | admin Approve (M-165) | token | `?next` or `/recruiter` |
| `suspended` | admin Suspend with a reason; tokenVersion +1 | token | review page with the blocked message (M-151). Lifted by an admin Approve in Account review, which sets the status to `active` and sends the approved email (OQ-2). |

Every recruiter workspace endpoint returns `RECRUITER_NOT_APPROVED` unless the status is `active`. Onboarding endpoints are open from `onboarding` onward. Before the email code, everything except code verify, code resend and `/me` returns `EMAIL_UNVERIFIED` (U37).

**Admin**

| State | Entered by | Lands on |
|---|---|---|
| `invited` | invite email: 72 h, single use, role chosen at invite (U21) | `/admin/set-password?token=`, then `/admin/sign-in` |
| `active` | password set, or the seeded Owner | `?next` or `/admin` |

**Rules**

- **Login (M-005).** One role-agnostic login. A candidate on the recruiter page (or the reverse) is signed in and sent to their own workspace with a friendly notice. Only admins can use the admin page, and admins sign in only there. Anyone else gets `INVALID_CREDENTIALS`.
- **Duplicate candidate sign-up (M-001, U36).** Same check-email screen. The existing account gets a "You already have an account" email with sign-in and reset links, under the same 1-per-minute and 5-per-day limits. Duplicate recruiter sign-up returns 409 `EMAIL_TAKEN`; the form shows sign-in and reset links (OQ-6h). U37 issues a token at sign-up, so a neutral screen is not possible for recruiters.
- **Verification link (M-001).** 24 h, single use. Resend at most 1 per minute and 5 per day. The page shows "Email verified" and Sign in; there is no auto sign-in. No email change in v1, so the M-001/M-004 re-verification on email change is not built (M-010, C21).
- **Recruiter email code (M-002, M-004).** Entered right after sign-up; onboarding continues only after it. Step 4 handles only the phone.
- **Forgot/reset (M-009).** "Forgot password?" on all three sign-in pages and one `/forgot-password` route. The link lasts 1 h and is single use; the reply is neutral ("if an account exists"). A reset signs out all sessions, marks the email verified and links to that role's sign-in.
- **Change password (M-010).** Current + new, in candidate and recruiter Data & account and in admin Settings.
- **Sessions (M-007, M-011).** 7-day token in localStorage; logout is client-side. On 401 the token is cleared and the user signs in again with `?next=<same-origin path>`. Signed-in visitors on `/`, `/sign-in` or `/sign-up` go to their workspace.
- **Consent (M-191, U22).** The sign-up checkbox is required and stores the Terms and Privacy versions plus the acceptance date. A new version shows a blocking re-accept dialog at the next sign-in.
- **Time zone (U12).** The browser's IANA time zone is saved on the user at each sign-in.
- **Language and country (M-135).** Stored on the user (§3.11).

### 3.2 Candidate profile and completeness

| Field | Rule | Source |
|---|---|---|
| Full name | on `User.fullName`, from sign-up, editable in Edit profile, ≤ 100 | M-012, A: recruiter Part C |
| Headline | required, ≤ 60 | A: candidate §26 |
| Location | country (EU 27 + UK) + free-text city ≤ 60 | M-032, M-031 |
| About | 20–600 | A: candidate §26 |
| Years of experience | integer 0–50, separate from work history | M-018 |
| Skills | 1–12, each ≤ 30, unique case-insensitive | M-064, A: candidate §26 |
| Work preference | `remote`, `hybrid` or `on_site` | A: candidate §26 |
| Availability | `available_now`, `within_2_weeks`, `within_1_month`, `open_to_opportunities`, `not_looking` | M-024 |
| Minimum salary | optional; when set it must be a valid amount in the profile country's currency with a period; not counted in completeness | M-017, M-131 |
| Work history | ≤ 20 entries: title and employer ≤ 100, start `YYYY-MM`, end or "I currently work here", description ≤ 1,000 (translatable on demand); or "No work experience yet" | M-018, M-031 |
| Education | ≤ 20 entries: institution and degree ≤ 100, start, end or "Still studying"; or "No formal qualification" | M-019, M-031 |
| Languages | ISO 639-1 code + one level (A1–C2, Native); at least 1; names translated into the UI language | M-020 |
| Right to work | entries for EU and/or UK: citizen/settled, visa/permit (with expiry date) or needs sponsorship; at least 1; optional evidence goes to the verification queue; nationality never used | M-021 |
| Links | at least one of LinkedIn (must match `linkedin.com/in/…`) or portfolio (any https URL) | M-022 |
| Photo | required; JPG/PNG/WebP ≤ 5 MB; square; stored 400×400 + 96×96; shown in the shell and to recruiters; no pre-moderation; admins can remove it through moderation; never a matching input | M-013 |
| External certificates | optional file or URL; with a file the candidate can request verification; recruiters see "Verified" only for reviewed ones | M-025 |
| Privacy | `discoverable` (default on), `resumeVisible` (default off), `matchingConsent` (default on) | M-187, A: candidate S54 |
| Email notifications | one toggle, default on; there is no in-app toggle | M-095, OD6 |

**Completeness checklist.** One server function returns `{ complete, done, total, percent, items: [{ key, done, route }] }`. It is embedded in `/me` and used by the apply gate, discovery (M-054), the promo card (M-196), the admin columns (M-161) and every checklist UI (M-015; ordering item 12).

| # | Item key | Done when | Source |
|---|---|---|---|
| 1 | `basics` | full name, headline, location (country + city), about, years, at least 1 skill and work preference all set | M-015, M-017 (salary excluded) |
| 2 | `work_history` | at least 1 entry, or "No work experience yet" | M-018 |
| 3 | `education` | at least 1 entry, or "No formal qualification" | M-019 |
| 4 | `languages` | at least 1 language with a level | M-020 |
| 5 | `right_to_work` | at least 1 EU or UK entry | M-021 |
| 6 | `photo` | photo uploaded | M-013 |
| 7 | `links` | at least 1 valid link | M-022 |
| 8 | `live_cv` | a live CV version exists | S |
| 9 | `phone` | phone verified with the on-screen code | M-003, M-004 |
| 10 | `check_identity` | identity check approved | M-023 |
| 11 | `check_academic` | counted only when an education entry exists; academic check approved | M-023 |
| 12 | `check_employment` | counted only when a work-history entry exists; employment check approved | M-023 |

- N is 10 to 12 and percent = done / N, with every item weighted equally (M-015). Admins approve only the evidence; completeness itself is automatic (M-016).
- Checks are per category, and one approved item per category is enough. Editing or deleting the entry linked to an approved item resets that category. An expired permit shows "Permit expired" and counts as no right to work in filters; completeness is unaffected (U27).

**Onboarding (M-014).** Three steps: story (CV upload), preferences (work preference, location, optional salary), plan (M-129). A partial draft profile is allowed, and `onboardingCompletedAt` is stored at the end. After that the candidate is sent to the checklist. The header country defaults to the profile country at onboarding (M-136).

**CV (M-027 … M-031, U18).**
- PDF or DOCX ≤ 10 MB, at most 20 versions. Text is extracted on upload. A PDF without a text layer is stored and flagged "No readable text", and matching then uses profile text.
- The AI snapshot proposal is paid; the profile changes only on explicit confirmation. Free gets extraction only.
- The assisted draft is paid: suggestions plus a revised snapshot, no new file; pending drafts can be deleted (M-061).
- Any own version can be downloaded, and any version except the live one can be deleted (M-028).
- Deleting a CV used in applications deletes the file everywhere; recruiters see "CV removed by the candidate" (M-030).

**Earlier-version requests (M-029, U19).**
- A recruiter requests with a reason (`verify_employment`, `earlier_role_cv`, `compliance`, `other`) and details ≤ 1,000.
- The candidate gets an email (under the email toggle) and sees a pending list on the CV page.
- Approving means choosing which version to share (A: recruiter RQ-44); the recruiter can then open it, and the download is logged. Declining shares nothing.

**Verification (M-016, M-023, M-166, M-168).**
- **Categories:** identity, academic, employment, right to work, external certificate.
- **Evidence types:**
  - identity: `passport`, `driving_licence`, `national_id`;
  - academic: `degree_certificate`, `diploma`, `transcript`;
  - employment: `employment_letter`, `contract_page`, `verified_reference` (A: candidate S34).
  Right-to-work and certificate submissions have no type select; the file is linked to the entry.
- **Linking:** each submission is linked to a profile entry (identity → the account name; academic → an education entry; employment → a work entry; right to work → its entry; certificate → its entry).
- **Statuses:** `in_review` → `approved` or `rejected` (reason ≤ 300). Resubmission is allowed. Self-approval is removed.
- **What recruiters see:** a tick per approved identity, academic and employment check (M-168).

**Phone (M-003, M-004, OD3).** E.164 with a country-code input. The code is shown on screen. One phone may be used by several accounts.

### 3.3 Plan, entitlements and lapse

- **Plans.** Free, and **Plus** (M-115) at £9 a month with the OD1 prices per currency (§3.10). The plan record lives in the database and is edited through the seed, with name and features per language, prices, interval, Stripe price ids and entitlements (M-116). Only candidates have a plan; recruiter AI is free for approved recruiters (M-117).
- **Entitlement keys:** `apply`, `message_send` (start and reply), `job_alerts`, `ai` (score and explanations, AI summaries, insights pages, CV snapshot, assisted draft, profile summary, translation) (S, M-118).
- **Paid** when the Stripe status is `active` or `trialing`, or `past_due` while Stripe still retries (the last failed invoice has a next payment attempt). **Free** for `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, or `past_due` with no further attempt (U38, refined by M-120 "keep access while Stripe retries"). This works whatever final retry action the Dashboard uses, so no Dashboard setting is a prerequisite (§2.10).
- **Cancel and failure (M-120, M-121).** Cancellation takes effect at period end through the Stripe Customer Portal. During a failed renewal, access stays while Stripe retries (`past_due`) and locks when Stripe marks the subscription unpaid or canceled.
- **Not gated:** browsing, searching and saving jobs; profile, CV and verification; course purchases; reading messages (S).
- **Lapse (M-119).** Applications stay active and withdrawable. Alerts are kept but paused, and resume on re-subscribing. Messages stay readable. AI pages lock. Only new actions are blocked.
- **Locked UI (M-118).** AI pages and Job alerts show a plan chip that opens the upgrade gate. Messages are read-only with an upgrade prompt in place of the composer. Apply opens the gate with the missing items and the upgrade.
- **Free match display (M-050).** A non-AI overlap label (M-052). Plus adds the score and explanations.
- **Onboarding plan step (M-129).** A subscriber sees "You're on Plus" and continues; the plan changes only through Billing.
- **Promo card (M-196).** Free: plan upsell with the price. Plus but incomplete: "Complete your profile" to the checklist. Otherwise hidden. A subscriber's price is shown in the subscription's own currency (C14).
- **Recruiters** never see a candidate's plan (M-087).

### 3.4 Applications and pipeline

- **Apply gate.** The server checks the `apply` entitlement (`PLAN_REQUIRED`), completeness (`PROFILE_INCOMPLETE` with `missing`) and that the job accepts applications (`JOB_NOT_ACCEPTING`), in one request (S).
- **Apply dialog (M-073).** CV version (default: live), optional cover note ≤ 2,000, required consent checkbox (stored with a timestamp).
- **Records.** One active application per candidate and job. Re-applying after a withdrawal creates a new record, and the old one stays withdrawn (M-074). Status history keeps dated steps `{ status, at, actor }`, plus a "Next step" text per status; there is no interview scheduling (M-075).
- **Candidate statuses:** `applied`, `under_review`, `interview`, `offer`, `hired`, `not_selected`, `withdrawn` (M-070, U33).
- **Pipeline (M-069, M-072, OD5).**
  - One card per application, showing the job. Stages belong to the company, and stage history is stored.
  - Each stage has one of 6 fixed categories: `applied`, `screening`, `shortlisted`, `interview`, `offer`, `hired`.
  - The first stage, "Applied" (category `applied`), is never removed or moved.
  - 2 to 12 stages; names 1–24 characters, unique case-insensitive.
  - A stage cannot be removed while it holds active applications. History keeps old names.
  - A new custom stage defaults to `screening` (M-070: custom → Under review).
- **Default stages,** created when the company is approved: Applied, Screening, Shortlisted, Interview, Offer, Hired, with the matching categories. Names are created in the company's language and then treated as user content (M-142; A: recruiter Part C).
- **Status from category (OD5):** `applied` → Applied; `screening` and `shortlisted` → Under review; `interview` → Interview; `offer` → Offer; `hired` → Hired.
- **Reject (M-090, U33).** The status becomes `not_selected` and the card leaves the board; a "Not selected" filter shows it. The confirm dialog has "Email the candidate", checked by default. The email waits the M-091 10 minutes, which is also the undo window. Undo = choose a stage again in the application's stage select; if the mapped status then equals the last emailed status, nothing is sent (OQ-6e).
- **Withdrawn (M-076).** Kept with a filter and badge in Applications, removed from the board.
- **Stage select (M-071).** One per application, hidden for non-applicants. Sourced candidates are not added in v1.
- **Applications table (M-077, M-078).** Job and Applied columns plus a job filter. "All open roles" on the board becomes a job filter (M-069). The "Candidate portal activity" section is removed.
- **Emails.**
  - Status change (M-091, U13): scheduled 10 min after the last move and sent only if the mapped status differs from the last emailed status.
  - New applications to the recruiter (OD14): at most one email per job per hour ("{n} new applications for {job}"), under the email toggle.
- **Activity timeline (M-081).** Company-wide; stored as type + params and rendered through translations. Events: applied, withdrew, replied, CV request decided, CV updated, plus colleagues' actions.
- **Recruiter Overview.**
  - Applications = active applications to the company's jobs, excluding not selected and withdrawn (M-082).
  - The "Shortlisted" series = shortlist additions per day; periods This week and Last week (M-083). Weeks start Monday in the browser time zone (M-170).

### 3.5 Messaging, counters and the bell

- **Threads (M-086).** One per company + candidate, optionally tagged with a job; text only, ≤ 2,000, no attachments. Polling about every 15 s with an unread badge (S).
- **Candidates (M-084).** A paid candidate can start a conversation only with recruiters of jobs they applied to, and reply in any thread. Free candidates read only.
- **Recruiters (M-085, U28).** Approved recruiters can message applicants and discoverable candidates only. After a candidate hides, existing threads stay open for both sides, but no new thread can start.
- **Plan (M-087).** Never shown to recruiters.
- **Default outreach text (M-088).** A translatable template in the recruiter's UI language; the candidate can translate it on demand.
- **New-message email (M-089, U13).** Sent when a message is unread for 15 min and no email went out for that conversation in the last 60 min. In the recipient's language; under the toggle and the cap.
- **Counters (M-094).** One `GET /me/counters` every 15 s, paused in hidden tabs. Candidates: unread messages and active applications (not withdrawn, not `not_selected`, as in M-082). Recruiters: unread messages. Badges are hidden at 0.
- **Bell (M-093, OD6).** No dot and no feed; the bell links to notification settings.
- **Translate** per message (M-144; paid for candidates, free for recruiters). **Report** a message (M-164).
- **Outreach (M-180).** Each recruiter-started conversation counts as "reviewed outreach".

### 3.6 Job alerts

- Plan-gated (S). At most 10 alerts; name ≤ 80, keywords ≤ 120, location ≤ 60 (M-031).
- **Frequencies (M-096, U12).** Instant, daily at 08:00, weekly on Monday at 08:00, in `User.timezone`. A digest lists jobs first published since the last digest. Empty digests are not sent; missed slots go out at the next tick.
- **Trigger (M-097).** First publish only (`firstPublishedAt`). Resume, reopen and edit do not trigger (M-037).
- **Matching (M-098, U35).**
  - Every keyword must appear in the job's title, company, skills, location, work mode, level or industry. Labels are also matched in the alert's language.
  - The location matches as a substring.
  - The alert stores the picker country when it is created (Remote allowed) and matches only that country.
- **Lapse (M-119).** Paused while Free; resumes on re-subscribing.

### 3.7 Jobs

- **Fields and limits (M-033, M-035, U26).**
  - Title 3–120; brief 40–5,000; up to 20 responsibilities of ≤ 300.
  - Required skills 1–20, preferred skills up to 20, each 1–50; a skill cannot be both required and preferred.
  - Experience 0–50 years. Required languages with a minimum level. Visa sponsorship yes/no.
  - Salary min and max are integers 0–100,000,000, with max ≥ min.
- **Enums (M-142).**
  - Employment type: `full_time`, `part_time`, `contract`, `internship`.
  - Level: `junior`, `mid`, `senior`, `lead`.
  - Work preference: `remote`, `hybrid`, `on_site`.
- **Location (M-032, OD2, OQ-6i).** On-site and hybrid jobs have a country (EU 27 + UK) and a city. Remote jobs have country `REMOTE` and an optional list of eligible countries; empty means all EU 27 + UK. The list shows as a badge on cards and details, and as an "Eligible in" filter inside the Remote view.
- **Salary currency (M-131).** Locked to the job country's currency; remote jobs use EUR. Stored as integer + currency + period (`year` or `month`).
- **Skills (M-034).** Free text, normalised case-insensitively. Suggestions are the most-used skills per market and language.
- **Wizard (M-041, M-060, M-039).**
  - The draft becomes a server job with status `draft` once step 1 is valid; Cancel keeps it.
  - Step 7 is renamed "Quality checks" and runs the same rules on the server.
  - Every transition to published is validated on the server; a 422 opens the wizard at the first invalid step.
- **Statuses (M-040, M-038, M-037).**
  - Tab order: published, paused, draft, closed (a Closed tab is added).
  - Only drafts can be deleted.
  - Edits are live: the AI summary and embedding regenerate, no repeat alert emails go out, and applicants are not notified.
- **Company name (M-042).** Always the company's display name; not editable per job.
- **Visibility (M-044).** Candidates see only published jobs of approved recruiters that moderation has not restricted.
- **Paused, closed or removed jobs (M-043).** Applicants and savers see "No longer accepting applications"; everyone else sees "no longer available".
- **Restricted (M-167).** Paused and locked; the reason is shown; no republish until cleared.
- **Dropped.** No perks or tagline fields; empty sections are hidden (M-036). The premium concept and its copy are removed (M-045).
- **Admin Jobs (M-046).** Lists all statuses with a status filter.

### 3.8 Discovery and matching

- **Find jobs (M-137, OD2, U25).**
  - Uses the header country. The Remote view lists remote-flagged jobs only; a country view lists on-site and hybrid jobs located there.
  - The salary filter is in the view's currency, with monthly salary × 12. Candidate minimum salary is compared only within the same currency.
  - Keyword rules are those of §3.6.
- **Find candidates (M-054, M-055, OQ-6a).**
  - Lists email-verified, discoverable, matching-consenting, complete candidates in the selected country.
  - "In the country" means the residence country, or a right to work there (citizen/settled or a valid permit, for the EU or UK region). Remote means open-to-remote candidates (profile work preference `remote`) in any country (OQ-6a).
  - Applicants stay visible to that company through their application (M-054, M-187).
- **Discovery filters (M-056, OD4, OQ-6f).**
  - "Has right to work in {country}" (citizen/settled or a valid permit; legal review before go-live).
  - Language with a minimum level.
  - Verified: every check M-023 requires for that candidate is approved (OQ-6f).
  - Availability (M-024).
- **Shortlist (M-079).** One list per company with `addedBy` and `createdAt`; the candidate is not notified. Candidates who turned discovery off are hidden, with a "no longer available" count.
- **Notes (M-080).** One per company + candidate, ≤ 5,000, with `updatedBy` and `updatedAt`, visible to the company.
- **Profile views (M-184).** One view per approved recruiter per day. The candidate sees the last 30 days compared with the previous 30.
- **Skill overlap (M-052).** One server function (required + preferred skills) and the same label everywhere.
- **Score (M-047, U5).**
  - `sim = clamp((cos − 0.20) / (0.60 − 0.20), 0, 1)`; `skill = matched required / required`; `score = round(100 × (0.6·sim + 0.4·skill))`.
  - The "experience" signal controls `sim` and "skills" controls `skill`; the weights are renormalised when one is off.
  - "Location" on: a mismatch caps the score at 49 (OQ-6g). A mismatch is either of these:
    - the candidate's profile country is not the job's country (on-site or hybrid), or is not in a remote job's non-empty eligible list;
    - the candidate's work preference differs from the job's.
  - Labels: Strong ≥ 75, Good ≥ 50. Weights and thresholds are stored per policy version. OpenAI writes explanations only.
- **Embeddings (U6).**
  - Candidate text: headline + about + skills + work history + education + live-CV text.
  - Job text: title + brief + responsibilities + skills + level + languages.
  - Every candidate with matching consent is embedded, Free included; only the display is gated.
- **Who sees the score (C6, M-057, M-050, M-068).** Paid candidates see the score, label and explanations. Free candidates see the overlap label only. Recruiters see ranking and evidence, never a number or a percentage. Admins see %.
- **Relevant count (M-051, U7, C7).** Candidates in the M-054 + M-055 population with a score ≥ Good. It is cached, refreshed on job save and nightly at 03:00 server time, and caught up at startup if more than 24 h have passed. The fallback when no embedding exists: at least 1 required skill.
- **Recommended jobs (M-053, U8, C11).** For Plus: published jobs in the picker country with a score ≥ Good, ranked. "+N this week" = published in the last 7 days. For Free: jobs sharing at least 1 required skill, ranked by overlap, then recency.
- **Recruiter recommendations.** The "Recommended candidates" KPI = distinct candidates relevant to at least one published job (A: recruiter RQ-34). "Talent worth meeting" = the top 3 such candidates who are neither shortlisted nor applied (A: recruiter A9).
- **Policy (M-048, M-049).** One global active policy. Signals: skills, experience, location; at least one must be on. Name and description are editable, drafts can be archived, and a version history is referenced by match results. Saving or activating triggers a recompute.
- **Exclusions (M-187, M-013, M-021).** Candidates without matching consent are left out of AI matching in both directions. Photo and nationality are never inputs.

### 3.9 Learning

- **Courses (M-113).** One collection with audience `candidate` or `recruiter`, authored in one language. Video and PDF lessons are single-language with a language tag. Titles, summaries and text lessons are translatable on demand.
- **Builder (M-101, M-102, M-106, M-107, U16).**
  - Full-page editor with tabs Details, Lessons, Quiz, Preview.
  - Lesson types: video (MP4 H.264/AAC or WebM ≤ 500 MB), text (Markdown ≤ 50,000 characters, sanitised; textarea plus preview), document (PDF ≤ 50 MB), link (https only).
  - Duration is read in the browser at upload and stays editable. Any lesson can be flagged as a free preview.
  - The Details tab holds every learner-facing field: summary, about (candidate) or lead (recruiter), tagline, designed for, outcomes, cover ≤ 5 MB.
  - Courses carry skill tags (M-114). There is no global disk cap.
- **Prices (U24, M-130, M-100).** A course needs all 8 currency prices, or Free, to publish. Prices are integer minor units. Cards show "Free" or the price; tiers and the "Learning Plus" pill are removed. Courses are one-time purchases, not part of the plan (S).
- **Editing after enrollment (M-108).** Once anyone is enrolled, lessons and the quiz are locked; copy and prices stay editable.
- **Unpublishing (M-109).** The course is hidden, buyers keep access, and courses are never deleted.
- **Completion (M-099, M-103, U15).**
  - Text, PDF and link lessons complete on open.
  - Video: the client sends a heartbeat every 15 s. The server credits `min(Δwall, 15 s) × min(rate, 2)` only when the position advanced without a seek, and completes the lesson at credited ≥ 90% of the duration.
  - The course completes when the final quiz is passed. There is no manual "Mark complete". Recruiters use the same model.
- **Quiz (M-104).**
  - Single- and multiple-choice questions, 2–6 options; pass mark per course (default 70).
  - Unlocks after all lessons. The score is shown but not the correct answers. Options are shuffled. Attempts are unlimited and the best score is kept.
  - Validation limits: 1–50 questions, question text 5–500, option text 1–200 (A: admin §9.1).
- **Certificates (M-105, U17, C18).**
  - The PDF shows the holder's name at issue, the course, the date, the platform name, and the code with a QR code and link to `/certificates/:code`.
  - The PDF chrome is in the holder's language; the course title stays as authored. The PDF is stored as a snapshot.
  - The public page shows name, course, date and Valid / Revoked / No longer valid, and is rate-limited.
  - An admin revoke is audited. A name change re-issues the PDF with the same code.
- **Badge (C24, M-026).** Shown wherever the profile is visible to the viewer. Certificates do not verify skills.
- **Definitions (M-110).** Enrolled = added (free) or bought. Active learner = at least 1 lesson done and not completed. Completions = quiz passed = certificate issued.
- **Admin stats (M-111).** Row text "{enrolled} enrolled, {purchased} purchased, {completions} completed"; a Revenue column per currency (needs `finance.view`); page totals; a learners list per course.
- **Recruiter purchases (M-112).** Belong to the user.
- **Suggestions (M-114, OQ-3).** Rule-based, labelled "Suggested for you", shown to Free and Plus alike.
  - Candidates: gap skills = required skills missing from the profile across saved jobs, applied jobs and the first 10 For-you jobs. Published candidate courses not yet enrolled are ranked by how many gap skills their tags match; courses matching none are not shown.
  - Recruiters: each recruiter course carries one pipeline category (OD5), set in the builder. Up to 3 published recruiter courses not yet enrolled are ranked by the company's active applications in that category, with the reason "{n} active applications at {stage}"; a category with 0 active applications is not suggested.

### 3.10 Payments and currencies

- **Currencies (M-130, C14).**
  - EUR, GBP, PLN, SEK, DKK, CZK, HUF, RON. The header country sets the currency; Remote = EUR.
  - In test mode any country's currency may be used for a purchase.
  - Billing and the promo card show a subscriber's own subscription currency.
- **Reports (M-130, C15, U34).** Money is totalled per currency and never summed across currencies. Money cards show one line per currency, largest first, at most 3, then "+n more".
- **OD1 price table (verbatim):**
  - Plan: GBP 9 · EUR 10 · PLN 45 · SEK 119 · DKK 79 · CZK 259 · HUF 3,990 · RON 55
  - £19 course: EUR 22 · PLN 95 · SEK 249 · DKK 169 · CZK 549 · HUF 8,490 · RON 115
  - £29 course: EUR 34 · PLN 145 · SEK 369 · DKK 249 · CZK 829 · HUF 12,990 · RON 169
  - £39 course: EUR 45 · PLN 195 · SEK 499 · DKK 339 · CZK 1,099 · HUF 17,490 · RON 229
  - £49 course: EUR 57 · PLN 245 · SEK 629 · DKK 429 · CZK 1,399 · HUF 21,990 · RON 289
- **Flow.**
  - A confirm dialog shows the item, the server price, the currency and "Continue to secure payment" (M-124).
  - Then the Stripe hosted Checkout (S), with card and Link only; Apple/Google Pay appear inside the card option (M-126, C13). Locale en/es/fr; Adaptive Pricing off (U40).
  - A per-role return page polls the session, refreshes plan, enrolments and payments, then returns to the starting page (M-125).
- **Portal (M-121).** The Stripe Customer Portal handles cancellation at period end, card updates and invoices.
- **Payment rows (M-122, C12).**
  - One row per one-time payment and per paid invoice. Failed renewals are recorded as `failed`; Dashboard refunds become `refunded`.
  - Abandoned or declined Checkout attempts are not recorded.
  - The Stripe receipt or hosted-invoice link is stored.
- **Reference (M-128).** A server sequence `LWM-000001`, with the Stripe ids stored alongside.
- **Tax (M-127).** Prices are VAT-inclusive. No Stripe Tax and no VAT ids in test mode.
- **Admin (M-123).** View only: renewal rows, subscription status and period in the details, a Plan column and filter on Candidates, and Active subscribers and MRR cards.

### 3.11 Country, language and formats

- **Countries (M-139, D16).** A seeded collection of 29 rows (EU 27 + `GB` + `REMOTE`) with ISO code, currency, default language, `isRemote`, order and `enabled`. 21 countries use EUR, including BG since 2026. CZ, DK, HU, PL, RO and SE use their own currencies, GB uses GBP, and Remote uses EUR. Names come from `Intl.DisplayNames`. The picker sorts by translated name with Remote last.
- **Default language (M-134).** ES → es; FR, BE, LU → fr; every other country → en. It applies until the user picks a language (`languageExplicit`); changing the country never overrides an explicit choice.
- **Storage (M-135).**
  - The server is the source of truth; anonymous visitors use localStorage.
  - The default language comes from the browser (en/es/fr, else en).
  - Sign-up requires a country select, defaulting to the browser region if it is listed, else Remote.
- **Header country vs profile (M-136).** The header country is a browsing preference. It is separate from the profile location and defaults from the profile country at onboarding.
- **What the picker filters (M-137).** Discovery surfaces only: Find jobs, recommendations, alert matching, Find candidates, shortlist discovery. Never the user's own applications, jobs, pipeline, messages or payments.
- **Admins (M-138).** No picker. Admin lists, Overview and Analytics get an "All countries / {country}" filter.
- **Format locale (M-133, M-132).**
  - `<language>-<country>`, e.g. en-DE, fr-BE, es-ES.
  - Remote and admins: en-IE, es-ES, fr-FR by language (M-132, OQ-6b).
  - Dates use the browser time zone, and date-only values are stored without a time.
- **Text (M-141, M-142, M-143).** UI text lives in translation files; business data and staff content live in the database. Enums are stored as keys. The server sends codes, and localises only emails, AI output and PDFs. Server-built CSV files are of the same kind: headers and labels in the requester's language, with a UTF-8 BOM (OQ-6d).
- **Translate (M-144).** On-demand Translate exists for job brief and responsibilities, company About, candidate about, work-history descriptions and messages (not skills or names). It is cached per entity + field + language + hash. Paid for candidates, free for recruiters.
- **Public pages (M-140).** A small language picker in the auth layout, on every public page.

### 3.12 Recruiter onboarding and company

- **Company (M-145).** One recruiter per company. Company is a separate record, and every recruiter-owned record carries `companyId`.
- **Names (M-146, M-147).** The legal name is verified in KYC; the display name is public and defaults to the legal name. After approval only these fields are editable: display name, industry, size, city, website, description.
- **Size (M-148).** Keys `1_10`, `11_50`, `51_200`, `201_500`, `501_1000`, `1000_plus`, with translated labels.
- **Country (M-149).** EU 27 + UK picker, no Remote. At step 2 it sets the recruiter's header country (and so the currency) and the default language, unless the language was chosen explicitly.
- **Logo (M-150).** PNG/JPG/SVG ≤ 2 MB, SVG sanitised. Without a logo, a letter tile whose colour is derived from the company id.
- **Steps.**
  1. Sign-up, then the email code.
  2. Step 1: account details, edit only, no password fields (M-153).
  3. Step 2: company.
  4. Step 3: KYC. Identity and registration documents are required, authorization is optional; PDF/JPEG/PNG ≤ 10 MB; replaceable only while in progress or rejected (M-185).
  5. Step 4: phone, with the on-screen code (M-003). Then submit.
  6. Step 5: review status page.
- **Before approval (M-151).** Recruiters see only onboarding or status pages.
- **Admin review (M-165, M-003).**
  - Approve / Reject / Suspend; a reason is required for reject and suspend.
  - The dialog shows the applicant, the company record, email verified, "Phone confirmed on screen (no SMS)", the KYC files (`documents.view`), the submitted date and earlier decisions.
  - Approve sets the status to `active`, creates the default stages and sends the "approved" email.
  - Reject sends the reason by email, and resubmission is allowed (M-152).
  - Suspend increases tokenVersion and sends an email. The jobs disappear from candidates through the M-044 visibility rule.

### 3.13 Admin access and permissions

- **Who is listed (M-154).** Access management lists admin staff only; roles gate admin pages.
- **Enforcement (M-155).** Every admin API route checks its permission. The sidebar, global search and page actions hide what the admin may not use. A 403 page shows on direct URLs.
- **Owner (M-160, U21).** The `isOwner` flag is set only by the seed. Owners bypass permissions and cannot be revoked; at least one Owner always exists. Nobody can remove their own `roles.assign`. Invited admins are never Owner.
- **Invites (M-159, U21).** An admin with `users.add` invites by email. The link lasts 72 h and is single use; the role is chosen at invite.
- **Roles (M-157, M-158).** Name 2–40, unique case-insensitive; description ≤ 240; at least 1 permission (A: admin §2.2). "Access scope" and user "department" are descriptive labels only. Edit uses the prefilled create dialog; archiving is blocked while users are assigned.
- **Effective permissions** = role permissions ∪ granted − removed (A: admin §2.2).

**Permission catalogue** (adopted, OQ-6j; derived from M-156 "Figma list + missing ids, drop ids with no feature" and A: admin §4.2, §4.4):

| Id | Guards |
|---|---|
| `dashboard.view` (new) | Overview |
| `users.view` | Candidates and Recruiters lists, detail pages (M-161) |
| `users.add` | Invite an admin (M-159) |
| `users.deactivate` | Suspend decision (M-165) and Approve of a suspended recruiter (OQ-2) |
| `roles.view` | Roles and User access tabs |
| `roles.create` | Create and duplicate a role |
| `roles.edit` | Edit a role (M-158) |
| `roles.archive` | Archive a role (M-158) |
| `roles.assign` | Save or revoke a user's access |
| `candidates.view` | Applications page, Recruitment page |
| `jobs.view` (new) | Jobs list, job AI summary and its Regenerate |
| `moderation.manage` | Moderation tabs (content, accounts, verification) and their decisions |
| `documents.view` (new) | Open KYC, evidence, right-to-work and certificate files, and voice notes |
| `learning.view` (new) | Courses list, stats, learners |
| `learning.manage` | Course builder, uploads, publish, certificate revoke |
| `finance.view` | Payments, subscription details and KPIs, Revenue column |
| `reports.view` | Analytics, report history |
| `reports.export` | Generate reports and every CSV export (with the page's view permission) |
| `audit.view` | Audit logs; Overview "Recent platform activity" |
| `ai.view` (new) | AI & matching page, oversight, feedback aggregates, AI status |
| `ai.manage` (new) | Create, edit, archive and activate policies; policy suggestion |

Dropped, because no feature uses them: `users.edit`, `jobs.manage`, `pipeline.manage`, `company.edit`, `finance.approve`. Admin Settings (own name, password, language) needs no permission. The seeded roles Manager, Accounts Head and Staff keep their Figma permission lists minus the dropped ids. The seed's "Sarah Miller → Manager" assignment is removed (M-154).

### 3.14 Moderation and verification

- **Reports (M-164, U20).**
  - A Report button on job details, candidate profiles, company sections and messages.
  - Reasons: `spam`, `scam_or_fraud`, `discriminatory`, `offensive`, `misleading`, `other`; details ≤ 500.
  - At most 10 reports per user per day, and one open case per reporter and target.
  - A message report stores an excerpt: the reported message plus up to 5 earlier messages of that thread (OQ-1). Admins never browse threads otherwise. Admins can also open cases from Jobs.
- **Content decisions (M-167).**
  - Dismiss or Restrict, with a reason. Restrict on a job pauses and locks it. Restrict on a profile hides it from discovery, and an admin can remove the photo (M-013).
  - Dismiss lifts the restriction. History is kept and the owner is emailed.
  - Company and message cases offer Dismiss only. To act, the admin suspends the recruiter through Account review (M-165) or restricts the candidate's profile (OQ-1).
- **Account review.** See §3.12.
- **Candidate verification (M-166).**
  - A third Moderation tab. Approve, or Reject with a required reason ≤ 300; resubmission allowed.
  - Covers identity, academic, employment, right-to-work evidence and external certificates. Each submission is linked to a profile entry. Decision emails follow M-092.
- **Admin table columns (M-169).**
  - Candidates' verification: Not started (no submission) / In review (submissions in review, none approved) / n of 3 verified (1–2 categories approved and not all required ones) / Verified (every M-023-required check approved) (OQ-6f).
  - Recruiters' status: Pending (unverified, onboarding, pending review) / Approved / Rejected / Suspended.
  - Learning, for both: "{n} enrolled, {m} certificates".

### 3.15 Metrics

All numbers are computed from the database (S, M-208). The date range applies to charts only; KPIs are all-time and say "All time" (M-177). Weeks start Monday in the browser time zone (M-170). The admin country filter applies (M-138).

| Screen · metric | Definition | Source |
|---|---|---|
| Admin Overview · Candidate registrations | count of candidate users | A: admin §1.1 |
| · Active users | candidates and recruiters with status `active`; links to `/admin/candidates?status=active` | M-173, U10 |
| · Published jobs | jobs with status published | A: admin §1.1 |
| · Applications | all applications except withdrawn | OQ-5 |
| · Verified candidate profiles | candidates in the "Verified" state | OQ-6f |
| · Course enrollments | enrollments (enrolled = added or bought) | M-110 |
| · Course badges earned | certificates issued and not revoked | M-110 |
| · Average role match | mean, over published jobs, of each job's top 5 scores; caption "Across {n} published roles" | M-172, U9 |
| · Platform activity | registrations and applications per day (week) or per week (month), real counts in bar and line views | M-170, M-171 |
| · Companies registered | companies created at onboarding step 2, any status | OQ-5 |
| · Course purchases | paid course payments | A: admin §1.1 |
| · Verification checks in review | candidate verification submissions in review (KYC counts under Pending user reviews) | OQ-5 |
| · Shortlist activity | shortlist entries | A: admin §1.1 |
| · Outreach drafts reviewed | recruiter-started conversations | M-180 |
| · Pending user reviews | recruiters with status `pending_review` | A: admin §1.1 |
| · Most demanded skills | top 6 normalised required skills of published jobs | A: admin §1.1 |
| · Recent platform activity | latest 5 audit events (admin, system and user) | M-174 |
| Analytics · Shortlist conversion | applications whose candidate is on that company's shortlist ÷ non-withdrawn applications, all-time | M-176, U11 |
| · Recruiter accounts | every recruiter user | OQ-5 |
| · Company registrations | companies created at onboarding step 2, any status | OQ-5 |
| · Reviewed outreach | as above | M-180 |
| · Matching quality card | explanatory translatable copy, not data | M-175 |
| Recruitment · stage counts | applications per category at their current stage | M-178, OD5 |
| · Funnel | applications that ever reached each category; withdrawn excluded; fixed Figma shapes with real numbers | M-178, M-179, OD5 |
| Recruiter Overview | open positions; Recommended (§3.8); Applications (M-082); Shortlisted (entries); funnel over the company's own stages, ever reached; momentum (M-083) | M-178, OD5 |
| Candidate Overview | Recommended jobs + "+N this week" (M-053); profile views over 30 days (M-184) | — |
| Payments | Active subscribers; MRR per currency (U34); failed payments = failed renewals | M-122, M-123 |
| AI & matching | explanation feedback aggregates (helpful / needs review) | M-067 |

### 3.16 Files, privacy, retention and GDPR

- **Uploads and access.** Upload safety (M-185, §2.6); signed URLs (U39); video uploads on localhost only (C26).
- **Privacy flags (M-187).**
  - Not discoverable: hidden from search and shortlists, but not from companies the candidate applied to.
  - CV hidden: the file is available only to companies the candidate applied to.
  - No matching consent: out of AI matching in both directions.
  - Every CV download is logged and visible to the candidate.
- **Retention (M-186, U32, C18).** Identity, KYC and evidence files are deleted 30 days after the decision; only the decision record is kept. A daily sweep runs at 03:00. Certificate files are exempt.
- **Candidate "Delete my data" (M-188 + OD15).** Confirm dialog with the current password (A: recruiter Part D #10). It deletes:
  - the account, profile, files, applications, alerts and AI caches;
  - enrolments, saved jobs, shortlist entries and recruiter notes about the candidate;
  - profile views, CV requests and download logs;
  - verification evidence and decisions.
  It also changes or keeps:
  - Messages are deleted for both sides; the company sees "Deleted user".
  - Audit and moderation entries are kept, with the actor or author shown as "Deleted user".
  - The Stripe subscription is cancelled immediately (no refund) and the Stripe Customer is deleted.
  - Payment records are kept with the payer name anonymised.
  - Certificates become a tombstone `{ code, status: no_longer_valid }`, and the public page says "No longer valid".
  - The user is signed out.
- **Recruiter deletion (M-189 + OD15, OQ-6k).** Jobs are closed. The company display name is kept for past applications and threads. Personal data and KYC files are deleted. The company's notes, shortlist and activity timeline are deleted (OQ-6k). Payments are kept, with the author anonymised.
- **Export (M-190, OD15).** A ZIP of JSON plus files.
  - Candidate: data, CV files, photo, certificates. Recruiter notes are excluded.
  - Recruiter: account, company, jobs, notes, messages, payments, plus a CSV summary.
- **Legal (M-191, OD12).** Legal texts are versioned per language in the database and served on public `/legal/:doc` pages (terms, privacy, imprint). They are seeded as clearly marked drafts, version `2026-11-draft`; the Imprint is a marked placeholder (S).
- **Fonts (M-192).** Self-hosted; the Google Fonts link is removed.

### 3.17 Emails

All emails are in the recipient's language (S). Classes are defined in §2.8.

| Type | To | Trigger | Class | Source |
|---|---|---|---|---|
| `verify_email` | candidate | sign-up, resend | critical | M-001 |
| `already_registered` | existing account | duplicate candidate sign-up | critical | U36 |
| `recruiter_email_code` | recruiter | sign-up, resend | critical | M-002, M-004 |
| `password_reset` | any role | forgot password | critical | M-009 |
| `admin_invite` | invitee | invite | critical | M-159, U21 |
| `recruiter_approved` / `_rejected` / `_suspended` | recruiter | account decision (rejected and suspended include the reason) | decision | M-092, M-165 |
| `verification_approved` / `_rejected` | candidate | evidence decision | decision | M-092, M-166 |
| `content_restricted` | job or profile owner | Restrict | decision | M-092, M-167 |
| `certificate_issued` | learner | quiz passed | decision | M-092, M-105 |
| `renewal_failed` | candidate | `invoice.payment_failed` on a renewal | decision | M-092, M-120 |
| `plan_ended` | candidate | subscription canceled or unpaid | decision | M-092, M-120 |
| `alert_instant` | candidate | first publish of a matching job | non-critical | M-096, M-097 |
| `alert_daily` / `alert_weekly` | candidate | 08:00 / Monday 08:00 in the user's time zone | non-critical | U12 |
| `application_status` | candidate | mapped status changed, 10 min after the last move | non-critical | M-091, U13 |
| `application_rejected` | candidate | reject with the box checked, after 10 min | non-critical | M-090, U33 |
| `new_message` | candidate or recruiter | unread for 15 min, at most once per conversation per 60 min | non-critical | M-089, U13 |
| `new_applications` | recruiter | at most one per job per hour | non-critical | OD14 |
| `cv_request` | candidate | earlier-version request | non-critical (OQ-6c) | U19 |

No other emails exist. Admins receive only invite and reset emails (OD6).

### 3.18 AI features and limits

| Feature | Who | Gate | Model | Cached per | Source |
|---|---|---|---|---|---|
| Match score + label | Plus candidates see it; admins see %; recruiters see ranking only | `ai` for display | embeddings | job + candidate + policy version | M-047 … M-053, U5–U7, C6 |
| Match explanation / insight narrative | Plus candidate; recruiter (narrative + evidence, no score) | `ai` / approved recruiter | FAST | candidate + job + language + profile hash | M-057 |
| Job AI summary (on each card and row; no page-level button) | Plus candidate, recruiter, admin (with Regenerate) | `ai` / approved / `jobs.view` | FAST | job version + language | M-058, M-059 |
| AI insights pages (overview, skill gap, improve profile, job match, why recommended) | Plus candidate | `ai` | FAST + code evidence | as above | M-057, M-063 … M-067 |
| CV snapshot proposal | Plus candidate | `ai` | MODEL | CV version | M-027, U18 |
| CV assisted draft | Plus candidate | `ai` | MODEL | stored as a pending draft | M-061 |
| Profile AI summary (recruiter-ready, copyable) | Plus candidate | `ai` | FAST | profile hash + live CV + language | M-062 |
| Translate | Plus candidate; recruiter | `ai` / approved | FAST | entity + field + language + hash | M-144, M-088, M-113 |
| Policy suggestion | admin | `ai.manage` | MODEL | not cached | M-048, U4 |
| Report brief: transcription + executive summary | admin | `reports.export` | TRANSCRIBE + MODEL | per report | M-181, OD7 |
| Embeddings | system | matching consent | EMBEDDING | source hash | U6 |

- **Code, not AI:** listed and missing skills, years, work mode, languages and right to work are computed in code, and invented gap texts are removed (M-057). Job "Quality checks" use server rules (M-060). Course suggestions use rules (M-114). The outreach text is a template (M-088).
- **Timing (M-058).** Generated on first open, cached per entity version and language, invalidated on change, with an admin Regenerate button.
- **Cap (OD13, U3).** 50 generations per user per UTC day, with a friendly message when reached. Not counted: cache hits, embeddings, admin Regenerate. Admins are exempt.
- **Role picker (M-063).** Top 10 + saved + applied jobs; defaults to the top-ranked job.
- **"I have this skill" (M-064).** Adds the skill to the profile, within the 12-skill and 30-character rules; refused at 12.
- **"Save this opportunity" (M-065).** Uses the normal saved-jobs list.
- **Skill demand (M-066).** The denominator is all visible published jobs in the candidate's picker country.
- **Feedback (M-067).** "Helpful / Needs review" is stored and aggregated for the admin.
- **Admin oversight (M-068).** A job picker defaulting to the newest published job; the top 4 candidates; evidence for the selected candidate.

### 3.19 Shell and UI rules

- **Brand (M-193, OD11).** "Local WorkMan" everywhere, with the "AI Job Portal" tagline kept in all languages. Logo: the existing "AI" mark cropped from `logo.png`, with "Local WorkMan" and "AI Job Portal" rendered as live text in Manrope.
- **Search (M-194).** "Search anything" jumps between pages only. Labels are translated and matched accent-insensitively. The shortcut label shows Ctrl K on non-Mac systems (A: shared §2).
- **Profile menu and sidebar identity (M-195).** The subtitle shows the candidate's plan, the recruiter's company or the admin's role (Owner for owners). Photo or initials, with the email under the name. "Profile" goes to My profile, Company or admin Settings.
- **Footer (M-197).** "© {current year} Local WorkMan" plus Terms, Privacy and Imprint links. The demo footer note goes away.
- **Sign-in pages (M-198).** Demo notes are removed. The admin page shows a restricted-access notice: authorised staff only, accounts created by an administrator.
- **Admin Settings (M-199, OD6).** Name, password change, language. No email preferences.
- **Help (M-200).** FAQs come from a database collection per audience, with per-language text seeded with rewritten answers. No admin editor.
- **Removals and small changes (M-201, M-202, M-203).** Remove the recruiter Overview "Compare" checkbox. The greeting uses local time of day and the first name, computed on the client. Remove the word "privacy" from the recruiter settings copy.
- **Bell (M-093, OD6).** No dot; it links to notification settings.
- **Demo leftovers (S).** The workspace switch is removed. "Reset demo" is removed and "Delete my data" becomes real.

### 3.20 Seed data

- **Two scripts (U41).**
  - `seed:catalog` is an idempotent upsert of: countries; plans with prices, plus (Phase 5) the Stripe Product, Prices and Portal configuration; permissions and the three Figma roles; FAQs; legal drafts; and (Phase 9) the default matching policy v1.
  - `seed:demo` wipes the demo data and recreates it, including the Stripe seed objects for the same database (OD8).
- **Content (M-208, M-210, M-207, M-209, U42).**
  - Today's client mock data becomes coherent server entities: computed numbers, not Figma numbers.
  - The people shown in recruitment and oversight become seeded candidates. The pending account becomes a recruiter applicant. James Chen exists twice: the candidate (`@example.com`) and the recruiter applicant demo account (OQ-4).
  - Locations move to London, Manchester, Dublin, Berlin, Munich, Paris, Lyon, Madrid, Barcelona, Amsterdam, Warsaw, Lisbon and Stockholm. Salaries are converted once at 1 USD = 0.75 GBP = 0.87 EUR = 3.75 PLN = 9.6 SEK, rounded to 1,000 (OQ-4).
  - Courses use the learner catalogue values, with 3 English Markdown lessons (300–600 words) and 5 single-choice questions each; prices follow OD1.
- **Accounts** (S, OD9; every password = `SEED_PASSWORD`):

| Account | Role and state | Email |
|---|---|---|
| Owner admin | admin, `isOwner` | `SEED_ADMIN_EMAIL` |
| Alex Morgan | candidate, Free, profile as in today's mock (so incomplete), owns one course | plus-alias `<local>+alex@<domain>` |
| Emma Wilson | candidate, Plus: a real Stripe test subscription (`pm_card_visa`, OD8) | `+emma` |
| Sarah Miller | recruiter at Acme Studio, approved | `+sarah` |
| James Chen | recruiter applicant with company + KYC files, `pending_review` (OQ-4) | `+james` |
| Every other seeded person | as in the mock data, made coherent | `@example.com`: never mailed, only logged (OD9) |

  The aliases are derived from `SEED_ADMIN_EMAIL` when the seed runs; no address is hard-coded. These four accounts are the "demo marketplace accounts" of today's admin data (A: admin §1.3, `users.js`).
- **Payments (OD8, M-122).** Today's paid mock payments become rows with `source: seed` and no receipt link. The mock's declined Checkout attempts are dropped, because M-122 does not record declines.
- **Coherence.** Seeded applicants passed the apply gate: each has a complete profile with approved checks. Applicants other than Emma have one historical Plus payment (`source: seed`, no receipt link, dated before their first application) and no active subscription, which is the M-119 lapsed state (OQ-4). Seeded enrollments match their seed payments. Seeded jobs belong to approved companies, one recruiter per company (M-145).

---

## 4. Data model

MongoDB database `eujobs` (`eujobs_test` for tests). Every collection has `createdAt` and `updatedAt`. Enums are stored as keys (M-142). The references below are ObjectIds.

### 4.1 Key catalogue (`config/enums.js`, served by `GET /meta/config`)

This catalogue must exist before any schema (ordering item 2). The client has one `enums` i18n key per value.

| Enum | Keys | Source |
|---|---|---|
| role | `candidate`, `recruiter`, `admin` | S |
| userStatus | `unverified`, `onboarding`, `pending_review`, `active`, `rejected`, `suspended`, `invited` | §3.1 |
| language | `en`, `es`, `fr` | S |
| workPreference | `remote`, `hybrid`, `on_site` | M-142 |
| employmentType | `full_time`, `part_time`, `contract`, `internship` | M-142 |
| jobLevel | `junior`, `mid`, `senior`, `lead` | M-142 |
| jobStatus | `draft`, `published`, `paused`, `closed` | M-040 |
| salaryPeriod | `year`, `month` | M-131 |
| companySize | `1_10`, `11_50`, `51_200`, `201_500`, `501_1000`, `1000_plus` | M-148 |
| availability | `available_now`, `within_2_weeks`, `within_1_month`, `open_to_opportunities`, `not_looking` | M-024 |
| languageLevel | `a1`, `a2`, `b1`, `b2`, `c1`, `c2`, `native` | M-020 |
| rtwRegion · rtwStatus | `eu`, `uk` · `citizen_settled`, `visa_permit`, `needs_sponsorship` | M-021 |
| verificationCategory | `identity`, `academic`, `employment`, `right_to_work`, `certificate` | M-166 |
| evidenceType | `passport`, `driving_licence`, `national_id`, `degree_certificate`, `diploma`, `transcript`, `employment_letter`, `contract_page`, `verified_reference` | A: candidate S34 |
| verificationStatus | `in_review`, `approved`, `rejected` | M-166 |
| kycDocType | `identity`, `registration`, `authorization` | §3.12 |
| applicationStatus | `applied`, `under_review`, `interview`, `offer`, `hired`, `not_selected`, `withdrawn` | M-070, U33 |
| stageCategory | `applied`, `screening`, `shortlisted`, `interview`, `offer`, `hired` | OD5 |
| stageTone | `neutral`, `primary`, `success` | A: recruiter Part C |
| alertFrequency | `instant`, `daily`, `weekly` | M-096 |
| cvRequestReason · cvRequestStatus | `verify_employment`, `earlier_role_cv`, `compliance`, `other` · `pending`, `approved`, `declined` | M-029 |
| activityType | `applied`, `withdrawn`, `stage_changed`, `rejected`, `shortlisted`, `unshortlisted`, `note_updated`, `outreach`, `message_reply`, `cv_request`, `cv_request_decided`, `cv_updated`, `cv_download` | M-081 |
| planKey · entitlement | `free`, `plus` · `apply`, `message_send`, `job_alerts`, `ai` | M-115, §3.3 |
| paymentKind · paymentStatus · paymentSource | `course`, `subscription` · `paid`, `failed`, `refunded` · `stripe`, `seed` | M-122, OD8 |
| courseAudience · courseLevel · courseStatus | `candidate`, `recruiter` · `foundation`, `intermediate`, `advanced` · `draft`, `published`, `unpublished` | M-109 |
| lessonType · questionType | `video`, `text`, `document`, `link` · `single`, `multiple` | M-102, M-104 |
| certificateStatus | `valid`, `revoked`, `no_longer_valid` | M-105, C18 |
| reportTargetType · reportReason · caseStatus | `job`, `candidate_profile`, `company`, `message` · `spam`, `scam_or_fraud`, `discriminatory`, `offensive`, `misleading`, `other` · `open`, `dismissed`, `restricted` | M-164, U20 |
| accountDecision | `approved`, `rejected`, `suspended` | M-165 |
| auditCategory · actorType | `workspace`, `policy`, `moderation`, `reports`, `access`, `learning`, `payments`, `jobs` · `admin`, `user`, `system` | M-162, M-163 |
| roleScope · roleStatus | `organization`, `department`, `finance_department`, `team` · `active`, `archived` | M-157, M-158 |
| policySignal · policyStatus | `skills`, `experience`, `location` · `draft`, `active`, `archived` | M-049 |
| matchLabel | `strong`, `good` (none below Good) | M-047 |
| aiKind | `job_summary`, `match_explanation`, `insights`, `translation`, `profile_summary`, `cv_snapshot`, `cv_draft`, `policy_suggestion`, `report_summary` | §3.18 |
| emailType · emailClass · emailStatus | the 22 types of §3.17 · `critical`, `decision`, `non_critical` · `sent`, `failed`, `suppressed_reserved`, `skipped_toggle`, `skipped_cap` | §2.8 |
| filePurpose | `photo`, `cv`, `evidence`, `kyc`, `certificate_file`, `company_logo`, `course_cover`, `lesson_video`, `lesson_document`, `report_voice`, `certificate_pdf`, `report_csv`, `export_zip` | M-185 |
| reportType · reportPeriod | `marketplace_summary`, `skills_demand`, `platform_activity` · `this_week`, `last_week`, `last_month` | M-183 |
| legalDoc · faqAudience | `terms`, `privacy`, `imprint` · `candidate`, `recruiter`, `admin` | M-191, M-200 |
| taskType | `email.message`, `email.stage`, `email.new-applications`, `alerts.instant`, `matching.recompute` | §2.7 |

### 4.2 Collections

**Accounts and platform**

| Collection | Key fields | Indexes | Drives |
|---|---|---|---|
| `users` | `role`, `email` (trimmed, lowercased), `passwordHash`, `fullName`, `status`, `isOwner`, `emailVerifiedAt`, `phone { e164, verifiedAt }`, `language`, `languageExplicit`, `pickerCountry`, `timezone`, `tokenVersion`, `legal { termsVersion, privacyVersion, acceptedAt }`, `notifyEmail` (default true), `privacy { discoverable, resumeVisible, matchingConsent }` (candidates), `onboardingCompletedAt` (candidates), `companyId` (recruiters), `adminAccess { roleId, department, granted[], removed[] }` (admins), `stripeCustomerId`, `lastLoginAt` | unique `email`; `{ role, status }` | M-001 … M-014, M-095, M-133 … M-136, M-145, M-154 … M-160, M-187, U12, U21, U37, OD3 (phone not unique), OD6 |
| `emailtokens` | `userId`, `purpose` (`verify_email`, `reset_password`, `admin_invite`), `tokenHash`, `expiresAt`, `usedAt` | unique `tokenHash`; TTL on `expiresAt` + 7 days | M-001, M-009, U21 |
| `verificationcodes` | `userId`, `channel` (`email`, `phone`), `target`, `codeHash`, `expiresAt`, `attempts`, `sentAt`, `consumedAt` | TTL; `{ userId, channel }` | M-002 … M-004 |
| `countries` | `code` (ISO2 or `REMOTE`), `currency`, `defaultLanguage`, `isRemote`, `order`, `enabled` | unique `code` | M-139, M-130, M-134 |
| `plans` | `key`, `name { en, es, fr }`, `features { en, es, fr }[]`, `interval: month`, `prices [{ currency, amountMinor, stripePriceId }]`, `entitlements[]` | unique `key` | M-115, M-116, OD1 |
| `appconfigs` | `key` (`stripe`), `value { productId, portalConfigurationId }` | unique `key` | U40, P6 |
| `permissions` | `id`, `group`, `order` (labels are i18n keys) | unique `id` | M-156 |
| `adminroles` | `name`, `nameLower`, `description`, `scope`, `permissions[]`, `status`, `system`, `createdBy` | unique `nameLower` | M-157, M-158 |
| `legaldocuments` | `doc`, `version`, `language`, `title`, `bodyMarkdown`, `bodyHtml`, `isDraft`, `publishedAt` | unique `{ doc, version, language }` | M-191, OD12 |
| `faqs` | `audiences[]`, `order`, `question { en, es, fr }`, `answer { en, es, fr }` | `{ audiences, order }` | M-200 |
| `files` | `ownerId`, `purpose`, `path`, `originalName`, `mime`, `size`, `sha256`, `deleteAfter` | `{ ownerId, purpose }`, `deleteAfter` | M-185, M-186, U39 |
| `fileaccesslogs` | `fileId`, `ownerId`, `accessorId`, `companyId`, `at` | `{ ownerId, at }` | M-187 |
| `emaillogs` | `type`, `class`, `userId`, `to`, `language`, `status`, `error` | `{ class, createdAt }` (cap) | OD9 |
| `scheduledtasks` | `type`, `key`, `dueAt`, `payload`, `status`, `attempts`, `lastError`, `lockedAt` | `{ status, dueAt }`; unique `key` where `status: pending` | OD10 |
| `jobruns` | `name`, `lastRunAt` | unique `name` | OD10, U7, U32 |
| `auditevents` | `type` (i18n key), `category`, `actor { type, id, name }`, `target { type, id }`, `params`, `at` | `{ at: -1 }`, `{ category, at }` | M-162, M-163, M-174 |

**Candidate**

| Collection | Key fields | Indexes | Drives |
|---|---|---|---|
| `candidateprofiles` | `userId`, `headline`, `location { country, city }`, `about`, `yearsExperience`, `skills [{ name, key }]`, `workPreference`, `availability`, `salaryMin { amount, currency, period }`, `workHistory [{ _id, title, employer, start, end, current, description }]`, `noWorkExperience`, `education [{ _id, institution, degree, start, end, stillStudying }]`, `noFormalQualification`, `languages [{ code, level }]`, `rightToWork [{ _id, region, status, permitExpiresOn }]`, `links { linkedin, portfolio }`, `photo { fileId, smallFileId }`, `certificates [{ _id, name, issuer, issuedOn, expiresOn, url, fileId }]`, `liveCvVersionId`, `completeness { done, total, complete, missing[] }` (recomputed on every change), `restricted { reason, by, at, caseId }` | unique `userId`; `{ 'location.country' }` | M-012 … M-026, M-167, U27 |
| `cvversions` | `userId`, `number`, `fileId` (null after delete), `originalName`, `mime`, `size`, `extractedText`, `noReadableText`, `snapshot { role, years, skills[] }`, `pendingSnapshot`, `drafts [{ _id, suggestions, revisedSnapshot, createdAt }]` | `{ userId, number }` | M-027 … M-031, M-061, U18 |
| `cvaccessrequests` | `companyId`, `candidateId`, `requestedBy`, `reason`, `details`, `status`, `cvVersionId` (chosen on approval), `decidedAt` | `{ candidateId, status }` | M-029, U19 |
| `verificationsubmissions` | `userId`, `category`, `evidenceType`, `fileId` (null after retention), `entryId`, `status`, `submittedAt`, `reviewedBy`, `reviewedAt`, `reason`, `previousSubmissionId` | `{ status, submittedAt }`, `{ userId, category }` | M-166, M-186, U27 |
| `savedjobs` | `candidateId`, `jobId` | unique pair | M-065 |
| `jobalerts` | `candidateId`, `name`, `keywords`, `location`, `country`, `language`, `frequency`, `active`, `lastDigestAt` | `{ frequency, active }` | M-096 … M-098, U35 |
| `alertmatches` | `alertId`, `jobId`, `mode` (`instant`, `digest`), `sentAt` | unique `{ alertId, jobId }` | M-097, U12 |
| `explanationfeedback` | `candidateId`, `jobId`, `value` (`helpful`, `needs_review`) | unique pair | M-067 |

**Recruiter, jobs and hiring**

| Collection | Key fields | Indexes | Drives |
|---|---|---|---|
| `companies` | `ownerUserId`, `legalName`, `displayName`, `website`, `businessEmail`, `industry`, `size`, `country`, `city`, `businessAddress`, `registrationDetails`, `description`, `logoFileId`, `verifiedAt`, `reviewHistory [{ decision, reason, by, at }]`, `onboardingSteps[]`, `submittedAt` | `ownerUserId` | M-145 … M-153, M-165 |
| `kycdocuments` | `companyId`, `userId`, `type`, `fileId` (null after retention), `uploadedAt` | `companyId` | M-185, M-186 |
| `jobs` | `companyId`, `createdBy`, `title`, `brief`, `responsibilities[]`, `requiredSkills[]`, `preferredSkills[]`, `experienceYears`, `level`, `employmentType`, `workPreference`, `country` (ISO2 or `REMOTE`), `city`, `remoteCountries[]`, `salary { min, max, currency, period }`, `requiredLanguages [{ code, minLevel }]`, `visaSponsorship`, `status`, `firstPublishedAt`, `publishedAt`, `closedAt`, `restricted { reason, by, at, caseId }`, `relevantCount`, `relevantComputedAt`, `contentHash` | `{ status, country }`, `{ companyId, status }` | M-032 … M-046, M-051, M-097, M-131, M-167, M-205, OD2 |
| `applications` | `candidateId`, `jobId`, `companyId`, `status`, `stageId`, `cvVersionId`, `coverNote`, `consentAt`, `appliedAt`, `withdrawnAt`, `notSelectedAt`, `history [{ status, stageId, stageName, category, at, actorId, actorType }]`, `lastEmailedStatus`, `cvRemoved` | unique `{ candidateId, jobId }` where status is not `withdrawn`; `{ companyId, status }` | M-069 … M-078, M-030, U33 |
| `pipelinestages` | `companyId`, `name`, `nameKey`, `category`, `order`, `isEntry`, `tone` | unique `{ companyId, nameKey }` | M-069 … M-072, OD5 |
| `shortlistentries` | `companyId`, `candidateId`, `addedBy` | unique pair | M-079, M-083 |
| `candidatenotes` | `companyId`, `candidateId`, `text`, `updatedBy` | unique pair | M-080 |
| `recruiteractivities` | `companyId`, `candidateId`, `actorId` (null = candidate or system), `type`, `params`, `at` | `{ companyId, candidateId, at }` | M-081, M-180 |
| `profileviews` | `candidateId`, `recruiterId`, `companyId`, `day` (YYYY-MM-DD, UTC), `at` | unique `{ candidateId, recruiterId, day }` | M-184 |
| `conversations` | `companyId`, `candidateId`, `jobId`, `startedBy` (`recruiter`, `candidate`), `lastMessageAt`, `lastMessagePreview`, `unread { candidate, recruiter }`, `lastEmailAt { candidate, recruiter }` | unique pair | M-084 … M-089 |
| `messages` | `conversationId`, `senderId`, `senderRole`, `body`, `readAt` | `{ conversationId, createdAt }` | M-086 |

**Payments and learning**

| Collection | Key fields | Indexes | Drives |
|---|---|---|---|
| `subscriptions` | `userId`, `planKey`, `status`, `retrying`, `currency`, `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `source` | unique `userId`; `stripeSubscriptionId` | M-119 … M-121, U38 |
| `payments` | `reference`, `userId` (null after erasure), `payerRole`, `payerName`, `kind`, `itemId`, `itemName`, `amountMinor`, `currency`, `status`, `failureReason`, `method { type, brand, last4 }`, `receiptUrl`, `periodStart`, `periodEnd`, `stripe { checkoutSessionId, paymentIntentId, invoiceId, subscriptionId, chargeId }`, `source`, `paidAt` | unique `reference`; `{ userId, paidAt }`; `stripe.invoiceId`, `stripe.paymentIntentId` | M-122, M-128, OD8 |
| `counters` | `_id` (`paymentReference`), `seq` | — | M-128 |
| `stripeevents` | `eventId`, `type`, `processedAt` | unique `eventId` | ordering item 11 |
| `courses` | `audience`, `language`, `title`, `category`, `level`, `summary`, `about`, `lead`, `tagline`, `designedFor`, `outcomes[]`, `coverFileId`, `skillTags[]`, `pipelineCategory` (recruiter courses, OQ-3), `isFree`, `prices [{ currency, amountMinor }]`, `status`, `lessons [{ _id, order, title, type, videoFileId, durationSec, textMarkdown, textHtml, documentFileId, url, isPreview, contentLanguage }]`, `quiz { passMark, questions [{ _id, text, type, options [{ _id, text }], correctOptionIds[] }] }`, `lockedAt`, `publishedAt`, `createdBy`, `updatedBy` | `{ audience, status }` | M-099 … M-114, U24 |
| `enrollments` | `userId`, `courseId`, `source` (`free`, `purchase`, `seed`), `paymentId`, `enrolledAt`, `lessons [{ lessonId, creditedSec, lastPositionSec, lastHeartbeatAt, completedAt }]`, `quizBestScore`, `quizPassedAt`, `completedAt`, `certificateId` | unique `{ userId, courseId }` | M-103, M-110, U15 |
| `quizattempts` | `userId`, `courseId`, `answers`, `scorePercent`, `passed`, `submittedAt` | `{ userId, courseId }` | M-104 |
| `certificates` | `code`, `userId` (null for a tombstone), `courseId`, `holderName`, `courseTitle`, `language`, `issuedAt`, `pdfFileId`, `status`, `revokedAt`, `revokedBy`, `revokeReason` | unique `code` | M-105, U17, C18 |

**Matching, AI, admin**

| Collection | Key fields | Indexes | Drives |
|---|---|---|---|
| `embeddings` | `ownerType` (`candidate`, `job`), `ownerId`, `model`, `dims`, `vector` (Float32 Buffer, about 12 KB), `sourceHash` | unique `{ ownerType, ownerId }` | U6, D25 |
| `matchingpolicies` | `name`, `description`, `status`, `signals { skills, experience, location }`, `weights { sim: 0.6, skill: 0.4 }`, `thresholds { strong: 75, good: 50 }`, `version`, `createdBy` | unique `status` where `status: active` | M-047 … M-049, U5 |
| `matchingpolicyversions` | `policyId`, `version`, `signals`, `weights`, `thresholds` | unique `{ policyId, version }` | M-049 |
| `matchresults` | `jobId`, `candidateId`, `policyVersionId`, `score`, `label`, `sim`, `skillShare`, `locationCapped`, `matchedSkills[]`, `missingSkills[]`, `computedAt` | unique `{ jobId, candidateId }`; `{ jobId, score: -1 }` | M-047, M-051, M-172 |
| `aicaches` | `kind`, `key` (hash of inputs + entity version), `language`, `output`, `model` | unique `{ kind, key, language }` | M-057, M-058, M-144 |
| `aiusages` | `userId`, `day` (UTC YYYY-MM-DD), `count` | unique pair | OD13 |
| `moderationcases` | `targetType`, `targetId`, `reports [{ reporterId, reason, details, at }]`, `excerpt [{ senderRole, body, at }]`, `status`, `decision { action, reason, by, at }`, `history[]`, `openedBy` (`user`, `admin`) | `{ status, createdAt }`; `{ targetType, targetId }` | M-164, M-167, U20, OQ-1 |
| `reportexports` | `type`, `period`, `language`, `brief`, `voiceFileId`, `transcript`, `aiSummary`, `csvFileId`, `filename`, `createdBy`, `generatedAt` | `generatedAt` | M-181 … M-183, U23 |

### 4.3 Unique indexes and TTL (ordering item 16)

Created at startup with `syncIndexes`, before any data. These are the unique indexes of §4.2:

- `users.email`, `certificates.code`, `payments.reference` (with `counters`), `stripeevents.eventId`. There is no phone uniqueness (OD3).
- Pairs and triples: `savedjobs`, `shortlistentries`, `candidatenotes`, `conversations`, `profileviews`, `enrollments`, `aicaches`, `aiusages`, `matchresults`, `embeddings`.
- `applications` (partial), `emailtokens.tokenHash`, `countries.code`, `plans.key`, `permissions.id`, `adminroles.nameLower`, `matchingpolicies` active (partial), `jobruns.name`, `scheduledtasks.key` (partial), `legaldocuments`.

TTL indexes on `emailtokens` and `verificationcodes`.

---

## 5. API outline

All paths are under `/api/v1`. **Who:**
- **Pub** = public.
- **Any** = any signed-in user.
- **C** = candidate; **C+x** = candidate with entitlement x (§3.3).
- **R** = recruiter with a verified email (U37); **R✓** = approved recruiter.
- **A:perm** = admin with that permission (Owner bypass).

**Auth and me**

| Method + path | Who | Purpose |
|---|---|---|
| POST `/auth/candidate/register` | Pub | create a candidate and email the verification link; duplicates get the same reply (M-001, U36) |
| POST `/auth/recruiter/register` | Pub | create a recruiter, return a token, email the code; duplicate → `EMAIL_TAKEN` (U37, OQ-6h) |
| POST `/auth/login` | Pub | `{ email, password, portal }` → `{ token, me }` (M-005) |
| POST `/auth/verify-email` · POST `/auth/verify-email/resend` | Pub | open the link; resend (202 always) (M-001) |
| POST `/auth/email-code/verify` · POST `/auth/email-code/resend` | recruiter (unverified) | recruiter email code (M-002, M-004) |
| POST `/auth/forgot-password` · POST `/auth/reset-password` | Pub | neutral 202; reset returns `{ role }` (M-009) |
| GET `/auth/invite/:token` · POST `/auth/invite/accept` | Pub | check the invite; set the password (U21) |
| GET `/me` · PATCH `/me` | Any | profile of the session (role, status, plan, entitlements, completeness, company, permissions, legal flags); `{ fullName, language, pickerCountry, timezone }` |
| POST `/me/password` · POST `/me/legal/accept` · PATCH `/me/notifications` | Any (notifications: C, R) | M-010, M-191/U22, M-095 |
| GET `/me/counters` | C, R✓ | unread messages, active applications (M-094) |
| GET `/me/payments` | C, R✓ | own payments with receipt links (M-122) |
| GET `/me/export` · DELETE `/me` | C, R | ZIP export (M-190); erasure with the password (M-188, M-189) |

**Meta and public**

| Method + path | Who | Purpose |
|---|---|---|
| GET `/health` | Pub | `{ status, db }` |
| GET `/meta/countries` · `/meta/languages` · `/meta/config` | Pub | 29 countries; ISO 639-1 codes; limits and enums |
| GET `/plans` | Pub | plans with the price in the requested or user currency (M-116) |
| GET `/legal/:doc` | Pub | current version in the requested language (M-191) |
| GET `/help/faqs` | Any | FAQs for the role, in the user's language (M-200) |
| GET `/public/certificates/:code` | Pub (30/min/IP) | certificate status (M-105) |
| GET `/files/:fileId` | signed URL | stream a file with Range support (U39) |
| POST `/stripe/webhook` | Stripe signature | webhook (§2.10) |

**Candidate**

| Method + path | Who | Purpose |
|---|---|---|
| GET/PUT `/candidate/profile` | C | core fields |
| POST/PATCH/DELETE `/candidate/profile/work-history[/:id]` · PUT `…/work-history/none` | C | M-018 |
| POST/PATCH/DELETE `/candidate/profile/education[/:id]` · PUT `…/education/none` | C | M-019 |
| PUT `/candidate/profile/languages` · `/right-to-work` · `/links` | C | M-020 … M-022 |
| POST/DELETE `/candidate/profile/photo` | C | M-013 |
| POST/PATCH/DELETE `/candidate/profile/certificates[/:id]` | C | M-025 |
| GET `/candidate/profile/completeness` | C | §3.2 (M-015, M-016) |
| PUT `/candidate/onboarding/:step` · POST `/candidate/onboarding/complete` | C | M-014 |
| GET/PATCH `/candidate/settings/privacy` | C | M-187 |
| GET `/candidate/overview` | C | KPIs, profile views (M-053, M-184) |
| GET `/candidate/cv` · POST `/candidate/cv/versions` | C | list; upload (U18) |
| POST `/candidate/cv/versions/:id/live` · GET `…/:id/download` · DELETE `…/:id` | C | M-028 |
| POST `/candidate/cv/versions/:id/snapshot` · POST `…/snapshot/confirm` | C+ai | M-027 |
| POST `/candidate/cv/drafts` · DELETE `/candidate/cv/drafts/:id` | C+ai | M-061 |
| GET `/candidate/cv/requests` · POST `/candidate/cv/requests/:id/decision` | C | M-029 |
| GET `/candidate/cv/downloads` | C | download log (M-187) |
| GET `/candidate/verification` | C | phone and check states |
| POST `/candidate/verification/phone/code` · POST `…/phone/confirm` | C | M-003, M-004 |
| POST `/candidate/verification/submissions` | C | evidence upload (M-166) |
| GET `/jobs` · GET `/jobs/:id` · GET `/jobs/recommended` | C | search (picker country); details; For you (M-053) |
| GET `/candidate/saved-jobs` · PUT/DELETE `/candidate/saved-jobs/:jobId` | C | M-065 |
| GET `/candidate/applications[/:id]` | C | list and history |
| POST `/candidate/applications` | C+apply (+ complete) | apply (§3.4) |
| POST `/candidate/applications/:id/withdraw` | C | M-074 |
| GET/POST `/candidate/job-alerts` · PATCH/DELETE `…/:id` | C+job_alerts | §3.6 |
| GET `/candidate/insights/overview` · `/roles` · `/skill-gap` · `/improve-profile` · `/job-match` · `/why-recommended` | C+ai | M-057, M-063, M-066 |
| PUT `/candidate/insights/feedback/:jobId` · POST `/candidate/profile/skills` | C+ai | M-067, M-064 |
| POST `/candidate/profile/ai-summary` | C+ai | M-062 |

**Shared signed-in features**

| Method + path | Who | Purpose |
|---|---|---|
| POST `/jobs/:id/ai-summary` | C+ai, R✓ | job AI summary (M-058, M-059) |
| POST `/translate` | C+ai, R✓ | `{ entity, id, field, language }` (M-144) |
| GET `/conversations` · POST `/conversations` | C, R✓ (start: R✓, or C+message_send to an applied company) | M-084, M-085 |
| GET `/conversations/:id/messages` · POST `…/messages` · POST `…/read` | C (send: C+message_send), R✓ | M-086 |
| POST `/reports` | C, R✓ | report content (M-164, U20) |
| GET `/courses` · GET `/courses/:id` | C, R✓ | catalogue by audience, prices in the user currency |
| POST `/learning/enrollments` · GET `/learning/enrollments` | C, R✓ | free enrol; own progress |
| GET `/learning/courses/:id/lessons/:lessonId` | C, R✓ (enrolled, or preview) | lesson content and signed media URL (M-106) |
| POST `/learning/lessons/:lessonId/progress` | C, R✓ | heartbeat or open (U15) |
| GET `/learning/courses/:id/quiz` · POST `…/quiz/attempts` | C, R✓ | M-104 |
| GET `/learning/certificates` · GET `/learning/certificates/:id/pdf` | C, R✓ | M-105 |
| GET `/learning/suggestions` | C, R✓ | M-114, OQ-3 |
| GET `/payments/quote` · POST `/payments/checkout-sessions` · GET `/payments/checkout-sessions/:id` | C (plan), C or R✓ (course) | M-124, M-125, U40 |
| POST `/payments/portal-session` | C (subscriber) | M-121 |

**Recruiter**

| Method + path | Who | Purpose |
|---|---|---|
| GET `/recruiter/onboarding` · PUT `…/account` · PUT `…/company` | R | M-151, M-153, M-149 |
| POST/DELETE `/recruiter/onboarding/documents[/:id]` | R | KYC (M-185) |
| POST `/recruiter/onboarding/phone/code` · POST `…/phone/confirm` · POST `…/submit` | R | M-003 |
| GET/PATCH `/recruiter/company` · POST/DELETE `/recruiter/company/logo` | R✓ | M-147, M-150 |
| GET `/recruiter/overview` · `/overview/momentum` · `/overview/talent` | R✓ | §3.15 |
| GET/POST `/recruiter/jobs` · GET/PUT `/recruiter/jobs/:id` | R✓ | list with status counts; draft create; edit |
| PATCH `/recruiter/jobs/:id/status` · DELETE `/recruiter/jobs/:id` | R✓ | transitions with publish validation (M-039); drafts only (M-038) |
| POST `/recruiter/jobs/quality-checks` | R✓ | M-060 |
| GET `/recruiter/jobs/:id/relevant-talent` · GET `/skills/suggestions` | R✓ | M-051; M-034 |
| GET `/recruiter/candidates` · GET `/recruiter/candidates/:id` | R✓ | discovery (M-054 … M-056); profile, which records a view (M-184) |
| GET `/recruiter/candidates/:id/match` | R✓ | evidence + narrative, no score (M-057) |
| GET `/recruiter/candidates/:id/cv` · POST `…/cv-requests` | R✓ | signed URL when allowed (M-187); request (M-029) |
| GET `…/activity` · GET/PUT `…/note` | R✓ | M-081, M-080 |
| GET `/recruiter/shortlist` · PUT/DELETE `/recruiter/shortlist/:candidateId` | R✓ | M-079 |
| GET `/recruiter/applications` | R✓ | filters: job, stage, status (M-076, M-077) |
| PATCH `/recruiter/applications/:id/stage` · POST `…/reject` | R✓ | move; reject `{ notify }` (M-090) |
| GET `/recruiter/pipeline` · POST/PATCH/DELETE `/recruiter/pipeline/stages[/:id]` · PUT `…/stages/order` | R✓ | M-069, M-072, OD5 |

**Admin** (every route needs `role=admin` plus the permission shown)

| Method + path | Permission | Purpose |
|---|---|---|
| GET `/admin/overview` · `/admin/activity` | `dashboard.view` | KPIs and chart (§3.15) |
| GET `/admin/overview/export` | `dashboard.view` + `reports.export` | CSV |
| GET `/admin/users` · GET `/admin/users/:id` · GET `/admin/users/export` | `users.view` (+ `reports.export`) | tables and detail pages (M-161, M-206) |
| GET `/admin/jobs` · GET/POST `/admin/jobs/:id/ai-summary[/regenerate]` | `jobs.view` | M-046, M-058 |
| GET `/admin/applications[/export]` · GET `/admin/recruitment/*` | `candidates.view` | M-206, M-178 |
| GET `/admin/permissions` · GET `/admin/roles` | `roles.view` | M-156 |
| POST `/admin/roles` · POST `/admin/roles/:id/duplicate` | `roles.create` | M-158 |
| PATCH `/admin/roles/:id` · POST `/admin/roles/:id/archive` | `roles.edit` / `roles.archive` | M-158 |
| GET `/admin/access/users` · PUT/DELETE `/admin/access/users/:id` | `roles.view` / `roles.assign` | M-154, M-160 |
| POST `/admin/invitations` | `users.add` | M-159 |
| GET `/admin/courses[/stats]` · GET `/admin/courses/:id/learners` | `learning.view` | M-111 |
| POST/PATCH `/admin/courses[/:id]` · lessons, order, quiz, status · POST `/admin/uploads` · POST `/admin/markdown/preview` · POST `/admin/certificates/:id/revoke` | `learning.manage` | M-101 … M-109, M-105 |
| GET `/admin/payments[/:id]` · `/admin/payments/stats` · `/admin/payments/export` | `finance.view` (+ `reports.export`) | M-122, M-123 |
| GET/POST/PATCH `/admin/matching/policies…` · `/activate` · `/archive` · `/suggest` | `ai.view` / `ai.manage` | M-048, M-049 |
| GET `/admin/matching/oversight` · `/feedback` · `/admin/ai/status` | `ai.view` | M-068, M-067 |
| GET `/admin/analytics` | `reports.view` | §3.15 |
| GET/POST `/admin/reports` · GET `/admin/reports/:id/download` | `reports.view` / `reports.export` | M-181 … M-183 |
| GET `/admin/moderation/summary` · `/content` · `/accounts` · `/verification` | `moderation.manage` | queues |
| POST `/admin/moderation/content/:id/decision` · `/accounts/:userId/decision` · `/verification/:id/decision` | `moderation.manage` (suspend and reactivate: + `users.deactivate`) | M-165 … M-167, OQ-1, OQ-2 |
| GET `/admin/audit-events[/export]` | `audit.view` (+ `reports.export`) | M-162, M-206 |
| GET `/admin/files/:fileId` | `documents.view` | sensitive files (signed URL; M-186, OQ-6 j) |

**Test only** (`NODE_ENV=test`): `POST /_test/reset`, `GET /_test/mail`, `POST /_test/scheduler/tick`, `POST /_test/db`, `POST /_test/ai/fail-next` (§2.13).

---

## 6. Build phases

The order follows the blocker review §4:
- the key catalogue, countries and money format, User and Company, the email layer, the scheduler, permissions and audit come first;
- payments and entitlements come before any plan gate;
- application history comes before KPIs.

Each phase lists its scope, tasks (with a verify check), decisions, prep, done criteria, browser verification and API tests.

**How to read the browser checks.** Viewports: **D** = 1440×900, **M** = 375×812. Every scenario also fails on console errors, unexpected 4xx/5xx responses, missing i18n keys and horizontal overflow at 375 px (§2.13). "Captured mail" means `/_test/mail`. "Tick at T" means `/_test/scheduler/tick { now: T }`.

**Interim rule.** Screens not yet migrated keep their mock data until their phase. A migrated screen reads only server data. Phase 12 proves nothing static remains.

### Phase 0: Restructure (done)

`client/` and `server/` exist; Vercel uses Root Directory `client`; lint, build and the 69-route sweep were green (S). Nothing to do. Phase 1 recreates the route sweep inside `e2e/`.

### Phase 1: Server foundation, auth API, mail, scheduler, seed skeleton, test harness

**Scope.** Everything server-side that every feature needs, plus the Vite proxy and the e2e harness. No new screens.

**Decisions.**
- Accounts: M-001 … M-011 (server side), M-191 (storage), U1, U2, U12, U36, U37, OD3, OD6 (no in-app toggle field).
- Platform: M-139, M-141 … M-143, M-155, M-156, M-160 (infrastructure), M-162 (writer), M-204, M-205.
- Email and scheduler: OD9, OD10, OQ-6c.
- Seed: U41, OQ-6j.
- Ordering items 2, 3, 5, 7, 8, 14, 15, 16.

**Prep.** P10 (download the top-10k list into `server/data/common-passwords.txt`), P12 (aliases derived by the seed), P13 (report `db.stats()`; the owner confirms tier, headroom and IP access in Atlas).

**Tasks**

1. `server/package.json`, scripts (§2.2), Phase 1 packages (§2.14). Verify: `npm ls` is clean and `node -v` is 24.x.
2. `config/env.js` validates all 22 variable names and derives the database name and the upload root. Verify: a missing variable makes startup fail with that name only (no values printed).
3. `lib/db.js` with `syncIndexes`; `GET /api/v1/health`. Verify: health returns `{ status: 'ok', db: 'up' }`.
4. Conventions: `errors.js` (all §2.3 codes), `validate.js`, error middleware, JSON 404. Verify: API tests.
5. `config/enums.js` (all of §4.1), `config/limits.js`, `GET /meta/config`. Verify: a test asserts every §4.1 enum is present.
6. Models: `users`, `emailtokens`, `verificationcodes`, `countries`, `plans`, `appconfigs`, `permissions`, `adminroles`, `auditevents`, `emaillogs`, `scheduledtasks`, `jobruns`, `legaldocuments`, `faqs`. Verify: indexes exist (§4.3).
7. Auth module:
   - candidate and recruiter register, login with `portal`, verify link and resend, email code verify and resend, forgot and reset;
   - `GET/PATCH /me`, password change, legal accept, notification toggle;
   - middleware (§2.5), password rules, rate limits.
   Verify: API tests below.
8. Mailer (§2.8) with en/es/fr templates `verify_email`, `already_registered`, `recruiter_email_code`, `password_reset`; reserved-domain suppression; cap; toggle; test capture; `npm run mail:test`. Verify: one live `verify_email` to a plus-alias, confirmed by the owner.
9. Scheduler (§2.7) with `scheduledtasks` and `jobruns`, and the startup catch-up. Verify: API tests with tick(now).
10. `lib/audit.js` (actor types, i18n type keys). Permission catalogue (§3.13) and `requirePermission` with the Owner bypass. `GET /admin/permissions` is the first admin route. Verify: an admin without `roles.view` gets `PERMISSION_DENIED`; the Owner passes.
11. `seed:catalog`: 29 countries, the Free and Plus plans with OD1 prices (Stripe ids come in Phase 5), permissions, the three Figma roles remapped (§3.13).
12. `seed:demo`: wipe, then create the Owner (`SEED_ADMIN_EMAIL`, `isOwner`) and the demo accounts Alex and Emma (candidates, email verified, onboarding done), Sarah (recruiter, status `onboarding`) and James (recruiter applicant, status `onboarding`). Plus-aliases `+alex`, `+emma`, `+sarah`, `+james`; `SEED_PASSWORD` is checked against the password rules. Later phases complete these accounts. Verify: running it twice gives the same result.
13. `client/vite.config.js`: proxy `/api` to `process.env.VITE_API_PROXY ?? 'http://localhost:5000'`. Verify: health through port 5173.
14. Test harness:
    - `server/test` (setup, helpers, `/_test` router);
    - `e2e/` (`package.json` with puppeteer-core, `run.js`, `lib/`, `routes.js` with today's 69 routes, the `sweep` scenario that signs in through today's demo session);
    - `e2e/artifacts/` added to `.gitignore`.
    Verify: `node e2e/run.js sweep` passes against the unchanged client.

**Done when.** All API tests pass. `seed:catalog` is idempotent and `seed:demo` recreates. The owner confirmed the live email. The harness boots both servers and the baseline sweep is green. Lint passes.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P1-01 | Harness boot | D | Server on 5100 (test DB) and Vite on 5174 start. Chrome opens `http://localhost:5174/api/v1/health` and gets `{ status: 'ok', db: 'up' }` through the proxy. |
| P1-02 | Baseline sweep | D, M | All 69 current routes render for the three roles with no console errors and no 375 px overflow, the same as the planning-session result. |
| P1-03 | API contract from the browser | D | In page context, `fetch('/api/v1/me')` with no token → 401 `AUTH_REQUIRED` JSON. With a token from `POST /auth/login` (seeded Emma, portal candidate) → 200 with `role: candidate`, `status: active`. |

**API tests** (`auth`, `users`, `mailer`, `scheduler`, `permissions`, `seed`)

- **Candidate register:** 201 without a token. The verification email is captured in the sign-up language (en, es, fr each tested). A duplicate gets the same 201 plus `already_registered`. Resend is limited to 1/min and 5/day.
- **Candidate login:** unverified → `EMAIL_UNVERIFIED`. After the link → token. Reusing the link → `TOKEN_USED`. An expired link (date shifted) → `TOKEN_EXPIRED`.
- **Portals (M-005):** a candidate on the recruiter portal → 200 with role `candidate`. An admin on the candidate portal and a candidate on the admin portal → `INVALID_CREDENTIALS`.
- **Recruiter register:** returns a token; a recruiter endpoint → `EMAIL_UNVERIFIED`; `/me` → 200. Code: 5 wrong → `CODE_LOCKED`; expired → `CODE_EXPIRED`; resend before 60 s → `RATE_LIMITED`; correct → status `onboarding`. Duplicate → `EMAIL_TAKEN`.
- **Passwords:** 7 characters, a list password, the email local part, and more than 72 bytes each → `VALIDATION_FAILED` with field keys.
- **Rate limits (U1):** per email and per IP (`X-Forwarded-For`), forgot password, sign-up → `RATE_LIMITED` with `retryAfter`.
- **Forgot and reset:** an unknown email → 202 and no mail. A reset bumps tokenVersion (the old token gets 401), sets `emailVerifiedAt` and returns the role.
- **Change password:** a wrong current password → validation error; success → the new password works.
- **`PATCH /me`:** language, `pickerCountry` (must exist), timezone, `languageExplicit`.
- **Mailer:**
  - every reserved domain → `suppressed_reserved`;
  - the 401st non-critical send in 24 h → `skipped_cap`, while a critical send still goes out;
  - toggle off → `skipped_toggle`.
- **Scheduler:** a due task runs exactly once (two parallel ticks); a failed task is retried up to 3 times; startup catch-up works.
- **Permissions:** the Owner bypass; `PERMISSION_DENIED` without the permission.
- **Seeds:** `seed:catalog` twice leaves stable counts (29 countries, 2 plans, 21 permissions, 3 roles). `seed:demo` creates the Owner and the 4 demo accounts with plus-aliases, and no demo account is on `example.com`.

### Phase 2: Client data layer, i18n, auth screens and state machine, shell

**Scope.** RTK Query, session, router guards, i18n infrastructure, formatting, every public and auth screen, and the shell identity. The shell, auth, legal and help screens ship in en/es/fr (proving the pipeline). Other screens get en keys as their phase migrates them; es/fr for those come in Phase 11.

**Decisions.**
- Accounts: M-001, M-002, M-005 … M-007, M-009 … M-011, M-191, U22, U36, U37, OQ-6h.
- Shell: M-093, M-192, M-193/OD11, M-194, M-195, M-197, M-198, M-199/OD6, M-200, C4.
- Locale: M-133 … M-135, M-139 … M-141, M-143, OQ-6b; U43 (shell and auth copy, FAQs, legal drafts).

**Prep.** P9, client part: `@fontsource/inter` and `@fontsource/manrope` with the weights in `DESIGN_SYSTEM.md`.

**Tasks**

1. Install the client packages; import the fonts; remove the Google Fonts link from `client/index.html` (M-192). Verify: no request to `fonts.googleapis.com`.
2. `store.js`, `api.js` (base query, reauth, tags), token store, `session` slice, `<Provider>`. Verify: `getMe` works after login.
3. i18n: init, namespaces, `errors` (every §2.3 code), `validation`, `enums` (every §4.1 key) in en/es/fr; `<html lang>`; `document.title` via `handle.titleKey`. Verify: switching language changes both.
4. `lib/format.js` and locale derivation (§3.11 with OQ-6b); `StatCard` takes a number plus a formatter. Verify: unit checks in the e2e (en-DE, fr-BE, en-IE samples).
5. Router: async workspace loader on `getMe`; the §3.1 redirects; `?next` (same-origin only); signed-in redirect away from public auth pages. Verify: P2 scenarios.
6. Screens:
   - sign-in × 3 (Forgot link; wrong-portal notice; admin restricted notice; no `DemoNote`);
   - candidate sign-up (country select, terms checkbox linking to `/legal/*`, password rules);
   - `/sign-up/check-email` (Resend with a cooldown), `/verify-email` (verifying, success, expired with Resend, used), `/forgot-password`, `/reset-password`;
   - recruiter sign-up, then `/recruiter/onboarding/email-code` (new, M-002);
   - `/legal/:doc`, the re-accept dialog (U22), a language picker on every public page (M-140).
   Recruiter onboarding steps 1–5 stay mock until Phase 4; the loader already routes by status.
7. Shell:
   - identity from `/me` (M-195): name, email, subtitle (candidate plan, recruiter company, admin role or "Owner"), initials avatar;
   - remove the workspace switch; bell without a dot (M-093);
   - country picker from `/meta/countries`, as a scrollable list with Remote last; language picker with endonyms; both call `PATCH /me` (anonymous visitors use localStorage);
   - footer (M-197); logo (OD11: crop the "AI" mark from `logo.png` into a new asset, plus live text in Manrope); Ctrl K on non-Mac;
   - sidebar items keyed by `item.to`; global search translated and accent-insensitive (M-194); sign-out (clear token, reset the API state, sync other tabs).
8. Help page from `GET /help/faqs`. `seed:catalog` adds FAQs per audience in en/es/fr (rewritten, no demo text) and the legal drafts (OD12: Terms, Privacy and an Imprint placeholder, version `2026-11-draft`, marked as drafts).
9. Settings: "Change password" in candidate and recruiter Data & account; admin Settings page (name, password, language; M-199, OD6). The notification pages keep only the email toggle (OD6).
10. Delete: `features/auth/utils/session.js`, `DemoNote`, the `preferencesContext` LOCATIONS and LANGUAGES, the localStorage preferences, the demo hero copy. Add the new public routes to `e2e/routes.js`. The sweep now signs in through the API with seeded accounts.

**Done when.** Every auth flow works in Chrome for all roles. The shell, auth, legal and help screens work in en/es/fr. No `lwm-session` key remains. Lint, build and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P2-01 | Candidate sign-up | D, M | Chrome language fr-FR: the form defaults to French, country France. Submit → check-email shows the address. Captured mail is in French with a link. Open it → "Email verified" + Sign in. Sign in → `/candidate/onboarding/story`. |
| P2-02 | Unverified sign-in | D | Sign in before verifying → inline alert with Resend. A second Resend within 60 s → rate-limit message with the wait time. |
| P2-03 | Duplicate sign-up | D | An existing email → same check-email screen; captured `already_registered`. |
| P2-04 | Used and expired links | D | A used link → "already used" with Sign in. Expiry shifted via `/_test/db` → expired state with an email field and Resend. |
| P2-05 | Wrong portal | D | Emma on `/recruiter/sign-in` → lands on `/candidate` with the notice. Emma on `/admin/sign-in` → generic error. The Owner on `/sign-in` → generic error. |
| P2-06 | Admin sign-in | D, M | The Owner signs in on `/admin/sign-in` → `/admin`. The restricted notice and the Forgot link are shown; no demo note. |
| P2-07 | Forgot and reset | D, M | A neutral confirmation for both an unknown and a known email. The captured link opens `/reset-password`. Common and short passwords show translated errors. Success links to that role's sign-in. A second tab with the old session gets 401 and goes to sign-in with `?next`. |
| P2-08 | `?next` | D | Signed out, open `/candidate/settings/billing` → `/sign-in?next=…`; after sign-in it lands there. `?next=https://evil.example` is ignored. |
| P2-09 | Signed-in redirect | D | `/`, `/sign-in` and `/sign-up` while signed in → own workspace. |
| P2-10 | Recruiter sign-up and code | D, M | `/recruiter/sign-up` → code screen. A wrong code shows attempts left; 5 wrong → locked message; Resend enabled after 60 s; correct → onboarding. Opening `/recruiter` redirects back to onboarding. A duplicate email shows `EMAIL_TAKEN` with sign-in and reset links. |
| P2-11 | Language and country | D, M | Switch to Español → shell and auth texts in Spanish, `<html lang="es">`, kept after reload (server). Switch the country to Poland → kept. Anonymous: the public-page picker keeps its choice in localStorage. |
| P2-12 | Shell identity | D, M | Emma: name, email, "Free" subtitle, initials. Owner: "Owner". No workspace switch. The bell has no dot and opens notification settings. Footer "© {current year} Local WorkMan" with three legal links. The country list scrolls at 375 px. |
| P2-13 | Legal and re-accept | D, M | `/legal/terms` shows the draft banner and switches language. Terms version bumped via `/_test/db` → the next sign-in shows a blocking dialog; Accept continues. |
| P2-14 | Help | D | FAQs differ per role and follow the language; search ignores accents. |
| P2-15 | Change password | D | Wrong current password → error. Success → the new password works at next sign-in. Admin Settings saves the name and language. |
| P2-16 | Notification settings | D | Only the email toggle is present, and it persists. |
| P2-17 | Fonts and logo | D | No Google Fonts request. The logo shows the AI mark plus live "Local WorkMan" and "AI Job Portal" text. |
| P2-18 | Sweep | D, M | All routes, all roles, signed in through the API, en. |

**API tests.** `/meta/countries` (29 rows, BG = EUR, Remote = EUR); `/legal/:doc` per language; `/help/faqs` per audience; `/me` DTO per role; `PATCH /me/notifications`; legal accept with versions.

### Phase 3: Candidate profile, completeness, uploads, CV, verification

**Scope.** The complete-profile model and every editor; onboarding; files and signed URLs; CV versions with extraction; phone and evidence verification; the admin verification queue; privacy settings. The CV AI actions arrive in Phase 9; until then they are hidden, and the rule-based fake draft is deleted.

**Decisions.**
- Profile: M-012 … M-026, M-027 (extraction part), M-028, M-030, M-031, M-032 (profile location), M-136.
- Verification and files: M-166, M-168 (data), M-185, M-187 (flags stored), U18, U27, U39.
- Other: OD3, OQ-4, C16, C17, C21.

**Prep.** P11, part 1. Fixtures live outside the repo in `C:/eujobs-data/fixtures`, generated by `e2e/fixtures/make.js`:
- a text PDF (pdfkit) and an image-only PDF (pdfkit with an embedded image);
- a DOCX (minimal OOXML zipped with archiver);
- JPG, PNG and WebP photos and an ID-like image (sharp);
- a 6 MB image and an 11 MB PDF;
- an `.exe` renamed to `.jpg`.

**Tasks**

1. Phase 3 packages. `lib/files.js`, the `files` and `fileaccesslogs` models, upload middleware per purpose, and `GET /files/:id`. Verify: tests for tampered signature, expiry, Range.
2. `candidateprofiles`, the section endpoints and the completeness service (§3.2), embedded in `/me`; the U27 reset rules. Verify: unit tests over every item combination.
3. Onboarding (M-014):
   - story: CV upload creates version 1;
   - preferences: work preference, country + city, optional salary in the country currency;
   - plan: plan cards from `/plans`; "Continue with Free". The Plus button keeps today's demo checkout until Phase 5 replaces it.
   `onboardingCompletedAt` is set; the header country takes the profile country (M-136).
4. My profile: section cards with editors (OD16) for basics, full name, availability, work history (with the opt-out), education (with the opt-out), languages (codes from `/meta/languages`, names via `Intl.DisplayNames`), right to work, links, photo (square crop on the server), external certificates. A completeness checklist panel; the Overview strength card from the server.
5. CV page:
   - upload (types and sizes; at most 20), extraction (pdfjs-dist, mammoth), "No readable text" flag;
   - live selection, download via a signed URL, delete non-live versions;
   - the compare panel reads server snapshots.
   Remove `cv/utils/cvVersions.js` and its fake draft.
6. Verification page:
   - phone (country-code input, on-screen code, M-004 rules);
   - checks with evidence types, statuses and reasons, and resubmission;
   - right-to-work and certificate verification requests linked to their entries;
   - the self-approve button is removed.
7. Admin: Moderation tab "Candidate verification" (list, detail with file preview through `documents.view`, Approve or Reject with a reason ≤ 300); the emails `verification_approved` and `verification_rejected`; audit events; the "Credential reviews" stat becomes a real count.
8. Privacy settings stored (M-187). The shell avatar shows the photo through a signed URL.
9. `seed:demo`:
   - Alex's profile from `profile.js` (incomplete by design);
   - seeded candidates from the recruiter `candidates.js` and `candidateDetails.js` as structured profiles. Applicants are complete with approved checks and a verified phone (OQ-4).
   - photos copied from client assets; CV PDFs generated with text;
   - two James Chen accounts (OQ-4): the candidate here, the recruiter applicant in Phase 4.
10. Delete: the candidate profile, CV, verification, onboarding and privacy-settings mock data and hooks.

**Done when.** In Chrome, a candidate reaches "Complete" (with admin approvals). The completeness shown always equals the server's. Uploads reject wrong types and sizes. Signed URLs expire. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P3-01 | Onboarding | D, M | A new verified candidate: story (upload a text PDF) → preferences (Remote, Poland, Warsaw, 12,000 PLN/month) → plan → Continue with Free → Overview. The header country is Poland. The next sign-in goes to `/candidate`. |
| P3-02 | Completeness walk | D | The checklist shows "x of N". Each section editor raises "x" after save. Adding a work and an education entry changes N from 10 to 12. The "No work experience yet" opt-out marks the item done and removes the employment check from N. |
| P3-03 | Field validation | D, M | Headline 61, about 19, a 13th skill, a duplicate skill with different case, a non-`linkedin.com/in` URL, an `http://` portfolio, end before start → translated messages. The same payloads via the API → 422. |
| P3-04 | Photo | D, M | A 4 MB PNG → the avatar appears in the sidebar, header and profile menu. 6 MB → size error. GIF → type error. `.exe` renamed `.jpg` → type error. |
| P3-05 | CV | D | Text PDF → version 1 live. Image-only PDF → "No readable text" badge. DOCX accepted. 11 MB → error. A 21st version → error. Download opens the file. A tampered signature → 403. The live version cannot be deleted; a non-live one can. |
| P3-06 | Phone | D, M | A Polish national number → normalised to E.164. The code shows on screen. 5 wrong → locked. Resend disabled for 60 s. Correct → "Verified". The same number on a second account also verifies (OD3). |
| P3-07 | Evidence flow | D, M | Submit identity (passport JPG) → In review. The Owner opens the verification tab and sees the preview, the candidate and the linked claim. Reject with a reason → the candidate sees Rejected + reason, and the captured email is in the candidate's language. Resubmit → Approve → Identity ticked, checklist item done, approval email. |
| P3-08 | Permission denial | D | A test-only admin without `moderation.manage` (created via `/_test/db`) → the verification API gives `PERMISSION_DENIED` and the page shows the translated no-permission state. Without `documents.view` the preview is refused. |
| P3-09 | Complete profile | D | After all items and approvals: checklist "Complete", 100% on the Overview card and My profile. |
| P3-10 | U27 reset | D | Editing the education entry linked to an approved academic check → the check resets and the profile is incomplete again. |
| P3-11 | Expired permit | D | A visa/permit with a past expiry date → "Permit expired"; completeness unchanged. |
| P3-12 | Privacy | D | The three privacy flags persist after reload. |

**API tests.** Completeness (every item, N 10–12, opt-outs, U27); section CRUD validation and limits; files (type, magic bytes, size, signature, expiry, ownership, Range, download log); CV (extraction for each fixture, 20 max, live and delete rules); phone (all M-004 rules); submissions and decisions (permissions, reasons, emails, audit); `/me` completeness.

### Phase 4: Recruiter onboarding, company, approval, jobs, discovery

**Scope.** Recruiter onboarding and admin account review; the company page; jobs end-to-end; candidate job browsing; recruiter candidate discovery.

Surfaces that depend on the match score use the non-AI path until Phase 9: the M-051 fallback (at least 1 required skill) for "N relevant" and the Recommended KPI, the U8 rule for For you, and the M-052 overlap for sorting and talent cards. Phase 9 swaps in the score.

**Decisions.**
- Onboarding and company: M-145 … M-153, M-165, OQ-2.
- Jobs: M-032 … M-046, M-131, M-205, OD2, U26, OQ-6i.
- Browsing: M-050, M-051 (fallback), M-052, M-053 (U8 for now), M-059 (removal), M-132, M-137, U8, U25.
- Discovery: M-024, M-026, M-029, M-054 … M-056, M-079 … M-081, M-167 (publish lock), M-184, M-187, M-201, M-202, OD4, U7 (population), U19, U28, OQ-6a, OQ-6f.
- Contradictions: C3, C7, C9, C10, C24.

**Prep.** P11, part 2: KYC PDF and PNG; an SVG containing `<script>` and an `onload` attribute.

**Tasks**

1. `companies` and `kycdocuments`. Onboarding endpoints and screens:
   - step 1: details only;
   - step 2: company, with the EU 27 + UK country, which sets the picker country and the default language unless explicit;
   - step 3: KYC uploads, locked after submit;
   - step 4: on-screen phone code, then submit;
   - step 5: status page for pending, rejected (reason + Resubmit) and suspended.
   Delete `useOnboardingState` and the onboarding mock data.
2. Admin Account review on the server:
   - list pending recruiters (oldest first) and suspended ones (OQ-2);
   - detail per §3.12;
   - Approve, Reject or Suspend with a reason, and Approve on a suspended account;
   - effects: status, tokenVersion, default stages on first approval, emails, audit.
3. Company page (M-147) and logo (dompurify + jsdom for SVG; a letter tile coloured from the id).
4. Jobs: model, service and endpoints:
   - wizard server draft after step 1, quality-check rules, publish validation with `step`;
   - statuses, the Closed tab and order; delete drafts only; edit live;
   - skill suggestions; salary currency locked by country (EUR for Remote) with the period; languages and sponsorship; Remote eligible countries (OQ-6i);
   - `firstPublishedAt`; the restricted lock respected.
   Recruiter Jobs list and details: "N relevant" via the fallback.
5. Candidate browsing:
   - Find jobs: visibility (M-044), picker and Remote view (OD2), filters including salary (U25), keyword rules, sort, pagination, eligible-country badge and filter;
   - job details: hide empty sections, the M-043 states, no static perks or premium copy;
   - saved jobs; the Free overlap label (M-052) for every candidate; Overview "Recommended jobs" and For you via U8;
   - remove the page-level AI summary buttons (per-card buttons come in Phase 9).
6. Recruiter discovery:
   - Find candidates: population, country rule, Remote = work preference `remote`, filters (has right to work in country, language + level, Verified, availability), overlap sort;
   - candidate profile tabs (M-026 layout, privacy, ticks per check, certificate badge, records profile views);
   - shortlist, notes, activity (events available now);
   - Resume tab (live CV only when `resumeVisible` or the candidate applied; downloads logged; earlier-version requests with reason and details);
   - candidate side: pending requests on the CV page, approve by choosing a version, or decline; `cv_request` email;
   - compare modal rows (A: recruiter B2);
   - Overview: open positions, shortlisted, recommended (fallback), talent cards (fallback), greeting (M-202); the Compare checkbox removed (M-201).
7. Candidate Overview profile-views KPI (M-184).
8. `seed:demo`:
   - Acme Studio approved for Sarah, with default stages;
   - one approved company with a seeded `@example.com` recruiter for each other company in the mock jobs;
   - the jobs, moved to the U42 cities with OQ-4 rates;
   - James Chen the recruiter applicant (pending, company, generated KYC files);
   - shortlists, notes, activities and profile views from the mocks.
9. Delete: recruiter jobs, company, find-candidates, shortlist, notes and activity mocks and hooks; candidate `jobs.js`, `recruiterJobs.js`, the `jobUtils` search code, and the saved-jobs hook.

**Done when.** A recruiter goes from sign-up to an approved workspace in Chrome. Jobs publish with server validation. Candidates browse by country and Remote. Recruiters discover only allowed candidates. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P4-01 | Onboarding | D, M | A verified recruiter: step 2 with country Germany (the picker becomes Germany; an explicit language is kept) → step 3 identity PDF + registration PNG → step 4 code on screen → submit → "Under review". `/recruiter` redirects to the status page. The API returns `RECRUITER_NOT_APPROVED`. The footer buttons wrap at 375 px. |
| P4-02 | KYC rules | D | 11 MB → error; `.txt` → error. After submit, replacing a document is disabled, and the API returns `LOCKED`. |
| P4-03 | Approve | D, M | The Owner's Account review shows the applicant, the company, "Phone confirmed on screen (no SMS)" and KYC previews → Approve → captured approved email → the recruiter signs in and sees the workspace. The 6 default stages exist (API). |
| P4-04 | Reject and resubmit | D | Reject with a reason → the status page shows it with Resubmit; the reason email is captured. Edit the company, resubmit → pending again. |
| P4-05 | Suspend and reactivate | D | Suspend Sarah with a reason → her session gets 401, and signing in shows the blocked page. Her jobs vanish from candidate Find jobs. Email captured. Approve from Account review → active again, jobs visible again, approved email. |
| P4-06 | Company page | D, M | Edit display name, industry, size, city, website and description; the legal name is read-only. A PNG logo appears on the jobs and candidate cards. An SVG with `<script>` → the served file contains no script or `on*` attribute. 3 MB → error. No logo → a letter tile with the same colour after reload. |
| P4-07 | Job wizard | D, M | A job in Poland: salary currency PLN locked, period month. The draft exists after step 1 and survives a reload. Publishing an invalid draft from the table menu opens the wizard at the first invalid step. A skill in both lists → error. Salary 100,000,001 → error. The quality checks list real rule results. Published job shown in the Published tab. Tab order published, paused, draft, closed. |
| P4-08 | Remote job | D | Remote with eligible PL and DE → country Remote, EUR. It is listed only in the candidate's Remote view, with the "Eligible in" badge. The "Eligible in: Poland" filter keeps it. The Poland view does not list it. |
| P4-09 | Edit live and delete | D | Editing a published title shows the new title to candidates. Delete is offered only on drafts. |
| P4-10 | Find jobs | D, M | Germany: only German on-site and hybrid jobs of approved, unrestricted companies. Remote shows EUR. The salary filter works in the view currency (a monthly job counted ×12). Keyword search follows the rules. A saved job persists. A paused job opened by a saver → "No longer accepting applications"; by others → "no longer available". en + Germany shows en-DE formats. |
| P4-11 | Free label | D | Cards show the overlap label and never a percentage. For you lists jobs sharing at least 1 required skill, ordered by overlap, then recency. |
| P4-12 | Find candidates | D, M | Germany: only email-verified, discoverable, consenting, complete candidates living in DE or with a valid EU right to work. Remote: candidates with work preference `remote`. The right-to-work, language ≥ B2 and Verified filters behave per §3.8. An incomplete or hidden candidate is never listed. |
| P4-13 | Candidate profile and CV request | D | The tabs show the photo, links, ticks, languages, right to work, history, education and certificates. With `resumeVisible` off there is no file; request an earlier version → captured `cv_request` email and a pending item on the candidate's CV page → approve with version 1 → the recruiter opens it → the candidate's download log shows the entry. The activity timeline shows request, decision and download. |
| P4-14 | Shortlist and notes | D | Bookmark → the Shortlists page lists the candidate. The candidate turns discovery off → hidden, with "1 no longer available". A note of 5,001 characters → error; a saved note shows `updatedBy` and the time. |
| P4-15 | Profile views | D | A recruiter opens the same candidate twice in a day → the candidate's Overview profile views rise by 1. |
| P4-16 | Recruiter Overview | D, M | Open positions and Shortlisted equal the database. No Compare checkbox. The greeting uses the local time of day and the first name. |
| P4-17 | Denials | D | An unapproved recruiter's API calls → 403. A hidden candidate's profile URL → 404. A candidate opening a draft job URL → 404. |

**API tests.** Onboarding state machine; KYC rules; account decisions (all transitions, reactivation, emails, audit, tokenVersion); company edit rules; every job limit, currency locking, Remote rules, status transitions, 422 with `step`, the restricted lock, delete rules; the visibility query; Find-jobs filters (OD2, U25); saved jobs; discovery population (each exclusion), country rule, filters including permit expiry; CV visibility and the request flow; shortlist, notes, activity, profile-view dedupe; skill suggestions.

### Phase 5: Payments, plan, Stripe, entitlements and gates

**Scope.** The plan catalogue in Stripe; subscription Checkout; the webhook and payment records; entitlements in `/me` and in middleware; the Portal; billing; every plan gate and upsell in the UI.

The course-purchase path is built here but verified in Phase 8. AI pages are gated here; their content arrives in Phase 9.

**Decisions.** M-115 … M-130, M-118, M-119 (AI and alerts lock), M-195 (plan subtitle), M-196, C12, C13, C14, C25, U38, U40, OD1, OD8, OQ-4; ordering items 4 and 11.

**Prep.**
- P5 rest: a paid Checkout end-to-end in each currency, done by P5-02.
- P6: the Portal configuration, created by `seed:catalog`.
- P8: `npm run stripe:check-secret` must print `match`.
- P7 is optional; nothing depends on it.

**Tasks**

1. Install `stripe`. `lib/stripe.js`. `seed:catalog` creates the Product, the 8 Prices and the Portal configuration and stores their ids (idempotent). Scripts `stripe:listen` and `stripe:check-secret` (§2.2). Verify: running `seed:catalog` twice creates no duplicates in Stripe; `stripe:check-secret` prints `match`.
2. `subscriptions`, `payments`, `counters`, `stripeevents`. The webhook with every handler (§2.10); the reference sequence; the entitlement rule with `retrying`; `requireEntitlement`; `me.plan` and `me.entitlements`. Verify: API tests.
3. Checkout:
   - `GET /payments/quote` and `POST /payments/checkout-sessions`;
   - the confirm dialog reuses the `CheckoutDialog` shell (A: shared §6);
   - return routes `/candidate/checkout/return` and `/recruiter/checkout/return` (M-125) poll the session, invalidate `Me`, `Subscription`, `Payments` and `Enrollments`, then go back to `from`;
   - delete `payments/utils/card.js` and the demo card form and copy.
4. Candidate Billing: plan and status, period end, cancel-at-period-end flag, subscription currency, "Manage subscription" → Portal session, the payments table from `/me/payments` with receipt links, and the Free upsell.
5. Gates in the UI:
   - `RequirePlan` on `ai-insights/*` and `job-alerts`;
   - plan chips in the sidebar and global search (M-118); the global `PLAN_REQUIRED` handler opening the upgrade dialog;
   - updated PlusGate copy; the promo card (M-196); the onboarding plan step with real Checkout and "You're on Plus" (M-129);
   - the profile-menu plan subtitle.
6. Emails `renewal_failed` and `plan_ended`.
7. `seed:demo` (OD8, OQ-4):
   - Emma's real Stripe test customer and subscription with `pm_card_visa`, in her picker country's currency, tagged `seed` and `db`;
   - the paid mock payments as `source: seed` rows; one historical Plus row for each other seeded applicant;
   - re-seeding deletes only this database's Stripe seed objects.
8. Delete: `lwm.candidate.subscription`, `useSubscription`, the `PLANS` constants, `usePayments` localStorage, `SEED_PAYMENTS`.

**Done when.** A Free candidate subscribes in every currency through hosted Checkout in Chrome. Webhooks create the correct rows exactly once. Lapse locks and unlocks correctly whatever the Stripe final retry action. Gates show and enforce. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P5-01 | Upgrade | D, M | Free candidate, picker Poland, opens AI insights → the gate shows the Plus price in PLN (45) formatted for en-PL. Upgrade → confirm dialog (item, price, currency, "Continue to secure payment") → hosted Checkout shows PLN 45.00, card and Link only, in the user's language → pay with 4242 → the return page polls → back on AI insights, unlocked. The database has an active subscription and one paid `LWM-` row with a receipt link. Billing shows PLN and the renewal date. |
| P5-02 | Every currency | D | Repeat with fresh Free candidates in Germany (EUR), UK (GBP), Sweden (SEK), Denmark (DKK), Czechia (CZK), Hungary (HUF), Romania (RON) and Remote (EUR). Each Checkout and each stored row has the requested currency and the OD1 amount (C14, P5). |
| P5-03 | Portal cancel | D | Billing → Manage subscription → Portal shows cancel, card update and invoices, and no plan switching. Cancel → back → Billing shows "Ends on {date}"; still Plus. |
| P5-04 | Renewal failure (Test Clock) | D | A harness helper creates a test-clock customer with card 0341 and links it to a candidate. Advance past the period end → `past_due` + `retrying` → still Plus; a failed row; `renewal_failed` captured. Advance through the whole retry schedule → Free (whether Stripe cancels, marks unpaid or leaves past due) → `plan_ended` captured → AI page locked. |
| P5-05 | Refund | D | Refund a payment through the Stripe API → `charge.refunded` → the row shows "Refunded" in Billing. |
| P5-06 | Idempotency | D | Resend a processed event with `stripe events resend <id> --api-key …` → no duplicate row. |
| P5-07 | Promo card | D, M | Free → upsell with the local price. Plus but incomplete → "Complete your profile" to the checklist. Plus and complete → hidden. A subscriber whose picker changed sees the subscription currency. |
| P5-08 | Onboarding plan step | D | A subscriber sees "You're on Plus"; Continue does not cancel. |
| P5-09 | Lock chips | D, M | Free: chips on AI insights and Job alerts in the sidebar and in global search. Plus: no chips. |
| P5-10 | Re-seed | D | `seed:demo` twice → Stripe has exactly one seed customer for `eujobs_test` (searched by metadata). Emma shows Plus. |

**API tests.**
- The entitlement table: every Stripe status × `retrying`.
- Webhook: bad signature → 400; idempotency on `eventId`; each handler with constructed payloads (subscription create, update, delete; `invoice.paid` as first and renewal; `invoice.payment_failed` with and without `next_payment_attempt`; `charge.refunded`; course checkout creates an enrollment).
- The reference sequence under concurrency.
- Currency rules (picker, Remote = EUR, display in the subscription currency); quotes equal to OD1 for all 8 currencies.
- Session parameters (card + Link, adaptive pricing off, locale, currency).
- The Portal only for subscribers; `requireEntitlement` returns 402 for Free.
- Seed cleanup scoped by database.

### Phase 6: Applications and pipeline

**Scope.** The apply gate and dialog; candidate Applications; the recruiter Applications table, board, stages and reject; status and new-application emails; recruiter Overview hiring numbers; counters (unread messages count is real and stays 0 until Phase 7).

**Decisions.** M-043, M-069 … M-078, M-082, M-083, M-090, M-091, M-094 (applications part), M-095, M-119 (applications after lapse), M-170, M-178, OD5, OD14, U13, U33, OQ-6e, C8.

**Prep.** None.

**Tasks**

1. `applications` and `pipelinestages`. Apply (the gate in one request), withdraw, re-apply as a new record, status history, the "Next step" text per status (i18n).
2. Candidate UI:
   - every Apply button calls the gate (A: candidate D2 list);
   - the gate modal lists missing items with links, plus Upgrade;
   - the apply dialog (M-073);
   - the Applications page (statuses, dated history, withdraw, re-apply);
   - the active-applications badge through `/me/counters` polled every 15 s, paused in hidden tabs.
3. Recruiter UI:
   - Applications table (Job, Applied, job filter, Withdrawn and Not selected filters); remove "Candidate portal activity";
   - board with one card per application and a job filter; stage select per application;
   - Manage stages with a category select (M-072, OD5);
   - the reject dialog with "Email the candidate" (M-090); undo through the stage select (OQ-6e);
   - job details: the applicants list.
4. Status mapping and history; scheduled tasks `email.stage` and `email.new-applications`; emails `application_status`, `application_rejected`, `new_applications`; activity events `applied`, `withdrawn`, `stage_changed`, `rejected`.
5. Recruiter Overview: the Applications KPI (M-082), the funnel over the company's stages ever reached (M-178), momentum with this week and last week in the browser time zone (M-083, M-170).
6. `seed:demo`: applications from the mock `pipeline.js` placements with coherent stage histories; the applicants are complete and have their OQ-4 payment history.
7. Delete: candidate `applications.js` and `useApplications`; recruiter `pipeline.js`, `usePipeline`, `useLiveApplicant`; the overview mock numbers.

**Done when.** The gate, applying, stage moves, rejection and withdrawal work end-to-end in Chrome, with the correct delayed emails. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P6-01 | Gate, Free and incomplete | D, M | Alex clicks Apply → the gate lists the missing items with links and "Upgrade to apply"; Apply is disabled. |
| P6-02 | Gate variants | D | Plus but incomplete → only the missing items. Free but complete → only the upgrade. Direct API calls → 402 and 403 with `missing`. |
| P6-03 | Apply | D, M | Emma: dialog with CV version (live by default); a cover note of 2,001 characters → error; consent required → submit → Applications shows "Applied" with a dated history; the sidebar badge updates within 15 s. Tick +1 h → the recruiter gets "1 new application for {job}". A second application to the same job within the hour → no email until the hour passes, then "{n} new applications". |
| P6-04 | Stage emails | D | The recruiter moves Applied → Screening → Shortlisted within 10 min. Tick +10 min → exactly one "Under review" email. Interview → "Interview" email. Interview → Screening → Interview within 10 min → no email. |
| P6-05 | Reject and undo | D, M | Reject with the box checked → the card leaves the board and shows under the "Not selected" filter. Within 10 min, a stage chosen again in its stage select → no email. Reject again with the box unchecked → no email. Reject with it checked → after 10 min the email arrives in the candidate's language (an es candidate gets Spanish). |
| P6-06 | Withdraw and re-apply | D | The candidate withdraws → the recruiter sees it under the Withdrawn filter and badge, off the board. Re-apply → a new record; the old one stays withdrawn. |
| P6-07 | Manage stages | D, M | Add "Portfolio review" (category screening), rename it, reorder it ("Applied" stays first). Deleting a stage with active applications → blocked message. A 13th stage → blocked. A 25-character name or a duplicate (case-insensitive) → error. History keeps the old names. |
| P6-08 | KPIs and charts | D | The Applications KPI equals the database count of active applications. The funnel lists the company's stages with ever-reached counts. Momentum buckets follow the browser time zone (CDP time-zone override) with Monday weeks. |
| P6-09 | Lapse | D | Emma's subscription canceled → the existing application stays active and can be withdrawn; Apply elsewhere shows the upgrade. |
| P6-10 | Toggle off | D | The candidate turns emails off → no status emails (EmailLog `skipped_toggle`). |
| P6-11 | Job closed | D | The recruiter closes the job → the applicant's job page shows "No longer accepting applications"; the application is still listed. |

**API tests.** The gate matrix (plan × completeness × job state); duplicates and the partial unique index; withdraw and re-apply; stage rules (M-072) and category mapping; history; U13 collapse with tick(now); rejection undo; OD14 batching; counters; KPI, funnel and momentum aggregations with time zones.

### Phase 7: Messaging, counters and job alerts

**Scope.** Two-way messages for both roles, with the unread badge and the email; job alerts with instant and digest delivery. "Translate" per message arrives in Phase 9; "Report message" in Phase 10.

**Decisions.** M-084 … M-089, M-093, M-094, M-096 … M-098, M-118, M-119, M-180, U12, U13, U28, U35, OD9.

**Prep.** None.

**Tasks**

1. `conversations` and `messages`, with the rules of §3.5. New screens (OD16): `/candidate/messages`, `/candidate/messages/:conversationId`, `/recruiter/messages`, `/recruiter/messages/:conversationId`, plus a "Messages" sidebar item for both roles.
2. Recruiter side: the `MessageModal` on the candidate profile sends a real first message with the default i18n template (M-088) and records `outreach` activity (M-180).
3. Candidate side:
   - a paid candidate can start a conversation from an application or the job of a company applied to;
   - Free candidates read only, with an upgrade prompt in place of the composer (M-118).
4. Read marking; `/me/counters` returns unread messages (both roles); badges are hidden at 0. The `email.message` task and the `new_message` email follow U13.
5. Job alerts:
   - `jobalerts` and `alertmatches`; CRUD with limits;
   - the page is plan-gated and shows a "Paused" state while Free (M-119);
   - matching (M-098, U35, translated labels); `alerts.instant` on first publish (M-097);
   - daily and weekly digests at 08:00 in the user's time zone (U12);
   - emails `alert_instant`, `alert_daily`, `alert_weekly`.
6. `seed:demo`: a few threads that match the mock outreach activity; alerts from `alerts.js`, moved to the U42 cities.
7. Delete: `job-alerts/data/alerts.js` and `useJobAlerts`; the device-only outreach text.

**Done when.** Messaging works both ways with correct gating, badges and email timing. Alerts send at the right times with the right jobs. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P7-01 | Recruiter outreach | D, M | Sarah opens a discoverable candidate → Message → the default template in Sarah's language → send → the thread is in her inbox. Alex (Free) sees the badge within 15 s, opens the thread and reads it. The composer is replaced by the upgrade prompt. The badge clears. |
| P7-02 | Plus reply | D | Emma replies → the recruiter badge increments; reading clears it. |
| P7-03 | Email timing | D | A message stays unread. Tick +14 min → no email; +15 min → `new_message` in the recipient's language. A second message 20 min later, also unread → no email (within 60 min); tick +61 min → email. |
| P7-04 | Candidate start rule | D | Emma can start a conversation with a company she applied to. The API refuses another company with 403. |
| P7-05 | Recruiter limits | D | No Message button for a non-discoverable non-applicant, and the API returns 403. After a candidate hides, the existing thread works both ways; a new thread is refused. |
| P7-06 | Plan invisibility | D | The recruiter thread with Alex shows nothing about his plan. |
| P7-07 | Polling pause | D | Background tab → no `/me/counters` requests (CDP). Visible again → polling resumes. |
| P7-08 | Instant alert | D, M | Emma creates "designer" (instant) with the picker on Germany. A recruiter publishes a matching German job → tick → captured email lists the job. Pausing and resuming the job, and editing it → no second email. |
| P7-09 | Digest | D | A daily alert, user time zone Europe/Madrid. Tick at 07:59 local → nothing; 08:00 → a digest of jobs first published since the last one. The next day with no new jobs → no email. |
| P7-10 | Keyword rule | D | "react senior" matches only jobs containing both words in the listed fields. An es-language alert matches through the Spanish level label. |
| P7-11 | Gating and lapse | D | Free → Job alerts locked with the chip and gate. A lapsed Plus candidate sees alerts as "Paused" and gets no emails; after re-subscribing, delivery resumes. |
| P7-12 | Limits | D | An 11th alert → error. A name of 81 characters → error. A message of 2,001 characters → error. |

**API tests.** The start and reply matrix (role × plan × applied × discoverable × hidden after a thread exists); the 2,000-character limit; unread counts and read; U13 scheduling; alert CRUD and limits; matching (fields, translated labels, country including Remote); first publish only; digest scheduling with luxon time zones; lapse pause.

### Phase 8: Learning

**Scope.** The admin course builder and Courses page; the learner catalogue, purchase, lesson viewer, quiz, certificates and public verification; recruiter learning; rule-based suggestions.

**Decisions.** M-099 … M-114, M-130 (course prices), M-207, M-209, C18, C24, U15 … U17, U24, U42, OD1, OQ-3.

**Prep.**
- P9, server part: Inter and Manrope TTF with Latin Extended in `server/assets/fonts`.
- P11, part 3, made by `e2e/fixtures/make.js` in Chrome:
  - a ~30 s WebM through `MediaRecorder` on a canvas stream;
  - an MP4 the same way if Chrome supports `video/mp4;codecs=avc1`, otherwise a small CC0 H.264/AAC MP4 downloaded;
  - a synthetic 501 MB file with an MP4 header for the size test.

**Tasks**

1. `courses` (with lessons and quiz embedded), `enrollments`, `quizattempts`, `certificates`. Admin routes `/admin/courses/new`, `/admin/courses/:id/edit` (full-page builder, M-101; tabs Details, Lessons, Quiz, Preview) and `/admin/courses/:id/learners`:
   - uploads with progress; video duration read in the browser and editable;
   - Markdown with the server preview (marked + DOMPurify); https links only; the free-preview flag; skill tags; the recruiter-course pipeline category (OQ-3);
   - 8 prices or Free; publish validation (U24, quiz rules, at least 1 lesson);
   - lock after the first enrollment; unpublish;
   - the admin Courses list and stats (M-111, Revenue only with `finance.view`);
   - Learning audit events.
2. Learner pages, candidate and recruiter:
   - catalogue with prices in the picker currency and no tiers; course details with the derived "Included" list and curriculum states;
   - free-preview lessons; free enrol; purchase through the Phase 5 Checkout (`kind: course`; recruiters buy for themselves);
   - lesson viewer `/…/learning/:courseId/lessons/:lessonId` (video through a signed URL with 15 s heartbeats; text, PDF and link complete on open);
   - quiz `/…/learning/:courseId/quiz`; the certificate block (PDF, code, URL);
   - "Certificates & badges" on My profile; recruiter learning stats; suggestions (OQ-3).
3. Certificates:
   - pdfkit + qrcode with the embedded fonts, in the holder's language, stored as a snapshot;
   - the public `/certificates/:code` page (public layout with a language picker, 30/min/IP);
   - re-issue on a name change; admin revoke from the learners list (audited); the `certificate_issued` email.
4. `seed:demo`:
   - 12 courses from the learner catalogues (M-207), each with 3 English Markdown lessons (300–600 words) and 5 single-choice questions;
   - OD1 prices; covers from client assets; skill tags and pipeline categories taken from each course's category or stream;
   - enrollments that match the seed payments (Alex: course 1 with lesson 1 done; Sarah: course 1 with lesson 1 done).
5. Delete: the candidate and recruiter learning mocks and hooks, the admin courses mock, `learnerCourse.js`, `CourseFormModal`, the "Mark complete" toggles, and `PurchaseDialog`'s demo copy.

**Done when.** An admin authors and publishes a course. Learners buy, complete, pass the quiz and get a certificate that verifies publicly. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P8-01 | Builder | D, M | Create a candidate course: Details (all learner fields, cover JPG); prices with HUF missing → publish blocked with the reason. Lessons: MP4 upload with progress and auto-filled duration (editable); a text lesson whose Markdown has `<script>` and a `javascript:` link → the preview is sanitised; an `http://` link → error; a PDF; an https link; lesson 1 flagged as free preview. Reorder by drag and by keyboard. Quiz: 5 questions (single and multiple); 1 option → error; no correct option → error. Publish → listed in the candidate catalogue. |
| P8-02 | Upload limits | D | 501 MB video (localhost) → `FILE_TOO_LARGE`. 51 MB PDF → error. 6 MB cover → error. |
| P8-03 | Catalogue | D, M | Poland view → prices in PLN; Free courses say "Free"; no Included or Plus tier badges. The preview lesson opens without buying; the others are locked. |
| P8-04 | Purchase | D | A candidate in Germany buys → confirm → Checkout in EUR → return page → enrolled. The row appears in Billing with a receipt link. |
| P8-05 | Completion | D, M | A text lesson completes on open; a PDF on open; a link on click-through. A ~30 s video played at 1× completes at about 90%. Seeking to the end does not complete it. 2× speed credits at most 2×. |
| P8-06 | Quiz | D, M | Locked until every lesson is complete. A wrong submission → score shown without correct answers; options reshuffled on retry. A pass ≥ 70 → certificate issued; the best score kept; `certificate_issued` captured. |
| P8-07 | Certificate | D, M | A user named "Łukasz Żółć" downloads the PDF: the diacritics render, the course title is as authored, the date is in his language, with the code and QR. `/certificates/:code` signed out → Valid with name, course and date. The 31st request in a minute → rate-limited. The admin revokes it → Revoked. A name change → re-issued PDF with the same code. |
| P8-08 | Lock and unpublish | D | Lesson and quiz editing is disabled once learners exist, with the reason shown; copy and prices still save. Unpublish → hidden from the catalogue while the buyer keeps access. |
| P8-09 | Recruiter learning | D | Sarah buys a recruiter course (personal). The stats show in progress, certificates and streams. Suggestions follow OQ-3 with real numbers in the reason. |
| P8-10 | Candidate suggestions | D | "Suggested for you" lists courses tagged with the candidate's gap skills (OQ-3). |
| P8-11 | Badge visibility | D | The certificate shows on My profile and on the recruiter's view of the candidate. A non-discoverable candidate who applied still shows it to that company (C24). |
| P8-12 | Admin list | D | Rows "{enrolled} enrolled, {purchased} purchased, {completions} completed". Revenue per currency only with `finance.view`. Page totals and the learners list are correct. |

**API tests.** Course validation and publishability (U24, quiz limits); the lock rules; lesson access (enrolled, preview, signed URL); heartbeat crediting (U15: wall clock, rate, seek); completion; quiz (unlock, single and multiple scoring, shuffle, best score); certificate code uniqueness, PDF with embedded fonts, public rate limit, revoke, re-issue; M-110 and M-111 numbers; OQ-3 suggestions; the purchase webhook creating an enrollment once.

### Phase 9: Matching and AI

**Scope.** Embeddings, policy versions, scores, relevance and recommendations, which replace the Phase 4 interim rules. Every OpenAI feature. The admin AI & matching page.

**Decisions.** M-047 … M-068, M-088 (translate), M-113 (translate), M-117, M-144, U3 … U7, OD13, C6, C11, C23, OQ-6g; ordering item 9.

**Prep.** P13: check the storage headroom for about 12 KB per embedding.

**Tasks**

1. Install `openai`. `lib/ai.js` (§2.9), `aicaches`, `aiusages`, the cap, `AI_UNAVAILABLE`.
2. `embeddings`: the U6 recipe; triggers on profile, CV, consent and job changes; a backfill command run by `seed:demo`.
3. `matchingpolicies` and versions; default v1 in `seed:catalog` (U5 weights and thresholds, all signals on). The score service (U5 with OQ-6g) and `matchresults` per policy version. Relevance (M-051, U7: on job save, nightly at 03:00, startup catch-up).
4. Display:
   - Plus candidate cards: score, label and explanation disclosure; For you and Recommended by score ≥ Good (M-053);
   - recruiter Recommended sort, talent cards and Recommended KPI by score, never exposing a number (C6);
   - admin oversight with %.
   The Phase 4 fallback stays only for jobs or candidates without an embedding (M-051).
5. OpenAI features (U4 models):
   - job AI summary on each candidate card and row (Plus), recruiter job rows, and admin with Regenerate;
   - match explanations and insight narratives (code evidence + narrative; the invented gap texts removed);
   - AI insights pages: overview, role picker (M-063), skill gap with "I have this skill" (M-064), improve profile, job match with "Save this opportunity" (M-065), why recommended with feedback (M-067), skill demand (M-066);
   - recruiter Match insights;
   - CV snapshot proposal and confirm (M-027); assisted draft (M-061); profile AI summary (M-062);
   - Translate (M-144: job brief, responsibilities, company About, candidate about, work descriptions, messages, course text, outreach).
6. Admin AI & matching page: policies (create, edit name and description, at least 1 signal, archive drafts, versions, activate → recompute); the policy suggestion (`OPENAI_MODEL`); oversight (job picker, top 4, evidence); feedback aggregates; AI status (models, last success).
7. Delete: `ai-insights/data/insights.js`, `useInsightsState`, `ai-insights/utils/matching.js`, recruiter `matchEvidence` fake texts, the AI summary templates, the admin `matching.js` mock and `useMatchingPolicies`.

**Done when.** Scores, labels and relevance are real and policy-driven. Every AI feature works in en/es/fr with caching and the cap. Recruiters never see a number. Lint, build, tests and sweep are green.

**Browser verification** (real OpenAI)

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P9-01 | Candidate scores | D, M | Plus cards show Strong or Good and a score. The explanation shows code evidence plus a narrative in the user's language. Switching to fr → a French narrative (a new cache entry). Free cards show the overlap label only, never a number. |
| P9-02 | For you | D | Plus: jobs in the picker country with score ≥ Good, ranked; "+N this week". |
| P9-03 | Recruiter view | D, M | The Recommended sort follows the scores. Talent cards. Expanding Match insights → evidence (skills, years, work mode, languages, right to work) plus a narrative. No percentage anywhere in the recruiter DOM, and API responses carry no score field. |
| P9-04 | Relevance | D | A job's "N relevant" equals the population with score ≥ Good. Editing the brief recomputes the embedding and the count. A tick at 03:00 runs the nightly job; after 25 h with the server off, startup catches up. |
| P9-05 | Policy | D, M | Create a draft, switch "experience" off (weights renormalise), activate → scores recompute; the history shows v1 and v2. Archive a draft. Switching every signal off is refused. "Suggest" fills the description. |
| P9-06 | Oversight and feedback | D | The admin picks a job → top 4 with % and evidence. A candidate clicks "Helpful" → the aggregate counts it. |
| P9-07 | Insights pages | D, M | The role picker offers top 10 + saved + applied and defaults to the top one. "I have this skill" adds the skill; a 13th is refused. "Save this opportunity" adds to saved jobs. Feedback is stored. Every narrative is in the user's language. Free → gate. |
| P9-08 | Job summaries | D | Per card (Plus), per row (recruiter), and the admin page with Regenerate. The second open is a cache hit: no OpenAI call and the cap unchanged. |
| P9-09 | CV AI | D | Plus upload → snapshot proposal; the profile is unchanged until Confirm. The assisted draft gives suggestions and a revised snapshot with no file; the pending draft can be deleted. Free → locked. |
| P9-10 | Translate and profile summary | D | Plus translates a German brief and a message. A recruiter translates a candidate's about for free. Free candidate → locked. The profile summary can be copied. |
| P9-11 | Cap | D | `aiusages` set to 50 via `/_test/db` → the next generation shows the friendly limit message. Cache hits still render. Admins are unaffected. |
| P9-12 | AI failure | D | `/_test/ai/fail-next` → a friendly fallback message; the code evidence still shows. |
| P9-13 | Consent off | D | A candidate turns matching consent off → gone from Find candidates and the relevant counts; their job cards show no score. |

**API tests.** The U5 formula (renormalisation, OQ-6g location cap, thresholds); policy versions and recompute; relevance population and nightly catch-up; cosine on Float32 buffers; embedding text and truncation; cache keys and invalidation (entity version, language, profile hash); cap counting (U3, admin exempt); recruiter and Free DTOs never carrying a score; consent exclusion; `AI_UNAVAILABLE`. OpenAI is stubbed in these tests.

### Phase 10: Admin

**Scope.** Every remaining admin area: access enforcement and its UI; user tables and details; jobs, applications and recruitment; overview, analytics and reports; audit; payments admin; content moderation with Report buttons.

**Decisions.** M-013 (photo removal), M-046, M-123, M-138, M-154 … M-167, M-169 … M-183, M-206, OD6, OD7, U9 … U11, U20, U21, U23, U34, OQ-1, OQ-2, OQ-5, OQ-6d, OQ-6f.

**Prep.** P11, part 4: a voice note. Reuse the P4 audio file (ask the owner for its path). If it is not available, generate a short spoken MP3 once with the OpenAI speech API.

**Tasks**

1. Access management:
   - roles: create, duplicate, edit through the prefilled dialog, archive (blocked while assigned);
   - user access, admin staff only; invites (U21) with `/admin/set-password`;
   - Owner and lock-out rules (M-160);
   - hide the sidebar, search and page actions per `me.permissions`; a 403 page (OD16).
2. Users:
   - Candidates and Recruiters tables: M-161 columns and filters, M-169 states, country filter, server pagination, audited CSV export with OQ-6d labels;
   - detail pages `/admin/candidates/:id` and `/admin/recruiters/:id` (profile, verification, plan, applications, history; documents through `documents.view`);
   - "Manage" opens the detail page.
3. Jobs (all statuses and a filter; "Open case" from a job), Applications (pagination, export), Recruitment (data view and funnel by category; OD5, M-178, M-179).
4. Overview and Analytics:
   - the §3.15 metrics with OQ-5;
   - the charts (M-170, M-171) and "All time" captions (M-177);
   - recent activity = the latest 5 audit events.
5. Reports (M-181 … M-183, U23): type, period (this week, last week, last month), a brief ≤ 500, a voice-note attachment (≤ 25 MB) → transcription (`OPENAI_TRANSCRIBE_MODEL` with the `whisper-1` fallback) and an executive summary in the admin's language → CSV in the U23 layout, stored as a snapshot; "Download again" returns the same bytes; audited.
6. Audit logs (M-162, M-163): category chips including Learning, Payments and Jobs; actor types; pagination; audited export.
7. Payments admin (M-122, M-123, U34): rows including renewals, failures and refunds; details with subscription status and period; Active subscribers and MRR per currency; the Plan column and filter on Candidates; export.
8. Moderation content:
   - Report buttons on job details, the recruiter's candidate profile view, the company section and messages (U20 limits);
   - the case list and detail; Dismiss or Restrict on jobs and profiles (M-167), including photo removal;
   - company and message cases offer Dismiss only, and the message excerpt is the reported message plus 5 earlier ones (OQ-1);
   - the `content_restricted` email; the summary counts.
9. `seed:demo`: moderation cases and audit history from the mocks (`auditEvents.js`, `moderation.js`); roles.
10. Delete: the remaining admin mock data (overview, analytics, recruitment, access, moderation, audit events, reports, users) and `utils/downloadCsv.js`.

**Done when.** Every admin page shows real data and enforces permissions on both API and UI. Reports, exports and moderation work end-to-end. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P10-01 | Invite and permissions | D, M | The Owner invites a Staff admin → the captured invite opens `/admin/set-password` → sign in → the sidebar and search show only permitted pages. A direct URL to Payments → 403 page; the API → `PERMISSION_DENIED`. |
| P10-02 | Roles | D | A 41-character name, a duplicate name (any case) and 0 permissions each → error. Duplicate, edit. Archive with users assigned → blocked; archive an unused role → archived. |
| P10-03 | Lock-out | D | The Owner cannot be revoked. An admin with `roles.assign` cannot remove their own `roles.assign`. |
| P10-04 | Users | D, M | The Candidates table shows Country, Right to work, Verification (Not started, In review, n of 3 verified, Verified), Completeness % and Plan, with filters, pagination and the country filter. The CSV export has a BOM and headers in the admin's language, and an audit event. "Manage" opens the detail page with every section. Recruiters show Pending, Approved, Rejected or Suspended. |
| P10-05 | Overview and Analytics | D, M | Every KPI equals an independent count from `/_test/db`. "Average role match" is captioned "Across {n} published roles". Charts show real counts for this week, last week and last month in the browser time zone. KPIs say "All time". The country filter changes the numbers. |
| P10-06 | Recruitment | D | Stage counts by category. The funnel uses ever-reached counts without withdrawn applications, in the fixed shapes. |
| P10-07 | Reports | D | "Marketplace summary", last week, with a brief and the voice note → a transcript and an executive summary in the admin's language → a CSV with the U23 layout → a history entry. "Download again" returns identical bytes (hash). Both actions are audited. |
| P10-08 | Audit | D | Chips include Learning, Payments and Jobs. Actor types are admin, user and system. A recruiter job status change, a CV download and a KYC submission are listed. Export is audited. |
| P10-09 | Payments | D, M | Rows include a renewal, a failed payment and a refund. Details show the subscription status and period. Active subscribers and MRR show one line per currency, at most 3, then "+n more". |
| P10-10 | Moderation | D, M | A candidate reports a job (scam_or_fraud; details of 501 characters → error) → a case appears. A second report on the same job by the same user → refused. An 11th report in one day → limited. Restrict → the job is paused and locked, the recruiter sees the reason and cannot republish, and gets an email. Dismiss lifts it. A profile report → Restrict hides the profile from discovery; the photo can be removed. A message report shows only the 6-message excerpt. A company case offers Dismiss only. |
| P10-11 | Jobs admin | D | All statuses with the status filter. "Open case" from a job row creates a case. |

**API tests.** The permission matrix for every admin route, generated from the route table; Owner and lock-out rules; role validation and archive; invites (expiry, single use); user filters and pagination; each metric with fixtures (OQ-5); report generation, snapshot and transcription fallback (stubbed); audit categories and actor types; audited exports; moderation limits, one open case, and the restrict and dismiss effects; payments KPIs per currency.

### Phase 11: Translations (es, fr), formats and long-text layout

**Scope.** Complete Spanish and French for every UI string, every Intl format, and the layout fixes for long translations listed in A: shared §12.13.

**Decisions.** S (en/es/fr for all UI text), M-133, M-141 … M-143, M-193 (tagline kept), M-194, OQ-6b, U43.

**Prep.** None.

**Tasks**

1. Scan for any remaining literal UI string (the A: shared §12.15 method) and move it to en keys. Translate every namespace into es and fr with one glossary: "Local WorkMan", "AI Job Portal" and "Plus" stay untranslated.
2. Plurals (A: shared §12.12); Intl everywhere (no `en-US`, `£`, `$` or hand-made formats); weekday and month labels through Intl; locale-aware `localeCompare`; accent-insensitive search and filters.
3. CSS fixes (A: shared §12.13):
   - remove `text-transform: capitalize`;
   - let Modal footers wrap;
   - fix ViewToggle and SegmentedTabs overflow;
   - fix StatCard values and PageTitle actions;
   - let StepFooter wrap;
   - ellipsis on Sidebar labels;
   - Dropdown max-height; the ProfileMenu list;
   - AuthLayout heights; Checkbox alignment.
4. Review the server texts (emails, PDF, CSV) in es and fr for terminology.

**Done when.** No missing keys and no English leftovers in es or fr; formats are correct per locale; no overflow at 375 px. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P11-01 | Sweep in es and fr | D, M | Every route for every role: zero missing keys, zero 375 px overflow. The English-leftover check (rendered text equal to an en value longer than 3 words, except the allowlist) finds nothing. |
| P11-02 | Formats | D | Samples on Billing, Find jobs and admin Payments in en-DE, fr-BE, es-ES and en-IE (Remote). HUF whole amounts show 0 decimals. StatCard counts read "12 345" in fr. |
| P11-03 | Long labels | M | fr dialogs with long buttons (the checkout confirm) wrap. Sidebar labels show an ellipsis. Tabs and toggles scroll or wrap. The recruiter onboarding footer wraps. |
| P11-04 | Server texts | D | One captured email of each type for an es user and an fr user, plus a certificate PDF in each language, read correctly. |
| P11-05 | Search | D | Global search finds "Paramètres" by typing "parametres". Help search is accent-insensitive. |

**API tests.** The server dictionaries have every en key in es and fr; CSV header localisation.

### Phase 12: GDPR export and erasure, retention, full regression

**Scope.** Data export, candidate erasure, recruiter deletion, the retention sweep, removal of the last demo leftovers, the static-data audit and the full regression.

**Decisions.** M-185 … M-190, OD15, U29 … U32, C18, OQ-6k; S ("Delete my data" is real, "Reset demo" is removed).

**Prep.** None.

**Tasks**

1. Export ZIP (archiver):
   - candidate: JSON of every own record plus CV files, photo and certificate PDFs, with no recruiter notes;
   - recruiter: JSON of account, company, jobs, notes, messages and payments, plus a CSV summary (OQ-6d).
2. Candidate erasure (§3.16) and recruiter deletion (§3.16, OQ-6k). Both require the password; Stripe is cancelled and deleted; the cascade covers every collection in §4.2.
3. The `retention-sweep` daily job (M-186, U32, certificate files exempt).
4. Remove "Reset demo", `candidate/settings/utils/localData.js`, the recruiter reset code, `useSharedLocalStorage` and any leftover mock.
5. A static-data audit script (`e2e/audit-static.js`). It must find nothing:
   - `useLocalStorage(` outside the four allowed sites (§2.15);
   - mock `data/` files;
   - currency symbols and `en-US` in code;
   - hard-coded demo names.
6. The full regression: every phase scenario plus the cross-role scenarios below.
7. Update the README facts (how to run the server, client, seeds and tests; the client no longer uses mock data).

**Done when.** Every scenario of every phase passes in one run, the static-data audit is clean, and lint, build and tests are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P12-01 | Candidate export | D | Data & account → Export → a ZIP with JSON (profile, applications, messages, payments, alerts, enrollments) plus the CV, photo and certificate files; no recruiter notes. |
| P12-02 | Candidate erasure | D, M | "Delete my data" with the password → signed out; signing in fails. For the recruiter: the application is gone, the thread shows "Deleted user", the shortlist count changes, the notes are gone. The certificate page says "No longer valid". Admin Payments shows the payer as "Deleted user". In Stripe the subscription is canceled and the Customer deleted. Audit entries show "Deleted user". |
| P12-03 | Recruiter deletion | D | Jobs closed. Candidates' applications and threads show the company display name. The KYC files are gone from disk. Payments are kept. The company's notes, shortlist and activity are gone. |
| P12-04 | Retention | D | Approved evidence with `decidedAt` shifted back 31 days → tick at 03:00 → the file is deleted from disk and the decision kept. Certificate files are untouched. |
| P12-05 | Full sweep | D, M | Every route × every role × en/es/fr: no console errors, failed requests, missing keys or overflow. |
| P12-06 | Cross-role journeys | D, M | (1) A new fr candidate signs up, verifies, onboards, completes the profile, gets approvals, subscribes in EUR, applies; the recruiter moves stages; fr emails arrive; they message; the recruiter rejects; the candidate sees "Not selected". (2) A new recruiter signs up, is approved, publishes; a Plus candidate gets the instant alert and applies. (3) The admin restricts that job → candidates see "no longer available". (4) A course purchase → certificate → public verification. (5) Candidate erasure → every view stays consistent. |
| P12-07 | Static audit | — | `node e2e/audit-static.js` reports 0 findings. |

**API tests.** Export contents for both roles; the erasure cascade (one assertion per collection); the recruiter deletion cascade; the retention sweep; tombstones; Stripe calls (stubbed in API tests, real in the e2e).

---

## 7. Prep checklist

| # | Item | Status | Exact steps |
|---|---|---|---|
| P1 | Remove the stale `questions-merged.md` (it contradicted the JSON on M-017 and M-159) | **done** | — (the JSON and `DECISIONS.md` are authoritative; C1) |
| P2 | Uploads folder outside OneDrive | **done** | `C:/eujobs-data/uploads` exists; `UPLOAD_DIR` is set |
| P3 | Missing env vars (`UPLOAD_DIR`, `FILE_URL_SECRET`, `SEED_ADMIN_EMAIL`, `OPENAI_TRANSCRIBE_MODEL`) | **done** | All 22 names are present (§1.3) |
| P4 | One real transcription | **done** | `gpt-4o-mini-transcribe` passed; `whisper-1` is the fallback (OD7) |
| P5 | Stripe currency checks | mostly **done**; rest in **Phase 5** | Done: Checkout in 8 currencies, currency switch on one Customer, Adaptive Pricing off. Remaining: P5-02 pays one subscription per currency end-to-end and checks the stored currency and amount. P8-04 buys a course in a currency other than an existing subscription's; if Stripe refuses, switch to one Customer per currency (U40). |
| P6 | Customer Portal configuration | **Phase 5** | `seed:catalog` calls `stripe.billingPortal.configurations.create` once (cancel at period end, payment-method update, invoice history, no plan switching) and stores the id in `AppConfig('stripe')`. Portal sessions pass that `configuration`. |
| P7 | Failed-payment retry settings | **optional** (not a prerequisite) | The code handles any final retry action (§2.10). Optionally the owner turns on Smart Retries in the Stripe Dashboard's failed-payment settings with final action "cancel subscription". The tests use Test Clocks + card `4000 0000 0000 0341` through the full schedule. |
| P8 | Webhook signing secret | **Phase 5** | `cd server && npm run stripe:check-secret` must print `match` (it runs `stripe listen --api-key <key> --print-secret` without printing anything). On `mismatch`, ask the owner to update `STRIPE_WEBHOOK_SECRET` in `server/.env`. There is no CLI browser login; always use `npm run stripe:listen`. |
| P9 | Fonts | **Phase 2** (client), **Phase 8** (server) | Client: install `@fontsource/inter` and `@fontsource/manrope`, import the weights used, remove the Google Fonts `<link>`. Server: download Inter and Manrope TTF with Latin Extended from the official font repositories into `server/assets/fonts/` and embed them in pdfkit. |
| P10 | Common-password list | **Phase 1** | Download SecLists `Passwords/Common-Credentials/10k-most-common.txt` (MIT) into `server/data/common-passwords.txt` and load it into a Set at startup. |
| P11 | Test fixtures | **Phases 3, 4, 8, 10** | `e2e/fixtures/make.js` writes to `C:/eujobs-data/fixtures`: PDFs and images through pdfkit and sharp; a DOCX zipped with archiver; an SVG with `<script>`; oversized files; WebM (and MP4 where Chrome's `MediaRecorder` supports it) recorded in Chrome; a synthetic 501 MB MP4. Download a small CC0 MP4 only if Chrome cannot record MP4. Voice note: the P4 audio file (ask the owner for its path), or one MP3 made with the OpenAI speech API. |
| P12 | Plus-alias test accounts | **Phase 1** | `seed:demo` derives `<local>+alex@<domain>`, `+emma`, `+sarah` and `+james` from `SEED_ADMIN_EMAIL`. Keep non-critical test sends under the 400/day cap. |
| P13 | Atlas tier and headroom | **Phase 1** (+ Phase 9) | Run `db.stats()` and report the storage used. Ask the owner to confirm in Atlas the cluster tier, free storage (embeddings are about 12 KB each) and that the current IP is on the access list. |
| P14 | Logo file | **not needed** | OD11: crop the existing AI mark; live text in Manrope (Phase 2). |
| P15 | Imprint legal entity details | **before go-live** (§8) | The Imprint stays a marked draft placeholder now (S, OD12). |
| P16 | npm packages | **per phase** | §2.14 lists each package, with the phase that installs it and the resolved duplicates. |
| P17 | cloudflared | **not needed now** (§8) | Installed (2026.8.2). Used only for a later Vercel demo: 100 MB request cap, URL changes each run. |

---

## 8. Out of scope now, or before go-live

| Item | When | Source |
|---|---|---|
| Final legal wording for Terms and Privacy; Imprint legal entity name, address and contact (replace the `2026-11-draft` texts) | before go-live | OD12, M-191, M-197, P15 |
| Legal reviews: the right-to-work filter; recruiter notes in the candidate export; the erasure scope; the 30-day evidence retention | before go-live | OD4, M-056, OD15, M-080, M-188, M-186 |
| Live Stripe keys, VAT handling, Stripe Tax and VAT ids, live receipts | before go-live | M-127, C12 |
| Hosting the API; the Vercel client with `VITE_API_URL`; the public `CLIENT_ORIGIN` | before go-live | M-204, S |
| Regenerate the stored certificate PDFs with the public base URL in the QR code (codes unchanged, like the U17 re-issue) | at the base-URL switch | M-105, ordering item 13 |
| Tunnel demos through cloudflared: video uploads only on localhost (100 MB cap); rate limiting by `CF-Connecting-IP` | when demoing | M-204, C26, P17 |
| A transactional email provider if volume exceeds personal Gmail (about 500/day) | before go-live | C19, OD9 |
| SMS phone verification (codes are shown on screen now) | not in v1 | M-003 |
| Antivirus scanning of uploads | not in v1 | M-185 (rejected option) |
| OCR for image-only PDFs; video transcoding | not in v1 | U18, M-102 |
| Email change in the app | not in v1 | M-010, C21 |
| Notification feed or bell dropdown | not in v1 | M-093, OD6 |
| Server-side global search | not in v1 | M-194 |
| Admin FAQ editor; admin Plans screen | not in v1 | M-200, M-116 |
| Recruiter teams (several recruiters per company) | later | M-145 |
| Sourced candidates in the pipeline; interview scheduling | not in v1 | M-071, M-075 |
| Admin subscription actions (cancel, refund, grant) | not in v1 | M-123 |
| Course archive and delete | not in v1 | M-109 |
| AI outreach drafts; AI course suggestions; AI job quality review | not in v1 | M-088, M-114, M-060 |
| Redis, queues, Docker | not used | S, OD10 |

---

## Appendix A: The 26 contradictions and the adopted resolutions

| # | Contradiction | Adopted resolution |
|---|---|---|
| C1 | The stale md vs the JSON on M-017 and M-159 | The JSON is authoritative. Salary is optional and not counted (M-017). Admins are invited by email (M-159). P1 done. |
| C2 | "One phone per account" vs on-screen codes | OD3: drop phone uniqueness. |
| C3 | Right-to-work filter vs the legal review before a sponsorship filter | OD4: ship "Has right to work in {country}" in test mode; legal review before go-live. |
| C4 | Toggles that control nothing | OD6: remove the in-app toggle and the admin email preferences. |
| C5 | The CV-request "notification" has no channel | U19: an email under the toggle plus a pending list on the CV page. |
| C6 | Score visibility for recruiters | Recruiters get ranking and evidence only. Paid candidates and admins see the number. |
| C7 | The relevant-count population vs who Find candidates can open | Use the M-054 + M-055 population (U7). |
| C8 | Custom stages vs the fixed admin funnel | OD5: 6 fixed stage categories. |
| C9 | Remote jobs in country views vs one salary currency | OD2: remote jobs appear only in the Remote view. |
| C10 | Salary cap vs HUF salaries | U26: salary max 100,000,000. |
| C11 | Free "For you" vs score-based Recommended | U8: Free gets jobs sharing at least 1 required skill. |
| C12 | "Stripe emails receipts" vs test mode | Store and show the receipt or hosted-invoice link; do not test receipt emails. |
| C13 | "Cards, wallets, Link" vs dynamic payment methods | `payment_method_types: ['card','link']` on every session (U40). |
| C14 | 8 currencies on a US sandbox | P5 verified. The subscriber's own currency is shown in Billing and the promo. Any country's currency is accepted in test mode. |
| C15 | Single money KPIs vs per-currency reports | U34: one line per currency, at most 3, then "+n more". |
| C16 | Protected files vs Bearer tokens | U39: signed file URLs. |
| C17 | Uploads inside OneDrive | P2: `UPLOAD_DIR` outside OneDrive (done). |
| C18 | Certificate deletion vs "Revoked"; certificate files vs 30-day deletion | A tombstone `{ code, status }` showing "No longer valid". Certificate files are exempt from the 30-day deletion. |
| C19 | Gmail volume | OD9: reserved-domain suppression, a cap of 400/24 h for non-critical email, critical email always sent. |
| C20 | "No queues" vs deferred work | OD10: an in-process 60 s timer over MongoDB due-records. |
| C21 | Email change re-verification vs no email change | Build only the phone part. |
| C22 | Code right after sign-up vs a token at sign-up | U37: a token at sign-up; `EMAIL_UNVERIFIED` until the code is entered. |
| C23 | Three policy signals vs a two-input formula | U5: experience → sim, skills → skill, location → cap at 49. |
| C24 | Badge hidden when not discoverable vs profile visible to companies applied to | Show the badge wherever the profile is visible. |
| C25 | Seeded Plus subscribers vs Stripe-driven state | OD8: real Stripe test customers and subscriptions in the seed. |
| C26 | Tunnel limits | Video uploads on localhost only; rate-limit by `CF-Connecting-IP` with trust proxy. |

## Appendix B: The 44 under-specified items and the adopted defaults

| # | Adopted default |
|---|---|
| U1 | 5 failed logins per email per 15 min; 20 per IP per 15 min; forgot password 5/h per email; sign-up 10/h per IP; `RATE_LIMITED` + `retryAfter`. |
| U2 | Min 8 characters, max 72 bytes; reject the top-10k list and the email local part; bcryptjs cost 12. |
| U3 | The cap is OD13. Not counted: cache hits, embeddings, admin Regenerate. |
| U4 | gpt-5.4-mini for job summaries, match explanations, insight narratives, translations and the profile summary. gpt-5.5 for the CV snapshot, assisted draft, policy suggestion and report summary. |
| U5 | `sim = clamp((cos−0.20)/0.40, 0, 1)`; `skill` = matched required ÷ required; score = round(100 × (0.6·sim + 0.4·skill)); signals as in C23; Strong ≥ 75, Good ≥ 50; stored per policy version. |
| U6 | Candidate text = headline + about + skills + work + education + live CV. Job text = title + brief + responsibilities + skills + level + languages. ~8,000 tokens; 3072 dims as Float32; cosine in Node; embed everyone with consent. |
| U7 | Relevant = score ≥ Good within the M-054 + M-055 population; nightly at 03:00 server time, with startup catch-up after 24 h. |
| U8 | Free "For you" = jobs sharing at least 1 required skill, ranked by overlap, then recency. |
| U9 | M-172: N = 5. |
| U10 | The M-173 card links to `/admin/candidates` with Status = Active. |
| U11 | M-176 = applications whose candidate is on that company's shortlist ÷ non-withdrawn applications, all-time. |
| U12 | Digests daily at 08:00 and weekly on Monday at 08:00 in `User.timezone` (saved at each sign-in); jobs since the last digest; no empty digests; missed slots at the next tick. |
| U13 | Tick 60 s. Message email when unread ≥ 15 min and no email for that conversation in 60 min. Stage email 10 min after the last move, only if the mapped status changed. |
| U14 | The new-application email is OD14. |
| U15 | Heartbeat every 15 s; credit min(Δwall, 15 s) × min(rate, 2) only when the position advanced without a seek; complete at ≥ 90%. |
| U16 | Duration read in the browser and editable; no global disk cap; text lessons in sanitised Markdown; https links only. |
| U17 | Verify page 30/min/IP. A name change re-issues with the same code. PDF chrome in the holder's language; the course title as authored. |
| U18 | CV PDF or DOCX ≤ 10 MB. No text layer → "No readable text", and matching uses profile text. The AI snapshot is paid; Free gets extraction only. |
| U19 | "Earlier CV version requested" email (toggle) plus a pending list on the CV page. |
| U20 | Report reasons: spam, scam_or_fraud, discriminatory, offensive, misleading, other; details ≤ 500; 10 reports per user per day; one open case per reporter and target. |
| U21 | Invite link valid 72 h, single use, role chosen at invite. `isOwner` set only by the seed; invited admins are never Owner. |
| U22 | A new Terms or Privacy version → a blocking re-accept dialog at the next sign-in. |
| U23 | Report CSV: an "Executive summary" row, then the summary; a "Brief" row with the brief or transcript; a blank row; then the data table. |
| U24 | A course needs all 8 prices (or Free) to publish; integer minor units; whole amounts shown with 0 decimals. |
| U25 | Monthly salary × 12 for filters, sort and the minimum-salary check. The Remote salary filter is in EUR. The candidate minimum is compared only within the same currency. |
| U26 | Salary max 100,000,000. |
| U27 | Checks per category, one approval each. Editing or deleting the linked entry resets that category. An expired permit shows "Permit expired", counts as no right to work in filters, and leaves completeness unchanged. |
| U28 | "Discoverable" = listed in Find candidates now. Existing threads stay open after hiding; no new threads. |
| U29 | Candidate erasure details are OD15. |
| U30 | Recruiter deletion details are OD15. |
| U31 | Recruiter notes are excluded from the candidate export (legal check at go-live; OD15). |
| U32 | 30 days as a constant; daily sweep at 03:00; certificate files exempt. |
| U33 | Reject sets `not_selected`; the card leaves the board; a "Not selected" filter; the rejection email uses the 10-min delay, which is also the undo window. |
| U34 | Money cards: one line per currency, largest first, at most 3, then "+n more". |
| U35 | Keywords match the job text plus labels in the alert's language; the alert stores the picker country (Remote allowed) and matches only that country. |
| U36 | A duplicate sign-up shows the same screen; the existing account gets "You already have an account" (sign-in + reset links) under the 1/min, 5/day limits. |
| U37 | A token is issued at recruiter sign-up; until the email is verified, recruiter endpoints except verify, resend and `/me` return 403 `EMAIL_UNVERIFIED` (logout is client-side, M-007). |
| U38 | Paid when active, trialing or past_due; Free for unpaid, canceled, incomplete, incomplete_expired. Refined: past_due counts as paid only while Stripe still retries (M-120, §2.10). |
| U39 | Signed URLs: HMAC(`FILE_URL_SECRET`) over path + userId + expiry; 15 min for images, PDFs and CVs; 6 h for video; issued after the ownership check; downloads logged. |
| U40 | One Product, one Price per currency (`plus_monthly_<cur>`) via `seed:catalog`; courses use inline `price_data`; every session sends the currency, card + Link, locale and Adaptive Pricing off; one Customer per currency only if Stripe refuses a switch. |
| U41 | `seed:catalog` is an idempotent upsert (countries, plan + Stripe prices, permissions, FAQs, legal texts); `seed:demo` wipes and recreates the demo data. |
| U42 | Courses: 3 English Markdown lessons (300–600 words) + 5 single-choice questions each. Cities: London, Manchester, Dublin, Berlin, Munich, Paris, Lyon, Madrid, Barcelona, Amsterdam, Warsaw, Lisbon, Stockholm. USD salaries converted once at fixed rounded rates (OQ-4), rounded to 1,000. |
| U43 | The build session writes all new copy in en/es/fr: about 22 email templates, FAQ answers per audience, certificate text, lock and upgrade prompts, the restricted-admin notice and every new UI string. Legal texts per OD12. |
| U44 | New screens without Figma follow OD16. |

## Appendix C: OD1–OD16 adopted

| # | Adopted decision |
|---|---|
| OD1 | Prices per currency: the table in §3.10, verbatim. |
| OD2 | Remote-flagged jobs appear only in the Remote view. Country views list on-site and hybrid jobs located there. Eligible countries show as a badge or filter inside Remote (OQ-6i: both). |
| OD3 | Drop "one phone per account". |
| OD4 | Ship "Has right to work in {country}" (citizen/settled or valid permit) in test mode; legal review before go-live. |
| OD5 | Each stage picks one of 6 fixed categories. The candidate status derives from it. The admin funnel counts categories; the recruiter funnel lists the company's stages. |
| OD6 | Remove the in-app toggle (no bell feed in v1) and the admin email notification preferences. |
| OD7 | Speech-to-text: `gpt-4o-mini-transcribe`, with `whisper-1` as fallback. **Resolved:** a real transcription test passed (P4). |
| OD8 | The seed creates real Stripe test customers and subscriptions (`pm_card_visa`) tagged `metadata.seed=true` (plus `metadata.db`), removed on re-seed. Historical seed payments are `source: seed`, without receipt links. |
| OD9 | The Owner uses `SEED_ADMIN_EMAIL`. The demo accounts use plus-aliases of it (S). Every other seed account uses `@example.com`. Reserved domains are never mailed, only logged. Non-critical emails are capped at 400 per rolling 24 h. Verification, code, reset and invite emails are always sent. |
| OD10 | An in-process 60 s timer over MongoDB due-records; missed work runs at the next start. |
| OD11 | Keep the "AI" mark cropped from `logo.png`; render "Local WorkMan" and "AI Job Portal" as live text in Manrope. |
| OD12 | Terms, Privacy and Imprint seeded in en/es/fr as marked drafts, version `2026-11-draft`. The Imprint is a placeholder. Final wording before go-live. |
| OD13 | 50 OpenAI generations per user per UTC day. Cache hits, embeddings and admin Regenerate are not counted. Admins are exempt. |
| OD14 | A new-application email to recruiters, at most 1 per job per hour ("{n} new applications for {job}"), under the email toggle. |
| OD15 | Candidate erasure scope, messages deleted for both sides ("Deleted user"), audit and moderation entries kept with "Deleted user", the Stripe subscription cancelled and the Customer deleted, certificate tombstones, recruiter deletion (jobs closed, display name kept, personal data and KYC deleted), notes excluded from the candidate export. Full list in §3.16. |
| OD16 | New screens with no Figma are built from existing components and `docs/DESIGN_SYSTEM.md` and checked in a real browser; there is no separate Figma step. |

## Appendix D: Reference map

| Need | Where |
|---|---|
| Full text of a decision | `docs/backend/DECISIONS.md` (grouped by topic; M-id headings) |
| Contradictions, external dependencies (D1–D26), defaults, ordering, OD, prep | `docs/backend/blocker-review.md` §1, §2, §3, §4 and its last two sections |
| **Candidate** screens, route by route | `audits/candidate.md` §0 (screen index), §1–§23 (per screen), §24 (decision impacts D1–D5), §25 (messages) |
| Candidate static items (file:line), formatters, demo copy | `audits/candidate.md` §28 (S1–S60), §28a, §28b |
| Candidate storage call sites and `data/` imports | `audits/candidate.md` §31a, §31b |
| **Recruiter** screens | `audits/recruiter.md` Part A (A0–A36), Part B (decision impacts B1–B4) |
| Recruiter storage keys, entities, endpoints | `audits/recruiter.md` §0.1, Part C, Part D |
| Recruiter static items, formatting, cross-role effects | `audits/recruiter.md` Part E, Part F, Part G; storage grep J2 |
| **Admin** screens | `audits/admin.md` §1.1–§1.28 |
| Admin entities, endpoints, permission map, course content gap | `audits/admin.md` §2, §3, §4, §5 |
| Admin static items and new-decision changes | `audits/admin.md` §6, §9.1–§9.4; storage grep §10.2 |
| **Shell, auth, help, payments core** | `audits/shared.md` §1–§8 |
| Shared endpoints, cross-feature imports, storage call sites (53) | `audits/shared.md` §9, §10, §11 |
| Formatting and i18n inventory; CSS for long translations | `audits/shared.md` §12 (plurals §12.12, CSS §12.13, size §12.15) |
| Shared static items | `audits/shared.md` §13 |
| Design tokens, Figma frames, flows, client conventions | `docs/DESIGN_SYSTEM.md`, `docs/FIGMA_SCREEN_INVENTORY.md`, `docs/USER_FLOW.md`, `docs/CONVENTIONS.md` |

**Per phase, read:**

| Phase | Audit sections |
|---|---|
| 2 | shared §1–§4, §8.1, §8.2, §11, §12, §13; candidate §0.1; recruiter A0–A2; admin §1.2, §1.28 |
| 3 | candidate §6–§8, §17–§19, §21–§23, §24 D1, D3; admin §9.2 (verification queue) |
| 4 | recruiter A3–A24, A30, B1, B2; candidate §1–§3; admin §1.25, §1.26, §9.2 |
| 5 | shared §6, §8.3; candidate §9, §9a, §20, §24 D4; admin §9.3; recruiter A33 |
| 6 | candidate §4, §24 D2; recruiter A25–A27, A9 |
| 7 | candidate §5, §25; recruiter A16 (message modal), A31, A36, B3 |
| 8 | candidate §15, §16, §24 D5; recruiter A28, A29, B4; admin §1.14–§1.16, §5, §9.1 |
| 9 | candidate §10–§14; recruiter A11, A15, A17; admin §1.6, §1.18, §1.19 |
| 10 | admin §1.1, §1.3–§1.13, §1.17, §1.20–§1.27, §4, §9.3, §9.4 |
| 11 | shared §12; candidate §28a; recruiter Part F |
| 12 | candidate §19; recruiter A32; shared §11 |
