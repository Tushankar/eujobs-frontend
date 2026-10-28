# Implementation plan

Goal: a complete, responsive React (JSX) frontend for **Local WorkMan (LWM) — AI Job Portal** that matches the Figma file `Local-WorkMan` (page **Final**, node `68:8827`), with working navigation, forms and interactions over mock data persisted to `localStorage`. Figma is the single source of truth for visuals.

## Phase 1 — Project inspection

The repository was empty apart from `CLAUDE.md`, so a clean **React 19 + Vite 8 (JavaScript)** project was established. Added only what the design needs: `react-router-dom` (routing for 80 screens across three roles) and `lucide-react` (the design system specifies Lucide-style icons; the exported Figma icons are Lucide shapes at stroke 1.7). Styling = plain CSS Modules + CSS variables (no second styling system). Lint = `oxlint` (from the Vite template). There is no backend, so all data is mock data.

## Phase 2 — Figma discovery (via Figma MCP)

* `get_metadata` on the page node showed **80 desktop screens in three role rows** (Candidate 23, Recruiter 31, Admin 26); every frame is 1440 px wide, so no tablet/mobile variants exist. A later audit of the other pages (Work Space, Page 2) found **two more candidate screens** (the 2-step profile-completion flow on Page 2), which were added.
* `get_variable_defs`, `get_design_context` and `get_screenshot` on the **D S** page and on the shell sub-nodes (sidebars, headers, footer, profile menu, sign-in) produced the tokens and the shell; every other frame was read the same way by the build agents.
* Outputs: `docs/DESIGN_SYSTEM.md`, `docs/FIGMA_SCREEN_INVENTORY.md`, `docs/USER_FLOW.md`, `docs/CONVENTIONS.md`.

## Architecture and build order

See `docs/CONVENTIONS.md`: feature folders per role and screen group (`pages/`, `components/`, `data/`, `routes.jsx`), auto-collected route files, shared primitives in `components/ui`, layouts in `components/layout`, cross-feature pieces in `components/common`.

1. Foundation: tokens, global styles, UI primitives, `AuthLayout`, `WorkspaceLayout` shell for all three roles, router, Candidate sign-in as the pipeline proof.
2. Ten batches of screens (A1–J1 below), built in parallel by role/feature, each: Figma context + screenshot → components → page → route → interactions → responsive → render in headless Chrome → compare → fix.
3. Consolidation (one badge component, one `PageTitle`, shared tables/tabs/dialogs) and an **independent verification pass**: three verifier agents that did not build the screens re-rendered every frame at 1:1 against its Figma screenshot, measured offsets, fixed regressions and smoke-tested interactions.
4. Final validation (see the log below).

## Screen checklist

All 80 Final frames and the 2 Page 2 frames are implemented and have been rendered and compared with their Figma screenshot (builder + independent verifier). Per-frame notes and remaining differences: `docs/FIGMA_SCREEN_INVENTORY.md`.

### Batch A1 — Auth + recruiter onboarding

- [x] Candidate · Sign in _Candidate_1 (`104:12563`)
- [x] Candidate · Sign up _Candidate_2 (`104:12737`)
- [x] Recruiter · Sign in _Recruiter_1 (`104:12650`)
- [x] Recruiter · Sign in _Recruiter_2 (`104:12849`)
- [x] Recruiter · Account registration_3 (`226:8092`)
- [x] Recruiter · Company information_4 (`226:8309`)
- [x] Recruiter · KYC & business verification_5 (`226:8536`)
- [x] Recruiter · Verify account_6 (`226:8737`)
- [x] Recruiter · Admin review & approval_7 (`226:8957`)
- [x] Admin · Sign in _Admin_1 (`164:6654`)

### Batch B1 — Candidate: overview, jobs, applications, alerts

- [x] Candidate · Overview_3 (`104:12961`)
- [x] Candidate · Overview_Profile dropdown expand_4 (`228:1708`)
- [x] Candidate · Find jobs_7 (`104:13591`)
- [x] Candidate · Job Details Page_5 (`104:22377`)
- [x] Candidate · Job Details Page_6 (`128:32285`)
- [x] Candidate · Applications_8 (`104:14457`)
- [x] Candidate · Job alerts_9 (`104:15088`)

### Batch C1 — Candidate: profile, CV, verification, learning, settings

- [x] Candidate · My profile_10 (`104:15315`)
- [x] Candidate · CV & versions_11 (`104:23237`)
- [x] Candidate · Verification_12 (`146:38564`)
- [x] Candidate · Learning_19 (`104:27577`)
- [x] Candidate · Learning Details_20 (`143:36938`)
- [x] Candidate · Settings_Privacy Policy_21 (`104:24244`)
- [x] Candidate · Settings_Notification_22 (`104:24486`)
- [x] Candidate · Settings_Data & Account_23 (`104:24711`)

### Batch D1 — Candidate: AI insights

- [x] Candidate · AI insights_13 (`104:15600`)
- [x] Candidate · AI insights_Skill gap_14 (`104:16124`)
- [x] Candidate · AI insights_Skill gap_Review Interaction Design before adding it_15 (`104:27147`)
- [x] Candidate · AI insights_Improve profile_16 (`104:16488`)
- [x] Candidate · AI insights_Job Match_17 (`104:16854`)
- [x] Candidate · AI insights_Why recommended_18 (`104:17305`)

### Batch E1 — Recruiter: overview, jobs, company, settings, help

- [x] Recruiter · Overview_ 8 (`104:17687`)
- [x] Recruiter · Overview_ profile popup_9 (`215:163`)
- [x] Recruiter · Jobs_11 (`104:18307`)
- [x] Recruiter · Create a job_10 (`104:19757`)
- [x] Recruiter · Jobs_Details (`272:13069`)
- [x] Recruiter · Company_24 (`104:26255`)
- [x] Recruiter · Create your next role_25 (`104:26470`)
- [x] Recruiter · Settings_Notifications_26 (`104:20004`)
- [x] Recruiter · Settings_Data & account_27 (`104:26726`)
- [x] Recruiter · help_28 (`104:26914`)

### Batch F1 — Recruiter: find candidates + profile tabs

- [x] Recruiter · Find candidates_12 (`104:18548`)
- [x] Recruiter · Find Candidates_Candidates Overview_13 (`104:20178`)
- [x] Recruiter · Find Candidates_Experience_14 (`104:20486`)
- [x] Recruiter · Find Candidates_Skills_15 (`104:20792`)
- [x] Recruiter · Find Candidates_Education_16 (`104:21108`)
- [x] Recruiter · Find Candidates_Resume_17 (`104:24965`)
- [x] Recruiter · Find Candidates_Activity_18 (`104:21780`)
- [x] Recruiter · Find Candidates_Notes_19 (`104:22079`)

### Batch G1 — Recruiter: shortlists, applications, pipeline, learning

- [x] Recruiter · Shortlists_20 (`104:19135`)
- [x] Recruiter · Applications_21 (`104:19455`)
- [x] Recruiter · Hiring pipeline_22 (`104:25323`)
- [x] Recruiter · Hiring pipeline_Manage Stage_23 (`104:25746`)
- [x] Recruiter · Recruiter learning (`245:918`)
- [x] Recruiter · Recruiter learning_View Course (`245:1417`)

### Batch H1 — Admin: overview, candidates, recruiters, jobs, applications

- [x] Admin · Overview_2 (`148:39548`)
- [x] Admin · Overview_Expand popup_3 (`208:11645`)
- [x] Admin · Candidates_4 (`148:40605`)
- [x] Admin · Recruiters_5 (`148:40989`)
- [x] Admin · Jobs_6 (`148:41578`)
- [x] Admin · Jobs_AI Summary (`273:14303`)
- [x] Admin · Applications  _7 (`148:41907`)

### Batch I1 — Admin: recruitment, access management, courses

- [x] Admin · Recruitment_8 (`164:5183`)
- [x] Admin · Recruitment_Funnel niew_9 (`181:570`)
- [x] Admin · Access management_Role (`257:9737`)
- [x] Admin · Access management_Create custom role (`257:11287`)
- [x] Admin · Access management_User Access (`257:10217`)
- [x] Admin · Access management_Manage Access (`257:10603`)
- [x] Admin · Courses_10 (`164:5808`)
- [x] Admin · Courses_10 (`252:7048`)

### Batch J1 — Admin: AI & matching, analytics, reports, moderation, audit logs

- [x] Admin · AI & matching_11 (`148:42227`)
- [x] Admin · AI & matching_Create matching policy_12 (`195:505`)
- [x] Admin · Analytics_13 (`148:42738`)
- [x] Admin · Analytics_Line graph_14 (`228:2544`)
- [x] Admin · Reports_15 (`168:8001`)
- [x] Admin · Moderation_Content moderation_16 (`168:8777`)
- [x] Admin · Product Designer, Growth_17 (`202:2477`)
- [x] Admin · Moderation_Account review_18 (`202:2852`)
- [x] Admin · Moderation_Review pending Account_19 (`168:8455`)
- [x] Admin · Audit logs_20 (`168:8238`)

### Batch K1 — Candidate profile-completion flow (Page 2)

- [x] Candidate · Step 1 of 2 · Your story (`98:11594`)
- [x] Candidate · Step 2 of 2 · Your preferences (`98:11819`)

## Validation log (what was actually run)

Final state of the codebase:

* `npm run lint` (oxlint): **0 errors, 0 warnings**.
* `npm run build`: succeeds (2,526 modules; entry chunk ≈ 352 kB, all page chunks lazy-loaded). The 8 MB auth hero PNG was re-encoded to a 0.6 MB JPEG at the same 4096×2803 resolution.
* **Route sweep:** 84 URLs (every route, with real ids for parameterised ones, including dialog and tab routes) loaded in headless Chrome: **0 console errors, 0 404 panels, 0 router error screens, 0 near-empty pages**. No leftover temporary Figma URLs in `src/`.
* **Per-batch checks** by the builders (lint, build, console, 375 px overflow, scripted interactions) and **independent verification** by three verifier agents: auth + candidate (34 routes at 1440 and 375 px, 0 console errors; sign-in/up, onboarding, jobs, applications, alerts, profile, CV, verification, learning, settings and AI-insights controls exercised), recruiter (33 routes x 2 widths = 66 loads, 0 errors; ~80 actions incl. shortlist and pipeline state sharing), admin (26 routes, ~150 checks incl. role creation, course publish, policy creation, moderation decisions with audit entries, 5 CSV exports). No horizontal page scroll at 375 px on any route tested.
* The two Page 2 onboarding screens were built after the verification pass: the builder ran 53 scripted interaction checks and compared both frames at 1:1; I re-rendered both against the live Figma frames myself (content within ~1–2 px) but they were not checked by a separate verifier agent.
* My own checks: five pages compared against live Figma screenshots (skill gap, onboarding step, profile, header variants, modal frames), the modal-backdrop colours sampled from four Figma frames, the stale `PageTitle` offsets found and fixed, and the whole app re-linted/re-built after every consolidation.
* After the verification pass, fixes made by the moderation and courses builders were re-compared by those builders only; those routes were re-swept by me but not re-verified by an independent agent.

**Not done / not possible:** the repository has no automated test suite (none was provided and none was configured), so there were no existing tests to run. Verification was Chrome-only (headless); no Firefox/Safari, real-device or screen-reader testing. Pixel comparison was by overlay/offset measurement and visual review, not an automated visual-regression tool.

## Decisions and assumptions

* **Design-file inconsistencies, resolved verbatim or by majority:** the brand reads "Local Worksmen" (logo), "Local Workman"/"Local workman" (footer) and "matchpoint." (most copy) — copied as drawn. Footer copy differs between frames; the shell uses "© 2026 Local Workman. · AI Job Portal" (it appears on at least four frames; two others say "Local workman … AI Job & Talent Matching Platform"). The candidate sidebar active fill is `#eaf4ff` (5 frames) rather than `#edf2fd` (3 frames).
* **Modal backdrop:** the D S page documents an ink + blur scrim but none of the modal frames draw one; dialogs match the frames (no scrim/blur). One CSS variable restores the documented recipe (`--modal-backdrop`, `--modal-blur`).
* **Content the frames don't show** (kept minimal): Create-a-job steps 2–9, company-size options, a sixth recruiter-learning course, Manage-stage reorder arrows, extra audit-log events, 12 mock jobs, a few seeded numbers (3 active applications), and the language list (English/Español/Français only changes the label).
* **Shared state across screens:** shortlist (Find candidates / Overview / Shortlists), pipeline (Applications / Hiring pipeline / profile stage), recruiter jobs (Admin Jobs and moderation review), candidate applications (Admin Applications).
* **Candidate profile completion:** the two Page 2 frames are early drafts (old shell and "matchpoint" branding). Only their page content is built, inside the current shell. Candidate **sign-up** lands on step 1; the sidebar "Complete your profile" link opens it; "Find my next chapter" saves to the profile and opens Find jobs. Candidate sign-in still goes straight to the Overview. Not built, on purpose: the old "Saved jobs" and admin "Companies" pages (dropped from Final's sidebars).
* **Admin Settings** has no frame: the route shows an explicit placeholder instead of an invented screen.
* **AI & matching** follows the later layout visible behind the policy modal (policy library), not the earlier single-card frame.
* **Downloads, uploads, payments and auth are not real** (the frames say so): files only record names, there are no file downloads, no payments, and credentials are never sent or stored.

## Known remaining differences

* The header breadcrumb truncates with an ellipsis on the one very long title ("AI Recommendation Explanation") at 1440 px; Figma compresses the action buttons instead.
* Footer placement: pinned to the viewport bottom on short pages (as in the 1024 px frames) but directly after the content in some taller frames.
* The shared `Checkbox` is the DS 16 px custom box; some frames draw a 13 px native-style checkbox. `SelectField` chevron colour and text indent differ slightly.
* A few Figma modal frames show ~5 px blur behind the dialog; others show none (not applied).
* Static numbers on the recruiter Overview funnel/KPIs (the Overview frame disagrees with the pipeline frame); admin-created courses do not appear in the candidate Learning page.
* Residual per-frame offsets of 1–3 px are listed in the inventory.
