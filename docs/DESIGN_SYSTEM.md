# Design system

Extracted from the Figma file `Local-WorkMan` — page **D S** ("matchpoint. Design System", five 1680 px reference frames: Foundations, Component library, Patterns & accessibility, Workspaces & AI guidance, Native assets) via `get_variable_defs`, `get_design_context` and screenshots, and cross-checked against the **Final** screens. Token values below are Figma's; none were invented. Implemented in `src/styles/variables.css` and `src/components/ui/`.

> **Naming.** The brand artwork in the screens reads **"Local Worksmen · AI Job Portal"**, the footer reads **"Local workman"**, and most copy/DS titles say **"matchpoint."** Copy is reproduced verbatim from Figma; the inconsistency is a design-file issue to resolve, not a code one.

## Principles (from the DS page)

Premium, not ornamental · Blue with intention (blue = primary actions, selected nav, focus, AI/evidence highlights; not every link or status) · One shared language across Candidate, Recruiter, Admin and auth · Evidence over percentages · Review before change (suggestions are editable/dismissible) · Say what's real (label local evidence-based previews; distinguish locally saved state from server state — hence the "Interactive demo · Changes saved on this device" footer).

## Colour (semantic tokens)

| Token | Value | Use |
|---|---|---|
| `--background` | `#F8F9FB` | page background |
| `--foreground` / `--card-foreground` / `--secondary-foreground` | `#202534` | text |
| `--card` | `#FFFFFF` | panels, inputs |
| `--primary` / `--ring` | `#0084FF` | primary action, focus ring, active nav |
| `--primary-foreground` | `#FFFFFF` | text on primary |
| `--primary-hover` / `--accent-foreground` | `#0066C4` | hover, accent text |
| `--secondary` | `#EEF0F5` | secondary buttons, segmented control track |
| `--muted` | `#F5F6F8` | muted surfaces |
| `--muted-foreground` | `#687184` | secondary text |
| `--accent` | `#EAF4FF` | selected / AI tint |
| `--border` | `#E8EAF0` | hairlines |
| `--destructive` | `#BF4545` | danger |
| `--selection` | `#CCE6FF` | text selection |
| `--blue-light-100` | `#E0F2FE` | AI badge in nav |

Further neutrals read directly from the screens (not Figma variables): label `#555B6D`, placeholder `#7B8292`, nav text `#73798A`, nav section heading `#A2A6B2`, breadcrumb `#767D8C`, faint `#9398A5`, footer `#737B8C`. DS-proposed status badge colours: green `#EDF7F0`/`#28734B`, amber `#FFF5E5`/`#8A5A16`.

Known DS follow-up (documented in Figma, preserved here): white on `#0084FF` is ≈ 3.66:1 (not normal-text AA at 12 px semibold); the proposed fix is `#0066C4` (≈ 5.7:1) — "not a current token".

## Typography

Manrope (display, headings, metrics) × Inter (UI, body, tables, labels). Loaded from Google Fonts in `index.html`.

| Role | Spec |
|---|---|
| Hero | Manrope 34–42 / 800, tight tracking (auth hero: 56/61.6, −1px) |
| Page title | Manrope 30–34 / 800 |
| Section | Manrope 18 / 700–800 |
| Card title | Manrope 14–16 / 700–800 |
| Metric | Manrope 28 / 700 |
| Input | Inter 14 / 400 |
| Button | Inter 12 / 600, line-height 18 |
| Body / evidence | Inter 14–15 / 400, line-height 1.55 |
| Metadata | Inter 10–13 / 400–600 |
| Nav label | Inter 12 / 400 (active 600) |
| Eyebrow | Inter 10, uppercase, +1px tracking |

Figma text styles found: Inter 11/12/13/14/15 Regular, Inter 12/14 Semi Bold, Manrope 16/18/20/24 ExtraBold, Manrope 28 Bold.

## Spacing, shape, elevation

* Gaps favour 8 / 12 / 16 / 24; panel padding 16 / 20 / 24.
* Radius: `--radius-md` 6 (badges, segmented option), `--radius-lg` 8 (company logo), `--radius-xl` 12 (**panels and — as drawn in the screens — buttons and inputs**; the DS page labels controls `lg`, but every Final frame uses 12), avatar full.
* Panel: white, 1px `--border`, `radius-xl`; selected/AI variant: `--accent` fill with a 20 % primary border. Shadows are subtle and purposeful: button `0 2px 1.5px rgba(98,89,219,.08)`, segmented-active `0 1px 1.5px rgba(0,0,0,.1)`, popover `0 20px 25px -5px / 0 8px 10px -6px rgba(0,0,0,.1)`. Dialog backdrop: ink `#20253499` + blur.
* Layout: sidebar 232 px, header 72 px (blur 8 px, 95 % white), content padding 40 px (1128 px column at 1440). Auth: 720 + 720 split.

## Components (`src/components/ui`)

| Component | Figma source | Notes |
|---|---|---|
| `Button` | DS Button (Primary/Secondary/Ghost/Danger × Default/Hover/Pressed/Focus/Disabled/Loading) | 40 px min height, 12 px/600 label, 150 ms transitions, native `disabled`, loading disables + `aria-busy` |
| `IconButton` | DS IconButton | 36 px, Lucide 17 px, required accessible `label` |
| `Badge` | DS Badge (gray/green/violet/amber/blue, optional dot) | word labels, never colour alone |
| `Avatar`, `CompanyLogo` | DS Avatar initials / Company logo initials | rounded-full vs rounded-square, palette from name |
| `TextField`, `PasswordField`, `TextareaField`, `SelectField` | DS Field (Default/Focus/Error/Disabled) | persistent label, nearby hint/error (`role="alert"`), `aria-describedby`/`aria-invalid` |
| `Checkbox`, `Switch` | not specified in DS; follow the screens | accessible native/`role="switch"` |
| `Panel` | DS Panel shell | padding 16/20/24, `selected` tint |
| `Modal`, `Dropdown` | Dialog backdrop spec / profile menu | Escape, outside click, focus handling |
| `Icon` | Lucide-style icons | stroke 1.7 on the 24 px grid |

Layout components (`src/components/layout`): `AuthLayout`, `WorkspaceLayout` → `Sidebar` (per-role nav from `src/app/workspaces.js`), `Header` (breadcrumb, search, workspace switch, language, location, notifications, profile menu), `ProfileMenu`, `GlobalSearch`.

## Icons and assets

Icons are Lucide at stroke 1.7 (verified: the exported Figma SVGs are Lucide shapes scaled from the 24 px grid, `stroke-width 1.41667` at 20 px). Custom glyphs (AI chat-sparkle, Access-management) and imagery are downloaded from Figma into `src/assets/`.

## Responsive behaviour (adaptation — Figma has desktop frames only)

≥ 1280 px: exact desktop layout. 1024–1279 px: header hides language/location. < 1024 px: sidebar becomes an off-canvas drawer opened from a menu button, content padding 20 px, multi-column grids collapse, auth hero is hidden. < 768 px: header keeps search, notifications and avatar.
