# Audit: shared shell, auth, help, payments core (read-only)

Repo: `C:\Users\tusha\OneDrive\Desktop\Ai Job`, audited 2026-10-29/30. The app moved to `client/` during the audit (staged renames). I checked that the in-scope files are byte-identical after the move (git hash compare and line counts). **Every path below is relative to `client/`** (e.g. `src/app/router.jsx` = `client/src/app/router.jsx`), and line numbers are unchanged.

Settled decisions applied (from the brief, the coordinator and the project memory): one role per account; admins are seeded; separate candidate and recruiter sign-ups; the WorkspaceSwitch is removed; JWT Bearer token stored by the client; **Redux Toolkit + RTK Query** (TanStack was dropped); forgot/reset password; candidates **must verify their email before the first login**; recruiters need admin approval; Stripe test-mode hosted Checkout + webhook (courses one-time; plan £9/month subscription); the paid plan unlocks **all AI features, applying, replying to messages and job alerts**; courses produce a **PDF certificate with a verification code**; Messages sidebar item with an unread badge polled about every 15 s; country picker = EU27 + UK + Remote and controls listings, currency, formats and default language; UI in en/es/fr via react-i18next files; emails and AI output in the user's language; Gmail SMTP; uploads on server disk; demo data and accounts are seeded; "Delete my data" is real and "Reset demo" is removed; Vercel serves the client (Root Directory = `client`); the server runs locally for now; nothing static may remain.

Already resolved since the audit started (no question needed): `.gitignore` now ignores `.env`, `.env.*` and `server/uploads/` (`/.gitignore:26-30`; `server/.env` is ignored). Vercel Root Directory = `client` (README.md:18), so `client/vercel.json` is the right place.

---

## 1. App shell and build config

### `index.html` (19 lines)
- `:2` `<html lang="en">` is static. It must follow the i18n language (set `document.documentElement.lang` on `i18next.on('languageChanged')`).
- `:7-12` loads Inter + Manrope from **fonts.googleapis.com**. That sends visitor IPs to Google, which is a known EU GDPR issue (LG München 2022). → Q36.
- `:13` `<title>Local WorkMan · AI Job Portal</title>` is static, and no route ever changes `document.title` (the only `document.title` hit in src is `features/auth/pages/KycVerificationPage.jsx:77`, which reads it). Needs a translated per-route title and a brand decision (Q2).

### `src/main.jsx` (12), `src/app/App.jsx` (6), `src/app/lazyPage.js` (7)
- No data. `App.jsx` renders `<RouterProvider>` only. The Redux `<Provider store>` (RTK Query API slice) and the i18next init must wrap it (`main.jsx` or `App.jsx`).

### `src/app/router.jsx` (46)
| Line | Today | Server-backed behaviour |
|---|---|---|
| 3, 16 | `loader: () => hasSession(id) ? null : redirect(signInPath)`, a sync localStorage marker | Async loader: no token → `redirect(signInPath + '?next=' + path)` (Q11). With a token → `store.dispatch(api.endpoints.getMe.initiate())` (**GET /api/auth/me**). If `me.role !== id`, redirect to `WORKSPACES[me.role].basePath`. Recruiter with `status !== 'approved'` → `/recruiter/onboarding/<step>` or the review screen (Q6). 401 → clear token → sign-in. |
| 20 | `homeLabel={`Back to ${workspace.label.toLowerCase()} overview`}` | Concatenation plus `toLowerCase()` of a translated label. Needs an i18n key with interpolation. |
| 31 | `/` → `<Navigate to="/sign-in">` always | Signed in → own workspace; otherwise → `/sign-in` (Q11). |
| 32 | `...authRoutes` (public) | Add new public routes: `/forgot-password`, `/reset-password`, `/sign-up/check-email`, `/verify-email`, certificate verification (§9), and legal pages if Q12/Q23 say so. |
| 33-35 | Workspace routes collected by `import.meta.glob` (`features/{candidate,recruiter,admin}/routes.jsx:7`, which also mounts `../help/routes.jsx`) | Unchanged. The new `messages` feature folders are auto-collected. |
| 40-44 | `hydrateFallbackElement` = sr-only "Loading…" | Translated. The workspace loader now awaits `/me`, so a visible loading state is needed. |

### `src/app/NotFoundPage.jsx` (22) + `.module.css` (40)
- Strings `:6` "Go to sign in", `:11` "404", `:12` "Page not found", `:14` "There is nothing at …". Translated only; no data.

### `src/app/workspaces.js` (113): per-role nav, identity, header variant
| Line | Static item | Becomes |
|---|---|---|
| 20-21, 37-38, 65-66, 86-87 | `user: { name: 'Alex Morgan', subtitle: 'Personal account', avatar }`, `'Sarah Miller' / 'Acme Studio'`, `'Workspace admin' / 'Acme Studio'` (the admin reuses the **candidate avatar**); `headerAvatar` static SVGs | From **GET /api/auth/me**: `fullName`, subtitle (Q18), avatar URL or initials via `components/ui/Avatar.jsx`. |
| 22, 51 | `badge: { useText: useActiveApplicationsBadge }`, imported from `features/candidate/jobs/hooks/useApplications.js:45-47` (localStorage) | Count from **GET /api/me/counters** (polled, Q22). |
| 39, 67, 88 | `showWorkspaceSwitch` | Delete (decided). |
| 40, 68, 89 | `showLocation` (admin false) | Keep; admin behaviour in Q32. |
| 41, 69, 90 | `profilePath` candidate `profile`, recruiter `company`, admin `settings` (a placeholder page, `features/admin/settings/pages/AdminSettingsPage.jsx:18`) | Q18. |
| 42-47 | Candidate `promo` with static copy → `onboarding/story` | Computed (Q20). |
| 48-58 / 70-79 / 91-106 | Nav labels are English literals | i18n keys. **Add `Messages`** (candidate + recruiter) with an unread badge. Add plan-lock metadata to gated candidate items (§8.3). |
| 56 | AI insights `badge: { text: 'AI', tone: 'ai' }` (static) | Plan-aware (Q21). |

### Build and tooling config
- `vite.config.js` (13): only the `@` alias. Add `server.proxy['/api'] → http://localhost:<port>` for dev, plus a `VITE_API_URL` env var for the Vercel build.
- `jsconfig.json` (8), `.oxlintrc.json` (15): client only. The server needs its own lint config (Node globals).
- `package.json` (25): deps today are `lucide-react`, `react`, `react-dom`, `react-router-dom`. To add: `@reduxjs/toolkit`, `react-redux`, `i18next`, `react-i18next` (optionally `i18next-browser-languagedetector`). Hosted Checkout is a plain redirect to `session.url`, so `@stripe/stripe-js` is **not** needed.
- `vercel.json` (9): SPA rewrite `/(.*) → /index.html`. Fine for the client. Public deep links (`/reset-password?token=`, `/verify-email?token=`, `/certificates/:code`) depend on it.
- `public/favicon.png`: the AI glyph with no text (viewed). OK.

---

## 2. Layout components (`src/components/layout`)

### `WorkspaceLayout.jsx` (41) + `.module.css` (57)
- `:19` wraps everything in `WorkspacePreferencesProvider` (localStorage prefs, see below). `:26` passes `{ workspace }` (static config incl. user) as outlet context to every page.
- Footer `:30` "© 2026 Local Workman. · AI Job Portal". The **year is static** (compute it) and the brand differs from elsewhere (Q2).
- Footer `:31-34` "Interactive demo · Changes saved on this device" is demo copy (Q23).

### `Sidebar.jsx` (113) + `.module.css` (276)
| Element | Line | Source today | Server-backed |
|---|---|---|---|
| Brand logo link + alt "Local Worksmen — AI Job Portal home" / "Local Worksmen, AI Job Portal" | 57-59 | static `assets/images/logo.png`. The raster itself reads "Local Worksmen / AI Job Portal" in **English** (viewed) | Q2 (brand and logo per language). |
| Section label "Workspace" | 62 | literal | i18n. |
| Nav items | 63-67 | `workspace.nav`; **React `key={item.label}`** | Key by `item.to` (labels change with language). Lock state (Q21). |
| Badges | 33-37, `LiveBadgeText` 14-16 | `item.badge.useText()` hook or static text | `useGetCountersQuery(undefined, { pollingInterval: 15000, skipPollingIfUnfocused: true })` → `activeApplications`, `unreadMessages`. Applications currently shows **"0"** when empty (`useApplications.js:46` returns `String(count)`) (Q22). |
| Promo card | 71-83 | `workspace.promo` static | Q20. |
| Settings / Help links | 85-99 | literal labels "Settings", "Help & resources" | i18n. |
| User block (avatar, name, subtitle) | 101-106 | static `workspace.user` | `/me` (Q18). |
| Sign out | 107 | `endSession(); navigate(signInPath)` | Clear token, `dispatch(api.util.resetApiState())`, navigate to the role's sign-in. Optional **POST /api/auth/logout** only if server-side revocation is chosen (Q7). Sync other tabs via the `storage` event. |

CSS issues for long translations: `.linkLabel { white-space: nowrap; min-width: 0 }` (`Sidebar.module.css:81-85`) has **no overflow/ellipsis** inside a 232 px sidebar (`variables.css:64`). Long es/fr labels ("Formation des recruteurs", "Gestión de accesos") will overflow, and adding Messages, badges and lock icons makes it worse. `.sectionLabel` is uppercase with letter-spacing (`:34-42`).

### `Header.jsx` (180) + `.module.css` (277)
| Element | Line | Today | Server-backed |
|---|---|---|---|
| Page title | 15-24 | route `handle.title` (19 English titles across `routes.jsx` files) or nav label; fallback `'Overview'` `:23` | `handle.titleKey` and i18n. |
| Breadcrumb root "{Label} workspace" | 145 | literal; CSS `text-transform: capitalize` (`Header.module.css:46-49`) | i18n. **Remove `capitalize`**: es/fr don't use title case ("Espacio De Trabajo"). |
| Search trigger "Search anything..." + `⌘ K` | 153-157 | literal; `⌘` is shown on Windows too | i18n; show Ctrl K on non-Mac. Behaviour in Q17. |
| WorkspaceSwitch | 12, 26-46, 159; CSS `.switch*` `Header.module.css:115-141`, `:270` | Candidate↔Recruiter links | **Delete** (decided). Imports `BriefcaseBusiness`, `Users` (`:3`) and `WORKSPACES` (`:6`, used only at `:30`) become unused. `session.js` `'member'` group goes away. |
| LanguageDropdown | 86-118 | `LANGUAGES` display names, saved to localStorage `lwm.language` | Language **codes** + endonyms; `i18n.changeLanguage`; **PATCH /api/me/preferences {language}** (Q26). |
| LocationDropdown | 48-84 | `LOCATIONS` (5 cities); note `:79` "Local marketplace preference for this workspace." | Countries from **GET /api/meta/countries** (29 entries); **PATCH /api/me/preferences {country}**; refetch country-scoped queries (RTK tag `CountryScoped`). The `Dropdown` panel has **no max-height** (`ui/Dropdown.module.css:5-15`, `overflow: hidden`) inside a sticky header, so 29 rows will run off-screen. Needs a scrollable or searchable list. |
| Hidden below 1280 px | `hideBelowWide` (`Header.module.css:246-250`) | Language/location only reachable via ProfileMenu on smaller screens | Keep. |
| Bell | 163-172 | Links to `settings/notifications` (admin: `settings` placeholder); **`.bellDot` always rendered** `:171`, ignoring the inApp preference ("Show a notification indicator when new recommendations are available", `features/candidate/settings/data/settings.js:36`, `features/recruiter/settings/data/notifications.js:11`) | Q19. |
| Ctrl/⌘+K listener | 124-133 | | No change. |

### `ProfileMenu.jsx` (114) + `.module.css` (152)
- `:22` static `headerAvatar`; `:29` `user.name`; `:30` "{Label} workspace" (CSS `capitalize`, `ProfileMenu.module.css:49`); `:34-40` Profile link (per-role target, Q18); `:42-74` Location row + inline list + note `:70`; `:76-108` Languages.
- With 29 countries, the **inline expanded list** (`.options` `:108-116`, no max-height) inside a fixed 254 px menu (`:30`) becomes about 1,250 px tall. `.rowValue` max 96 px (`:89-98`) truncates "Netherlands"/"Luxembourg"/"República Checa".
- Same data and actions as the header pickers.

### `GlobalSearch.jsx` (83) + `.module.css` (75)
- Searches **only the current workspace's nav labels plus Settings and Help** (`:16-24`), client-side `includes` on English labels. After i18n it must match translated labels, accent-insensitively (`normalize('NFD')`).
- Copy `:40-41,52,60,79`. Behaviour → Q17 (server search `GET /api/search`).

### `WorkspacePreferences.jsx` (14) + `preferencesContext.js` (15)
- `WorkspacePreferences.jsx:7-8` `useLocalStorage('lwm.location', LOCATIONS[0])`, `useLocalStorage('lwm.language', LANGUAGES[0])`. The default location is **'San Francisco, US'** (a non-EU default).
- `preferencesContext.js:4` `LOCATIONS = ['San Francisco, US','London, UK','New York, US','Berlin, Germany','Remote / Global']`; `:7` `LANGUAGES = ['English','Español','Français']`, with the comment "Only English copy exists; the choice is just remembered."
- Becomes a preferences slice: signed-in → `/me.language|country` (server is the source of truth); anonymous → localStorage (Q26). Provides a derived `formatLocale` and `currency` (Q30/Q31) to the formatters.

### `AuthLayout.jsx` (78) + `.module.css` (249)
- Static marketing copy: `:41` "LOCAL WORKMAN", `:47` "AI-powered matching. Human decisions.", `:49-55` the title with **hard `<br />` line breaks** (needs a `<Trans>`/translator-controlled break), `:57` lead, `:60` default quote, `:63` default footer "AI Job & Talent Matching Platform · matchpoint.", `:69-70` logo alt "Local Worksmen".
- CSS: hero title 56 px (`:110-118`), footer `position:absolute; bottom` (`:141-148`), desktop layout locked to `height:100vh` (`:189-193`). Longer French copy risks overlapping the footer on short screens.
- No language picker on public pages (Q35). The hero image `auth-hero.jpg` has no readable text (viewed). `auth-admin-brand-mark.png` contains English text ("AI Job Platform / SMART JOBS…") but CSS crops it to the glyph (`:83-90`). It is a 370 KB file shown at 32×27.

---

## 3. UI primitives and common components (strings, formatting, data only)

| File:line | Item | Change |
|---|---|---|
| `components/ui/Modal.jsx:36` | "Close dialog" | i18n |
| `components/ui/PasswordField.jsx:16` | "Hide password"/"Show password" | i18n |
| `components/ui/CompanyLogo.jsx:15,24` | alt/aria `${name} logo` | i18n interpolation |
| `components/ui/Avatar.jsx:6-13,25-38` | initials via `toUpperCase()`; name-hash palette | Fine; use `toLocaleUpperCase`. Accepts `src` for the real photo (decision: photo is part of the profile). |
| `components/ui/SelectField.jsx:23-26` | `placeholder` option | Callers pass translated text |
| `components/ui/Button.module.css:15`, `common/PillBadge.module.css:10`, `common/ViewToggle.module.css:51` | `white-space: nowrap` | Long translations overflow narrow footers/toggles; review at 375 px |
| `components/common/ConfirmDialog.jsx:12-13` | defaults 'Confirm'/'Cancel' | i18n defaults |
| `components/common/DataTable.jsx:13`, `DataTable.module.css:15-17` | sr-only caption; `min-width:720px`; `text-align:left` | OK for LTR languages |
| `components/common/StatCard.jsx:7` + `hooks/useCountUp.js:3,12,38` | Animates **pre-formatted strings**. The regex `^(\D*)(\d[\d,]*)(\D*)$` treats `,` as a thousands separator and re-formats with `'en-US'` | **Bug for es/fr:** "12,5 %" parses as 125 → shows "125 %". "1.284"/"1 284" silently skip the animation. StatCard should take a number plus a formatter. |
| `components/common/PageTitle.module.css:17`, `SectionTitle`, `EmptyState`, `FilterChips`, `NoticeBanner`, `RowActionLink`, `SegmentedTabs`, `StatusBadge`, `PillBadge` | Content comes from callers. SegmentedTabs/ViewToggle indicators slide with `translateX` from the left | LTR only, which is fine for en/es/fr. No data. |

---

## 4. Auth (in scope: SignIn, SignUp, WorkspacePicker, validation, session, hero, workspaceChoices + shared auth components)

### 4.1 `features/auth/routes.jsx` (26)
Public routes: `/sign-in` (candidate), `/sign-up`, `/recruiter/sign-in`, `/recruiter/sign-up`, `/admin/sign-in`, `/recruiter/onboarding/*`. These are absolute paths, so they win over the workspace catch-alls. **New public routes** (§8): `/forgot-password`, `/reset-password`, `/sign-up/check-email`, `/verify-email`. Recruiter variants are covered in Q6/Q9.

### 4.2 `SignInPage.jsx` (111) + `.module.css` (41)
- Per-portal copy `SIGN_IN_COPY` `:19-43`: helpers `:22,29,37`, lead `:23,30`, email placeholders `:24` `you@example.com` and `:31,38` `you@company.com`, **admin notice `:39-40`** "…Production accounts require an invitation and server-side approval; this opens the demo only." (demo copy, Q13). Hero `:33,41`.
- Form: email `:72-81` (type email, `autoComplete="email"`), password `:82-90` (`current-password`). No "Forgot password?" link today. Submit `:97-99` "Signing in…"/"Sign in". Switch prompt `:102-106` "**New to matchpoint?** Sign up" (brand, Q2). `DemoNote` `:108`.
- Action today `:56-64`: validate → `startSession(workspace)` → **fake 500 ms `setTimeout`** → navigate to basePath. No network.
- Server: **POST /api/auth/login** `{ email, password, portal: 'candidate'|'recruiter'|'admin' }`
  - `200 { token, user }` (user = id, role, status, fullName, email, language, country, plan, onboarding flags, permissions for admin)
  - `401 INVALID_CREDENTIALS` (generic)
  - `403 EMAIL_NOT_VERIFIED` (only after a correct password) → inline alert with **Resend link** (POST /api/auth/verify-email/resend)
  - `403 WRONG_PORTAL {role}` (Q4)
  - `403 RECRUITER_PENDING | RECRUITER_REJECTED | RECRUITER_ONBOARDING {step}` (Q6)
  - `403 ACCOUNT_SUSPENDED`
  - `429 TOO_MANY_ATTEMPTS` (Q8)
  - Then redirect by `user.role`: candidate whose onboarding isn't done → `/candidate/onboarding` (Q5); otherwise `?next` or basePath.
- **Client validation (exact), `utils/validation.js:54-59` called at `:58` with `copy.emailPlaceholder`:**
  - email: blank (after `trim`) → "Enter your email address."; fails `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (`:7`, tested on the trimmed value `:15`) → "Enter a valid email address, like {example}." where example = `you@example.com` (candidate) or `you@company.com` (recruiter, admin).
  - password: empty string → "Enter your password." (whitespace-only **passes**; no length rule on sign-in).
  - The raw (untrimmed) email is what would be sent, so the server must `trim().toLowerCase()`.

### 4.3 `SignUpPage.jsx` (100) + `.module.css` (20): candidate
- Fields: fullName `:48-56` (placeholder **"Alex Morgan"** `:52`, a demo name used as placeholder), email `:57-66`, password `:67-77` with hint `:73` "Use at least 8 characters. **Don't use a real password in this demo.**", confirm `:78-86`.
- Consent checkbox `:87-89` "I understand that this demo saves profile changes on this device. No real account is created." It only disables the button (`CreateAccountButton` `disabled={!understood}` `:90`) and has no error message (Q12).
- Today `:28-36`: validate → `startSession('candidate')` → fake 500 ms → `/candidate/onboarding`.
- Server (decision: verify before login): **POST /api/auth/candidate/register** `{ fullName, email, password, language, country, termsAccepted, termsVersion }` → `201 { status: 'verification_sent' }` (no token) → navigate to `/sign-up/check-email` with the email in router state. `409 EMAIL_TAKEN` is an enumeration trade-off; recommend a generic message plus an email to the owner (folded into Q5).
- **Client validation (exact), `validation.js:61-67`:**
  - fullName blank (trim) → "Enter your full name."
  - email → same rules and messages as sign-in, example `you@example.com`
  - password: empty → "Enter a password."; `length < 8` (UTF-16 length, untrimmed, no maximum, no composition rule) → "Use at least 8 characters." (`:40-48`, `MIN_PASSWORD_LENGTH = 8` `:8`)
  - confirmPassword: empty → "Re-enter your password."; ≠ password (only checked when password is non-empty) → "Passwords do not match."
  - The server must enforce the same rules (Q3) and return codes (Q16).

### 4.4 `WorkspacePicker.jsx` (57) + `.module.css` (91); `data/workspaceChoices.js` (14)
- Candidate/Recruiter tiles flip to the same screen for the other role (`SIGN_IN_CHOICES` `:4-7`, `SIGN_UP_CHOICES` `:9-12`); admin gets a single static tile (`ADMIN_CHOICES` `:14`). Label `:21` "Choose your workspace", helper per page.
- With one role per account this is portal selection, not account type. Login behaviour on mismatch → Q4. Labels → i18n.

### 4.5 Shared auth components
- `AuthIntro.jsx:7` eyebrow "Your next chapter starts here" (uppercase CSS `AuthIntro.module.css:6`); titles "Welcome back." / "Create your account."
- `AuthSwitchPrompt.jsx` (link + page flip).
- `CreateAccountButton.jsx:16` "Creating account…"/"Create account".
- `DemoNote.jsx:7-8` "Demo only. Credentials are not sent or stored…" → remove (Q13).
- `useFormState.js` (20): pure form state, keep.
- `data/hero.js:2` `LOCAL_WORKMAN_HERO.footer` "AI Job & Talent Matching Platform · Local Workman" → i18n plus brand.

### 4.6 `utils/session.js` (39): replace entirely
- `SESSION_KEY='lwm-session'` `:8`, groups `{candidate:'member', recruiter:'member', admin:'admin'}` `:9` (the shared 'member' existed only for the WorkspaceSwitch), `startSession` `:13-20`, `endSession` `:22-29`, `hasSession` `:31-39`, in-memory fallback `:11`.
- New: a token store (`getToken`/`setToken`/`clearToken`) read by RTK Query `fetchBaseQuery({ prepareHeaders })`, plus a `baseQueryWithReauth` that clears the token and redirects on 401. The key must **not** start with `lwm.` while legacy key-wiping code exists (`features/candidate/settings/utils/localData.js:23-25`, `features/recruiter/settings/pages/DataAccountPage.jsx:33-35`; both go away with "Reset demo removed").

### 4.7 `utils/validation.js` (118): full rule list (incl. out-of-scope recruiter rules sharing the file)
- `checkEmail` `:13-17`; `checkPhone` `:19-26` (`^\+?[\d\s().-]+$`, 7–15 digits, "Enter your phone number." / "Enter a valid phone number, using 7 to 15 digits."); `checkWebsite` `:28-37` (prefixes `https://`, hostname must contain '.', "Enter your company website." / "Enter a valid website, like https://example.com."); `checkPasswordPair` `:40-48` (with `optional` mode).
- `validateRecruiterAccount` `:73-82`: jobTitle "Enter your job title or role.", workEmail "Enter your work email." (example you@company.com), terms "Accept the Terms of Service and Privacy Policy to continue."
- `validateCompany` `:84-97`: "Enter the legal company name.", "Enter the business email." (example hello@company.com), "Enter your industry.", "Select a company size.", **"Enter the country." (free text, should become the country code list)**, "Enter the business address."
- `checkDocumentFileName` `:100-102` `/\.(pdf|jpe?g|png)$/i` "Choose a PDF, JPG, or PNG file."; `validateKyc` `:104-109`.
- `validateOtps` `:111-118` against **`DEMO_OTP='123456'`** (`data/onboarding.js:11`), message "That code does not match. Use the demo code shown below the field."
- **i18n impact:** validators return English sentences, some interpolated (`:15`, `:113`). Change them to return `{ key, params }` and translate in the Field.

---

## 5. Help (`features/help`)

- `routes.jsx:4` is mounted in all three workspaces (`handle.title 'Help'`).
- `HelpPage.jsx` (86): title/lead `:29-30`, search placeholder `:36-37`, sr status `:45` "`${n} help topics found`" (plural), empty state `:77-80`. The first FAQ is open by default `:15`. Search is a client-side `includes` over question+answer `:17-19`, which is not accent-insensitive.
- `data/help.js` (60): `FAQS` `:4-41` are 6 static Q&As, **identical for all three roles**. Several answers are demo-only: `:9` "The current prototype uses local comparisons…", `:15` "This demo doesn't upload or transmit…", `:21` "Text extraction runs in your browser…", `:33` "This is an interactive prototype…", `:36-39` "How do I reset my demo data?" (Reset demo is removed). These need rewriting → Q44.
- `HELP_LINKS` `:47-60`: labels plus per-role targets (privacy: candidate `settings/privacy`, recruiter `settings/data-account`, admin `audit-logs`; matches: candidate `ai-insights` (now plan-gated, so Free users land on the upgrade gate), recruiter `find-candidates`, admin `ai-matching`). Targets are navigation config; labels go to i18n.
- `FaqItem.jsx`, `HelpLinkCard.jsx`: presentational.
- Endpoint (if Q44 → DB): **GET /api/help/faqs?audience={role}** (language from the user/Accept-Language) → `[{ id, question, answer, order }]`.

---

## 6. Payments core (`features/payments`): decision 5, what dies and what survives

| Part | File:line | Fate |
|---|---|---|
| Card form, Luhn, expiry/CVC validation, formatters, demo cards | `utils/card.js:1-59` (entire file); `CheckoutDialog.jsx:6,10-11,21-41,54-79,108-150` | **Dead.** Stripe hosted Checkout collects the card. |
| Client-side recording of attempts (`record`) | `hooks/usePayments.js:23-40`; `CheckoutDialog.jsx:20,64-74` | **Dead.** Payments are written by the **webhook** only. |
| `PAYMENTS_STORAGE_KEY 'lwm.payments'`, `useSharedLocalStorage` | `data/payments.js:11`, `usePayments.js:14` | **Dead.** |
| `SEED_PAYMENTS` + `seed()` + `DECLINED` | `data/payments.js:28-45` | **Dead in the client.** Demo payments (if wanted) come from the server seed script (decided: seed demo data). |
| Ownership by **display name** | `usePayments.js:19-20` (`payerName === WORKSPACES[role].user.name`), `CheckoutDialog.jsx:66` | **Dead.** Server filters by `userId` from the JWT. |
| Client-generated `id`, `reference` (`LWM-xxxxx`), `at`, `currency:'GBP'` | `usePayments.js:27-33`, `payments.js:31` | **Server-generated** (Q43). |
| Demo copy | `CheckoutDialog.jsx:73` failureReason, `:76`, `:86` description, `:147-150` demo cards | **Dead.** |
| Synchronous `onPaid(payment)` contract + `payerRole` prop | `CheckoutDialog.jsx:13-19,77` | **Dead.** Unlocks happen after the webhook. The client learns via the return route (Q38) and RTK tag invalidation (`Me`, `Subscription`, `Enrollments`, `Payments`). `payerRole` comes from the JWT. |
| Dialog shell: Modal + summary block (item name, caption, total) + Cancel / primary button | `CheckoutDialog.jsx:81-106`, CSS `.summary/.itemName/.caption/.total` (`CheckoutDialog.module.css:6-37`) | **Survives** as the "Review & continue to secure payment" step (Q37). Amount and currency come from the server quote; the button calls **POST /api/payments/checkout-sessions** `{ kind:'course'|'subscription', itemId }` → `{ url }` → `window.location.assign(url)`. CSS `.pair`, `.failure`, `.demo` die. |
| `PaymentsTable` | `components/PaymentsTable.jsx:1-60` | **Survives.** Columns reference/payer/item/type/amount/method/status/date/details stay. Data comes from **GET /api/payments** (own) or **GET /api/admin/payments** (all, filters). `method` must handle non-card methods (Q39). Header strings `:19-48` → i18n. |
| `PAYMENT_STATUS` (`paid`, `failed`), `PAYMENT_KIND_LABEL`, `PAYER_ROLE_LABEL` | `data/payments.js:13-19` | **Survive** as enum→i18n-key maps, extended for `pending`/`refunded` (Q40). |
| `formatMoney = (amount) => '£' + amount.toFixed(2)` | `data/payments.js:21` | **Survives, rewritten:** `formatMoney(amountMinor, currency, locale)` via `Intl.NumberFormat(locale, { style:'currency', currency })`. Store **integer minor units**; today amounts are floats (`49`, `9`). |
| `formatPaymentDate` (`toLocaleDateString('en-US')`) | `data/payments.js:24-26` | **Survives, rewritten** with the user format locale (Q31). |

Callers that must change (from the coupling list): `features/candidate/billing/components/PlusGate.jsx:6,46-51`; `features/candidate/billing/data/subscription.js:1,24-30` (`PLUS_CHECKOUT_ITEM` caption "demo: no renewal charges are ever made"); `features/candidate/learning/components/PurchaseDialog.jsx:2`; `features/candidate/onboarding/pages/PlanStepPage.jsx:8`; `features/candidate/settings/pages/BillingSettingsPage.jsx:9-12`; `features/recruiter/learning/components/PurchaseDialog.jsx:2`; `features/recruiter/settings/pages/BillingPage.jsx:3-4`; `features/admin/payments/pages/PaymentsPage.jsx:16-17` (also `:68` "Amount (GBP)" and `:106` "From paid payments, in GBP", which sums mixed currencies once Q30 is decided).

Server side (shared core):
- **POST /api/payments/checkout-sessions**: server prices the item from the DB in the user's currency, sets `client_reference_id=userId`, `metadata{kind,itemId}`, `success_url`/`cancel_url` (Q38), mode `payment|subscription`, `locale` = user language.
- **GET /api/payments/checkout-sessions/:id**: status for the return page.
- **POST /api/stripe/webhook**: raw body, signature check, idempotency on `event.id`. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded|failed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated|deleted`, `charge.refunded`, optionally `payment_intent.payment_failed` (Q40).
- **POST /api/payments/portal-session** (if Q41 = Stripe portal).
- **Entities:**
  - `Payment { reference, userId, payerRole, payerNameSnapshot, kind, itemId, itemNameSnapshot, amountMinor, currency, status, method{type,brand,last4}, failureReason, stripe{checkoutSessionId,paymentIntentId,invoiceId,subscriptionId}, receiptUrl, createdAt, paidAt }`
  - `Subscription { userId, plan, status, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd, cancelAtPeriodEnd }`
  - `StripeEvent { eventId (unique), type, processedAt }`

---

## 7. Hooks, utils, styles

- `hooks/useLocalStorage.js` (34) and `hooks/useSharedLocalStorage.js` (48): the backing store for **53 call sites in 37 files** (§11). After migration they remain only for anonymous prefs and UI conveniences (Q25). `useSharedLocalStorage`'s cross-component sync is replaced by the RTK store.
- `hooks/useCountUp.js` (40): see §3 (decimal-comma bug, `en-US` `:38`).
- `hooks/usePresence.js`, `hooks/useActiveIndicator.js`, `utils/cx.js`, `utils/pageFlip.js`: no data, no i18n impact (pageFlip/indicators are LTR, acceptable).
- `utils/downloadCsv.js` (17): builds CSV in the browser with **no UTF-8 BOM** (`:9`) and a comma delimiter, so Excel garbles é/ñ and es/fr Excel expects `;`. It is used by admin exports (other auditor). Add a BOM or generate exports server-side; translate headers and filenames.
- `styles/variables.css` (82): `--sidebar-width:232px` (`:64`) limits nav label length. Fonts at `:43-44` (see Q36). `styles/globals.css` (82): nothing language-specific. `styles/utilities.css` (116): `.truncate`, `.sr-only`, page-flip `rotateY` and `grow-x` with `transform-origin:left` are all LTR, fine for en/es/fr. RTL is not needed (no RTL languages planned); there are 77 physical left/right declarations if it ever is.

---

## 8. New decisions: required changes in this scope

### 8.1 Candidate email verification before first login
- **New public screens/routes** (in `features/auth/routes.jsx`, using `AuthLayout`):
  1. `/sign-up/check-email`: "Check your inbox" with the address, **Resend** button (cooldown), and "Wrong address? Sign up again" / "Back to sign in".
  2. `/verify-email?token=`: calls **POST /api/auth/verify-email {token}** on mount. States: verifying, success ("Email verified" + Sign in button), **expired** (`410 TOKEN_EXPIRED` → email field + Resend), invalid/already used (`400/409` → Sign in link).
  3. Resend is inline (on check-email, expired, and the sign-in unverified alert): **POST /api/auth/verify-email/resend {email}** → always `202` (throttled).
- **SignInPage reaction:** on `403 EMAIL_NOT_VERIFIED`, show a non-field alert "Confirm your email to sign in. We sent a link to {email}." with a Resend link. No token is stored.
- **SignUpPage:** submit → register mutation → check-email (replaces `startSession` `:34` and the onboarding redirect `:35`). The first successful login then routes to `/candidate/onboarding` (Q5).
- **Recruiters:** today `RecruiterSignUpPage.jsx:43-47` (out of scope, read for context) saves locally and continues to onboarding step 2 without an account. Onboarding step 4 verifies email and phone by OTP (`DEMO_OTP`). Whether recruiters use the same link-before-login flow, and how onboarding steps 2-4 work without a session → Q6.
- **Entities:** `User.emailVerifiedAt`, `User.status`; `EmailToken { userId, type:'verify_email'|'reset_password', tokenHash, expiresAt, usedAt }`; email templates en/es/fr (Gmail SMTP).

### 8.2 Forgot / reset password
- `/forgot-password` (email; confirmation state "If an account exists for {email}, we've sent a link" regardless of outcome) and `/reset-password?token=` (new password + confirm with the `checkPasswordPair` rules `validation.js:40-48`; states: valid, expired/invalid → request a new link, success → Sign in at the role's sign-in page).
- **SignInPage:** add a "Forgot password?" link by the password field (`:82-90`) on candidate/recruiter/admin (Q9).
- **Endpoints:** **POST /api/auth/forgot-password {email}** → `202`; optional **GET /api/auth/reset-password/:token** (pre-validate); **POST /api/auth/reset-password {token, password}** → `200 {role}` | `410` | `400` | `422 WEAK_PASSWORD`. Increment `tokenVersion` to sign out other sessions (Q7/Q9).
- **Files:** `features/auth/routes.jsx`, new `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`, `validation.js` (add `validateForgot`/`validateReset` reusing helpers), `SignInPage.jsx`.

### 8.3 Paid plan unlocks all AI, applying, message replies, job alerts: shell impact
- **Today:** only AI insights is gated, via `features/candidate/billing/components/PlusGate.jsx` (a layout route used by `features/candidate/ai-insights/routes.jsx:7`). Plan state comes from localStorage (`useSubscription.js:7`, key `lwm.candidate.subscription`). Plan copy is in `subscription.js:11-21`, and **the Free plan says "Browse and apply to jobs" (`:12`), which contradicts the decision** (applying needs the plan).
- **Shell needs:**
  1. Nav metadata in `workspaces.js` (e.g. `requires: 'plan'` on AI insights `:56` and Job alerts `:52`; Messages = read allowed, reply gated?) rendered by `Sidebar.jsx` `NavItem` `:18-42` as a lock/plan chip instead of the static 'AI' badge for Free users (Q21).
  2. The promo card becomes the plan upsell for Free users (Q20).
  3. Upgrade entry points: locked nav → gate page; promo card; optionally a plan row in ProfileMenu/sidebar subtitle (Q18); a global handler for **`403 PLAN_REQUIRED`** that opens an upgrade dialog.
  4. GlobalSearch shows gated destinations with a lock.
  5. Help link "Understand your matches" → gate for Free users.
- **Where the shared guard lives (recommendation):** only candidates have a plan, so keep it in `features/candidate/billing/` and export three things:
  - `RequirePlan`: route layout (generalised `PlusGate`), wraps `ai-insights` and `job-alerts`.
  - `PlanGate`: inline wrapper for Apply and Reply buttons.
  - `usePlan()`: reads `me.plan` and `me.entitlements` from `/me`.

  Sidebar and GlobalSearch read the same `me.entitlements`. If recruiters ever get plans (Q24), move it to `components/common/`. The **server enforces** entitlements (`requirePlan` middleware on AI endpoints, POST applications, POST message replies, job-alert CRUD, and the job-alert sender). Client gating is UX only.
- **Plan data:** `PLANS` (`subscription.js:11-21`) → **GET /api/plans** (name, price in the user's currency, features as i18n keys or DB text). The plan name is still open (tracked in project memory).

### 8.4 Course certificate (PDF + verification code): public verification route
- A public route is needed **outside** the workspaces: anything under `/candidate|/recruiter` runs the workspace loader and redirects anonymous visitors to sign-in (`router.jsx:16`).
- Proposal: new `features/certificates/routes.jsx` with absolute paths `/certificates` (enter-a-code form) and `/certificates/:code` (result), imported into `router.jsx` next to `authRoutes`, using `AuthLayout` or a minimal public layout with a language picker (Q35). **GET /api/public/certificates/:code** (no auth, rate-limited) → `{ valid, holderName, courseTitle, issuedAt, revokedAt }`.
- The PDF embeds `${CLIENT_URL}/certificates/${code}`, so CLIENT_URL must be decided (Q46).
- Entity: `Certificate { code (unique, non-guessable), userId, courseId, holderNameSnapshot, courseTitleSnapshot, language, issuedAt, revokedAt }`. → Q45.

### 8.5 Shared payments core: see §6 (dead vs surviving parts, callers, endpoints).

---

## 9. Consolidated endpoint list (this scope)

| Method + path | Payload → response | Used by |
|---|---|---|
| POST /api/auth/candidate/register | `{fullName,email,password,language,country,termsAccepted,termsVersion}` → 201 | SignUpPage |
| POST /api/auth/login | `{email,password,portal}` → `{token,user}` / error codes §4.2 | SignInPage ×3 |
| GET /api/auth/me | → user + plan + entitlements + permissions (admin) + recruiter status + onboarding flags | router loader, Sidebar, ProfileMenu, guards |
| POST /api/auth/logout | → 204 (only if server revocation, Q7) | Sidebar sign-out |
| POST /api/auth/verify-email | `{token}` → 200 `{role}` / 400 / 409 / 410 | /verify-email |
| POST /api/auth/verify-email/resend | `{email}` → 202 | check-email, sign-in, expired page |
| POST /api/auth/forgot-password | `{email}` → 202 | /forgot-password |
| GET /api/auth/reset-password/:token | → 200 / 410 (optional) | /reset-password |
| POST /api/auth/reset-password | `{token,password}` → 200 `{role}` | /reset-password |
| PATCH /api/me/preferences | `{language?,country?}` → user | Header, ProfileMenu |
| GET /api/me/counters | → `{unreadMessages, activeApplications, unreadNotifications?}` (poll 15 s) | Sidebar badges, bell |
| GET /api/meta/countries | → `[{code, currency, defaultLanguage, isRemote, sortOrder}]` | pickers, sign-up |
| GET /api/meta/config | → `{languages:[{code,nativeName}], stripeMode, …}` | pickers, checkout copy |
| GET /api/search?q=&types=&limit= | → grouped results (role- and country-scoped) | GlobalSearch (Q17) |
| GET /api/help/faqs?audience= | → FAQ list in the user's language | HelpPage (Q44) |
| GET /api/plans | → plan(s) with localized price | promo, gate, plan step |
| POST /api/payments/checkout-sessions | `{kind,itemId}` → `{url,sessionId}` | Checkout dialog |
| GET /api/payments/checkout-sessions/:id | → `{status,paymentStatus,payment?}` | return page (Q38) |
| GET /api/payments, GET /api/admin/payments | paging/filters → payments | PaymentsTable |
| POST /api/payments/portal-session | → `{url}` (Q41) | Billing |
| POST /api/stripe/webhook | Stripe events | server |
| GET /api/public/certificates/:code | → certificate status | /certificates/:code |

Entities implied (this scope):
- `User { role, email (unique, lowercased), passwordHash, fullName, avatar, status, emailVerifiedAt, language, country, tokenVersion, termsVersion, termsAcceptedAt, lastLoginAt, failedLogins… }`
- `EmailToken`, `Country`, `Payment`, `Subscription`, `StripeEvent`, `Certificate`, `HelpFaq` (if DB), `Notification` (if Q19 = feed), admin `Role/permissions` (Access Management, open).

---

## 10. Cross-feature coupling (whole `client/src`, AST-free import scan via Node script; every hit)

### 10.1 Imports from another role's / shared feature folder (36)
```
features/admin/applications/pages/ApplicationsPage.jsx:8  -> features/candidate/jobs/data/applications.js
features/admin/applications/pages/ApplicationsPage.jsx:9  -> features/candidate/jobs/hooks/useApplications.js
features/admin/applications/pages/ApplicationsPage.jsx:10 -> features/candidate/jobs/hooks/useJobListings.js
features/admin/jobs/components/JobSummaryModal.jsx:5      -> features/recruiter/jobs/data/jobs.js
features/admin/jobs/components/JobSummaryModal.jsx:6      -> features/recruiter/jobs/data/jobFields.js
features/admin/jobs/pages/JobsPage.jsx:10                 -> features/recruiter/jobs/components/JobStatusBadge.jsx
features/admin/jobs/pages/JobsPage.jsx:11                 -> features/recruiter/jobs/data/jobFields.js
features/admin/jobs/pages/JobsPage.jsx:12                 -> features/recruiter/jobs/hooks/useJobs.js
features/admin/moderation/pages/ModerationPage.jsx:10     -> features/recruiter/jobs/hooks/useJobs.js
features/admin/moderation/utils/jobReviewItem.js:1        -> features/recruiter/jobs/data/jobFields.js
features/admin/overview/pages/OverviewPage.jsx:7          -> features/recruiter/jobs/hooks/useJobs.js
features/admin/payments/pages/PaymentsPage.jsx:16         -> features/payments/components/PaymentsTable.jsx
features/admin/payments/pages/PaymentsPage.jsx:17         -> features/payments/hooks/usePayments.js
features/candidate/billing/components/PlusGate.jsx:6      -> features/payments/components/CheckoutDialog.jsx
features/candidate/billing/data/subscription.js:1         -> features/payments/data/payments.js
features/candidate/jobs/hooks/useJobListings.js:3         -> features/recruiter/company/data/company.js
features/candidate/jobs/hooks/useJobListings.js:4         -> features/recruiter/jobs/data/jobs.js
features/candidate/learning/components/PurchaseDialog.jsx:2 -> features/payments/components/CheckoutDialog.jsx
features/candidate/learning/hooks/useCourseCatalogue.js:2 -> features/admin/courses/hooks/useCourses.js
features/candidate/learning/hooks/useCourseCatalogue.js:3 -> features/admin/courses/utils/learnerCourse.js
features/candidate/onboarding/pages/PlanStepPage.jsx:8    -> features/payments/components/CheckoutDialog.jsx
features/candidate/settings/pages/BillingSettingsPage.jsx:9  -> features/payments/components/CheckoutDialog.jsx
features/candidate/settings/pages/BillingSettingsPage.jsx:10 -> features/payments/components/PaymentsTable.jsx
features/candidate/settings/pages/BillingSettingsPage.jsx:11 -> features/payments/data/payments.js
features/candidate/settings/pages/BillingSettingsPage.jsx:12 -> features/payments/hooks/usePayments.js
features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:2 -> features/candidate/jobs/data/recruiterJobs.js
features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:3 -> features/candidate/jobs/hooks/useApplications.js
features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:4 -> features/candidate/profile/data/profile.js
features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:5 -> features/candidate/profile/utils/profileText.js
features/recruiter/jobs/pages/JobDetailsPage.jsx:7        -> features/candidate/jobs/data/recruiterJobs.js
features/recruiter/jobs/pages/JobDetailsPage.jsx:8        -> features/candidate/jobs/hooks/useApplications.js
features/recruiter/learning/components/PurchaseDialog.jsx:2 -> features/payments/components/CheckoutDialog.jsx
features/recruiter/learning/hooks/useCourseCatalogue.js:2 -> features/admin/courses/hooks/useCourses.js
features/recruiter/learning/hooks/useCourseCatalogue.js:3 -> features/admin/courses/utils/learnerCourse.js
features/recruiter/settings/pages/BillingPage.jsx:3       -> features/payments/components/PaymentsTable.jsx
features/recruiter/settings/pages/BillingPage.jsx:4       -> features/payments/hooks/usePayments.js
```
### 10.2 Non-feature code importing feature code (7)
```
app/router.jsx:3       -> features/auth/utils/session.js
app/router.jsx:6       -> features/auth/routes.jsx
app/router.jsx:7       -> features/candidate/routes.jsx
app/router.jsx:8       -> features/recruiter/routes.jsx
app/router.jsx:9       -> features/admin/routes.jsx
app/workspaces.js:22   -> features/candidate/jobs/hooks/useApplications.js   (sidebar badge)
components/layout/Sidebar.jsx:6 -> features/auth/utils/session.js
```
Plus `import.meta.glob(['./*/routes.jsx','../help/routes.jsx'])` at `features/{admin,candidate,recruiter}/routes.jsx:7`.

### 10.3 What the API layer must preserve (relationships these imports encode)
- **Recruiter jobs → candidate listings:** `useJobListings` merges `lwm.recruiter.jobs` + `lwm.recruiter.company` + `lwm.candidate.profile`. Becomes **GET /api/jobs** (published, country-scoped, match fields computed server-side).
- **Candidate applications → recruiter pipeline/job detail/admin:** `useLiveApplicant`, recruiter `JobDetailsPage`, admin `ApplicationsPage` read the candidate's localStorage directly. Becomes recruiter `GET /api/recruiter/jobs/:id/applications` (applicant snapshot honouring candidate privacy settings) and admin `GET /api/admin/applications`. **Today a recruiter screen reads the candidate's private profile key** (`useLiveApplicant.js:17`), so authorization must replace it.
- **Admin courses → learner catalogues:** `useCourseCatalogue` (candidate and recruiter) reads `lwm.admin.courses`. Becomes **GET /api/courses?audience=** (published only).
- **Recruiter jobs → admin jobs/moderation/overview:** becomes admin endpoints. **Shared enums/labels** (`recruiter/jobs/data/jobFields.js`, `JobStatusBadge.jsx`, `admin/courses/utils/learnerCourse.js`, `candidate/profile/utils/profileText.js`) should move to a shared folder (e.g. `src/shared/`) so admin/candidate don't import recruiter internals.
- **Payments core → 8 consumers** (§6).

### 10.4 Same-role cross-feature imports (80): for completeness
```
admin/access-management/data/accessData.js:1 -> admin/shared/data/users.js
admin/ai-matching/components/PolicySidebar.jsx:5 -> admin/audit-logs/utils/formatDate.js
admin/ai-matching/pages/AiMatchingPage.jsx:6 -> admin/audit-logs/hooks/useAuditLog.js
admin/applications/pages/ApplicationsPage.jsx:11 -> admin/shared/data/users.js
admin/candidates/pages/CandidatesPage.jsx:1 -> admin/shared/components/UsersDirectory.jsx
admin/candidates/pages/CandidatesPage.jsx:2 -> admin/shared/data/users.js
admin/moderation/components/ReviewDetails.jsx:2 -> admin/audit-logs/utils/formatDate.js
admin/moderation/pages/ModerationPage.jsx:8 -> admin/audit-logs/hooks/useAuditLog.js
admin/moderation/pages/ModerationPage.jsx:9 -> admin/audit-logs/utils/formatDate.js
admin/overview/pages/OverviewPage.jsx:9 -> admin/shared/data/users.js
admin/payments/pages/PaymentsPage.jsx:8 -> admin/audit-logs/hooks/useAuditLog.js
admin/payments/pages/PaymentsPage.jsx:9 -> admin/audit-logs/utils/formatDate.js
admin/recruiters/pages/RecruitersPage.jsx:1 -> admin/shared/components/UsersDirectory.jsx
admin/recruiters/pages/RecruitersPage.jsx:2 -> admin/shared/data/users.js
admin/reports/components/ExportHistory.jsx:4 -> admin/audit-logs/utils/formatDate.js
admin/reports/data/reports.js:1 -> admin/analytics/data/analytics.js
admin/reports/pages/ReportsPage.jsx:3 -> admin/audit-logs/hooks/useAuditLog.js
candidate/ai-insights/routes.jsx:7 -> candidate/billing/components/PlusGate.jsx
candidate/applications/components/ApplicationActivityModal.jsx:5 -> candidate/jobs/components/JobLogo.jsx
candidate/applications/components/ApplicationActivityModal.jsx:6 -> candidate/jobs/data/applications.js
candidate/applications/components/ApplicationActivityModal.jsx:7 -> candidate/jobs/data/jobUtils.js
candidate/applications/pages/ApplicationsPage.jsx:11 -> candidate/jobs/components/AiJobSummaryModal.jsx
candidate/applications/pages/ApplicationsPage.jsx:12 -> candidate/jobs/components/AiSummaryButton.jsx
candidate/applications/pages/ApplicationsPage.jsx:13 -> candidate/jobs/components/JobLogo.jsx
candidate/applications/pages/ApplicationsPage.jsx:14 -> candidate/jobs/data/applications.js
candidate/applications/pages/ApplicationsPage.jsx:15 -> candidate/jobs/data/jobUtils.js
candidate/applications/pages/ApplicationsPage.jsx:16 -> candidate/jobs/hooks/useApplications.js
candidate/applications/pages/ApplicationsPage.jsx:17 -> candidate/jobs/hooks/useJobListings.js
candidate/jobs/hooks/useJobListings.js:5 -> candidate/profile/data/profile.js
candidate/onboarding/pages/PlanStepPage.jsx:6 -> candidate/billing/data/subscription.js
candidate/onboarding/pages/PlanStepPage.jsx:7 -> candidate/billing/hooks/useSubscription.js
candidate/onboarding/pages/PreferencesStepPage.jsx:7 -> candidate/profile/data/profile.js
candidate/onboarding/pages/StoryStepPage.jsx:6 -> candidate/cv/components/UploadDropzone.jsx
candidate/onboarding/pages/StoryStepPage.jsx:7 -> candidate/cv/data/cvVersions.js
candidate/onboarding/pages/StoryStepPage.jsx:8 -> candidate/cv/utils/cvVersions.js
candidate/overview/components/ApplicationActivityCard.jsx:5 -> candidate/jobs/components/JobLogo.jsx
candidate/overview/components/ApplicationActivityCard.jsx:6 -> candidate/jobs/data/applications.js
candidate/overview/components/ApplicationActivityCard.jsx:7 -> candidate/jobs/data/jobUtils.js
candidate/overview/components/ApplicationActivityCard.jsx:8 -> candidate/jobs/hooks/useApplications.js
candidate/overview/components/ApplicationActivityCard.jsx:9 -> candidate/jobs/hooks/useJobListings.js
candidate/overview/pages/OverviewPage.jsx:10 -> candidate/jobs/components/JobCard.jsx
candidate/overview/pages/OverviewPage.jsx:11 -> candidate/jobs/data/jobUtils.js
candidate/overview/pages/OverviewPage.jsx:12 -> candidate/jobs/hooks/useApplications.js
candidate/overview/pages/OverviewPage.jsx:13 -> candidate/jobs/hooks/useJobListings.js
candidate/overview/pages/OverviewPage.jsx:14 -> candidate/jobs/hooks/useSavedJobs.js
candidate/profile/pages/ProfilePage.jsx:11 -> candidate/cv/data/cvVersions.js
candidate/settings/pages/BillingSettingsPage.jsx:7 -> candidate/billing/data/subscription.js
candidate/settings/pages/BillingSettingsPage.jsx:8 -> candidate/billing/hooks/useSubscription.js
candidate/settings/pages/DataAccountSettingsPage.jsx:8 -> candidate/cv/data/cvVersions.js
candidate/settings/pages/DataAccountSettingsPage.jsx:9 -> candidate/profile/data/profile.js
candidate/settings/pages/DataAccountSettingsPage.jsx:10 -> candidate/verification/data/verification.js
candidate/settings/utils/localData.js:1 -> candidate/cv/data/cvVersions.js
candidate/settings/utils/localData.js:2 -> candidate/learning/data/courses.js
candidate/settings/utils/localData.js:3 -> candidate/profile/data/profile.js
candidate/settings/utils/localData.js:4 -> candidate/profile/utils/profileText.js
candidate/settings/utils/localData.js:5 -> candidate/verification/data/verification.js
recruiter/applications/pages/ApplicationsPage.jsx:9 -> recruiter/overview/components/SectionHeading.jsx
recruiter/applications/pages/ApplicationsPage.jsx:10 -> recruiter/hiring-pipeline/components/StageSelect.jsx
recruiter/applications/pages/ApplicationsPage.jsx:11 -> recruiter/hiring-pipeline/data/pipeline.js
recruiter/applications/pages/ApplicationsPage.jsx:12 -> recruiter/hiring-pipeline/hooks/usePipeline.js
recruiter/find-candidates/hooks/useMatchJob.js:2 -> recruiter/jobs/hooks/useJobs.js
recruiter/find-candidates/pages/CandidateProfilePage.jsx:6 -> recruiter/hiring-pipeline/data/pipeline.js
recruiter/find-candidates/pages/CandidateProfilePage.jsx:7 -> recruiter/hiring-pipeline/hooks/usePipeline.js
recruiter/hiring-pipeline/hooks/useLiveApplicant.js:6 -> recruiter/jobs/data/jobs.js
recruiter/hiring-pipeline/hooks/usePipeline.js:2 -> recruiter/find-candidates/data/candidates.js
recruiter/learning/pages/CourseDetailsPage.jsx:8 -> recruiter/overview/components/SectionHeading.jsx
recruiter/learning/pages/LearningPage.jsx:8 -> recruiter/overview/components/SectionHeading.jsx
recruiter/overview/pages/OverviewPage.jsx:8 -> recruiter/find-candidates/hooks/useShortlist.js
recruiter/overview/pages/OverviewPage.jsx:9 -> recruiter/jobs/components/AiJobSummary.jsx
recruiter/overview/pages/OverviewPage.jsx:10 -> recruiter/jobs/components/JobsTable.jsx
recruiter/overview/pages/OverviewPage.jsx:11 -> recruiter/jobs/hooks/useJobs.js
recruiter/shortlists/pages/ShortlistsPage.jsx:7 -> recruiter/find-candidates/components/CandidateCard.jsx
recruiter/shortlists/pages/ShortlistsPage.jsx:8 -> recruiter/find-candidates/components/CompareModal.jsx
recruiter/shortlists/pages/ShortlistsPage.jsx:9 -> recruiter/find-candidates/components/DiscoveryToolbar.jsx
recruiter/shortlists/pages/ShortlistsPage.jsx:10 -> recruiter/find-candidates/components/SortSelect.jsx
recruiter/shortlists/pages/ShortlistsPage.jsx:11 -> recruiter/find-candidates/data/candidates.js
recruiter/shortlists/pages/ShortlistsPage.jsx:12 -> recruiter/find-candidates/hooks/useMatchJob.js
recruiter/shortlists/pages/ShortlistsPage.jsx:13 -> recruiter/find-candidates/hooks/useShortlist.js
recruiter/shortlists/pages/ShortlistsPage.jsx:14 -> recruiter/find-candidates/utils/discovery.js
recruiter/shortlists/pages/ShortlistsPage.jsx:15 -> recruiter/hiring-pipeline/hooks/useLiveApplicant.js
```
(All paths under `features/`.)

Static identity coupling (whole src): `WORKSPACES[...].user` is read by `features/payments/components/CheckoutDialog.jsx:66`, `features/payments/hooks/usePayments.js:19` and `features/recruiter/settings/pages/DataAccountPage.jsx:73-74` (`workspace.user.name/subtitle`). Hard-coded demo names (Alex Morgan / Sarah Miller / Acme Studio / Workspace admin) appear in 17 files (`app/workspaces.js` ×5, `payments/data/payments.js` ×5, `admin/audit-logs/data/auditEvents.js` ×6, `admin/recruitment/data/recruitment.js` ×4, recruiter/candidate `jobs` data ×3 each, and others). All of these move into the server seed.

---

## 11. Storage access (whole `client/src`; every hit)

### 11.1 Direct `localStorage` / `sessionStorage` API calls
| File:line | Call | Key | Fate |
|---|---|---|---|
| `features/auth/utils/session.js:16` | `localStorage.setItem` | `lwm-session` | Replace with the token store |
| `features/auth/utils/session.js:25` | `localStorage.removeItem` | `lwm-session` | " |
| `features/auth/utils/session.js:34` | `localStorage.getItem` | `lwm-session` | " |
| `features/candidate/settings/utils/localData.js:23` | `Object.keys(localStorage)` | all `lwm.` / `lwm.candidate.` | Delete ("Reset demo"/local delete removed; Delete my data becomes a server call) |
| `…/localData.js:25` | `removeItem` (bulk) | `lwm.candidate.*`, settings | Delete |
| `…/localData.js:31` | `sessionStorage.setItem` | `lwm.session.candidateData` | Delete |
| `…/localData.js:50` | `setItem` | `lwm.candidate.profile` ← 'null' | Delete |
| `…/localData.js:51` | `setItem` | `lwm.candidate.cv` | Delete |
| `…/localData.js:52` | `setItem` | `lwm.candidate.learning` | Delete |
| `…/localData.js:53` | `setItem` (loop) | applications/jobAlerts/savedJobs | Delete |
| `…/localData.js:60` | `sessionStorage.getItem` | `lwm.session.candidateData` | Delete |
| `…/localData.js:68` | `sessionStorage.removeItem` | `lwm.session.candidateData` | Delete |
| `features/recruiter/settings/pages/DataAccountPage.jsx:33` | `Object.keys(localStorage)` | all `lwm.` | Delete (Reset demo removed) |
| `…/DataAccountPage.jsx:35` | `removeItem` (bulk) | all `lwm.` | Delete |
| `…/DataAccountPage.jsx:36` | `sessionStorage.setItem` | `lwm.session.demoReset` | Delete |
| `…/DataAccountPage.jsx:45` | `sessionStorage.getItem` | `lwm.session.demoReset` | Delete |
| `…/DataAccountPage.jsx:53` | `sessionStorage.removeItem` | `lwm.session.demoReset` | Delete |
| `hooks/useLocalStorage.js:11` / `:23` | `getItem` / `setItem` | any | Keep only for anon prefs/UI conveniences |
| `hooks/useSharedLocalStorage.js:15` / `:38` | `getItem` / `setItem` | any | Remove once callers are migrated |

Comment-only mentions (no access): `features/auth/components/OnboardingLayout.jsx:18`, `features/recruiter/company/data/company.js:2`, `features/recruiter/jobs/data/jobs.js:3`, `features/recruiter/settings/data/account.js:5` (prefix const `:6`, `RESET_FLAG_KEY` `:9`), `hooks/useLocalStorage.js:4`, `hooks/useSharedLocalStorage.js:6`. No `indexedDB` or `document.cookie` anywhere.

### 11.2 Storage-hook call sites (53 call sites in 37 files) → server owner
| File:line | Hook | Key | Becomes |
|---|---|---|---|
| components/layout/WorkspacePreferences.jsx:7 | useLocalStorage | `lwm.location` | `User.country` (anon: local) |
| components/layout/WorkspacePreferences.jsx:8 | useLocalStorage | `lwm.language` | `User.language` (anon: local) |
| features/admin/access-management/hooks/useAccess.js:31 | shared | `lwm.admin.roles` | AdminRole |
| …/useAccess.js:32 | shared | `lwm.admin.userAccess` | admin user access |
| features/admin/ai-matching/hooks/useMatchingPolicies.js:9 | local | `lwm.admin.matching-policies` | MatchingPolicy |
| features/admin/audit-logs/hooks/useAuditLog.js:13 | shared | `lwm.admin.audit-log` | AuditEvent (server-written) |
| features/admin/courses/hooks/useCourses.js:6 | shared | `lwm.admin.courses` | Course |
| features/admin/moderation/hooks/useModerationDecisions.js:9 | local | `lwm.admin.moderation` | ModerationDecision |
| features/admin/reports/pages/ReportsPage.jsx:16 | local | `lwm.admin.reports` | ReportExport |
| features/auth/utils/useOnboardingState.js:11 | local | `lwm.onboarding.data` | Recruiter/Company onboarding record |
| features/auth/utils/useOnboardingState.js:12 | local | `lwm.onboarding.completed` | onboarding step status |
| features/candidate/ai-insights/hooks/useInsightsState.js:13 | local | `lwm.ai-insights.added-skills` | candidate AI state |
| …/useInsightsState.js:24 | local | `lwm.ai-insights.learning-plan` | " |
| …/useInsightsState.js:29 | local | `lwm.ai-insights.saved-roles` | " |
| …/useInsightsState.js:35 | local | `lwm.ai-insights.explanation-feedback` | " |
| features/candidate/billing/hooks/useSubscription.js:7 | shared | `lwm.candidate.subscription` | Subscription |
| features/candidate/cv/pages/CvVersionsPage.jsx:17 | local | `lwm.candidate.cv` | CvVersion |
| features/candidate/job-alerts/hooks/useJobAlerts.js:7 | local | `lwm.candidate.jobAlerts` | JobAlert |
| features/candidate/jobs/hooks/useApplications.js:14 | shared | `lwm.candidate.applications` | Application |
| features/candidate/jobs/hooks/useJobListings.js:15 | local | `lwm.recruiter.jobs` (**cross-role read**) | GET /api/jobs |
| …/useJobListings.js:16 | local | `lwm.recruiter.company` (**cross-role read**) | " |
| …/useJobListings.js:17 | local | `lwm.candidate.profile` | " (server-side match) |
| features/candidate/jobs/hooks/useSavedJobs.js:7 | shared | `lwm.candidate.savedJobs` | SavedJob |
| features/candidate/learning/hooks/useLearning.js:27 | local | `lwm.candidate.learning` | Enrollment/progress |
| features/candidate/onboarding/pages/PreferencesStepPage.jsx:22 | local | `lwm.candidate.profile` | CandidateProfile |
| …/PreferencesStepPage.jsx:23 | local | `lwm.candidate.onboarding` | onboarding state |
| features/candidate/onboarding/pages/StoryStepPage.jsx:22 | local | `lwm.candidate.onboarding` | " |
| …/StoryStepPage.jsx:23 | local | `lwm.candidate.cv` | CvVersion |
| features/candidate/overview/components/InsightCard.jsx:10 | local | `lwm.candidate.overview.insightDismissed` | Q25 |
| features/candidate/profile/pages/ProfilePage.jsx:20 | local | `lwm.candidate.profile` | CandidateProfile |
| …/ProfilePage.jsx:21 | local | `lwm.candidate.cv` | CvVersion |
| features/candidate/settings/pages/DataAccountSettingsPage.jsx:61 | local | `lwm.candidate.profile` | export/delete |
| …:62 | local | `lwm.candidate.cv` | " |
| …:63 | local | `lwm.candidate.verification` | " |
| …:64 | local | `lwm.candidate.settings.privacy` | " |
| …:65 | local | `lwm.candidate.settings.notifications` | " |
| features/candidate/settings/pages/NotificationSettingsPage.jsx:9 | local | `lwm.candidate.settings.notifications` | User.notificationPrefs |
| features/candidate/settings/pages/PrivacySettingsPage.jsx:11 | local | `lwm.candidate.settings.privacy` | User.privacy |
| features/candidate/verification/pages/VerificationPage.jsx:23 | local | `lwm.candidate.verification` | VerificationCheck |
| features/payments/hooks/usePayments.js:14 | shared | `lwm.payments` | Payment (§6) |
| features/recruiter/company/pages/CompanyPage.jsx:31 | local | `lwm.recruiter.company` | Company |
| features/recruiter/find-candidates/hooks/useCandidateActivity.js:12 | shared | `lwm.recruiter.candidate-activity` | CandidateActivity |
| features/recruiter/find-candidates/hooks/useCandidateNotes.js:9 | shared | `lwm.recruiter.candidate-notes` | CandidateNote |
| features/recruiter/find-candidates/hooks/useMatchJob.js:14 | shared | `lwm.recruiter.match-job` | Q25 |
| features/recruiter/find-candidates/hooks/useShortlist.js:13 | shared | `lwm.recruiter.shortlist` | Shortlist |
| features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:17 | local | `lwm.candidate.profile` (**cross-role read**) | applicant snapshot API |
| …/useLiveApplicant.js:18 | local | `lwm.recruiter.jobs` | Job |
| features/recruiter/hiring-pipeline/hooks/usePipeline.js:26 | local | `lwm.recruiter.pipeline` | PipelineStage/placement |
| features/recruiter/jobs/hooks/useJobs.js:17 | local | `lwm.recruiter.jobs` | Job |
| features/recruiter/jobs/pages/CreateJobPage.jsx:32 | local | `lwm.recruiter.jobWizardDraft` | Q25 |
| features/recruiter/learning/hooks/useRecruiterLearning.js:18 | local | `lwm.recruiter.learning` | Enrollment/progress |
| features/recruiter/settings/pages/DataAccountPage.jsx:63 | local | `lwm.recruiter.settings.notifications` | export |
| features/recruiter/settings/pages/NotificationsPage.jsx:10 | local | `lwm.recruiter.settings.notifications` | User.notificationPrefs |

After migration the browser keeps only: the auth token (non-`lwm.` key), anonymous `language`/`country`, and whatever Q25 decides.

---

## 12. Formatting & i18n inventory (whole `client/src`; every hit)

### 12.1 `Intl.*`
- `features/admin/audit-logs/utils/formatDate.js:1` `new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',year:'numeric'})`
- `features/admin/audit-logs/utils/formatDate.js:2` `new Intl.DateTimeFormat('en-US', {…time})`
- `features/admin/courses/utils/courseFormat.js:1` `new Intl.DateTimeFormat('en-US', …)`

### 12.2 `toLocale*` / `localeCompare`
- `features/admin/shared/data/users.js:56` `toLocaleDateString('en-US', …)` (with the `T12:00:00` noon hack)
- `features/candidate/jobs/data/applications.js:23` `toLocaleDateString('en-US', {month:'short',day:'numeric'})` (noon hack)
- `features/payments/data/payments.js:25` `toLocaleDateString('en-US', …)`
- `features/recruiter/find-candidates/pages/CandidateActivityPage.jsx:8` `toLocaleString(undefined, {dateStyle:'medium',timeStyle:'short'})` (browser locale, not the app language)
- `hooks/useCountUp.js:38` `toLocaleString('en-US')`
- `features/candidate/cv/utils/cvVersions.js:62`, `features/recruiter/find-candidates/utils/discovery.js:46`, `features/recruiter/jobs/pages/JobsPage.jsx:30`: `localeCompare` with no locale. Pass the UI locale (accented sort order).

### 12.3 Currency symbols and `$`-templates
- `features/admin/courses/utils/courseFormat.js:8` (comment "£39.00"), `:10` `` `£${price.toFixed(2)}` `` / 'Free', `:23` "Enter a price above £0 and up to £999."
- `features/candidate/billing/data/subscription.js:12` `price:'£0'`, `period:'forever'`; `:16` `price:'£9'`
- `features/candidate/jobs/data/jobUtils.js:9` `` `$${min}k – $${max}k` `` (salaries in **USD**)
- `features/candidate/learning/hooks/useLearning.js:6` `` `£${price.toFixed(2)}` ``
- `features/candidate/profile/utils/profileText.js:8` `` `$${salaryMin}k+ / year` ``
- `features/payments/data/payments.js:21` `formatMoney` `£`
- `features/recruiter/jobs/data/jobFields.js:165` `` `$${…}k` ``
- `features/recruiter/learning/hooks/useRecruiterLearning.js:5` `formatPrice` `£`

### 12.4 Currency codes
- `features/admin/courses/components/CourseFormModal.jsx:79` "Price (GBP)"
- `features/admin/payments/pages/PaymentsPage.jsx:68` CSV header "Amount (GBP)"; `:106` caption "From paid payments, in GBP"
- `features/payments/data/payments.js:31` `currency:'GBP'`; `features/payments/hooks/usePayments.js:32` `currency:'GBP'`
- `features/recruiter/jobs/components/JobStepFields.jsx:91` "Minimum salary (USD per year)", `:97` "Maximum salary (USD per year)"
- `features/recruiter/jobs/data/jobs.js:11` (comment "annual USD")

### 12.5 `toFixed` number formatting
`features/admin/courses/utils/courseFormat.js:10`; `features/admin/payments/pages/PaymentsPage.jsx:76`; `features/candidate/cv/utils/cvVersions.js:20` ("{n} MB" message); `features/candidate/learning/hooks/useLearning.js:6`; `features/candidate/onboarding/utils/onboarding.js:6` ("{n} MB"); `features/payments/data/payments.js:21`; `features/recruiter/jobs/data/jobFields.js:165`; `features/recruiter/learning/hooks/useRecruiterLearning.js:5`. Decimal points are hard-coded, so es/fr need a decimal comma via `Intl.NumberFormat`. Also hand-rolled durations: `features/admin/courses/utils/learnerCourse.js:16-17` (`${h}h ${m}m`).

### 12.6 ISO date literals (seed/mock data; all move to the server seed)
`features/admin/ai-matching/data/matching.js:29`; `features/admin/audit-logs/data/auditEvents.js:21,29,37,45,53,61`; `features/admin/courses/data/courses.js:16,17,18,19,20,21,22,23,24,25,26,27`; `features/admin/moderation/data/moderation.js:13,23,34`; `features/admin/shared/data/users.js:17,27,37,47`; `features/candidate/cv/data/cvVersions.js:27,37,47`; `features/candidate/jobs/data/applications.js:14,15,16`; `features/payments/data/payments.js:39,40,41,42,43,44`; `features/recruiter/jobs/data/jobs.js:35,56,82`.

### 12.7 Month-name / formatted date literals
- `features/admin/overview/data/overview.js:35` "Workspace initialized · Sep 30, 2026" (**static data**)
- `features/candidate/overview/pages/OverviewPage.jsx:47` "Wednesday, September 30, 2026" (**static "today"**)
- comments: `features/admin/audit-logs/utils/formatDate.js:10,15`; `features/admin/courses/utils/courseFormat.js:3`; `features/admin/shared/data/users.js:54`; `features/candidate/jobs/data/applications.js:21`; `features/payments/data/payments.js:23`; `features/candidate/cv/utils/cvVersions.js:5` ("13 Oct 2026, 10:36", produced by a **hand-rolled formatter** with an English `MONTHS` array at `:3`)

### 12.8 Hard-coded weekday/month label arrays
`features/admin/analytics/data/analytics.js:43` `DAYS=['Mon'…'Sun']`; `features/admin/overview/data/overview.js:49,54,63,68`; `features/recruiter/overview/data/overview.js:20` `MOMENTUM_DAYS`; `features/candidate/cv/utils/cvVersions.js:3` `MONTHS`. Use `Intl.DateTimeFormat(locale,{weekday:'short'})`. Weeks start on Monday in the EU (fine), but the labels are English.

### 12.9 Year literals in copy
`components/layout/WorkspaceLayout.jsx:30` "© 2026"; `features/admin/recruitment/data/recruitment.js:23,24,25` "Alex Morgan · 2026-09-28" etc. (static); `features/recruiter/find-candidates/data/candidateDetails.js:56,57` "2024–present", "2023–2024" (mock). Plus the comment hits in 12.7.

### 12.10 Relative-time and period copy
`features/admin/analytics/data/analytics.js:38,39,40` ("This week", "Last week", "Last month"); `features/admin/overview/data/overview.js:47,61`; `features/admin/reports/data/reports.js:17` "Platform activity (this week, illustrative)"; `features/recruiter/overview/data/overview.js:25,31`; `features/candidate/jobs/data/jobUtils.js:13,16` ("1 hour ago", "1 day ago", "{n} days ago", hand-rolled; use `Intl.RelativeTimeFormat`); `features/candidate/overview/pages/OverviewPage.jsx:74` value "6", delta "+6 this week" (**static stat**); `features/candidate/billing/data/subscription.js:12,18` ("forever", "per month"); "per year" sentences `features/admin/jobs/components/JobSummaryModal.jsx:15`, `features/recruiter/jobs/components/AiJobSummary.jsx:17`, `features/candidate/jobs/components/AiJobSummaryModal.jsx:48`; salary labels `features/candidate/profile/components/EditProfileModal.jsx:212`, `features/recruiter/jobs/components/JobStepFields.jsx:91,97`.

### 12.11 Date computation sites (`new Date(` / `Date.now()`)
Client-generated ids/timestamps that become server-generated: `admin/ai-matching/hooks/useMatchingPolicies.js:17,20,34`; `admin/audit-logs/hooks/useAuditLog.js:19,20,30`; `admin/audit-logs/pages/AuditLogsPage.jsx:54` (filename date); `admin/audit-logs/utils/formatDate.js:12,17`; `admin/courses/hooks/useCourses.js:9,15,21`; `admin/courses/utils/courseFormat.js:5`; `admin/moderation/hooks/useModerationDecisions.js:15`; `admin/reports/pages/ReportsPage.jsx:21,24`; `admin/shared/data/users.js:56`; `candidate/billing/hooks/useSubscription.js:11`; `candidate/cv/utils/cvVersions.js:7,41,58`; `candidate/job-alerts/components/JobAlertModal.jsx:36`; `candidate/jobs/data/applications.js:23`; `candidate/jobs/data/recruiterJobs.js:53`; `candidate/jobs/hooks/useApplications.js:6` (local-time "today"); `candidate/verification/pages/VerificationPage.jsx:43`; `payments/data/payments.js:25`; `payments/hooks/usePayments.js:17,29,31`; `payments/utils/card.js:49`; `recruiter/find-candidates/hooks/useCandidateActivity.js:20`; `recruiter/find-candidates/pages/CandidateActivityPage.jsx:8`; `recruiter/hiring-pipeline/hooks/usePipeline.js:46`; `recruiter/jobs/hooks/useJobs.js:24,26`. (All under `features/`.)

### 12.12 English plural ternaries (`=== 1 ?`): 21 in 20 files → i18next plural keys
`admin/access-management/components/ManageAccessModal.jsx:138`; `admin/access-management/pages/UserAccessPage.jsx:48`; `admin/analytics/components/InsightCards.jsx:20`; `admin/audit-logs/pages/AuditLogsPage.jsx:56`; `admin/overview/components/DemandedSkillsCard.jsx:19`; `admin/payments/pages/PaymentsPage.jsx:87`; `candidate/ai-insights/components/MatchCard.jsx:36`; `candidate/ai-insights/pages/AiInsightsPage.jsx:71`; `candidate/ai-insights/pages/JobMatchPage.jsx:124`; `candidate/jobs/components/JobFiltersModal.jsx:30`; `candidate/jobs/data/jobUtils.js:16`; `candidate/jobs/pages/FindJobsPage.jsx:99`; `candidate/jobs/pages/JobDetailsPage.jsx:83,109`; `candidate/profile/utils/profileText.js:4`; `recruiter/find-candidates/pages/FindCandidatesPage.jsx:62`; `recruiter/find-candidates/utils/matchEvidence.js:22`; `recruiter/hiring-pipeline/hooks/useLiveApplicant.js:49`; `recruiter/hiring-pipeline/hooks/usePipeline.js:78`; `recruiter/jobs/data/jobFields.js:207`; `recruiter/shortlists/pages/ShortlistsPage.jsx:71`.

### 12.13 CSS that matters for translations
- `text-transform: capitalize` (wrong for es/fr): `components/layout/Header.module.css:48`, `components/layout/ProfileMenu.module.css:49`.
- `text-transform: uppercase` (OK for es/fr, but adds width): `components/common/PageTitle.module.css:17`, `components/layout/Sidebar.module.css:40`, `features/auth/components/AuthIntro.module.css:6`, `features/auth/components/OnboardingLayout.module.css:76,248`, `features/admin/ai-matching/components/OversightSection.module.css:136`, `features/admin/audit-logs/components/AuditEventRow.module.css:67`, `features/admin/moderation/components/ReviewDetails.module.css:36`, `features/candidate/jobs/pages/JobDetailsPage.module.css:246`, `features/candidate/learning/components/CourseCard.module.css:93`, `features/candidate/learning/pages/LearningDetailsPage.module.css:160`, `features/recruiter/find-candidates/components/MatchInsights.module.css:52`, `features/recruiter/find-candidates/components/ResumePreviewModal.module.css:30`, `features/recruiter/jobs/components/JobWizard.module.css:102`, `features/recruiter/learning/components/CourseCard.module.css:82`, `features/recruiter/learning/components/SuggestionCard.module.css:50`, `features/recruiter/learning/pages/CourseDetailsPage.module.css:139,172`, `features/recruiter/learning/pages/LearningPage.module.css:27`.
- Overflow risks: `Sidebar.module.css:81-85`; `Header.module.css` `.pill` max-width 160 px (`:144-158`), `.menuItem` nowrap (`:203-220`); `ProfileMenu.module.css:30,89-98,108-116`; `ui/Dropdown.module.css:5-15` (no max-height); `AuthLayout.module.css:110-148,189-193`; `WorkspaceLayout.module.css:21-31` (9 px footer row).
- Added after the 38-file CSS scan (§16.1). Long es/fr labels hit these:
  - **Dialog footers:** `components/ui/Modal.module.css:101-107` `.footer` is a flex row (`justify-content:flex-end`, gap 8) with **no `flex-wrap`**, and every Button is `white-space:nowrap` (`components/ui/Button.module.css:15`). Two long labels (e.g. "Annuler" + "Continuer vers le paiement sécurisé") overflow a 375 px-wide dialog (dialog is `width:100%`, `max-width` from the caller, e.g. 480). Affects every Modal/ConfirmDialog, including the checkout step.
  - **Toggles:** `components/common/ViewToggle.module.css:37-56` `.item` is `white-space:nowrap`; the `.wide` variant (`:83-96`) uses equal `1fr` columns capped at `max-width:576px`. The longest translated label sets every column, and the tray overflows narrow screens (no wrap or scroll).
  - **Tabs:** `components/common/SegmentedTabs.module.css:1-8` `.tray` is `display:inline-flex` with no `flex-wrap` or `overflow-x`. Longer tab labels push the tray past its container on phones.
  - **KPI values:** `components/common/StatCard.module.css:29-43` `.value` is 28 px Manrope with no overflow handling. `Intl` currency/number output for fr/es uses non-breaking spaces ("12 345,67 €"), so it can't wrap and overflows narrow KPI cards. Format compactly or allow `overflow-wrap:anywhere`.
  - **Page title actions:** `components/common/PageTitle.module.css:41-46` `.actions` is `flex-shrink:0` with nowrap Buttons. Long translated actions squeeze the title column between 768 and 1023 px (the column layout only starts at 767 px, `:48-58`).
  - **Recruiter onboarding footer:** `features/auth/components/StepFooter.module.css:1-13` puts Back and Continue `space-between` with no wrap, and `.primary` has `min-width:160px`. Long labels overflow at 375 px.
  - **Uppercase eyebrows:** uppercase plus letter-spacing widen them (`components/common/PageTitle.module.css:16-17` 1.8 px; `features/auth/components/AuthIntro.module.css:5-6` 1 px; `components/layout/Sidebar.module.css:39-40` 1.8 px). They wrap rather than overflow, but they add lines in the 100vh-locked auth column (`AuthIntro.module.css:27-50` short-height rules).
  - **Cosmetic:** `components/ui/Checkbox.module.css:1-9` `.checkbox` is `align-items:center`, so with longer multi-line consent text (Terms, Q12) the box centres against the whole paragraph. SignUp overrides this (`SignUpPage.module.css:8-20`); other callers don't.

### 12.14 Other i18n mechanics found
- `<html lang>` static; `document.title` never set.
- String concatenation with translated words: `app/router.jsx:20` (`toLowerCase()`); `Header.jsx:145`, `ProfileMenu.jsx:30` (`{label} workspace`); `Sidebar.jsx:55` (`${label} navigation`); `validation.js:15,113`.
- `<br />` inside a heading: `AuthLayout.jsx:49-55`.
- `⌘ K` on all platforms: `Header.jsx:156`.
- Help search and GlobalSearch filters are not diacritic-insensitive.
- CSV without BOM: `utils/downloadCsv.js:9`.
- `useCountUp` decimal-comma bug (§3).

### 12.15 Size estimate for the i18n work (method)
**Method:** I parsed all 361 `.js/.jsx` files in `client/src` with the Rolldown/Oxc parser that ships in node_modules (`rolldown/parseAst`, `lang:'jsx'`). Counted: (a) JSXText nodes containing letters; (b) string or template values of user-facing JSX attributes (`label`, `title`, `description`, `placeholder`, `aria-label`, `alt`, `hint`, `caption`, `helper`, `lead`, `eyebrow`, `linkLabel`, `confirmLabel`, …); (c) other string literals that look like copy (contain a space, start upper-case, or end with punctuation), excluding imports, ids/slugs, `lwm.` keys, paths/URLs, CSS/MIME/SVG data, comparisons and member keys; (d) template literals with ≥2 English words. Script: `scratchpad/audit-shared.strings.mjs`. A manual check of the `app`, `components` and `payments` outputs showed roughly 5–10 % false positives (e.g. a CSS selector, a thrown dev error).

| Area | Occurrences | Unique | Words |
|---|---|---|---|
| candidate (UI files) | 811 | 696 | 4,038 |
| recruiter (UI files) | 534 | 459 | 2,380 |
| admin (UI files) | 572 | 466 | 2,315 |
| auth (incl. onboarding) | 174 | 141 | 787 |
| help | 23 | 22 | 253 |
| components (layout/ui/common) | 56 | 50 | 175 |
| payments | 56 | 52 | 171 |
| app | 48 | 42 | 87 |
| `data/` files of candidate/recruiter/admin (mock content + enums) | 1,124 | 747 | 4,538 |
| **Total** | **3,398** | **≈2,280** | **≈14,700** |

- UI files alone: about 2,220 occurrences, about 1,890 unique (summed per area), about 9,900 words.
- `data/` files: about 1,170 occurrences, about 4,800 words. Mostly mock content moving to the DB (seeded, not translated in files) plus enum labels/options that become i18n keys.
- **Estimate:** about **2,000–2,300 translation keys**, about **11–12k English words**, translated into **2 languages** (es, fr), so about 23k words to translate. Within that: 172 interpolated templates (ICU params), 21 plural forms, 7 locale-pinned formatters (`'en-US'`), 8 hand-rolled money/size formatters, 3 USD salary formatters, 1 hand-rolled month formatter and 7 English weekday/month arrays.
- My scope alone (app + components + auth + help + payments): about 357 occurrences, about 1,470 words.

---

## 13. Static items to replace (this scope)

| File:line | Static item | Replacement |
|---|---|---|
| index.html:2 | `lang="en"` | current i18n language |
| index.html:7-12 | Google Fonts CDN | self-host (Q36) |
| index.html:13 | title | i18n + brand (Q2) |
| app/router.jsx:20 | "Back to {x} overview" concat | i18n key |
| app/router.jsx:31 | `/` → `/sign-in` always | session-aware redirect |
| app/router.jsx:41 | "Loading…" | i18n, visible loader |
| app/NotFoundPage.jsx:6,11-14 | copy | i18n |
| app/workspaces.js:37,38,65,66,86,87 | demo users + avatars | `/me` |
| app/workspaces.js:42-47 | promo | computed (Q20) |
| app/workspaces.js:51 | Applications badge from localStorage | `/me/counters` |
| app/workspaces.js:56 | 'AI' badge | plan-aware (Q21) |
| app/workspaces.js:39,67,88 | `showWorkspaceSwitch` | delete |
| app/workspaces.js:48-106 | nav labels | i18n; add Messages |
| components/layout/WorkspaceLayout.jsx:30 | "© 2026 Local Workman. · AI Job Portal" | computed year + brand |
| components/layout/WorkspaceLayout.jsx:31-34 | "Interactive demo · Changes saved on this device" | Q23 |
| components/layout/preferencesContext.js:4 | 5 cities | `/meta/countries` |
| components/layout/preferencesContext.js:7 | 3 language names | `/meta/config` (codes + endonyms) |
| components/layout/WorkspacePreferences.jsx:7-8 | localStorage prefs, default 'San Francisco, US' | `/me` + anon local (Q26) |
| components/layout/Header.jsx:79 / ProfileMenu.jsx:70 | "Local marketplace preference for this workspace." | new copy |
| components/layout/Header.jsx:145,155,156 | breadcrumb/search copy, ⌘ | i18n/platform |
| components/layout/Header.jsx:12,26-46,159 | WorkspaceSwitch | delete |
| components/layout/Header.jsx:167-171 | bell target + always-on dot | Q19 |
| components/layout/Sidebar.jsx:57-58 | brand alt "Local Worksmen" | Q2 |
| components/layout/Sidebar.jsx:62,90,97,107 | labels | i18n |
| components/layout/Sidebar.jsx:101-107 | user block / endSession | `/me` / logout |
| components/layout/ProfileMenu.jsx:22,29-30,37,51,83 | avatar, name, role, labels | `/me` + i18n |
| components/layout/GlobalSearch.jsx:16-24,40-41,52,60,79 | nav-only search + copy | Q17 + i18n |
| components/layout/AuthLayout.jsx:41,47,49-57,60,63,69-70 | hero/brand copy | i18n + Q2 |
| features/auth/data/hero.js:2 | footer copy | i18n |
| features/auth/pages/SignInPage.jsx:19-43 | per-portal copy | i18n |
| features/auth/pages/SignInPage.jsx:39-40 | admin "demo" notice | Q13 |
| features/auth/pages/SignInPage.jsx:62-63 | fake session + 500 ms delay | login mutation |
| features/auth/pages/SignInPage.jsx:104 | "New to matchpoint?" | Q2 |
| features/auth/pages/SignInPage.jsx:108 | DemoNote | remove (Q13) |
| features/auth/pages/SignUpPage.jsx:52 | placeholder "Alex Morgan" | generic placeholder |
| features/auth/pages/SignUpPage.jsx:73 | "Don't use a real password in this demo." | remove |
| features/auth/pages/SignUpPage.jsx:87-89 | demo consent | Terms/Privacy (Q12) |
| features/auth/pages/SignUpPage.jsx:34-35 | fake session → onboarding | register → check-email |
| features/auth/pages/SignUpPage.jsx:97 | DemoNote | remove |
| features/auth/components/DemoNote.jsx:7-8 | demo disclaimer | delete component |
| features/auth/components/AuthIntro.jsx:7, CreateAccountButton.jsx:16, WorkspacePicker.jsx:21, workspaceChoices.js:5-6,10-11,14 | copy | i18n |
| features/auth/utils/validation.js (all messages) | English sentences | `{key, params}` |
| features/auth/data/onboarding.js:11 | `DEMO_OTP` | server codes (onboarding auditor) |
| features/auth/utils/session.js:1-39 | demo session | token store |
| features/help/data/help.js:4-41 | 6 FAQs (5 with demo text) | Q44 |
| features/help/data/help.js:47-60 | link labels | i18n |
| features/help/pages/HelpPage.jsx:29-30,36-37,45,77-80 | copy | i18n |
| features/payments/data/payments.js:11,21,25,28-45 | key, £ formatter, en-US date, seed payments | §6 |
| features/payments/hooks/usePayments.js:14-40 | local store, ownership by name, client refs | §6 |
| features/payments/components/CheckoutDialog.jsx:66,73,76,86,147-150 | WORKSPACES name, demo copy | §6 |
| features/payments/utils/card.js:1-59 | card form logic | delete |
| features/payments/components/PaymentsTable.jsx:19-48 | headers | i18n |
| hooks/useCountUp.js:3,38 | en-US / comma parse | number + formatter |
| components/ui/Modal.jsx:36, PasswordField.jsx:16, ConfirmDialog.jsx:12-13, CompanyLogo.jsx:15,24 | a11y/default labels | i18n |
| utils/downloadCsv.js:9 | no BOM | BOM / server export |
| components/layout/Header.module.css:48, ProfileMenu.module.css:49 | `capitalize` | remove |
| components/ui/Dropdown.module.css:5-15, ProfileMenu.module.css:108-116 | unbounded lists | max-height + scroll/search |
| components/layout/Sidebar.module.css:81-85 | nowrap labels | ellipsis or wrap |

---

## 14. Questions (each with options; recommendation marked ★)

**A. Scope / product**
- **Q1.** Where is the line for "nothing static" for *UI text*? (a) ★ UI copy (labels, headings, marketing taglines, validation and empty-state messages) lives in en/es/fr i18n files; business data and staff-editable content (FAQ, plans/prices, countries, legal texts, certificate data) live in the DB. (b) Everything, including UI copy, lives in the DB (a CMS). (c) Everything, including FAQ and legal texts, lives in i18n files.
- **Q2.** Which brand name is used everywhere? Today it is "Local WorkMan" (index.html:13, README), "Local Worksmen" (logo.png raster + alts Sidebar.jsx:57-58, AuthLayout.jsx:69-70, OnboardingLayout.jsx:54-55), "Local Workman" (WorkspaceLayout.jsx:30, hero.js:2), "LOCAL WORKMAN" (AuthLayout.jsx:41), "matchpoint." (AuthLayout.jsx:63, SignInPage.jsx:104) and repo "eujobs". It is also needed for emails, the Stripe statement descriptor and the PDF certificate. (a) ★ "Local WorkMan" with a corrected logo raster. (b) "Local Worksmen" (matches the current logo). (c) Another name. Also: does the logo's English tagline "AI Job Portal" stay in all languages? ★ Yes, as part of the brand.

**B. Auth & session**
- **Q3.** Password rules (client and server)? (a) ★ Minimum 8 characters, maximum 128 (or 72 bytes if bcrypt), no composition rules, reject the most common passwords; this matches today's "Use at least 8 characters". (b) Minimum 8 plus upper/lower/digit. (c) Minimum 12.
- **Q4.** What happens when an account signs in on the wrong portal (candidate on `/recruiter/sign-in`, recruiter on `/sign-in`, any non-admin on `/admin/sign-in`)? (a) ★ Candidate↔recruiter: sign in anyway and redirect to the account's own workspace. Admin portal: only admins can sign in there, and admins can only sign in there; everyone else gets the generic "Email or password is incorrect". (b) Reject with "This is a {role} account, sign in here" plus a link. (c) Merge into one sign-in page and keep the role picker only on sign-up.
- **Q5.** Details of candidate email verification: link lifetime, resend throttling, what the link page does, where the first login lands, and what sign-up says for an already-registered email? (a) ★ 24 h single-use link; resend at most once a minute and 5 a day; the link page shows "Email verified" plus a Sign in button (no auto sign-in, since the link may be opened in another browser); the first successful login goes to `/candidate/onboarding` until onboarding is complete; sign-up with an existing email shows the same "check your inbox" screen and emails the owner instead (no account enumeration). (b) Same, but auto sign-in after verification. (c) A 48 h link and an explicit "This email is already registered" error.
- **Q6.** Recruiter verification and sign-in states. Today onboarding step 4 uses email and phone OTP codes (`DEMO_OTP`), and steps 2–4 run before any account exists. (a) ★ Recruiters verify their email by link before first login, like candidates. After login they continue onboarding steps 2–4 with a session that only allows onboarding endpoints. The phone uses the same on-screen-code mechanism decided for candidates. Sign-in by status: onboarding incomplete → resume the first open step; submitted → "Admin review" status screen; rejected → status screen with the admin's reason and a "Resubmit" option; suspended → blocked message. (b) Keep email and phone OTPs inside onboarding (needs an SMS provider) with no link. (c) Same as (a), but a rejected recruiter cannot resubmit. Sub-question: may a rejected recruiter resubmit? ★ Yes, once their details are edited.
- **Q7.** How long does the JWT last, and how is it revoked? (a) ★ A single access token of about 7 days in localStorage, with `tokenVersion` on the user so a password reset or "sign out everywhere" invalidates it; logout is client-side only. (b) A 15-minute access token plus a refresh token. That conflicts with "client stores bearer" unless the refresh token is an httpOnly cookie. (c) A 24 h token with no revocation.
- **Q8.** How is login brute force handled (no Redis)? (a) ★ An in-memory rate limit per IP and per email (e.g. 5 attempts per 15 min) returning 429 with a translated message; no account lockout. (b) Lock the account after N failures until a reset. (c) Nothing for now.
- **Q9.** Details of forgot/reset password? (a) ★ Available to all three roles with a "Forgot password?" link on all three sign-in pages; one `/forgot-password` route with a `?from=` back-link; 1 h single-use link; the response is always "if an account exists…"; a successful reset signs out all sessions (`tokenVersion++`), marks the email as verified (the link proves ownership) and links to that role's sign-in page. (b) Same, but admins reset only via seed or another admin. (c) Separate `/recruiter/forgot-password` and `/admin/forgot-password` routes.
- **Q10.** Can signed-in users change their password or email, and where does an admin manage their own account (admin Settings is a placeholder, `AdminSettingsPage.jsx:18`)? (a) ★ Add a minimal "Change password" form (current + new) to candidate and recruiter "Data & account" and to an admin Settings page; changing the email is not offered in v1. (b) No in-app change; users use forgot password. (c) Password and email change for all roles.
- **Q11.** What happens to a signed-in visitor on `/`, `/sign-in` or `/sign-up`, and does a session expiry return the user to where they were? (a) ★ Redirect signed-in visitors to their workspace; on 401, clear the token and send them to their sign-in with `?next=<same-origin path>`, returning there after login. (b) Always show the auth pages and always land on Overview.
- **Q12.** Terms and Privacy consent on candidate sign-up. Today the checkbox is demo text (`SignUpPage.jsx:87-89`). Where do the legal texts live? (a) ★ A required checkbox "I accept the Terms of Service and Privacy Policy" with links; store `termsVersion` and `acceptedAt`; legal documents are versioned per language in the DB and shown at public routes `/legal/terms` and `/legal/privacy` (also linked from the footer, Q23). (b) A passive line "By creating an account you agree to…". (c) Links to external pages hosted elsewhere.
- **Q13.** What replaces `DemoNote` (`SignInPage.jsx:108`, `SignUpPage.jsx:97`) and the admin notice (`SignInPage.jsx:39-40`)? (a) ★ Remove DemoNote everywhere; the admin notice becomes "Admin access is restricted to authorised staff. Accounts are created by an administrator." (b) Replace DemoNote with a security tip or Terms links. (c) Keep a "Test environment" note while Stripe is in test mode.
- **Q14.** How are additional admin accounts created? (a) ★ Seed script only in v1; the seeded admin sets or resets their password through the forgot-password flow. (b) Admins invite admins from Access Management (invite email plus a set-password link). (c) A server CLI command.
- **Q15.** (Permission enforcement is already open in project memory; this asks only what the shell does.) If admin custom roles are enforced, does the sidebar hide nav items and GlobalSearch hide destinations the admin's permissions don't allow? (a) ★ Yes: `/me.permissions` filters nav and search, and the API enforces. (b) Show everything and let the API return 403. (c) All admins have full access in v1.
- **Q16.** How does the server report errors? (a) ★ Stable codes plus field names (`{ code:'EMAIL_NOT_VERIFIED', field? , params? }`) that the client translates; the server localizes only emails, AI output and PDFs. (b) The server returns messages already localized to `Accept-Language`.

**C. Shell**
- **Q17.** What does the header "Search anything" (Ctrl/⌘ K) search? (a) Keep today's quick-jump over the workspace's pages (no server). (b) Server search only. (c) ★ Both: pages (client-side, translated, accent-insensitive) plus a debounced (250 ms, ≥2 chars) **GET /api/search** returning up to 5 results per group, scoped by role and country. Candidate: jobs and courses. Recruiter: own jobs, own applicants, discoverable candidates. Admin: users, jobs, courses, payments by reference.
- **Q18.** What do the profile menu and sidebar identity show per role, and where does "Profile" go? (a) ★ Name from `/me`. Subtitle: candidate = plan name ("Free" / plan name), recruiter = company name, admin = admin role name. Avatar = uploaded photo if present, otherwise initials (`ui/Avatar`). Profile link: candidate → My profile, recruiter → Company, admin → admin Settings (if Q10a) or hidden. Add the email under the name in the dropdown. (b) Name and email only, same for all roles. (c) Keep today's labels ("Personal account", "{Role} workspace").
- **Q19.** What does the bell do? Today the dot is always on (`Header.jsx:171`) and the bell links to notification settings. The settings copy says "Show a notification indicator when new recommendations are available". (a) ★ For v1, remove the dot and keep the bell as a link to notification settings, with no feed (no design exists). (b) The dot = unread in-app notifications (application status changes, approval results, payment receipts, job-alert matches) with a dropdown list and "mark all read". This needs a `Notification` collection, `GET /api/notifications` and the 15 s counters poll, and respects the inApp toggle. (c) The dot = "new recommendations since the last visit", computed server-side, and clicking opens recommendations.
- **Q20.** What drives the sidebar promo card (candidate only today)? (a) Profile completion (show "Complete your profile" until the required fields are complete). (b) Plan upsell for Free users. (c) ★ Computed priority from `/me`: Free → plan upsell with the localized price; on the plan but profile incomplete → "Complete your profile" (applying needs a complete profile); otherwise hidden. Copy lives in i18n files. (d) Admin-managed promo content in the DB.
- **Q21.** How does the shell show plan-locked features to Free candidates, what can Free users do in Messages and Job alerts, and what happens on downgrade? (a) ★ AI insights and Job alerts stay visible with a lock/plan chip (instead of the 'AI' badge) that opens the upgrade gate. Messages: Free users can read, and the reply box is replaced by an upgrade prompt. Applying: the Apply button opens the upgrade prompt (and/or "complete profile"). On downgrade or non-payment: existing applications and messages stay readable, job alerts are paused (not deleted), and AI pages lock. (b) Hide locked items. (c) No marker; the gate appears only on click.
- **Q22.** Polling and badge behaviour? (a) ★ One **GET /api/me/counters** call every 15 s (RTK Query `pollingInterval`, paused when the tab is hidden) feeds the Messages unread badge, candidate Applications (active count) and the bell (if Q19b). Badges are hidden when the count is 0 (today Applications shows "0"). No new recruiter or admin badges. (b) Same, plus recruiter "new applications" and admin "pending recruiter approvals" badges. (c) Separate endpoints per badge.
- **Q23.** What replaces the footer note "Interactive demo · Changes saved on this device" (`WorkspaceLayout.jsx:31-34`)? (a) ★ Remove it; footer = "© {current year} {brand}" plus links to Terms, Privacy and an Imprint/Legal notice (public legal pages, Q12). (b) Remove it with no links. (c) Show the app version or environment ("Test mode").
- **Q24.** Are recruiter AI features (AI candidate matching, AI job summaries) free for approved recruiters, or also behind a paid plan? (a) ★ Free for approved recruiters; only candidates have a plan. (b) Recruiters need a paid plan too (price and plan to define).
- **Q25.** Where do pure UI conveniences live: the dismissed overview insight (`lwm.candidate.overview.insightDismissed`), the recruiter's selected match job (`lwm.recruiter.match-job`) and the unfinished job-wizard draft (`lwm.recruiter.jobWizardDraft`)? (a) ★ The draft becomes a server-side draft Job (status `draft`); the other two stay in browser storage per device. (b) All three on the server (`User.uiState`). (c) All three in the browser.

**D. Country / language / formats**
- **Q26.** Where are language and country stored, and what does an anonymous visitor get? (a) ★ Signed-in: stored on the user (server is the source of truth, applied at login, PATCHed on change). Anonymous: localStorage. Default language = the browser language if en/es/fr, otherwise en. The sign-up form gets a required **country** select (new field), defaulting to the browser region if it is in the list, otherwise Remote; it is sent with registration. (b) Browser only. (c) Server only, with anonymous visitors fixed to English/Remote.
- **Q27.** Is the header country the same as the candidate's profile location (used for matching and shown to recruiters)? (a) ★ No. It is a separate browsing preference (`User.country`); the profile keeps its own location and work-eligibility fields. (b) Yes, one field: changing the header changes the profile location.
- **Q28.** What does "Remote" mean? (a) ★ Jobs: listings flagged remote (any country) only. Candidates: people open to remote. Currency EUR. Formats follow the chosen language's default region (en-IE / es-ES / fr-FR). (b) Remote shows all countries. (c) Remote = remote jobs plus all jobs in the EU.
- **Q29.** What is the default language per country, given only en/es/fr exist? (a) ★ Spain → es; France and Luxembourg → fr; Belgium → fr; everyone else, including UK and Remote → en. The default applies only until the user explicitly picks a language, and changing country never overrides an explicit choice. (b) Spain → es, France → fr, everyone else en (Belgium and Luxembourg → en). (c) Always keep the current language when the country changes.
- **Q30.** Which currencies are charged and displayed? Today the plan is £9 and the admin enters course prices in GBP ("Price (GBP)", `CourseFormModal.jsx:79`). The countries are 21 euro-area (incl. Bulgaria since 2026), 6 non-euro EU (CZK, DKK, HUF, PLN, RON, SEK) and the UK. (a) ★ Two charging currencies: GBP for the UK and EUR for every other country including Remote. The admin enters both prices per course and the plan has £9 plus a € price set by the product owner (Stripe Price with `currency_options`). Reports total each currency separately. (b) Charge GBP everywhere and show an approximate local price. (c) Full local currency for the 6 non-euro countries too (8 currencies).
- **Q31.** How are dates and numbers formatted? (a) ★ Locale = `{language}-{country}` (e.g. `en-DE`, `fr-BE`, `es-ES`); Remote → `en-IE`/`es-ES`/`fr-FR`; timezone = the browser's; date-only values (`appliedAt`, `joined`) are stored as dates without time. (b) The country's own locale even when the UI is in English (e.g. `de-DE`). (c) Language only (`en`, `es`, `fr`).
- **Q32.** Does the admin workspace get a country picker? (a) ★ No (keep `showLocation:false`). Admin lists get an explicit "Country" filter defaulting to "All countries"; admin formats use the admin's language and Q31. (b) Yes, the same picker, and it filters every admin list.
- **Q33.** Which lists does the country picker filter? (a) ★ Only discovery surfaces: candidate Find jobs, recommendations and job-alert matching; recruiter Find candidates and Shortlists discovery. A user's own data (applications, recruiter's jobs, pipeline, messages, payments) is never filtered. (b) Every list, including owned data.
- **Q34.** Where does the country list come from, and how are names translated? (a) ★ A seeded `countries` collection (ISO code, currency, default language, isRemote, sort order, enabled) served by **GET /api/meta/countries**; names rendered by `Intl.DisplayNames(language,{type:'region'})`, with "Remote" from i18n. (b) The same collection storing en/es/fr names. (c) A client constant (contradicts "nothing static").
- **Q35.** Do public pages (sign-in/up, forgot/reset, verify-email, certificate check, legal) get a language picker? Nothing in the design shows one. (a) ★ Yes, a small language picker in the `AuthLayout` header area. (b) No; browser language only, changeable after login.
- **Q36.** Should the Inter/Manrope fonts be self-hosted instead of loaded from Google Fonts (`index.html:7-12`, which sends visitor IPs to Google)? (a) ★ Self-host (font files in `client/public` or the `@fontsource` packages). (b) Keep Google Fonts behind a consent banner. (c) Keep as is.

**E. Payments**
- **Q37.** Does checkout show an in-app step before Stripe? (a) ★ Yes: keep the dialog shell with the item, server price, currency and a "Continue to secure payment" button, then redirect to Stripe. (b) Redirect to Stripe immediately on "Buy" or "Upgrade".
- **Q38.** Where does Stripe send the user back? (a) ★ A per-workspace return route `/{role}/payments/return?session_id=…` showing "Confirming your payment…", which polls `GET /api/payments/checkout-sessions/:id`, refreshes the plan, enrolments and payments, then sends the user back to the page they started from (cancel_url = that page). (b) Straight back to the original page with `?checkout=success` and polling there.
- **Q39.** Which payment methods appear on Stripe Checkout? (a) ★ Cards only (plus Apple/Google Pay and Link, which Stripe shows automatically). (b) Also EU methods (SEPA Direct Debit, iDEAL, Bancontact); their success is asynchronous, and the Method column shows the method type when there is no card.
- **Q40.** Which payment records and statuses exist? (a) ★ A row per paid one-time payment and per paid subscription invoice (renewals included); failed renewals recorded as `failed`; refunds made in the Stripe Dashboard reflected by webhook as `refunded`; abandoned or declined Checkout attempts not recorded. The plan locks as soon as the subscription isn't active (no grace period). (b) Also record every declined attempt (`payment_intent.payment_failed`), as today's admin page does. (c) Keep only `paid`.
- **Q41.** How do candidates cancel or manage the subscription? (a) ★ Stripe Customer Portal (**POST /api/payments/portal-session**), with cancel-at-period-end and card updates. (b) An in-app "Cancel plan" button (**POST /api/subscriptions/cancel**, cancel at period end) and no card update. (c) Cancel immediately with no refund.
- **Q42.** VAT, receipts and invoices? (a) ★ In test mode: prices VAT-inclusive, Stripe receipts emailed by Stripe in the user's language, invoices only for subscriptions (Stripe-hosted), no Stripe Tax until going live. (b) Enable Stripe Tax and collect VAT IDs from recruiters (B2B) now. (c) No receipts.
- **Q43.** What payment reference do users see? (a) ★ Keep a server-generated sequence `LWM-000001` (shown in the tables) and store the Stripe IDs alongside. (b) Show Stripe IDs only.

**F. Help / certificates**
- **Q44.** Where do Help FAQs come from, and are they per role? Today there are 6 identical FAQs for all roles and 5 contain demo text. (a) ★ A DB `helpFaqs` collection with per-language text and an `audience` list (candidate/recruiter/admin), seeded with rewritten answers, served by **GET /api/help/faqs?audience=**, no admin editor in v1, search client-side and accent-insensitive. (b) Store them in i18n files per role. (c) A DB collection plus a new admin FAQ editor screen.
- **Q45.** What does the public certificate check look like? (a) ★ Public routes `/certificates` (enter code) and `/certificates/:code` (result) outside the workspaces, showing holder full name, course title, completion date and Valid/Revoked (no email or score). The PDF is issued in the holder's language with a QR code/link to `${CLIENT_URL}/certificates/{code}`. The admin can revoke. Rate-limited. (b) Show only "Valid" plus the course title, no name. (c) No public page; verification only by contacting support.

**G. Infra**
- **Q46.** While the server runs locally, which client URL do verification/reset emails, Stripe success/cancel URLs and certificate links use, and is the Vercel-hosted client expected to talk to the local API? Browsers increasingly block or prompt for public-site → `localhost` requests (Chrome Local Network Access), and Stripe webhooks need `stripe listen --forward-to localhost`. (a) ★ `CLIENT_URL` env var = `http://localhost:5173` during development with the Vite dev proxy to the local API. The Vercel deployment points at a public tunnel (e.g. cloudflared/ngrok) only for demos, until the API is hosted. (b) Use the Vercel URL for everything and accept that it only works on the developer's machine. (c) Host the API now.

---

## 15. Risks
1. **Payments and entitlements become asynchronous and multi-currency.**
   - Eight call sites rely on a synchronous `onPaid` and on client-recorded payments.
   - Ownership is matched by **display name** (`usePayments.js:19`, `CheckoutDialog.jsx:66`).
   - `GBP` and `£` are hard-coded in 5 formatters and 2 records, while currency is supposed to follow the country.
   - A wrong webhook/return/tag-invalidation design either unlocks features without payment or locks out paying users, and the admin totals add up mixed currencies.
2. **Cross-role state is shared through localStorage.**
   - 36 cross-role imports and 53 storage-hook call sites in 37 files, e.g. a recruiter hook reading the candidate's private profile key (`useLiveApplicant.js:17`), and candidate listings reading the recruiter's jobs and company keys.
   - Each one must become an authorized server relationship. Any one missed means a broken screen or a data leak across roles or countries.
3. **The i18n volume is large and English is baked into logic.**
   - About 2,300 unique strings and about 14.7k words; 172 interpolated templates; 21 English plurals.
   - 7 formatters pinned to `en-US`, 8 hand-rolled money/size formatters, USD salary formatters, English weekday/month arrays.
   - Validators return English sentences; `capitalize` CSS; `toLowerCase` concatenation.
   - The `useCountUp` decimal-comma bug ("12,5" → 125).
   - Partial conversion would leave mixed languages and US formats.
4. **The auth state machine is undesigned while the client is binary.**
   - Today there is only `hasSession`. The new states are unverified, recruiter onboarding/pending/rejected, suspended, wrong portal, expired token and plan-gated.
   - All of them touch the router loader, SignInPage, Sidebar and the guards.
   - The JWT in localStorage is exposed to XSS, and legacy code wipes every `lwm.` key; the token key must stay outside that prefix until that code is deleted.
5. **The shell isn't built for real data volumes, longer translations or the hosting split.**
   - The 29-country list sits in unbounded dropdown/menu lists inside a sticky header.
   - Sidebar labels are nowrap with no overflow handling at 232 px, before adding Messages and lock chips.
   - The bell dot is static and the Applications badge shows "0".
   - Running the API locally behind a Vercel-hosted client complicates email links, Stripe webhooks and browser local-network rules.

Other risks: Google Fonts and GDPR (Q36); account enumeration through register/forgot responses; CSV exports without a BOM; the `T12:00:00` date hacks show that date-only values need a clear storage type.

---

## 16. Coverage

`find` over the scope (paths relative to `client/` unless they start with `/`). "Full" = every line read. Line counts were re-checked after the move to `client/`.

| File | Lines | Read |
|---|---|---|
| /.gitignore | 30 | Full (re-read after restructure) |
| /README.md | 32 | Full (context) |
| .oxlintrc.json | 15 | Full |
| index.html | 19 | Full |
| jsconfig.json | 8 | Full |
| package.json | 25 | Full |
| vercel.json | 9 | Full |
| vite.config.js | 13 | Full |
| public/favicon.png | binary | Viewed |
| src/main.jsx | 12 | Full |
| src/app/App.jsx | 6 | Full |
| src/app/NotFoundPage.jsx | 22 | Full |
| src/app/NotFoundPage.module.css | 40 | Full |
| src/app/lazyPage.js | 7 | Full |
| src/app/router.jsx | 46 | Full |
| src/app/workspaces.js | 113 | Full |
| src/components/layout/AuthLayout.jsx | 78 | Full |
| src/components/layout/AuthLayout.module.css | 249 | Full |
| src/components/layout/GlobalSearch.jsx | 83 | Full |
| src/components/layout/GlobalSearch.module.css | 75 | Full |
| src/components/layout/Header.jsx | 180 | Full |
| src/components/layout/Header.module.css | 277 | Full (in segments) |
| src/components/layout/ProfileMenu.jsx | 114 | Full |
| src/components/layout/ProfileMenu.module.css | 152 | Full |
| src/components/layout/Sidebar.jsx | 113 | Full |
| src/components/layout/Sidebar.module.css | 276 | Full (in segments) |
| src/components/layout/WorkspaceLayout.jsx | 41 | Full |
| src/components/layout/WorkspaceLayout.module.css | 57 | Full |
| src/components/layout/WorkspacePreferences.jsx | 14 | Full |
| src/components/layout/preferencesContext.js | 15 | Full |
| src/components/ui/Avatar.jsx / .module.css | 40 / 29 | Full / Full |
| src/components/ui/Button.jsx / .module.css | 42 / 185 | Full / Full |
| src/components/ui/Checkbox.jsx / .module.css | 20 / 65 | Full / Full |
| src/components/ui/CompanyLogo.jsx / .module.css | 28 / 29 | Full / Full |
| src/components/ui/Dropdown.jsx / .module.css | 58 / 58 | Full / Full |
| src/components/ui/Field.module.css | 166 | Full |
| src/components/ui/Icon.jsx | 10 | Full |
| src/components/ui/IconButton.jsx / .module.css | 24 / 32 | Full / Full |
| src/components/ui/Modal.jsx / .module.css | 126 / 123 | Full / Full |
| src/components/ui/Panel.jsx / .module.css | 18 / 11 | Full / Full |
| src/components/ui/PasswordField.jsx | 22 | Full |
| src/components/ui/SelectField.jsx | 44 | Full |
| src/components/ui/Switch.jsx / .module.css | 22 / 47 | Full / Full |
| src/components/ui/TextField.jsx | 67 | Full |
| src/components/ui/TextareaField.jsx | 24 | Full |
| src/components/ui/index.js | 14 | Full |
| src/components/common/ConfirmDialog.jsx | 39 | Full |
| src/components/common/DataTable.jsx / .module.css | 38 / 39 | Full / Full |
| src/components/common/EmptyState.jsx / .module.css | 19 / 62 | Full / Full |
| src/components/common/FilterChips.jsx / .module.css | 24 / 37 | Full / Full |
| src/components/common/NoticeBanner.jsx / .module.css | 10 / 10 | Full / Full |
| src/components/common/PageTitle.jsx / .module.css | 16 / 58 | Full / Full |
| src/components/common/PillBadge.jsx / .module.css | 15 / 58 | Full / Full |
| src/components/common/RowActionLink.jsx / .module.css | 13 / 4 | Full / Full |
| src/components/common/SectionTitle.jsx / .module.css | 17 / 26 | Full / Full |
| src/components/common/SegmentedTabs.jsx / .module.css | 34 / 60 | Full / Full |
| src/components/common/StatCard.jsx / .module.css | 25 / 56 | Full / Full |
| src/components/common/StatusBadge.jsx | 10 | Full |
| src/components/common/ViewToggle.jsx / .module.css | 36 / 101 | Full / Full |
| src/features/auth/routes.jsx | 26 | Full |
| src/features/auth/pages/SignInPage.jsx / .module.css | 111 / 41 | Full / Full |
| src/features/auth/pages/SignUpPage.jsx / .module.css | 100 / 20 | Full / Full |
| src/features/auth/components/WorkspacePicker.jsx / .module.css | 57 / 91 | Full / Full |
| src/features/auth/components/AuthIntro.jsx / .module.css | 12 / 51 | Full / Full |
| src/features/auth/components/AuthSwitchPrompt.jsx / .module.css | 15 / 29 | Full / Full |
| src/features/auth/components/CreateAccountButton.jsx / .module.css | 19 / 7 | Full / Full |
| src/features/auth/components/DemoNote.jsx / .module.css | 11 / 27 | Full / Full |
| src/features/auth/components/compactHint.module.css | 5 | Full |
| src/features/auth/components/TermsConsent.jsx | 19 | Full (shared with recruiter forms) |
| src/features/auth/data/hero.js | 2 | Full |
| src/features/auth/data/workspaceChoices.js | 14 | Full |
| src/features/auth/data/onboarding.js | 42 | Full (DEMO_OTP used by validation.js) |
| src/features/auth/utils/session.js | 39 | Full |
| src/features/auth/utils/validation.js | 118 | Full |
| src/features/auth/utils/useFormState.js | 20 | Full |
| src/features/auth/utils/useOnboarding.js | 11 | Full (context) |
| src/features/auth/utils/useOnboardingState.js | 30 | Full (context; storage list) |
| src/features/auth/pages/RecruiterSignUpPage.jsx | 74 | Full (context only; recruiter auditor) |
| src/features/auth/pages/AdminReviewPage.jsx | 67 | Full (context only; recruiter auditor) |
| src/features/auth/components/OnboardingLayout.jsx | 141 | Lines 1-60 (context only; out of scope) |
| Out of scope (recruiter onboarding auditor), not read: AccountRegistrationPage.jsx (63), CompanyInformationPage.jsx (131), KycVerificationPage.jsx (94), VerifyAccountPage.jsx (111), AdminReviewPage.module.css (118), OnboardingStepPage.module.css (40), RecruiterSignUpPage.module.css (21), OnboardingLayout.module.css (349; only grep hits :76,:248 seen), DocumentUpload.jsx (50), RecruiterAccountFields.jsx (71), StepFooter.jsx (20), StepGroup.jsx (20), StepHeading.jsx (11), TermsConsent.module.css (25). Their CSS modules KycVerificationPage, VerifyAccountPage, DocumentUpload, RecruiterAccountFields, StepFooter, StepGroup and StepHeading **were read fully afterwards**; see §16.1. | — | Excluded by scope |
| src/features/help/routes.jsx | 4 | Full |
| src/features/help/data/help.js | 60 | Full |
| src/features/help/pages/HelpPage.jsx / .module.css | 86 / 69 | Full / Full |
| src/features/help/components/FaqItem.jsx / .module.css | 33 / 56 | Full / Full |
| src/features/help/components/HelpLinkCard.jsx / .module.css | 17 / 30 | Full / Full |
| src/features/payments/components/CheckoutDialog.jsx / .module.css | 155 / 62 | Full / Full |
| src/features/payments/components/PaymentsTable.jsx / .module.css | 60 / 19 | Full / Full |
| src/features/payments/data/payments.js | 45 | Full |
| src/features/payments/hooks/usePayments.js | 43 | Full |
| src/features/payments/utils/card.js | 59 | Full |
| src/hooks/useActiveIndicator.js | 29 | Full |
| src/hooks/useCountUp.js | 40 | Full |
| src/hooks/useLocalStorage.js | 34 | Full |
| src/hooks/usePresence.js | 23 | Full |
| src/hooks/useSharedLocalStorage.js | 48 | Full |
| src/utils/cx.js | 4 | Full |
| src/utils/downloadCsv.js | 17 | Full |
| src/utils/pageFlip.js | 27 | Full |
| src/styles/globals.css | 82 | Full |
| src/styles/utilities.css | 116 | Full |
| src/styles/variables.css | 82 | Full |
| src/assets/images/logo.png, auth-hero.jpg, auth-admin-brand-mark.png | binary | Viewed (text noted §1-2) |
| src/assets/images/avatar-*.svg, src/assets/icons/*.svg (20 files) | binary/SVG | Grepped for `<text>`: none |

### 16.1 CSS modules: explicit per-file coverage (38 files from the coordinator's `find` gap list)
**Method.** Every file was read in full: 31 earlier in the audit, and the 7 marked † on 2026-10-30. All 38 were then scanned with one regex for `content:`, `url(`, `attr(`, `text-transform`, `white-space`, `text-overflow`, `line-clamp`, `letter-spacing`, fixed px `width`/`min-width`/`max-width`/`height` and `minmax(…px`, `text-align:left|right`, physical `margin/padding-left|right` and `left:/right:`, `overflow-wrap`, `word-break` and `hyphens`. Raw hits: `scratchpad/audit-shared.css-scan.txt`.

**Global result:** none of the 38 contains text or data. There is no `url()` and no `attr()`. The only `content:` values are empty decorative pseudo-elements (`SegmentedTabs.module.css:12`, `ViewToggle.module.css:14`). Physical left/right properties appear only where LTR-only is acceptable (en/es/fr).

| File (under `client/src/`) | Lines | Status | Findings |
|---|---|---|---|
| components/common/DataTable.module.css | 39 | read fully + scanned | `.table min-width:720px` `:15` (scrolls inside `.scroll`, OK); `text-align:left` `:17` (LTR, OK); header 10 px text wraps; no risk |
| components/common/EmptyState.module.css | 62 | read fully + scanned | `.description max-width:420px` `:30` / `384px` `:58` wrap normally; no risk |
| components/common/FilterChips.module.css | 37 | read fully + scanned | `.row flex-wrap:wrap` `:3`; chips wrap; no risk |
| components/common/NoticeBanner.module.css | 10 | read fully + scanned | no hits; no risk |
| components/common/PageTitle.module.css | 58 | read fully + scanned | eyebrow uppercase + `letter-spacing:1.8px` `:16-17`; `.actions flex-shrink:0` `:41-46` → **risk** (§12.13); title `letter-spacing:-0.7px` `:30` fine |
| components/common/PillBadge.module.css | 58 | read fully + scanned | `white-space:nowrap` `:10` (badges grow with longer status words; already in §3/§12.13); dot 4 px |
| components/common/RowActionLink.module.css | 4 | read fully + scanned | colour only; no risk |
| components/common/SectionTitle.module.css | 26 | read fully + scanned | `letter-spacing:-0.25px` `:17`; text wraps; no risk |
| components/common/SegmentedTabs.module.css | 60 | read fully + scanned | `content:''` `:12` (decorative); tray `inline-flex` with no wrap `:1-8` → **risk** (§12.13); sliding indicator via `translateX` `:20` (LTR) |
| components/common/StatCard.module.css | 56 | read fully + scanned | `.value` 28 px, no overflow handling `:36-43` → **risk** with localized currency (§12.13); `letter-spacing:-0.7px` `:41` |
| components/common/ViewToggle.module.css | 101 | read fully + scanned | `content:''` `:14`; `.item white-space:nowrap` `:51`; `.wide max-width:576px` with equal columns `:83-92` → **risk** (§12.13) |
| components/ui/Avatar.module.css | 29 | read fully + scanned | colours only; no risk |
| components/ui/Button.module.css | 185 | read fully + scanned | `white-space:nowrap` `:15`; `min-height:40px` `:6` / `32px` `:53` (height only) → feeds the Modal-footer/PageTitle risks |
| components/ui/Checkbox.module.css | 65 | read fully + scanned | `.checkbox align-items:center` `:1-9` (multi-line label cosmetic, §12.13); box 16 px |
| components/ui/CompanyLogo.module.css | 29 | read fully + scanned | colours only; no risk |
| components/ui/Dropdown.module.css | 58 | read fully + scanned | `.panel` has no max-height/overflow-y (`:5-15`, already a risk for the 29-country list); `.start left:0` / `.end right:0` `:52-58` (LTR) |
| components/ui/IconButton.module.css | 32 | read fully + scanned | 36×36 fixed (icon only); no risk |
| components/ui/Modal.module.css | 123 | read fully + scanned | `.footer` flex with no wrap `:101-107` → **risk** (§12.13); header `space-between` `:72-78`, titles wrap; `.body overflow-y:auto` `:96-99` OK |
| components/ui/Panel.module.css | 11 | read fully + scanned | no hits; no risk |
| components/ui/Switch.module.css | 47 | read fully + scanned | fixed sizes and `left:` thumb + `translateX` `:21-46` (LTR, no text); no risk |
| features/auth/components/AuthIntro.module.css | 51 | read fully + scanned | eyebrow uppercase + `letter-spacing:1px` `:1-8`; short-height tightening `:27-50` (§12.13) |
| features/auth/components/AuthSwitchPrompt.module.css | 29 | read fully + scanned | centred text wraps; short-height rules `:18-29`; no risk |
| features/auth/components/CreateAccountButton.module.css | 7 | read fully + scanned | disabled-state styling only; no risk |
| features/auth/components/DemoNote.module.css | 27 | read fully + scanned | no text risk; component to be deleted (Q13) |
| features/auth/components/DocumentUpload.module.css † | 90 | read fully + scanned | `white-space:nowrap` `:29` is on the visually hidden input only; `.fileName overflow-wrap:anywhere` `:82` (good for long file names); the file name is uploaded data (server disk), the title/description wrap; no risk |
| features/auth/components/RecruiterAccountFields.module.css † | 16 | read fully + scanned | 2-column grid collapses below 767 px `:12-16`; no risk |
| features/auth/components/StepFooter.module.css † | 13 | read fully + scanned | `space-between` with no wrap + `.primary min-width:160px` `:1-13` → **risk** (§12.13) |
| features/auth/components/StepGroup.module.css † | 42 | read fully + scanned | icon tile 36 px; title/description wrap; no risk |
| features/auth/components/StepHeading.module.css † | 14 | read fully + scanned | no hits; no risk |
| features/auth/components/WorkspacePicker.module.css | 91 | read fully + scanned | 2-column tiles `:12-17`; admin single tile `minmax(0,227px)` `:20-22` (short labels, fine); short-height rules `:60-91`; no risk |
| features/auth/pages/KycVerificationPage.module.css † | 34 | read fully + scanned | no hits; banner text wraps; no risk |
| features/auth/pages/SignInPage.module.css | 41 | read fully + scanned | admin notice wraps `:8-26`; short-height rules; no risk |
| features/auth/pages/VerifyAccountPage.module.css † | 78 | read fully + scanned | OTP and checklist 2-column grids collapse below 767 px `:11-24,73-77`; `.checkValue overflow-wrap:anywhere` `:66` (emails/phones, good); the OTP grid may disappear if Q6 = email link |
| features/help/components/FaqItem.module.css | 56 | read fully + scanned | `.summary text-align:left` `:26` (LTR); `.answer max-width:718px` `:45` wraps; no risk |
| features/help/components/HelpLinkCard.module.css | 30 | read fully + scanned | label wraps; no risk |
| features/help/pages/HelpPage.module.css | 69 | read fully + scanned | `max-width:768px` search `:18`, `871px` links grid `:30` with `minmax(0,…fr)` columns collapsing below 1023 px `:58-62`; no risk |
| features/payments/components/CheckoutDialog.module.css | 62 | read fully + scanned | `.total white-space:nowrap` `:36` (amount only, fine); `.pair/.failure/.demo` die with the card form (§6); Modal-footer risk applies |
| features/payments/components/PaymentsTable.module.css | 19 | read fully + scanned | `letter-spacing:0.02em` on reference `:4`; no risk |

Context files read outside scope (to apply decisions or describe shell links): `features/candidate/billing/components/PlusGate.jsx` (54), `billing/data/subscription.js` (30), `billing/hooks/useSubscription.js` (16), `candidate/ai-insights/routes.jsx` (24), `candidate/jobs/hooks/useApplications.js` (47), `candidate/settings/routes.jsx`, `candidate/settings/data/settings.js` (lines 1-43), `recruiter/settings/routes.jsx`, `recruiter/settings/data/notifications.js` (18), `admin/settings/routes.jsx`, `admin/settings/pages/AdminSettingsPage.jsx` (29), `features/{candidate,recruiter,admin}/routes.jsx` (9 each), `/IMPLEMENTATION_PLAN.md` (full), `/docs/*` (grep only).

Whole-src greps (run over all 361 JS/JSX files; output is in §10–§12): cross-feature imports (Node import scanner, `scratchpad/audit-shared.coupling.mjs`); localStorage/sessionStorage/indexedDB/cookie; storage-hook call sites; `Intl.`; `toLocale*`/`localeCompare`; `£ € $${`; `GBP|EUR|USD`; `toFixed`; ISO date literals; month-name literals; weekday/month arrays; year literals; relative-time/period copy; `new Date(`/`Date.now()`; `=== 1 ?` plurals; `text-transform`; `lang`/`document.title`/`⌘`. Raw output: `scratchpad/audit-shared.greps.txt` (same-role list: `audit-shared.samerole.txt`; post-move line counts: `audit-shared.counts-now.txt`). AST string count: `scratchpad/audit-shared.strings.mjs`.
