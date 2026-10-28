# Conventions

How this codebase is organised and how screens are built. Read this before adding a screen.

## Stack

React 19 · Vite 8 · react-router-dom 7 (data router) · lucide-react · plain **CSS Modules** (no Tailwind, no CSS-in-JS) · `.jsx` for components, `.js` for utilities. No TypeScript. No backend: all data is mock data kept next to the feature, with user changes persisted to `localStorage` (the Figma footer says "Changes saved on this device"). Never imply that anything is saved to a server.

Commands: `npm run dev` · `npm run build` · `npm run lint` (oxlint).
Alias: `@` → `src/` (e.g. `import { Button } from '@/components/ui'`).

## Folder layout

```
src/
  app/            router.jsx, App.jsx, workspaces.js (nav + identity per role), lazyPage.js, NotFoundPage
  assets/         images/ (photos, logos, avatars), icons/ (custom Figma glyphs that are not in Lucide)
  components/
    ui/           DS primitives: Button, IconButton, Avatar, CompanyLogo, Panel, TextField,
                  PasswordField, TextareaField, SelectField, Checkbox, Switch, Modal, Dropdown, Icon
    layout/       AuthLayout, WorkspaceLayout (Sidebar + Header + ProfileMenu + footer), GlobalSearch
    common/       generic, reusable-across-features components built on top of ui/ (PillBadge — the one
                  badge, DataTable, SegmentedTabs/ViewToggle, PageTitle, StatCard, EmptyState, ConfirmDialog...). Create here when a component is (or will clearly be) used by
                  more than one feature.
  features/
    auth/                 public routes (sign in / up, recruiter onboarding)
    candidate/<group>/    pages/  components/  data/  routes.jsx
    recruiter/<group>/    same
    admin/<group>/        same
    help/                 shared Help page (mounted in every workspace)
  hooks/          useLocalStorage ...
  styles/         variables.css (design tokens), globals.css (reset), utilities.css
  utils/          cx.js ...
```

A *group* is a set of related screens (e.g. `candidate/ai-insights`, `recruiter/find-candidates`). Each group owns its `pages/`, feature-specific `components/`, mock `data/` and a `routes.jsx`.

## Routing

* `src/features/<role>/routes.jsx` auto-collects every `src/features/<role>/<group>/routes.jsx` (and `features/help/routes.jsx`) with `import.meta.glob`. **Adding a screen never requires editing `router.jsx`.**
* A group's `routes.jsx` default-exports an array of react-router route objects with paths **relative to the workspace** (`/candidate`, `/recruiter`, `/admin` are mounted by `WorkspaceLayout`). Use `index: true` for the workspace root.
* Always lazy-load pages:

```jsx
import { lazyPage } from '@/app/lazyPage.js'

export default [
  { path: 'jobs', lazy: lazyPage(() => import('./pages/FindJobsPage.jsx')) },
  { path: 'jobs/:jobId', lazy: lazyPage(() => import('./pages/JobDetailsPage.jsx')), handle: { title: 'Job details' } },
]
```

* `handle.title` sets the breadcrumb's current-page text; without it the header falls back to the matching sidebar label.
* Public routes (auth) are absolute paths in `features/auth/routes.jsx`.
* Settings tabs: `/<role>/settings` redirects (`<Navigate replace>`) to the first tab.
* Keep `routes.jsx` files trivial. A syntax error there breaks the whole app.

## Styling

* One `Component.module.css` per component/page. Class names are local, so collisions are impossible.
* Use the tokens in `src/styles/variables.css` (`var(--primary)`, `var(--border)`, `var(--radius-xl)` ...). Hard-code a hex only when the design uses a value that is not a token (many one-off greys exist; keep them local to the module).
* Figma's generated code is absolutely-positioned Tailwind. **Translate it to flex/grid** with the same measurements (padding, gaps, sizes, radii, font size/weight/line-height, colors). Do not copy Tailwind classes. Keep absolute positioning only for genuine overlays (badges on avatars, dots, etc.).
* Fonts: Manrope (display/headings, 700–800) and Inter (UI/body). Controls are `radius-xl` (12px), badges `radius-md` (6px).
* The page content area (inside `WorkspaceLayout`) is a fluid column: at 1440 px it is 1128 px wide with 40 px side padding and 28 px top padding. Pages render *only* their content (title block onwards); the sidebar, header and footer come from the layout.

### Responsive

Figma only contains 1440 px desktop frames. Match them exactly at ≥ 1280 px. Below that, adapt sensibly without redesigning: collapse multi-column grids (`@media (max-width: 1023px)` → 2 columns / 1 column), let toolbars wrap, wrap wide tables/boards in a horizontally scrollable container, stack split layouts. No horizontal page scroll at 375 px. The shell already provides the mobile drawer navigation.

## Icons and assets

* UI icons are **Lucide** drawn at stroke 1.7: use `<Icon as={Search} size={16} />` from `@/components/ui`. Figma exports of Lucide icons are identical shapes, so pick the matching Lucide glyph by looking at the export. To identify an icon, download the exported SVG and render it (a contact sheet via headless Chrome works well).
* Non-Lucide glyphs (the AI sparkle-chat icon, the Access-management icon, illustrations) and all photos/logos/avatars are **downloaded from Figma into `src/assets/`** with `curl -L` and imported. Never leave `figma.com/api/mcp/asset/...` URLs in code (they expire after 7 days).
* Use the real Figma asset wherever the design has one. No emoji, stock imagery or Unicode symbols as icons.

## Interactions

Every visible control must do something sensible, using the smallest behaviour consistent with the design:

* navigation → `Link`/`NavLink`/`useNavigate` to a real route. No `href="#"`.
* forms → controlled inputs, validation with messages that name the problem, a submit state, a success state/redirect. Show/hide password where there's a password field.
* tabs, filters, search, sort, pagination/load-more, dropdowns, modals/drawers, toggles → implemented over the mock data.
* state a user changes (saved jobs, notes, settings, shortlist ...) persists with `useLocalStorage('lwm.<feature>.<thing>', initial)`.
* copy comes from Figma verbatim, including the "demo only" notes. Don't invent product features. Where the design doesn't say what happens, do the minimum and record the assumption in your report.
* Use semantic elements (`button`, `a`, `label`, `table`, headings in order), visible focus (global `:focus-visible` ring), `aria-label` on icon-only controls.

## Verification (per screen)

1. `get_design_context` (with the `figma:figma-design-to-code` skill loaded first) **and** the screenshot for the frame; for frames too large/sparse, fetch child nodes.
2. Build the page; add the route.
3. Render it in headless Chrome at the frame's width (1440) and the frame's height, view the PNG next to the Figma screenshot, list discrepancies (layout, spacing, type, colour, icons, imagery), fix them, re-render.
4. Check the console for errors/failed requests, run `npm run lint`, and a production build.
5. Only call a screen *visually checked* if you actually compared the render with the Figma screenshot.

## Mock data and naming

`features/<role>/<group>/data/*.js` exports plain arrays/objects. Keep realistic copy from the Figma frames (names, titles, numbers). Component names are PascalCase nouns (`JobCard`, `ApplicationsTable`); pages end in `Page`.
