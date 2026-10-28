# Local WorkMan (LWM) — AI Job Portal (frontend)

React + Vite (JavaScript/JSX) implementation of the **Local-WorkMan** Figma design: three role workspaces — **Candidate**, **Recruiter**, **Admin** — plus authentication and recruiter onboarding. It is a front-end demo: all data is mock data kept in the browser (`localStorage`); nothing is sent to a server.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run lint     # oxlint
```

Sign in at `/sign-in` (Candidate or Recruiter) or `/admin/sign-in` with any well-formed email and a non-empty password (demo only).

## Docs

| File | What it covers |
|---|---|
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | plan, build order, per-screen checklist, validation log |
| [docs/FIGMA_SCREEN_INVENTORY.md](docs/FIGMA_SCREEN_INVENTORY.md) | every Figma frame → node id, route, role, status |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | tokens, typography, components extracted from Figma |
| [docs/USER_FLOW.md](docs/USER_FLOW.md) | screen flow per role (Mermaid) |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | architecture and how to add a screen |
