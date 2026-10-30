# Local WorkMan (LWM) — AI Job Portal (frontend)

React + Vite (JavaScript/JSX) implementation of the **Local-WorkMan** Figma design: three role workspaces — **Candidate**, **Recruiter**, **Admin** — plus authentication and recruiter onboarding.

| Folder | What it is |
|---|---|
| `client/` | the React app. Today all data is mock data kept in the browser (`localStorage`); nothing is sent to a server. |
| `server/` | the Node.js API (Express + MongoDB), being built. Its `.env` is local only and never committed. |

```bash
cd client
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into client/dist/
npm run lint     # oxlint
```

Code paths in the docs (`src/...`) are relative to `client/`. On Vercel, set the project's **Root Directory** to `client`.

Sign in at `/sign-in` (Candidate or Recruiter) or `/admin/sign-in` with any well-formed email and a non-empty password (demo only). Workspace pages need you to sign in first; the session is kept in this browser until you sign out.

Payments use a demo checkout (no payment provider, nothing is charged): card `4242 4242 4242 4242` succeeds and `4000 0000 0000 0002` is declined, with any future expiry and any security code. Candidates and recruiters see their own payments under Settings → Billing; the admin sees all of them under Payments.

## Docs

| File | What it covers |
|---|---|
| [docs/BACKEND_PLAN.md](docs/BACKEND_PLAN.md) | **backend build plan**: decisions, architecture, data model, API, phases with browser checks |
| [docs/backend/DECISIONS.md](docs/backend/DECISIONS.md) | the 210 final product decisions (audits and review in `docs/backend/`) |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | frontend plan, build order, per-screen checklist, validation log |
| [docs/FIGMA_SCREEN_INVENTORY.md](docs/FIGMA_SCREEN_INVENTORY.md) | every Figma frame → node id, route, role, status |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | tokens, typography, components extracted from Figma |
| [docs/USER_FLOW.md](docs/USER_FLOW.md) | screen flow per role (Mermaid) |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | architecture and how to add a screen |
