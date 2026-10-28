# Implementation plan

Goal: a complete, responsive React (JSX) frontend for **Local WorkMan (LWM) — AI Job Portal** that matches the Figma file `Local-WorkMan` (page **Final**, node `68:8827`), with working navigation, forms and interactions over mock data persisted to `localStorage`. Figma is the single source of truth for visuals.

## Phase 1 — Project inspection

The repository was empty apart from `CLAUDE.md`, so a clean **React 19 + Vite 8 (JavaScript)** project was established. Added only what the design needs: `react-router-dom` (routing for ~80 screens across three roles) and `lucide-react` (the design system specifies Lucide-style icons; exported Figma icons are Lucide shapes). Styling = plain CSS Modules + CSS variables (no second styling system). Lint = `oxlint` (from the Vite template).

## Phase 2 — Figma discovery (via Figma MCP)

* `get_metadata` on the page node showed **80 desktop screens in three role rows** (Candidate 23, Recruiter 31, Admin 26) plus role labels; every frame is 1440 px wide, so no tablet/mobile variants exist.
* `get_variable_defs`, `get_design_context` and `get_screenshot` on the **D S** page and on shell sub-nodes (sidebars, headers, footer, profile menu, sign-in) produced the tokens and shell. See `docs/DESIGN_SYSTEM.md`, `docs/FIGMA_SCREEN_INVENTORY.md`, `docs/USER_FLOW.md`.

## Architecture

See `docs/CONVENTIONS.md`. Feature folders per role and screen group, each owning `pages/`, `components/`, `data/` and a `routes.jsx` that is auto-collected by the role's `routes.jsx`; shared primitives in `components/ui`, layouts in `components/layout`, cross-feature pieces in `components/common`.

## Build order

1. Foundation (done): tokens, global styles, UI primitives, `AuthLayout`, `WorkspaceLayout` shell for all three roles, router, Candidate sign-in as the pipeline proof.
2. Screens in batches (below), each: Figma context + screenshot → components → page → route → interactions → responsive → render in headless Chrome → compare → fix.
3. Consolidation between waves (promote duplicated components to `components/common`), then a final pass: production build, lint, every route loaded, user journeys, console/asset errors.

## Screen checklist

Legend: `[ ]` not started · `[~]` built · `[x]` built **and** visually compared with the Figma screenshot. Details and notes per frame: `docs/FIGMA_SCREEN_INVENTORY.md`.

### Batch A1 — Auth + recruiter onboarding

- [ ] Candidate · Sign in _Candidate_1 (`104:12563`) → `/sign-in`
- [ ] Candidate · Sign up _Candidate_2 (`104:12737`) → `/sign-up`
- [ ] Recruiter · Sign in _Recruiter_1 (`104:12650`) → `/recruiter/sign-in`
- [ ] Recruiter · Sign in _Recruiter_2 (`104:12849`) → `/recruiter/sign-up`
- [ ] Recruiter · Account registration_3 (`226:8092`) → `/recruiter/onboarding/account`
- [ ] Recruiter · Company information_4 (`226:8309`) → `/recruiter/onboarding/company`
- [ ] Recruiter · KYC & business verification_5 (`226:8536`) → `/recruiter/onboarding/kyc`
- [ ] Recruiter · Verify account_6 (`226:8737`) → `/recruiter/onboarding/verify`
- [ ] Recruiter · Admin review & approval_7 (`226:8957`) → `/recruiter/onboarding/review`
- [ ] Admin · Sign in _Admin_1 (`164:6654`) → `/admin/sign-in`

### Batch B1 — Candidate: overview, jobs, applications, alerts

- [ ] Candidate · Overview_3 (`104:12961`) → `/candidate`
- [ ] Candidate · Overview_Profile dropdown expand_4 (`228:1708`) → `/candidate (profile menu open)`
- [ ] Candidate · Find jobs_7 (`104:13591`) → `/candidate/jobs`
- [ ] Candidate · Job Details Page_5 (`104:22377`) → `/candidate/jobs/:jobId`
- [ ] Candidate · Job Details Page_6 (`128:32285`) → `/candidate/jobs/:jobId (variant)`
- [ ] Candidate · Applications_8 (`104:14457`) → `/candidate/applications`
- [ ] Candidate · Job alerts_9 (`104:15088`) → `/candidate/job-alerts`

### Batch C1 — Candidate: profile, CV, verification, learning, settings

- [ ] Candidate · My profile_10 (`104:15315`) → `/candidate/profile`
- [ ] Candidate · CV & versions_11 (`104:23237`) → `/candidate/cv-versions`
- [ ] Candidate · Verification_12 (`146:38564`) → `/candidate/verification`
- [ ] Candidate · Learning_19 (`104:27577`) → `/candidate/learning`
- [ ] Candidate · Learning Details_20 (`143:36938`) → `/candidate/learning/:courseId`
- [ ] Candidate · Settings_Privacy Policy_21 (`104:24244`) → `/candidate/settings/privacy`
- [ ] Candidate · Settings_Notification_22 (`104:24486`) → `/candidate/settings/notifications`
- [ ] Candidate · Settings_Data & Account_23 (`104:24711`) → `/candidate/settings/data-account`

### Batch D1 — Candidate: AI insights

- [ ] Candidate · AI insights_13 (`104:15600`) → `/candidate/ai-insights`
- [ ] Candidate · AI insights_Skill gap_14 (`104:16124`) → `/candidate/ai-insights/skill-gap`
- [ ] Candidate · AI insights_Skill gap_Review Interaction Design before adding it_15 (`104:27147`) → `/candidate/ai-insights/skill-gap (item selected)`
- [ ] Candidate · AI insights_Improve profile_16 (`104:16488`) → `/candidate/ai-insights/improve-profile`
- [ ] Candidate · AI insights_Job Match_17 (`104:16854`) → `/candidate/ai-insights/job-match`
- [ ] Candidate · AI insights_Why recommended_18 (`104:17305`) → `/candidate/ai-insights/why-recommended`

### Batch E1 — Recruiter: overview, jobs, company, settings, help

- [ ] Recruiter · Overview_ 8 (`104:17687`) → `/recruiter`
- [ ] Recruiter · Overview_ profile popup_9 (`215:163`) → `/recruiter (profile menu open)`
- [ ] Recruiter · Jobs_11 (`104:18307`) → `/recruiter/jobs`
- [ ] Recruiter · Create a job_10 (`104:19757`) → `/recruiter/jobs/new`
- [ ] Recruiter · Jobs_Details (`272:13069`) → `/recruiter/jobs/:jobId`
- [ ] Recruiter · Company_24 (`104:26255`) → `/recruiter/company`
- [ ] Recruiter · Create your next role_25 (`104:26470`) → `/recruiter/company/create-role (suggested)`
- [ ] Recruiter · Settings_Notifications_26 (`104:20004`) → `/recruiter/settings/notifications`
- [ ] Recruiter · Settings_Data & account_27 (`104:26726`) → `/recruiter/settings/data-account`
- [ ] Recruiter · help_28 (`104:26914`) → `/{role}/help (shared)`

### Batch F1 — Recruiter: find candidates + profile tabs

- [ ] Recruiter · Find candidates_12 (`104:18548`) → `/recruiter/find-candidates`
- [ ] Recruiter · Find Candidates_Candidates Overview_13 (`104:20178`) → `/recruiter/find-candidates/:candidateId`
- [ ] Recruiter · Find Candidates_Experience_14 (`104:20486`) → `/recruiter/find-candidates/:candidateId/experience`
- [ ] Recruiter · Find Candidates_Skills_15 (`104:20792`) → `/recruiter/find-candidates/:candidateId/skills`
- [ ] Recruiter · Find Candidates_Education_16 (`104:21108`) → `/recruiter/find-candidates/:candidateId/education`
- [ ] Recruiter · Find Candidates_Resume_17 (`104:24965`) → `/recruiter/find-candidates/:candidateId/resume`
- [ ] Recruiter · Find Candidates_Activity_18 (`104:21780`) → `/recruiter/find-candidates/:candidateId/activity`
- [ ] Recruiter · Find Candidates_Notes_19 (`104:22079`) → `/recruiter/find-candidates/:candidateId/notes`

### Batch G1 — Recruiter: shortlists, applications, pipeline, learning

- [ ] Recruiter · Shortlists_20 (`104:19135`) → `/recruiter/shortlists`
- [ ] Recruiter · Applications_21 (`104:19455`) → `/recruiter/applications`
- [ ] Recruiter · Hiring pipeline_22 (`104:25323`) → `/recruiter/hiring-pipeline`
- [ ] Recruiter · Hiring pipeline_Manage Stage_23 (`104:25746`) → `/recruiter/hiring-pipeline/manage-stage`
- [ ] Recruiter · Recruiter learning (`245:918`) → `/recruiter/learning`
- [ ] Recruiter · Recruiter learning_View Course (`245:1417`) → `/recruiter/learning/:courseId`

### Batch H1 — Admin: overview, candidates, recruiters, jobs, applications

- [ ] Admin · Overview_2 (`148:39548`) → `/admin`
- [ ] Admin · Overview_Expand popup_3 (`208:11645`) → `/admin (profile menu open)`
- [ ] Admin · Candidates_4 (`148:40605`) → `/admin/candidates`
- [ ] Admin · Recruiters_5 (`148:40989`) → `/admin/recruiters`
- [ ] Admin · Jobs_6 (`148:41578`) → `/admin/jobs`
- [ ] Admin · Jobs_AI Summary (`273:14303`) → `/admin/jobs/:jobId/ai-summary`
- [ ] Admin · Applications  _7 (`148:41907`) → `/admin/applications`

### Batch I1 — Admin: recruitment, access management, courses

- [ ] Admin · Recruitment_8 (`164:5183`) → `/admin/recruitment`
- [ ] Admin · Recruitment_Funnel niew_9 (`181:570`) → `/admin/recruitment/funnel`
- [ ] Admin · Access management_Role (`257:9737`) → `/admin/access-management`
- [ ] Admin · Access management_Create custom role (`257:11287`) → `/admin/access-management/roles/new`
- [ ] Admin · Access management_User Access (`257:10217`) → `/admin/access-management/users`
- [ ] Admin · Access management_Manage Access (`257:10603`) → `/admin/access-management/users/:userId`
- [ ] Admin · Courses_10 (`164:5808`) → `/admin/courses`
- [ ] Admin · Courses_10 (`252:7048`) → `/admin/courses (second state)`

### Batch J1 — Admin: AI & matching, analytics, reports, moderation, audit logs

- [ ] Admin · AI & matching_11 (`148:42227`) → `/admin/ai-matching`
- [ ] Admin · AI & matching_Create matching policy_12 (`195:505`) → `/admin/ai-matching/policies/new`
- [ ] Admin · Analytics_13 (`148:42738`) → `/admin/analytics`
- [ ] Admin · Analytics_Line graph_14 (`228:2544`) → `/admin/analytics (line graph view)`
- [ ] Admin · Reports_15 (`168:8001`) → `/admin/reports`
- [ ] Admin · Moderation_Content moderation_16 (`168:8777`) → `/admin/moderation`
- [ ] Admin · Product Designer, Growth_17 (`202:2477`) → `/admin/moderation/content/:itemId`
- [ ] Admin · Moderation_Account review_18 (`202:2852`) → `/admin/moderation/accounts/:accountId`
- [ ] Admin · Moderation_Review pending Account_19 (`168:8455`) → `/admin/moderation/accounts/:accountId/pending`
- [ ] Admin · Audit logs_20 (`168:8238`) → `/admin/audit-logs`

## Validation log

_Filled in as batches finish: build / lint / route checks actually run, and remaining visual discrepancies._
