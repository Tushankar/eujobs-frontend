# Admin workspace — backend readiness audit

Repo root: `C:\Users\tusha\OneDrive\Desktop\Ai Job`. **Path convention:** the frontend was moved with `git mv` from `src/` to `client/src/` during this audit (file contents unchanged; verified with `git status`: only renames, plus the files that were already modified before the move). All citations are relative to the repo root and start with `client/src/...`. Inside a screen section (§1.x), a bare file name such as `OverviewPage.jsx:20` means the file in that feature's folder `client/src/features/admin/<feature>/{pages,components,data,hooks,utils}/`; `accessData.js` = `client/src/features/admin/access-management/data/accessData.js`, `users.js` = `client/src/features/admin/shared/data/users.js`, `moderation.js` = `client/src/features/admin/moderation/data/moderation.js`, `matching.js` = `client/src/features/admin/ai-matching/data/matching.js`, `courses.js` (admin) = `client/src/features/admin/courses/data/courses.js`, `payments.js` = `client/src/features/payments/data/payments.js`, `jobFields.js` = `client/src/features/recruiter/jobs/data/jobFields.js`. Partial paths that start with a feature name (`overview/data/overview.js`, `recruiter/jobs/data/jobs.js`, `candidate/learning/data/courses.js`, `auth/data/onboarding.js`, …) are under `client/src/features/`. `workspaces.js` = `client/src/app/workspaces.js`; `ProfileMenu.jsx`, `Header.jsx`, `preferencesContext.js` = `client/src/components/layout/`; `useCountUp.js` = `client/src/hooks/useCountUp.js`. §6 lists full `client/src/` paths. `docs/`, `IMPLEMENTATION_PLAN.md`, `README.md` and `CLAUDE.md` stay at the repo root.
Scope: everything under `client/src/features/admin/**` (128 files: 84 JS/JSX + 44 CSS modules, all read in full; see §10 Coverage) plus the modules the admin pages import from other features: `client/src/features/recruiter/jobs/{hooks/useJobs.js,data/jobs.js,data/jobFields.js}`, `client/src/features/candidate/jobs/{hooks/useApplications.js,hooks/useJobListings.js,data/applications.js}`, `client/src/features/payments/**`, `client/src/features/{candidate,recruiter}/learning/**` (catalogue hooks, data, details pages, cards, lesson rows, purchase dialog), `client/src/components/layout/{ProfileMenu,Header,preferencesContext}`, `client/src/app/workspaces.js`, `client/src/hooks/useCountUp.js`, `client/src/features/auth/{data/onboarding.js,pages/KycVerificationPage.jsx,pages/AdminReviewPage.jsx}`, `client/src/features/candidate/verification/data/verification.js`, `docs/FIGMA_SCREEN_INVENTORY.md`, `IMPLEMENTATION_PLAN.md`.

Read-only audit: no repo file was changed.

---

## 0. Headline findings (read first)

1. **Nothing in the admin workspace is server-shaped yet.** Every number, list, chart and AI result is either a constant in `client/src/features/admin/**/data/*.js`, a JSX literal, or derived from localStorage keys owned by other workspaces (`lwm.recruiter.jobs`, `lwm.candidate.applications`, `lwm.payments`). Admin's own persisted state lives in 7 keys: `lwm.admin.roles`, `lwm.admin.userAccess`, `lwm.admin.courses`, `lwm.admin.matching-policies`, `lwm.admin.moderation`, `lwm.admin.reports`, `lwm.admin.audit-log`.
2. **Access management manages the wrong population (or an undefined one).** The "users" in User access are the 4 *marketplace* demo accounts (3 candidates + 1 recruiter) from `client/src/features/admin/shared/data/users.js:11-52` (`accessData.js:109`), and the Candidates/Recruiters "Manage" button opens the role-assignment dialog for a candidate (`UsersDirectory.jsx:55`). The permission catalogue describes employer-team abilities (create/pause jobs, move pipeline, edit company) that the admin UI never performs, and has no permission for AI & matching, analytics, payments export, settings or overview. Nothing reads the assignments anywhere (no enforcement). See Q1–Q8 and the Permission map.
3. **Courses: the admin form collects 8 fields; the learner pages render ~15 fields + per-lesson data + media + assessment + badge.** The gap is papered over in `admin/courses/utils/learnerCourse.js` ("Lesson 1…N", 35 min/lesson) and in both `useCourseCatalogue.js` `fromUpload()` functions (template summary/outcomes, a fixed stock photo). The admin course list and the learner catalogues also disagree: 9 of 12 seed prices, one title, one category. Admin edits to a built-in course's title/price never reach learners; `enrolled`/`purchased` are always 0. Course media keeps only a file name, accepts any file type, and has no size limit.
4. **Moderation decisions have no effect** ("Restrict content" claims to pause a job or hide a profile, but nothing reads `lwm.admin.moderation`). Two queues that the decisions need have **no source or no UI**: nothing lets a user *file* a content report, and there is **no admin screen for candidate credential evidence**: the "Credential reviews" stat is the literal `"0"` (`ModerationPage.jsx:152`). The seed also has a *candidate* pending approval, which contradicts "recruiters must be approved".
5. **Audit coverage is partial.** Only AI-matching (3 events), moderation (4 titles), report export and payments export write audit events. Access management (create/duplicate role, save/revoke access) and Courses (upload/edit/publish/unpublish) write **nothing**. Neither do the Overview, Users, Applications or Audit CSV exports. The actor is always the literal `'Workspace admin'` (`useAuditLog.js:21`).
6. **Localisation is hard-coded:** every date formatter is `en-US`, money is `£` in 4 places and `$…k` for salaries, CSV dates are raw ISO, plural rules are inline English, and the StatCard count-up animation only understands en-US digit grouping (`client/src/hooks/useCountUp.js:3,38`). The admin has **no country picker** (`workspaces.js:89 showLocation: false`), and the location list in the shell is US/global cities, not EU 27 + UK + Remote (`preferencesContext.js:4`).
7. **The coordinator's new decisions (§9) add four large admin areas:** (1) a course builder with lessons, quiz, certificates and real per-course stats, replacing `CourseFormModal`'s lesson count and name-only media; (2) a candidate verification review queue (none exists; candidates self-approve today) and a full recruiter approval flow (the account dialog shows only name/email/date today); (3) subscription tracking for a plan that now gates applying, messaging replies and job alerts; (4) structured candidate profiles, which require an admin candidate detail page and new table columns. Questions Q51–Q72 cover them; Q23/Q24/Q25/Q41 are superseded or answered.

---

## 1. Screens (route by route)

Route source of truth: `client/src/features/admin/routes.jsx:7-9` (glob of `./*/routes.jsx` + `../help/routes.jsx`). Nav: `client/src/app/workspaces.js:91-106`.

Screens/states covered (28): Overview; Overview expand popup (profile menu); Candidates; Recruiters; Jobs; Jobs AI summary; Applications; Recruitment data view; Recruitment funnel view; Access › Roles; Access › Create custom role; Access › User access; Access › Manage access / Assign role (+ save confirm + revoke confirm); Courses › Candidate tab; Courses › Recruiter tab; Course form modal (Upload / Manage); Payments (+ details modal); AI & matching; Create matching policy; Analytics bar; Analytics line (+ range); Reports; Moderation › Content queue; Review reported content (+ job review from Jobs, the "Product Designer, Growth" frame); Moderation › Account review; Review pending account; Audit logs; Settings placeholder. Out of scope but mounted in admin: `/admin/help` (`client/src/features/help/**`, static FAQ in `client/src/features/help/data/help.js`) and `/admin/sign-in` (`client/src/features/auth`).

Conventions used below:
* **Static?** Y = constant/literal; D = derived on the client from other mock/localStorage data; C = copy (translatable, not data).
* Endpoints are suggestions: Express, JSON, `Authorization: Bearer <JWT>`, all under `/api/admin/*` and requiring `role=admin` (plus a permission if Q2 = enforce).
* "Audit" = the event the **server** should append after a successful mutation, `{title, category, detail, actor:{type:'admin', id, name}, target:{type,id}, at}`. Wording keeps today's client strings with the device/demo wording removed.

---

### 1.1 Overview — `/admin` (index route, `overview/routes.jsx:3`)

Purpose: platform KPIs, activity chart, marketplace-health counters, demanded skills, recent activity, CSV export.

**Displayed data**

| # | Item | Current source | Static? | Becomes dynamic as |
|---|---|---|---|---|
| 1 | Page eyebrow/title/description | `OverviewPage.jsx:72-74` | C | i18n keys |
| 2 | **Candidate registrations** | `ADMIN_USERS.filter(role==='Candidate').length`, `OverviewPage.jsx:20,26`; users from `shared/data/users.js:11-52` | D (from static list) | `User.countDocuments({role:'candidate'})` (country filter per Q49) |
| 3 | caption "Users in this demo workspace" | `OverviewPage.jsx:26` | C (demo copy) | e.g. "Registered candidate accounts" |
| 4 | **Active users** | `ADMIN_USERS.filter(status==='active')`, `OverviewPage.jsx:21,27` (counts candidates *and* recruiters but links to /admin/candidates) | D | `User.countDocuments({role:{$in:['candidate','recruiter']}, status:'active'})` (definition Q12) |
| 5 | **Published jobs** | `useJobs()` → `lwm.recruiter.jobs` seeded from `recruiter/jobs/data/jobs.js:26-99`, `OverviewPage.jsx:18,23,28` | D | `Job.countDocuments({status:'published'})` |
| 6 | caption "Open in the demo marketplace" | `OverviewPage.jsx:28` | C demo | change |
| 7 | **Applications** = 9 | `OVERVIEW_STATS.applications`, `overview/data/overview.js:8` | Y | `Application.countDocuments({status:{$ne:'withdrawn'}})` (include withdrawn? see Q17) |
| 8 | **Verified candidate profiles** = 0 | `overview.js:9` | Y | candidates whose 3 credential checks (identity, academic, employment) are all `verified` (caption "All named credential checks complete") — aggregation over `CredentialCheck` grouped by user, `count == 3` |
| 9 | **Course enrollments** = 0 | `overview.js:10` | Y | `Enrollment.countDocuments({audience:'candidate', startedAt:{$ne:null}, completedAt:null})` ("Candidate learning currently underway") — definition Q31 |
| 10 | **Course badges earned** = 0 | `overview.js:11` | Y | `Enrollment.countDocuments({completedAt:{$ne:null}})` (badge model Q26). caption "Assessments completed in the demo" (`OverviewPage.jsx:47`) is demo copy |
| 11 | **Average role match** = '68%' + caption "Evidence summary for Senior Product Designer" | `overview.js:12`, `OverviewPage.jsx:52-56` | Y (and tied to one job) | from `MatchResult` (Q11, Q35) |
| 12 | Stat links (`to`) | `OverviewPage.jsx:26-56` | C | keep |
| 13 | Platform activity: periods "This week"/"Last week" | `ACTIVITY_PERIODS`, `overview.js:44-73` | Y | `GET /api/admin/activity?period=` → registrations per day = `User` created per day (candidate+recruiter? Q12), applications per day = `Application.appliedAt` per day; timezone/week start Q9 |
| 14 | bar values (registrations/applications per weekday) | `overview.js:50-51, 64-65` | Y | same aggregation |
| 15 | bar scale max 25 | `BAR_SCALE_MAX`, `overview.js:42`; used `PlatformActivityCard.jsx:50,54` | Y | compute from max of series (like analytics `niceCeiling`, `ActivityCharts.jsx:12-17`) |
| 16 | line view "0-100 index", Mon–Sat only | `overview.js:53-56, 67-70`; ticks `PlatformActivityCard.jsx:13` | Y (Figma artefact) | Q10 |
| 17 | weekday labels Mon…Sun | `overview.js:49,54,63,68` | Y | locale weekday names (`Intl.DateTimeFormat(locale,{weekday:'short'})`) |
| 18 | card description "Illustrative registrations and applications" | `PlatformActivityCard.jsx:143` | C demo | "Registrations and applications" |
| 19 | Marketplace health: Companies registered = 1 | `overview.js:17` | Y | `Company.countDocuments()` (approved only?) |
| 20 | Course purchases = 0 | `overview.js:18` | Y | `Payment.countDocuments({kind:'course', status:'paid'})` |
| 21 | Verification checks in review = 0 | `overview.js:19` | Y | `CredentialCheck.countDocuments({status:'in-review'})` (+ recruiter KYC in review?) |
| 22 | Shortlist activity = 2 | `overview.js:20` | Y | `Shortlist.countDocuments()` (all time vs period — Q16) |
| 23 | Outreach drafts reviewed = 0 | `overview.js:21` | Y | `CandidateActivity.countDocuments({type:'outreach'})` (recruiter outreach is stored today as `lwm.recruiter.candidate-activity` type `outreach`) — Q19 |
| 24 | Pending user reviews | `overview.js:22` replaced at `OverviewPage.jsx:60` with `ADMIN_USERS.filter(status==='pending').length` | D | `User.countDocuments({status:'pending'})` (= Moderation "Pending accounts") |
| 25 | Health card title/desc/link | `MarketplaceHealthCard.jsx:11,20-23` | C | keep |
| 26 | **Most demanded skills** (Figma 3, Product Design 1, Design Systems 1, UX Research 1, Prototyping 1, Interaction Design 1) | `DEMANDED_SKILLS`, `overview.js:26-33` (does **not** match the seed jobs' skills) | Y | `Job.aggregate([{$match:{status:'published'}},{$unwind:'$requiredSkills'},{$group:{_id:'$requiredSkills',roles:{$sum:1}}},{$sort:{roles:-1,_id:1}},{$limit:6}])` — skills need normalisation (case/trim) |
| 27 | Recent platform activity: "Workspace initialized · Sep 30, 2026" | `RECENT_ACTIVITY`, `overview.js:35` | Y | latest N audit events (Q13) |
| 28 | Oversight note "AI assists with evidence…" | `RecentActivityCard.jsx:24-27` | C | keep |

**Actions**

| Action | Now | Server |
|---|---|---|
| Export report | Client CSV of 8 stats + 6 health rows, `OverviewPage.jsx:62-67`, file `platform-overview.csv`; **no audit** | `GET /api/admin/overview/export.csv?country=` → `text/csv` (server builds from the same aggregation). Audit: `{title:'Overview report exported', category:'Reports', detail:'Platform overview was exported as platform-overview.csv.'}` (Q46) |
| Bar/line toggle, period select | local state, `PlatformActivityCard.jsx:135-138` | `GET /api/admin/activity?period=this-week|last-week&tz=Europe/Paris` → `{period, buckets:[{date:'2026-10-26', label?, registrations, applications}]}` (labels formatted client-side) |
| Stat card click | navigation | — |

Suggested read endpoint: `GET /api/admin/overview?country=` → `{stats:{candidateRegistrations, activeUsers, publishedJobs, applications, verifiedCandidateProfiles, courseEnrollments, courseBadges, averageRoleMatch:{percent, basis}}, health:{companies, coursePurchases, verificationChecksInReview, shortlistActivity, outreachReviewed, pendingUserReviews}, demandedSkills:[{skill, roles}], recentActivity:[{id,title,at}]}`.

Touchpoints: no AI/upload/payment/email. Formatting: weekday labels, integer formatting (StatCard count-up uses en-US grouping, `useCountUp.js:38`). i18n ≈ 45 strings. Demo copy: rows 3, 6, 10, 11, 18.

---

### 1.2 Overview "expand popup" — profile menu on `/admin` (Figma `Overview_Expand popup_3`, inventory line 69)

Component: `client/src/components/layout/ProfileMenu.jsx` (shared shell).

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| Name "Workspace admin" | `workspaces.js:86` | Y | `GET /api/auth/me` → `name` |
| Subtitle "Acme Studio" (admin belongs to a recruiter company?) | `workspaces.js:86` (not shown in menu, used in sidebar identity) | Y | admin has no company → show role/role-name (Q1) |
| Avatar (re-uses the *candidate* avatar) | `workspaces.js:86-87` | Y | user avatar or initials |
| "{label} workspace" | `ProfileMenu.jsx:30` | C | keep |
| Profile → `/admin/settings` | `workspaces.js:90`, `ProfileMenu.jsx:34-40` | C | settings page (Q48) |
| Location row | hidden for admin (`showLocation:false`, `workspaces.js:89`) | — | Q49 |
| Languages: English / Español / Français | `LANGUAGES`, `preferencesContext.js:7` (only label changes); persisted in localStorage `lwm.language` and location in `lwm.location` by `client/src/components/layout/WorkspacePreferences.jsx:7-8` (shared shell provider) | Y | `PATCH /api/me {language:'en'|'es'|'fr'}` → persists on User; drives i18n + AI answer language + email language |

Header extras (admin): bell links to `/admin/settings` (`Header.jsx:167`) with an always-on red dot (`Header.jsx:171`) — Q48.

---

### 1.3 Candidates — `/admin/candidates` and 1.4 Recruiters — `/admin/recruiters`

Pages `candidates/pages/CandidatesPage.jsx:4-13`, `recruiters/pages/RecruitersPage.jsx:4-13`; both render `shared/components/UsersDirectory.jsx`.

**Displayed data**

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| Title / description | `CandidatesPage.jsx:9-10`, `RecruitersPage.jsx:9-10` | C | i18n |
| Rows: name, email, role, joined, verification, learning, status | `ADMIN_USERS` `shared/data/users.js:11-52` filtered by role (`CandidatesPage.jsx:4`, `RecruitersPage.jsx:4`) | Y | `GET /api/admin/users?role=candidate|recruiter&status=&q=&page=&limit=` |
| Joined "Sep 24, 2026" | `formatJoined` en-US, `users.js:55-57` | Y format | locale date |
| Verification label ("Not started" pill / "Not connected" text) | `users.js:18,27,36,45` | Y | candidates: from `CredentialCheck` (Not started / In review / n of 3 verified / Verified); recruiters: from KYC/approval (`pending`/`approved`/`suspended`). "Not connected" has no backend meaning (Q51) |
| Learning "0 enrolled · 0 badges" / "—" | `users.js:19,28,37,46` | Y | `Enrollment` counts per user (`enrolled`, `badges`) for both roles (Q51) |
| Status pill Active / Pending | `USER_STATUSES`, `users.js:6-9` | Y enum | `User.status` enum; must add `suspended` (set by moderation) and possibly `rejected`/`deactivated` → filter options `UsersDirectory.jsx:13-16` |
| Empty state copy | `UsersDirectory.jsx:140-149` | C | i18n |

**Actions**

| Action | Now | Server |
|---|---|---|
| Search name/email | client filter `UsersDirectory.jsx:70-75` | `q` param (case-insensitive prefix/regex on name, email) |
| Status filter | client `UsersDirectory.jsx:121-127` | `status` param |
| Export users | client CSV `UsersDirectory.jsx:82-98` (`candidates.csv` / `recruiters.csv`; columns Name, Email, Role, Joined (raw ISO), Verification, Learning, Status); **no audit** | `GET /api/admin/users/export.csv?role=&status=&q=` → CSV with locale-independent ISO dates. Audit `{title:'Candidates exported'|'Recruiters exported', category:'Reports', detail:'{n} accounts were exported as {file}.'}` |
| Manage (row) | links to `/admin/access-management/users/:id` (`UsersDirectory.jsx:55`) → role-assignment dialog for a marketplace user | Q5 |

Response shape: `{items:[{id, name, email, role, joinedAt, verification:{state, label?}, learning:{enrolled, badges}, status}], total, page, limit}`.

Entities: `User`, `CredentialCheck`, `RecruiterVerification` (KYC), `Enrollment`.
Touchpoints: date format; i18n ≈ 30 (shared) + 4 per page. Pagination: none in UI (Q50).

---

### 1.5 Jobs — `/admin/jobs`

**Displayed data**

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| Rows (published only) | `useJobs()` → `lwm.recruiter.jobs` (seed `recruiter/jobs/data/jobs.js:26-99`, all "Acme Studio", US/UK locations), filtered `JobsPage.jsx:51` | D | `GET /api/admin/jobs?status=published&q=&page=` (status filter Q20) |
| Role, Company | `JobsPage.jsx:17-18` | D | `Job.title`, `Company.name` (populate) |
| Salary "$140k – $180k" | `formatSalary` `recruiter/jobs/data/jobFields.js:162-171` (hard-coded `$`, `k`) | Y format | `{salaryMin, salaryMax, currency, period}` + `Intl.NumberFormat(locale,{style:'currency',currency, notation:'compact'})` (Q22) |
| Status badge | `JobStatusBadge`, statuses `recruiter/jobs/data/jobs.js:16-21` | Y enum | `Job.status` enum `published|paused|draft|closed` (+ restriction flag, Q44) |
| Title/description, empty states | `JobsPage.jsx:62, 79-94` | C | i18n |

**Actions**

| Action | Now | Server |
|---|---|---|
| Search title/company | client `JobsPage.jsx:52-55` | `q` |
| "Ai Summary" | link to `/admin/jobs/:jobId/ai-summary` (`JobsPage.jsx:29`) | see 1.6 |
| "Review" | link to `/admin/moderation/content/:jobId` (`JobsPage.jsx:37`); the moderation page treats an unknown content id as a job id (`ModerationPage.jsx:70-71`). Report ids and job ids share one URL namespace (the seed report id `product-designer-growth` equals the job id) | give job review its own route, e.g. `/admin/moderation/jobs/:jobId`, backed by `GET /api/admin/moderation/jobs/:jobId` (job + open reports + decision history) |

i18n ≈ 15. Note `aria-label` "Ai Summary" casing (`JobsPage.jsx:33-35`) copied from Figma.

---

### 1.6 Jobs AI summary — `/admin/jobs/:jobId/ai-summary` (`jobs/routes.jsx:6`)

Today: **no AI**. A rule-based template (`JobSummaryModal.jsx:9-38`) with a disclaimer saying no model was used (`:114-115`).

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| Badge "Local structured summary", "Admin perspective" | `JobSummaryModal.jsx:60,62` | C demo | "AI summary" + model/generated-at meta |
| Title, meta (company · location · work model) | `:64-65` | D | Job fields |
| Narrative paragraph | `describeRole()` template, `:9-16` ("…compensation is $X per year") | D template | **OpenAI** narrative (admin's language) |
| "Marketplace review at a glance" 3 checks | `reviewPoints()` `:18-38` | D rules | AI review points (`[{ok, text}]`) — or keep deterministic checks + AI text (Q21) |
| Key role facts (work model, employment, level, experience, location, salary) | `:44-51` | D | from Job (DB, not AI) |
| Required skills | `:52, 99-109` | D | `Job.requiredSkills` |
| Disclaimer | `:111-117` | C demo | rewrite: "AI-generated from the job record; does not approve a job…" |

Action: open/close only. Server:
* `GET /api/admin/jobs/:id/ai-summary?lang=en` → `200 {jobId, language, summary, reviewPoints:[{ok, text}], facts:{...}, skills:[...], model, generatedAt, cached:true}`; generates if no cache for `(jobId, job.updatedAt, language)`.
* `POST /api/admin/jobs/:id/ai-summary {lang}` → force regenerate (needs a Regenerate button — not in Figma).
* Entity `JobAiSummary {jobId, jobVersion/updatedAt, language, summary, reviewPoints[], model, promptVersion, tokens, generatedAt, generatedBy}`.
* Audit: optional `{title:'Job AI summary generated', category:'Jobs'?}` (Q46/Q47).
* Errors: OpenAI timeout → 502 with a translatable message; rate limit per admin.

i18n ≈ 25.

---

### 1.7 Applications — `/admin/applications`

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| Candidate name — **always "Alex Morgan"** | `APPLICANT` `ApplicationsPage.jsx:14-15` | Y | `Application.candidateId → User.name` |
| Role, Company | `useJobListings().getJob(application.jobId)` (candidate sample jobs `candidate/jobs/data/jobs.js` + recruiter jobs) `ApplicationsPage.jsx:33-40` | D | populate Job + Company |
| Applied — raw ISO "2026-09-28" | `ApplicationsPage.jsx:23,38` (no formatter) | Y format | locale date |
| Status pill + tone | `APPLICATION_STATUS` `candidate/jobs/data/applications.js:2-7`; tones `ApplicationsPage.jsx:17` | Y enum | `Application.status` (unify with pipeline stages, Q17) |
| Rows | `lwm.candidate.applications` seed `candidate/jobs/data/applications.js:13-17` (jobs at Figma/Notion/Vercel, which are not in the recruiter job store) | D | `GET /api/admin/applications?status=&q=&page=` |

Action **Export activity**: client CSV `ApplicationsPage.jsx:42-50` (`applications.csv`), no audit → `GET /api/admin/applications/export.csv` + audit `{title:'Applications exported', category:'Reports'}`.

Response: `{items:[{id, candidate:{id,name}, job:{id,title}, company:{id,name}, appliedAt, status}], total}`. i18n ≈ 15.

---

### 1.8 Recruitment — data view `/admin/recruitment` and 1.9 funnel view `/admin/recruitment/funnel`

Read-only oversight (`recruitment/routes.jsx:6-9`).

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| Header copy, "View audit log" | `RecruitmentPage.jsx:41-48` | C | — |
| **Published roles** = 3 | `PUBLISHED_ROLES.length`, `recruitment.js:16-20`; `RecruitmentPage.jsx:52` | Y | `Job.countDocuments({status:'published'})` |
| **Applications** = 3 | `APPLICATION_COVERAGE.length`, `recruitment.js:22-26`; `RecruitmentPage.jsx:53` | Y | `Application.countDocuments(...)` |
| **Shortlisted** | `CANDIDATES.filter(shortlisted)`, `RecruitmentPage.jsx:35,54`; `recruitment.js:6-14` | D (static list) | `Shortlist` distinct (candidate, job) count |
| **Reviewed outreach** = `0` literal | `RecruitmentPage.jsx:55` | Y | Q19 |
| Pipeline stage enum Applied…Hired | `PIPELINE_STAGES` `recruitment.js:3` | Y enum | `Application.stage` enum |
| Stage counters | `PipelineStages.jsx:10` counting `CANDIDATES` | D | `Application.aggregate group by stage` |
| Candidate movement rows (7 people; Sofia Martinez, Oliver Park, Aisha Patel, Daniel Kim are not accounts anywhere) | `recruitment.js:6-14` | Y | `GET /api/admin/recruitment/movement?stage=&page=` → `[{applicationId, candidate:{id,name,headline}, job:{id,title}, stage, shortlisted, outreachCount}]` (unit Q17) |
| Avatar tints | `recruitment.js:7-13` `tone` | Y | derive from id hash (presentation only) |
| Outreach column "No outreach" literal | `CandidateMovement.jsx:45` | Y | count/last outreach from `CandidateActivity` |
| Stage pill tones | `CandidateMovement.jsx:35` | C | — |
| Role activity list (title, "Remote · San Francisco, US", "Published" badge literal) | `recruitment.js:16-20`; badge `OversightSidebar.jsx:36-38` | Y | `GET /api/admin/recruitment/roles?limit=5` → published jobs (`workPreference · location`, status) |
| Application coverage list (title, "Alex Morgan · 2026-09-28" raw ISO, status, tone) | `recruitment.js:22-26` | Y | latest applications, or per-role application counts ("Roles receiving candidate interest" says per role, data is per application — Q17) |
| **Funnel counts 9/6/5/4/3/2** (label "Hire" vs stage "Hired") | `FUNNEL_STAGES` `recruitment.js:29-36` | Y (contradicts data view counts; inventory line 76) | "reached stage" counts need stage history (Q17) |
| Funnel geometry/colours | `FunnelChart.jsx:21-39` (fixed sizes) | Y presentation | Q18 |
| Oversight note | `OversightSidebar.jsx:55-67` | C | — |

Actions: view toggle (route), stage select (client filter), links. No mutations → no audit.
Endpoint: `GET /api/admin/recruitment/summary` → `{publishedRoles, applications, shortlisted, reviewedOutreach, stageCounts:{applied,screening,shortlisted,interview,offer,hired}, funnel:[{stage, reached}]}`.
i18n ≈ 50.

---

### 1.10 Access management › Roles — `/admin/access-management` (index)

Layout `AccessManagementLayout.jsx`: eyebrow/title/description `:14-18`, "Create custom role" button only on Roles (`:19-23`).
Toolbar `AccessToolbar.jsx`: tabs Roles / User access (`:8-13`), search box.

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| **Active roles** = all roles (no archived state exists) | `roles.length`, `RolesPage.jsx:52` | D | `Role.countDocuments({status:'active'})` |
| **Custom roles** | `RolesPage.jsx:31,53` | D | `Role.countDocuments({system:false,status:'active'})` |
| **Assigned users** — caption "Users with configured frontend access" | `RolesPage.jsx:32,54` | D + C demo | `AdminAccess.countDocuments({roleId:{$ne:null}})`; caption change |
| System roles Manager / Accounts Head / Staff (name, description, scope, permissions) | `SYSTEM_ROLES` `accessData.js:64-99` | Y | seeded `Role` docs `{system:true}` (immutable) |
| Custom roles | `lwm.admin.roles` (`useAccess.js:5,31`) | localStorage | `Role {system:false}` |
| RoleCard: System/Custom badge, **"Active" badge literal**, description, permissions count, assigned users count, "Scope: …" | `RoleCard.jsx:16-34` (Active `:17`) | D / Y | role.status (Q6); `assignedUsers` = count of access records with this role (`useAccess.js:44-50`) |
| Empty state | `RolesPage.jsx:70` | C | — |
| Notice banner "…It is saved on this device." | `RolesPage.jsx:36` | C demo | change |

**Actions**

| Action | Now | Server | Audit (proposed; none today) |
|---|---|---|---|
| Search roles (name/description/scope) | client `RolesPage.jsx:27-30` | client filter fine (small list) or `?q=` | — |
| **Duplicate** | `duplicateRole` `useAccess.js:66-72`: name "X (copy)", then "X (copy 2)"…; copies scope/description/permissions; id `custom-<slug>[-n]` (`useAccess.js:18-23`). Can exceed the 40-char name limit | `POST /api/admin/roles/:id/duplicate` → `201 Role`. Server re-validates (name ≤40 → truncate base) | `{title:'Role duplicated', category:'Access', detail:'“{source}” was duplicated as “{copy}”.'}` |
| **Manage users** | link to `/admin/access-management/users` with `state.query = role.name` (`RoleCard.jsx:39`) | client | — |
| Create custom role | route `/roles/new` → 1.11 | | |

Endpoints: `GET /api/admin/roles` → `[{id, name, description, scope, system, status, permissions:[id], assignedUsers, createdAt, updatedAt}]`; `GET /api/admin/permissions` → groups (if catalogue is server-served; Q3).

---

### 1.11 Access management › Create custom role — `/admin/access-management/roles/new` (dialog)

`CreateRoleModal.jsx`, validation `utils/validateRole.js`.

Fields and client rules (exact):
* **Role name**: `maxLength={40}` (`CreateRoleModal.jsx:49`); trimmed required → "Enter a role name."; trimmed length < 2 → "Role name needs at least 2 characters."; case-insensitive duplicate of **any** existing role (system included, `RolesPage.jsx:76`) → `A role named "{name}" already exists. Choose a different name.` (`validateRole.js:5-9`). Server must enforce max 40 too (only an HTML attribute today) and uniqueness via a case-insensitive unique index (`nameLower`).
* **Access scope**: select of `ACCESS_SCOPES = ['Organization','Department','Finance department','Team']` (`accessData.js:62`), default `Organization` (`CreateRoleModal.jsx:13`). Meaning: Q4.
* **Description**: optional; `description.length > 240` → "Keep the description under 240 characters." (`validateRole.js:10`; untrimmed length). Empty → server default "Custom role created by an admin." (`useAccess.js:57`): static copy that should be an i18n key or left empty.
* **Permissions**: matrix of 5 groups / 20 permissions (`accessData.js:6-57`); Save disabled while 0 selected (`CreateRoleModal.jsx:41`); the description line shows "{n} selected · …" (`:65`). Not enforced in `validateRole` → server must require ≥1 and every id ∈ catalogue.

Action **Save reusable role** → `POST /api/admin/roles {name, scope, description, permissions:[ids]}` → `201 {role}`; `409` duplicate name; `422` validation map `{field: messageKey}`. Client then shows the notice and navigates back.
Audit (missing today): `{title:'Custom role created', category:'Access', detail:'Custom role “{name}” ({scope}) was created with {n} permissions.'}`.
i18n ≈ 12 + catalogue 5 group labels + 20×(label+description) = ~57.

---

### 1.12 Access management › User access — `/admin/access-management/users`

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| User list (Alex Morgan, Sarah Miller, Emma Wilson, James Chen): name, email, **Platform type** (Candidate/Recruiter) | `ACCESS_USERS` = `ADMIN_USERS` re-ordered by `FIGMA_ORDER`, `accessData.js:106-111` | Y | Q1 (admin staff vs marketplace users) → `GET /api/admin/access/users?q=` |
| Access role (or "No access role") | `useAccess.js:34-42` joining `lwm.admin.userAccess` (default `{ 'sarah-miller': {roleId:'manager', department:'Talent', granted:[], removed:[]} }`, `accessData.js:102-104`) | Y default + localStorage | `AdminAccess` |
| Department (or "Not assigned") | `UserAccessPage.jsx:40` | D | `AdminAccess.department` |
| Effective access "{n} permissions" | `effectivePermissionIds` `useAccess.js:11-16`; `UserAccessPage.jsx:43-50` (inline English plural) | D | server computes `effectiveCount` (and the id list) |
| Button "Manage access" / "Assign role" | `UserAccessPage.jsx:55-64` | C | — |
| Notice "Access saved for {name}. It is stored on this device." | `UserAccessPage.jsx:120` | C demo | change |

Search (`UserAccessPage.jsx:80-85`) matches name, email, platform, role name, department; the initial query can arrive from RoleCard "Manage users".
Response: `[{id, name, email, platform, access:{roleId, department, granted, removed}, role:{id,name,system}|null, effectivePermissions:[ids]}]`.

---

### 1.13 Access management › Manage access / Assign role — `/admin/access-management/users/:userId` (dialog + 2 confirm dialogs)

`ManageAccessModal.jsx`.

Fields and rules:
* **Assigned role**: select of all roles labelled "{name} · System|Custom" (`:13-15, 93-101`); required on save → "Choose a role to assign." (`:58`). Changing role drops grants already in the new role and drops removals not in the new role (`:39-46`).
* **Department or scope**: free text, no maxLength attribute; `department.length > 60` → "Keep the department or scope under 60 characters." (`:59`; untrimmed); saved trimmed (`:141`).
* **Effective permissions**: 20 tiles in matrix order; checked = effective; note per tile "Inherited from role" / "Granted individually" / "Removed for this user" / "Not granted" (`:17-20`). Toggle logic `:48-53`: if the permission is in the role → toggles membership of `removed`; else toggles `granted`.
* Effective = role.permissions ∪ granted − removed (`useAccess.js:11-16`).

| Action | Now | Server | Audit (proposed; none today) |
|---|---|---|---|
| Save assignment → confirm "Save access for {name}?" with "{role} with {n} effective permissions in {dept}. This is saved on this device only." (`:135-142`, demo copy) | `saveUserAccess` → `lwm.admin.userAccess` (`useAccess.js:74-76`) | `PUT /api/admin/access/users/:userId {roleId, department, granted:[ids], removed:[ids]}` → `200 {access, role, effectivePermissions}`. Server: roleId must exist & be active; granted ∩ role.permissions = ∅; removed ⊆ role.permissions; ids ∈ catalogue; department ≤60 trimmed; cannot remove own `roles.assign` / last Owner (Q8) | `{title:'User access saved', category:'Access', detail:'{user}: {role} with {n} effective permissions{ in {department}}.'}` |
| Revoke access (only when a role exists) → danger confirm "Revoke access for {name}?" (`:143-151`) | sets `{roleId:null, department:'', granted:[], removed:[]}` (`useAccess.js:78-80`) | `DELETE /api/admin/access/users/:userId` → `204` | `{title:'User access revoked', category:'Access', detail:'{user}: role, department scope and individual permissions were removed.'}` |
| Cancel / close | navigate back | — | — |

Unknown `userId` → redirect to list (`UserAccessPage.jsx:88`) → server `404`.
Email touchpoint (if admin staff): notify the affected person their access changed (Q53).
i18n ≈ 35 (+ catalogue labels shared with 1.11).

---

### 1.14 Courses › Candidate courses — `/admin/courses`; 1.15 Recruiter courses — `/admin/courses/recruiter`

`CoursesPage.jsx` (tab from URL `:30`), table `CoursesTable.jsx`, data `courses/data/courses.js`, hook `useCourses.js` (`lwm.admin.courses`, shared with both learner catalogues).

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| Eyebrow/title/description ("…courses **candidates** see…" also on the recruiter tab) | `CoursesPage.jsx:63-65` | C | audience-aware copy |
| Tabs labels | `AUDIENCES` `courses.js:6-9` | C | — |
| **Total courses** | `audienceCourses.length` `:86` | D | `Course.countDocuments({audience})` |
| **Published** ("Visible in candidate learning") | `:44, 87-92` | D | `{audience, status:'published'}` |
| **Paid courses** ("One-time purchase content") | `:45, 93` | D | `{audience, price:{$gt:0}}` |
| **Active learners** ("Course enrollments in this demo") | sum of `course.enrolled` `:46, 94` — `enrolled` is always 0 (`courses.js:12`, `useCourses.js:16`) | Y in effect | `Enrollment.countDocuments({courseId:{$in: audience courses}})` (definition Q31) |
| Rows: title, "{category} · {n} lessons", level, Access pill ("Free"/"£39.00"), "{enrolled} enrolled · {purchased} purchased", status, updated date | `INITIAL_COURSES` `courses.js:15-28` + edits; `CoursesTable.jsx:13-59`; `formatPrice` `courseFormat.js:9-11` (hard-coded `£`), `formatUpdated` en-US `courseFormat.js:1-6` | Y seed / D | `GET /api/admin/courses?audience=&status=&q=` with computed `enrolled`, `purchased` (`Payment` paid count per course) |
| Status filter options | `STATUS_OPTIONS` `courses.js:30-34` | C enum | `published|draft` |
| Page note "Course media is represented by its selected file name…" | `CoursesPage.jsx:125-128` | C demo | remove/replace |
| Notice texts "Uploaded "{t}" to {tab}." / "Saved changes to "{t}"." / "Published/Unpublished "{t}"." | `:50, 57` | C | i18n |

Seed vs learner catalogue mismatches (both must collapse into one `Course` collection):

| id | admin price (`courses.js`) | learner price | other |
|---|---|---|---|
| interaction-design-foundations | 0 (`:16`) | £49 (`candidate/learning/data/courses.js:40`); seed payment Alex £49 (`payments.js:39`) | learner tier "Included" |
| interaction-systems-in-practice | 39 (`:17`) | 39 (`:59`) | — |
| designing-trusted-fintech-journeys | 0 (`:18`) | 19 (`:78`) | — |
| design-leadership-in-practice | 49 (`:19`) | 49 (`:101`) | — |
| designing-for-developer-workflows | 59 (`:20`) | 49 (`:124`) | — |
| evidence-led-user-interviews | 0 (`:21`) | 49 (`:147`) | tier "Included" |
| hiring-technology-product-talent | 0 (`:22`) | 49 (`recruiter/learning/data/courses.js:35`); seed payment Sarah £49 | updatedAt 2026-10-27 |
| fair-hiring-inclusive-selection | 0, title "Fair, Inclusive & Responsible Hiring", category "Ethical Hiring" (`:23`) | 49, title "Fair Hiring & Inclusive Selection", stream "Fair Hiring" (`:84-88`) | |
| structured-interviewing-better-evidence | 0 (`:24`) | 49 (`:61`) | |
| talent-strategy-workforce-planning | 0 (`:25`) | 29 (`:114`) | |
| employer-brand-candidate-experience | 0 (`:26`) | 29 (`:140`) | |
| recruiting-leadership-team-coaching | 0 (`:27`) | 29 (`:166`) | |

**Actions**

| Action | Now | Server | Audit (proposed; none today) |
|---|---|---|---|
| Tab switch | route | — | — |
| Search (title/category), status filter | client `CoursesPage.jsx:37-42` | `q`, `status` | — |
| **Upload course** / **Manage** | open 1.16 | | |
| **Publish / Unpublish** (row) | `setStatus` `useCourses.js:20-22` toggles `published`↔`draft`, bumps `updatedAt`; learner catalogue hides drafts (`candidate/learning/hooks/useCourseCatalogue.js:39`) | `PATCH /api/admin/courses/:id/status {status:'published'|'draft'}` → `200 Course`. Publishing should require the learner-required content (Q25) | `{title:'Course published'|'Course unpublished', category:'Learning' (Q47), detail:'“{title}” ({audience} courses) is now {published|a draft}.'}` |

Stats endpoint: `GET /api/admin/courses/stats?audience=` → `{total, published, paid, activeLearners}`.
Payments touchpoint: price drives Stripe Checkout `price_data` (one-time). Currency Q27.
i18n ≈ 55.

---

### 1.16 Course form modal — "Upload course" / "Manage course" (dialog, no URL)

`CourseFormModal.jsx` + `validateCourse` `courseFormat.js:14-26`.

| Field | Control & limits | Default | Client validation (exact message) |
|---|---|---|---|
| audience | implicit from tab (`CourseFormModal.jsx:37`) | tab | — |
| Course title | text, `maxLength={80}` (`:68`) | '' / course | trimmed empty → "Enter a course title."; trimmed < 3 → "Course title needs at least 3 characters." (no server max today) |
| Category or skill | text, `maxLength={40}` (`:70`) | '' | trimmed empty → "Enter a category or skill, for example Interaction Design." |
| Level | select `COURSE_LEVELS = Foundation|Intermediate|Advanced` (`courses.js:3`) | Foundation | — |
| Lessons | number `min 1 max 60` (`:74`) | "4" (`:21`) | not integer or <1 or >60 → "Enter a whole number of lessons from 1 to 60." |
| Access | select Free / "Paid (one-time purchase)" (`:9-12`) | free unless price>0 | — |
| Price (GBP) | number `min 0 step 0.01`, shown only if paid (`:77-87`) | '' | `!(amount > 0) || amount > 999` → "Enter a price above £0 and up to £999." (no 2-decimal check; `£` hard-coded in message) |
| Course media | `<input type=file>` **no `accept`, no size limit**; only `file.name` kept (`:88-97`); choosing then cancelling clears the name | '' / course.mediaName | none |
| Published checkbox "Published: visible in {candidate|recruiter} learning" | (`:98-103`) | **true** for new (`:25`) | — |

Saved shape (`:36-45`): `{audience, title, category, level, lessons:number, price:number (0 if free), mediaName, status}`; new id = `slug(title)-<base36 time>` and `enrolled:0, purchased:0` (`useCourses.js:14-16`).

Server:
* `POST /api/admin/courses` `multipart/form-data` (fields + `media` file) → `201 Course`. Validate same rules + `price` 2 decimals, store `priceMinor` (integer pence), title max 80, category max 40, audience enum, file type/size per Q24, slug unique per audience.
* `PATCH /api/admin/courses/:id` multipart → `200 Course`; replacing media deletes the old file from disk.
* Media storage: `uploads/course-media/<courseId>/<uuid>.<ext>`, `File` record, served via authenticated `GET /api/media/:fileId` with HTTP Range (video) and purchase checks (intro/cover public, lessons only for enrolled users).
* Audit: `{title:'Course uploaded', category:'Learning', detail:'“{title}” was added to {audience} courses as {Published|Draft}.'}`; `{title:'Course updated', …'Changes to “{title}” were saved.'}`.
* Demo copy to change: modal hints "Only the file name is kept in this prototype." (`:94-95`).

See §5 for what learners need beyond these fields.

---

### 1.17 Payments — `/admin/payments` (+ details modal; no Figma frame)

`client/src/features/admin/payments/pages/PaymentsPage.jsx`; data `client/src/features/payments/data/payments.js`; hook `client/src/features/payments/hooks/usePayments.js` (`lwm.payments` + `SEED_PAYMENTS`).

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| **Collected** "£234.00" ("From paid payments, in GBP") | sum of paid amounts `PaymentsPage.jsx:51-52,106`; `formatMoney` `payments.js:21` (`£`) | D | `Payment.aggregate({status:'paid'} group by currency sum amountMinor)` (one value per currency if Q27 ≠ GBP-only) |
| **Successful payments** | `:107` | D | count paid |
| **Failed payments** ("Declined at checkout") | `payments.length - paid.length` `:108` | D | count failed (Q32) |
| **Subscriptions** ("Paid AI Matches Plus plans") | `:109-114` | D | count paid `kind:'subscription'` (or active `Subscription` docs — renewals Q33) |
| Seed rows (6) | `SEED_PAYMENTS` `payments.js:38-45` | Y | seeded `Payment` docs |
| Table: reference, payer + role, item, type, amount, method "Visa •••• 4242", status, date | `PaymentsTable.jsx:18-57`; date en-US `payments.js:24-26` | D | `GET /api/admin/payments?status=&payerRole=&kind=&q=&page=` |
| Details modal: status, payer, item, amount, method, date (en-US date-time), failure reason | `PaymentsPage.jsx:139-190` | D | `GET /api/admin/payments/:id` |
| Filter option sets | `PaymentsPage.jsx:21-35` | C enums | `status: paid|failed`, `payerRole: candidate|recruiter`, `kind: course|subscription` |
| Reference "LWM-0xxxx" | `usePayments.js:27-30` (`1000 + n` padded to 5) | D | server counter (`Counter` collection, atomic `$inc`) |
| Failure reason text "Card declined by the issuer (demo decline card)." | `payments.js:28` | Y demo | Stripe `last_payment_error.message` / decline code (translated) |

| Action | Now | Server | Audit |
|---|---|---|---|
| Search ref/payer/item; 3 filters | client `:54-63` | query params | — |
| Details | modal | `GET /api/admin/payments/:id` | — |
| **Export payments** | client CSV `:65-90` (`payments.csv`; columns Reference, Date (raw ISO), Payer, Role, Item, Type, "Amount (GBP)", Method, Status, Failure reason) | `GET /api/admin/payments/export.csv?…` (currency column instead of "(GBP)") | existing: `{title:'Payments exported', category:'Reports', detail:'{n} payments were exported as payments.csv.'}` (drop "in the browser…Nothing was uploaded.") |

Writer side (not admin UI, but the admin page depends on it): `POST /api/stripe/webhook` (raw body, signature check, idempotent on `event.id`):
* `checkout.session.completed` (mode `payment` → course; `subscription` → Plus) → `Payment{status:'paid'}`, `Enrollment` / `Subscription` upsert; payer from `client_reference_id`/metadata userId; `method` from the PaymentIntent's charge `payment_method_details.card.{brand,last4}`.
* `payment_intent.payment_failed` → `Payment{status:'failed', failureReason}` (Q32).
* `invoice.paid` (renewals) → Q33. `customer.subscription.deleted/updated` → Subscription status.
Emails: receipts? (not decided; Q53). Demo copy: `PaymentsPage.jsx:87-89` "saved to this device. Nothing was uploaded."
i18n ≈ 45.

---

### 1.18 AI & matching — `/admin/ai-matching` (splat route, `ai-matching/routes.jsx:4-10`)

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| Header copy | `AiMatchingPage.jsx:62-64` | C | — |
| Policy editor: name, description, Active pill, 3 signal switches, "Require human review" (always on, disabled) | `POLICY_SIGNALS` `matching.js:2-18`; `HUMAN_REVIEW_SIGNAL` `:20-23`; `PolicyEditor.jsx:28-58` | Y (signal catalogue) / D | `MatchingPolicy` |
| Default policy "Default evidence policy" (updatedAt 2026-09-30T08:05) | `DEFAULT_POLICY` `matching.js:25-31` | Y seed | seeded policy |
| Policy library list: name, "Updated {date}" (en-US), Active/Draft | `PolicySidebar.jsx:15-36`; `lwm.admin.matching-policies` (`useMatchingPolicies.js:9`) | D | `GET /api/admin/matching/policies` → `{policies:[{id,name,description,signals,status,updatedAt}], activeId}` |
| Guidance card "Evidence. Not absolutes." | `PolicySidebar.jsx:39-48` | C | — |
| **Service status "AI backend not connected"** + text | `PolicySidebar.jsx:50-59` | Y | `GET /api/admin/ai/status` → `{connected, model, lastSuccessAt, lastError}` (OpenAI key present + last call health) |
| Editor note "Policy settings are stored locally…" | `PolicyEditor.jsx:68-70` | C demo | change |
| **Recruiter match-summary oversight** — 4 cards (Alex 100%, Emma 100%, Oliver 100%, James 77%) "…for Senior Product Designer" | `OVERSIGHT_CANDIDATES` `matching.js:34-39`; `OversightSection.jsx:17` | Y | `GET /api/admin/matching/oversight?jobId=` → `{job:{id,title}, candidates:[{id,name,headline,percent}]}` (Q36) |
| **AI Match Insights** evidence (summary "3 relevant skills · 6 years · Remote", skills, experience text, potential gap, disclaimer) | `MATCH_EVIDENCE` `matching.js:41-47` | Y | `GET /api/admin/matching/evidence?jobId=&candidateId=` → `{summary, skills:[...], experience, gap, disclaimer}`: evidence from the match engine, narrative by OpenAI in the admin's language |

| Action | Now | Server | Audit (existing client strings) |
|---|---|---|---|
| Select policy | local state | — | — |
| Toggle signals → **Save reviewed policy** | `saveSignals` `useMatchingPolicies.js:29-38`; message "Policy saved on this device." (`PolicyEditor.jsx:18`) | `PUT /api/admin/matching/policies/:id/signals {skills:bool, experience:bool, location:bool}` → `200 policy` (no validation today; ≥1 signal? Q37). If the policy is active, scores need recomputing (Q35) | `{title:'Matching policy saved', category:'Policy', detail:'Signals for “{name}” were reviewed and saved. Human review stays required.'}` (`AiMatchingPage.jsx:43-47`) |
| **Make active** (only when not active) | `activate` `:40` | `POST /api/admin/matching/policies/:id/activate` → `200 {activeId}` (transaction: previous active → draft) | `{title:'Matching policy activated', category:'Policy', detail:'“{name}” is now the active matching policy.'}` (`:52-56`, drop "on this device") |
| Create policy | route `/ai-matching/policies/new` → 1.19 | | |

i18n ≈ 45.

---

### 1.19 Create matching policy — `/admin/ai-matching/policies/new` (dialog)

`CreatePolicyModal.jsx`.

Rules (exact, `:8-23`):
* **Policy name** (`maxLength={80}` attribute but rule says 60, `:73`): trimmed empty → "Enter a policy name."; <3 → "Policy name must be at least 3 characters."; >60 → "Policy name must be 60 characters or fewer."; case-insensitive duplicate → "A policy with this name already exists. Choose a different name."
* **Policy description**: trimmed empty → "Describe the roles, market, or review context this policy supports."; <20 → "Add more detail: at least 20 characters."; >500 → "Keep the description to 500 characters or fewer."
* Both buttons disabled until name and description are non-blank (`:34, 102, 116`).
* New policy = draft, all signals on (`useMatchingPolicies.js:14-27`).

| Action | Now | Server | Audit |
|---|---|---|---|
| **Improve description** ("AI-assisted policy suggestion") | local template `suggestDescription` `matching.js:50-53`; note "Local suggestion only." (`:108`) | `POST /api/admin/matching/policies/suggest-description {name, description, language}` → `200 {suggestion}` via **OpenAI**, in the admin's language; result ≤500 chars (truncate/regenerate); rate-limited | none today; optional (Q46) |
| **Create draft policy** | `addPolicy` + audit + notice "…created on this device…" (`AiMatchingPage.jsx:29-39`) | `POST /api/admin/matching/policies {name, description}` → `201 policy` (`409` duplicate, `422` rules) | `{title:'Matching policy draft created', category:'Policy', detail:'Draft policy “{name}” was created with every approved signal on. Human review stays required.'}` |

---

### 1.20 Analytics — `/admin/analytics` (bar) and 1.21 line graph `?view=line&range=`

`AnalyticsPage.jsx` (URL params `:15-16`).

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| **Shortlist conversion** '33%' ("Shortlisted / current demo candidates") | `ANALYTICS_STATS` `analytics.js:4` | Y | Q15 |
| **Recruiter accounts** '1' ("Registered in the demo workspace") | `analytics.js:5` | Y | `User.countDocuments({role:'recruiter'})` (approved only?) |
| **Company registrations** '1' ("Local company profile") | `analytics.js:6` | Y | `Company.countDocuments()` |
| **Reviewed outreach** '0' | `analytics.js:7` | Y | Q19 |
| Date ranges This week / Last week / Last month | `DATE_RANGES` `analytics.js:37-41` | Y enum | keep enum, server computes buckets (Q9) |
| Chart data per range (daily for weeks, "Week 1–4" for month) | `ACTIVITY_BY_RANGE` `analytics.js:46-65`; DAYS `:43` | Y | `GET /api/admin/activity?period=` (shared with Overview) |
| Line view: 0–100 index Mon–Sat; "last-month" has no line data and falls back to the bar series (`ActivityCard.jsx:66`) | `analytics.js:52,58` | Y | Q10 |
| Card description "Illustrative registrations and applications" | `ActivityCard.jsx:16` | C demo | change |
| **Most demanded skills** (duplicate of Overview's static list) | `analytics.js:10-17`; `InsightCards.jsx:8-29` | Y | same aggregation as Overview #26 |
| **Matching quality** notes (Relevance feedback "Not yet connected", Recommendation conversion "Not yet measured", Fairness & quality "Human review required") | `QUALITY_NOTES` `analytics.js:19-35` | Y | Q14 |

Actions: view toggle and range select (URL only, no server mutation).
Endpoint: `GET /api/admin/analytics?range=` → `{stats:{shortlistConversion, recruiterAccounts, companyRegistrations, reviewedOutreach}, activity:{buckets}, demandedSkills}`.
i18n ≈ 35.

---

### 1.22 Reports — `/admin/reports`

`ReportsPage.jsx`, `ReportForm.jsx`, `ExportHistory.jsx`, `reports/data/reports.js`.

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| Report types: Marketplace summary; Most demanded skills; "Platform activity (this week, illustrative)" | `REPORT_TYPES` `reports.js:4-23` (rows read the **static** analytics constants) | Y | `GET /api/admin/reports/types`; rows computed server-side from the real aggregations |
| CSV header block: Report, Generated (raw ISO), "Scope: Current local workspace", Brief, Voice note file name | `buildReportRows` `reports.js:28-39` | Y/D | server header block (+ AI summary if Q38) |
| Filename `{typeId}-{YYYY-MM-DD}.csv` | `reports.js:41-43` | D | keep |
| Export history (type, filename, date-time en-US, brief, voice note name) | `lwm.admin.reports` (`ReportsPage.jsx:16`), `ExportHistory.jsx:22-43` | localStorage | `GET /api/admin/reports?page=` → `[{id, typeId, typeLabel, brief, voiceNote:{fileId, originalName}, aiSummary?, generatedAt, filename, createdBy}]` |
| Form copy, scope line "CSV export · Current local workspace…" | `ReportForm.jsx:51-56, 94-104` | C demo | change |

Form rules:
* **Report type**: select (default first type).
* **Report brief**: textarea; `brief.length > 500` (`MAX_BRIEF_LENGTH` `reports.js:25`; checked **before** trim, `ReportForm.jsx:30`) → "Keep the brief to 500 characters or fewer."; saved trimmed.
* **Voice note**: hidden `<input type=file accept="audio/*">`; rejects non-`audio/*` MIME → "Choose an audio file, for example .mp3, .m4a or .wav." (`ReportForm.jsx:16-26`); **no size limit**; only the name is kept; removable. Label says "Record or attach" but only attach exists (Q39).

| Action | Now | Server | Audit |
|---|---|---|---|
| **Generate & download** | client CSV + history entry + audit (`ReportsPage.jsx:20-40`) | `POST /api/admin/reports` multipart `{typeId, brief, voiceNote?}` → stores the voice note on disk (`uploads/report-voice/…`), optional OpenAI transcription + AI brief (Q38), builds the CSV, stores the snapshot (Q40) → `201 {id, filename, downloadUrl}`; client then `GET /api/admin/reports/:id/download` | existing `{title:'Report exported', category:'Reports', detail:'{type} was generated as {filename}.'}` (drop the device wording) |
| **Download again** | regenerates from *current* data (`ReportsPage.jsx:42-45`); no audit | `GET /api/admin/reports/:id/download` (snapshot) | proposed `{title:'Report downloaded again', category:'Reports'}` (Q46) |

i18n ≈ 30.

---

### 1.23 Moderation › Content moderation queue — `/admin/moderation`

### 1.24 Review reported content — `/admin/moderation/content/:itemId` (incl. the "Product Designer, Growth" frame and job review opened from Jobs)

### 1.25 Moderation › Account review — `/admin/moderation/accounts`

### 1.26 Review pending account — `/admin/moderation/accounts/:accountId`

One page, `ModerationPage.jsx` (splat route `moderation/routes.jsx:4-10`).

**Displayed data**

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| Title/description | `ModerationPage.jsx:144-147` | C | — |
| **Pending accounts** | `PENDING_ACCOUNTS` minus decided (`:74, 150`); list `moderation.js:28-36` (James Chen, a *candidate*) | D from static | `User.countDocuments({status:'pending'})` (role scope Q42) |
| **Content reports** | `CONTENT_ITEMS` minus decided (`:73, 151`); list `moderation.js:4-25` | D from static | `ModerationCase.countDocuments({status:'pending'})` |
| **Credential reviews** = `"0"` literal | `:152` | Y | `CredentialCheck.countDocuments({status:'in-review'})` (no UI to act on them — Q43) |
| **Content decisions** | count of `content:*` decision keys (`:75, 153`) | D | `ModerationCase.countDocuments({status:{$ne:'pending'}})` |
| Tabs + counts | `:156-162`; tab copy `:35-49` (account tab copy says "candidate and recruiter accounts") | D | from summary |
| Content row: title, priority pill (High/Standard), "{kind} · {reason}", summary, "Reported {date-time en-US}", decision badge, decision note "Decision recorded {date} · Reason: …" | `:118-139`, `:92-96` | D | `GET /api/admin/moderation/content?status=` |
| Account row: name, email, "{type} account · Joined {date} · Registration details require human review." | `:98-116` | D | `GET /api/admin/moderation/accounts?status=pending` |
| Decision badges | `DECISION_BADGES` `moderation.js:82-88` | Y enum | `pending|dismissed|restricted|approved|suspended` (+ `rejected`/`verified` Q42/Q43) |
| Content dialog body: kind/priority pills, title, "{reason} · Reported {date}" or "Opened for review from the Jobs list…", report context or listing details (company, location, salary `$`, skills, description), policy notice | `ReviewDetails.jsx:8-51`; job mapping `utils/jobReviewItem.js:7-21` | D | `GET /api/admin/moderation/content/:caseId` or `/jobs/:jobId` |
| Account dialog body: name, "{email} · {type} · Joined {date}", notice "…This action updates a demo record only." | `ReviewDetails.jsx:54-66` | D + C demo | needs registration details + KYC documents (company, website, business email, industry, size, country, registration details, address, 3 documents; from `auth/data/onboarding.js:27-42`, `KycVerificationPage.jsx:13-30`) with authenticated file links |
| Previous decision line | `ReviewDialog.jsx:70-75`, `ModerationPage.jsx:200-202` | D | decision history |

**Decision flow** (`ReviewDialog.jsx`): step 1 choose an action → step 2 confirm with reason. Reason required for `reasonRequired` actions ("Add a reason so the decision has a clear record."); max 300 chars → "Keep the reason to 300 characters or fewer." (`:6, 26-37`); saved trimmed.

| Action | Config | Now | Server | Audit (existing titles `ModerationPage.jsx:28-33`; detail `:82-86`) |
|---|---|---|---|---|
| **Dismiss report** | reason optional (`moderation.js:39-47`) | `lwm.admin.moderation["content:<id>"] = {status, reason, decidedAt}` | `POST /api/admin/moderation/content/:caseId/decision {decision:'dismissed', reason?}` → `200 case`; if it lifts an earlier restriction → restore target (Q44) | `{title:'Content report dismissed', category:'Moderation', detail:'{title}: report dismissed. Reason: {r}' | 'No reason was added.'}` |
| **Restrict content** | reason required (`:48-57`); copy says a job is paused / profile removed from discovery: **not implemented** | same, writes nothing else | `{decision:'restricted', reason}` → job: `status:'paused'` + `restricted:{by, at, reason}` (blocks recruiter re-publish); candidate profile: `discoverable:false`; email owner (Q53) | `{title:'Content restricted', …'content restricted. Reason: {r}'}` |
| Same two actions on a job with no report (from Jobs "Review") | `jobToReviewItem` | key `content:<jobId>` | `POST /api/admin/moderation/jobs/:jobId/decision` → creates a case with `source:'admin'` | same |
| **Suspend for review** | reason required (`:61-69`) | key `account:<id>` | `POST /api/admin/moderation/accounts/:userId/decision {decision:'suspended', reason}` → `User.status='suspended'` (blocks login / revokes JWT validity via `tokenVersion`) + email | `{title:'Account suspended for review', …}` |
| **Approve account** | reason optional; copy "approved in this demo record" (`:70-78`) | key `account:<id>` | `{decision:'approved'}` → `User.status='active'`, recruiter tools unlocked, email "approved" | `{title:'Account approved', …}` |
| Back / close | | navigate | — | — |

Re-deciding is allowed ("You can record a new decision below", `ReviewDialog.jsx:72-73`) → keep `decisions[]` history on the case.
Entities: `ModerationCase {targetType: 'job'|'candidateProfile'|'company', targetId, titleSnapshot, kind, priority:'high'|'standard', reason, summary, source:'user-report'|'admin', reporterId?, reportedAt, status, decisions:[{decision, reason≤300, decidedBy, decidedAt}]}`; `AccountDecision` (or `User.reviewHistory[]`).
Missing sources: no "Report" action exists anywhere in candidate/recruiter UIs (grep found none) → Q41. No credential review UI → Q43.
i18n ≈ 65.

---

### 1.27 Audit logs — `/admin/audit-logs`

| Item | Source | Static? | Dynamic |
|---|---|---|---|
| Events = recorded (`lwm.admin.audit-log`) + 6 seed events, sorted client-side | `useAuditLog.js:13,29-32`; seeds `auditEvents.js:15-64` | Y seeds + localStorage | `GET /api/admin/audit-events?category=&q=&page=&limit=5` → `{items:[{id,title,category,actor:{type,name},at,detail}], total}` (sorted `at desc`, indexed) |
| Actor "Workspace admin" for every recorded event | `useAuditLog.js:21` | Y | from JWT user; seed actors "Marketplace user", "System" (Q46) |
| Categories filter chips All/Workspace/Policy/Moderation/Reports/Access | `AUDIT_CATEGORIES` `auditEvents.js:2-9` | Y enum | enum (+ Learning, Payments, Jobs — Q47) |
| Row "{title} · {date en-US}" + **"Local event" badge literal** | `AuditEventRow.jsx:18-21` | Y | remove badge or show actor type |
| Expanded: Category, Recorded by, Time (en-US date-time), Details | `AuditEventRow.jsx:24-42`; `formatDate.js:1-18` | D | locale |
| Page size 5, pager text "Showing {a}–{b} of {n} events", "Page x of y" | `AuditLogsPage.jsx:14, 116-144` | C/D | server pagination |
| Notice "This is a local demo log, not an immutable security audit trail…" | `AuditLogsPage.jsx:111-114` | C demo | remove/replace |
| Description "…in your local workspace." | `:64` | C demo | change |

| Action | Now | Server | Audit |
|---|---|---|---|
| Search (title/category/actor/detail), category filter, page, expand | client | `q` (text index on title+detail+actor.name), `category`, `page` | — |
| **Export log** | client CSV of all matching (`:48-57`, `audit-log-YYYY-MM-DD.csv`; Time formatted en-US) | `GET /api/admin/audit-events/export.csv?category=&q=` (ISO timestamps) | proposed `{title:'Audit log exported', category:'Reports'}` (Q46) |

Server guarantees: append-only collection (no update/delete routes), written in the same handler as the mutation, `at` = server time, index `{at:-1}`, `{category:1, at:-1}`.
i18n ≈ 25 (+ seed event text if seeds are kept).

---

### 1.28 Settings — `/admin/settings`

Placeholder `AdminSettingsPage.jsx:11-28` ("Admin settings are not part of the supplied design"). No data. Also the target of the profile menu "Profile" and the header bell. Q48.

---

## 2. Entities (consolidated)

> Entities added or changed by the new decisions (Lesson, Quiz, LessonProgress, QuizAttempt, Certificate, VerificationSubmission, Plan, Subscription, structured CandidateProfile) are specified in §9.1–9.4.

Types are Mongoose-style. `ref` = ObjectId reference. Timestamps `createdAt/updatedAt` on all.

### 2.1 User
| field | type | notes |
|---|---|---|
| role | enum `candidate|recruiter|admin` | one role per account (decided) |
| name, email (unique, lowercased), passwordHash | String | |
| status | enum `pending|active|suspended` (+ `rejected`? `deactivated`?) | today only `active|pending` (`users.js:6-9`); moderation adds `suspended` |
| language | enum `en|es|fr` | profile menu |
| country | enum EU27 + `GB` + `REMOTE` | picker |
| isOwner | Boolean (admins) | super-admin bypass (Q8) |
| emailVerifiedAt, phoneVerifiedAt, lastLoginAt, tokenVersion | | suspension invalidates tokens |
| reviewHistory | [{decision, reason, decidedBy, decidedAt}] | or separate `AccountDecision` |

### 2.2 Access management
* **Permission** (catalogue; code constant or seeded collection, Q3): `{id:'users.view', group:'people', labelKey, descriptionKey, order}`. Today: 5 groups (`people, roles, recruitment, finance, governance`), 20 ids: `users.view, users.add, users.edit, users.deactivate, roles.view, roles.create, roles.edit, roles.archive, roles.assign, jobs.manage, candidates.view, pipeline.manage, company.edit, finance.view, finance.approve, reports.view, reports.export, moderation.manage, audit.view, learning.manage` (`accessData.js:6-57`).
* **Role**: `{slug (custom-<slug>[-n]), name (2–40, unique case-insensitive via nameLower), description (≤240, default ''), scope enum ['Organization','Department','Finance department','Team'] (Q4), system:Boolean, status enum active|archived (Q6), permissions:[permissionId] (≥1), createdBy ref User}`. Seed: Manager (Department, 9 perms), Accounts Head (Finance department, 7), Staff (Department, 2) (`accessData.js:64-99`).
* **AdminAccess** (one per user; or embedded `User.access`): `{userId ref (unique), roleId ref|null, department String ≤60 trimmed, granted:[permissionId], removed:[permissionId], updatedBy, updatedAt}`. Invariants: `granted ∩ role.permissions = ∅`, `removed ⊆ role.permissions`. Effective = role ∪ granted − removed. Seed: Sarah Miller → Manager, "Talent" (`accessData.js:102-104`): only valid if Q1 ≠ "admin staff only".

### 2.3 Company / recruiter verification
* **Company** `{name, website, businessEmail, industry, size enum (6 options, onboarding.js:14-21), country, registrationDetails, businessAddress, ownerUserId}`.
* **RecruiterVerification** `{userId, documents:{identity:fileRef, registration:fileRef, authorization:fileRef|null}, emailOtpVerifiedAt, phoneOtpVerifiedAt, submittedAt, status pending|approved|suspended|rejected}`. Files: PDF/JPG/PNG (`KycVerificationPage.jsx:17,22,28`; size limit not defined in KYC: candidate evidence uses 10 MB).

### 2.4 CredentialCheck (candidate verification evidence)
`{userId, type enum identity|academic|employment, evidenceType (per type: 3 options each, verification.js:17-39), fileId (PDF/JPG/JPEG/PNG ≤10 MB, verification.js:41-42), status enum in-review|verified|rejected, submittedAt, reviewedBy, reviewedAt, reason≤300}`.

### 2.5 Jobs / applications / pipeline
* **Job** (existing recruiter shape, `recruiter/jobs/data/jobs.js:1-13`): `status enum published|paused|draft|closed`, `workPreference Remote|Hybrid|On-site`, `employmentType Full-time|Part-time|Contract|Internship`, `level Junior|Mid-level|Senior|Lead`, `requiredSkills[]`, `preferredSkills[]`, `salaryMin/Max` (+ **currency, period** — Q22), `country`, `companyId`, + `restricted:{by,at,reason}`.
* **JobAiSummary** (§1.6).
* **Application** `{candidateId, jobId, status enum applied|under-review|interview|withdrawn, stage enum applied|screening|shortlisted|interview|offer|hired (Q17), appliedAt, stageHistory:[{stage, at, by}]}`.
* **Shortlist** `{recruiterId, candidateId, jobId?, createdAt}`.
* **CandidateActivity** `{recruiterId, candidateId, type outreach|cv-request|stage, text, at}`; "reviewed outreach" = type outreach (Q19).

### 2.6 Learning / payments
* **Course** `{slug, audience enum candidate|recruiter, title 3–80, category ≤40 (learner: candidate "category", recruiter "stream"), level enum Foundation|Intermediate|Advanced, priceMinor Int (0 or 1–99900), currency 'GBP' (Q27), status enum published|draft, media (Q24), + learner content (§5), createdBy, updatedBy}`; computed `enrolled`, `purchased`.
* **Lesson** `{courseId, order, title, video fileRef?, durationSec?, …}` (§5).
* **Enrollment** `{userId, courseId, source free|purchase, paymentId?, enrolledAt, completedLessonIds:[lessonId], completedAt?, badgeIssuedAt?}` (today `lwm.candidate.learning` / `lwm.recruiter.learning` `{purchased:[ids], completedLessons:{courseId:[lessonIds]}}`).
* **Payment** `{reference 'LWM-xxxxx' unique, at, payerId ref, payerRole candidate|recruiter, payerName snapshot, kind course|subscription, itemId, itemName snapshot, amountMinor, currency, method:{brand,last4}, status paid|failed (+refunded later), failureReason, stripe:{eventId unique, checkoutSessionId, paymentIntentId, invoiceId, subscriptionId}}`.
* **Subscription** `{userId, plan 'plus', status, stripeSubscriptionId, currentPeriodEnd, cancelAtPeriodEnd}` (Plus £9/month).
* **Counter** `{_id:'paymentReference', seq}`.

### 2.7 AI matching
* **MatchingPolicy** `{name 3–60 unique ci, description 20–500, signals:{skills:Bool, experience:Bool, location:Bool}, humanReview: true (constant), status draft|active (exactly one active, enforced by partial unique index), createdBy, updatedAt, version?}` (+ `MatchingPolicyVersion` if Q37).
* **MatchResult** `{jobId, candidateId, policyId, policyVersion, percent 0–100, evidence:{skills:[...], experienceYears, location, gap}, computedAt}`.

### 2.8 Moderation, audit, reports, files
* **ModerationCase** (§1.23–1.26).
* **AuditEvent** `{title, category enum Workspace|Policy|Moderation|Reports|Access (+Learning|Payments|Jobs, Q47), actor:{type admin|user|system, id?, name}, target:{type,id}?, at, detail, metadata?}`: append-only.
* **ReportExport** `{typeId enum marketplace-summary|skills-demand|platform-activity, typeLabel, brief ≤500, voiceNote fileRef?, transcript?, aiSummary?, period?, generatedAt, filename, file fileRef (snapshot), createdBy}`.
* **File** `{ownerId, purpose enum course-cover|course-intro|lesson-video|course-media|report-voice|kyc|evidence, path, originalName, mime, size, sha256?, createdAt}`.
* **Enumerations to keep server-side**: analytics ranges `this-week|last-week|last-month`; payment filters; course status; decision badges; audit categories.

---

## 3. Endpoints (consolidated)

> Endpoints for the new decisions (course builder, uploads, quiz and certificates; verification queue and recruiter onboarding; subscriptions; candidate detail) are listed in §9.1–9.4.

All `/api/admin/*` require `role=admin` (+ permission in brackets if Q2 = enforce). `[P]` = proposed permission id from the Permission map.

| Method & path | Body / query | Response | Audit |
|---|---|---|---|
| GET `/api/auth/me` | — | `{id,name,email,role,language,country,isOwner,permissions:[...]}` | — |
| PATCH `/api/me` | `{language?, name?}` | user | — |
| GET `/admin/overview` | `country?` | §1.1 | — |
| GET `/admin/overview/export.csv` | `country?` | CSV | Overview report exported |
| GET `/admin/activity` | `period, tz, country?` | `{buckets}` | — |
| GET `/admin/users` | `role,status,q,page,limit,country?` | paged users | — |
| GET `/admin/users/export.csv` | same | CSV | Candidates/Recruiters exported |
| GET `/admin/jobs` | `status,q,page` | paged jobs | — |
| GET/POST `/admin/jobs/:id/ai-summary` | `lang` | summary | (optional) Job AI summary generated |
| GET `/admin/applications` (+ `/export.csv`) | `status,q,page` | paged | Applications exported |
| GET `/admin/recruitment/summary` · `/movement` · `/roles` · `/coverage` | `stage?, jobId?` | §1.8 | — |
| GET `/admin/permissions` | — | groups | — |
| GET `/admin/roles` | — | roles + assignedUsers | — |
| POST `/admin/roles` | `{name,scope,description,permissions}` | 201 role | Custom role created |
| POST `/admin/roles/:id/duplicate` | — | 201 role | Role duplicated |
| PATCH `/admin/roles/:id` · POST `/admin/roles/:id/archive` | (Q6) | role | Role updated / archived |
| GET `/admin/access/users` | `q` | users + access | — |
| PUT `/admin/access/users/:userId` | `{roleId,department,granted,removed}` | access | User access saved |
| DELETE `/admin/access/users/:userId` | — | 204 | User access revoked |
| POST `/admin/access/invitations` | `{email,name,roleId?}` (Q7) | 201 | Admin invited |
| GET `/admin/courses` · `/admin/courses/stats` | `audience,status,q` | list/stats | — |
| POST `/admin/courses` (multipart) | fields + media | 201 | Course uploaded |
| PATCH `/admin/courses/:id` (multipart) | fields + media? | course | Course updated |
| PATCH `/admin/courses/:id/status` | `{status}` | course | Course published / unpublished |
| (lessons CRUD if Q25 = A) `POST/PATCH/DELETE /admin/courses/:id/lessons[/:lessonId]` | | | Course updated |
| GET `/api/media/:fileId` | Range | stream | — |
| GET `/admin/payments` · `/admin/payments/:id` · `/admin/payments/export.csv` | filters | | Payments exported |
| POST `/api/stripe/webhook` | raw | 200 | — (Q46) |
| GET `/admin/matching/policies` | — | `{policies, activeId}` | — |
| POST `/admin/matching/policies` | `{name,description}` | 201 | Matching policy draft created |
| PUT `/admin/matching/policies/:id/signals` | `{skills,experience,location}` | policy | Matching policy saved |
| POST `/admin/matching/policies/:id/activate` | — | `{activeId}` | Matching policy activated |
| POST `/admin/matching/policies/suggest-description` | `{name,description,language}` | `{suggestion}` | (optional) |
| GET `/admin/matching/oversight` · `/admin/matching/evidence` | `jobId, candidateId` | §1.18 | — |
| GET `/admin/ai/status` | — | `{connected,model,lastSuccessAt}` | — |
| GET `/admin/analytics` | `range,tz,country?` | §1.20 | — |
| GET `/admin/reports/types` · GET `/admin/reports` | | | — |
| POST `/admin/reports` (multipart) | `{typeId,brief,voiceNote?}` | `{id,filename,downloadUrl}` | Report exported |
| GET `/admin/reports/:id/download` | | CSV | (optional) Report downloaded again |
| GET `/admin/moderation/summary` | | counts | — |
| GET `/admin/moderation/content` · `/content/:caseId` · `/jobs/:jobId` | `status` | | — |
| POST `/admin/moderation/content/:caseId/decision` · `/jobs/:jobId/decision` | `{decision,reason}` | case | Content report dismissed / Content restricted |
| GET `/admin/moderation/accounts` · `/accounts/:userId` | | account + company + KYC files | — |
| POST `/admin/moderation/accounts/:userId/decision` | `{decision,reason}` | user | Account approved / Account suspended for review |
| GET `/admin/moderation/credentials` · POST `/admin/moderation/credentials/:checkId/decision` (Q43) | `{decision:'verified'|'rejected', reason}` | check | Credential verified / rejected |
| POST `/api/moderation/reports` (candidate/recruiter side, Q41) | `{targetType,targetId,reason,summary}` | 201 | system event "Content report received" |
| GET `/admin/audit-events` · `/export.csv` | `category,q,page,limit` | paged | Audit log exported |
| GET `/api/admin/files/:fileId` | | stream (KYC/evidence/voice) | — |

Validation errors: return `422 {errors:{field:'messageKey'}}` with the same message keys the client shows today so the copy can be translated in one place.

---

## 4. Permission map (what enforcing would require)

### 4.1 Who and what (current behaviour)
* **Users in User access** = marketplace accounts (3 candidates + 1 recruiter), shown with "Platform type" Candidate/Recruiter (`accessData.js:109`). No admin staff appear. The candidate/recruiter directories link "Manage" into this dialog (`UsersDirectory.jsx:55`).
* **A role assignment grants**: a role id, a free-text department, plus per-user grants/removals. **Nothing reads it**; no route, nav item or button checks a permission. Effective permissions = role ∪ granted − removed (`useAccess.js:11-16`).
* **Scope** (role) = one of Organization / Department / Finance department / Team, free label. **Department** (user) = free text ≤60 labelled "Department or scope". No data entity has a department, so neither can restrict data today.
* The catalogue reads like an **employer-team RBAC** (Manager "supervises a team, manages recruitment activity", Accounts Head "finance approvals", permissions "Create, edit, publish, and pause jobs", "Move candidates and manage recruitment stages", "Update employer information and branding"). The admin workspace is explicitly read-only on recruitment ("Oversight, not hiring control", `OversightSidebar.jsx:56-62`).

### 4.2 Map of each existing permission id to admin pages/actions it could guard (if Q1 = admin staff)

| Permission id | Guards (page / action / endpoint) | Fit |
|---|---|---|
| `users.view` | Candidates, Recruiters lists (`GET /admin/users`); User access list | good |
| `users.add` | **no UI**. Could guard admin invitations (Q7) | no UI |
| `users.edit` | **no UI** (no user-edit screen); account approve could use it | weak |
| `users.deactivate` | Moderation › "Suspend for review" (`POST …/accounts/:id/decision` with `suspended`) | partial overlap with `moderation.manage` |
| `roles.view` | Access management Roles + User access tabs (`GET /admin/roles`, `/admin/access/users`) | good |
| `roles.create` | Create custom role, Duplicate | good |
| `roles.edit` | **no UI** (Q6) | no UI |
| `roles.archive` | **no UI** (Q6) | no UI |
| `roles.assign` | Manage access Save / Revoke (`PUT/DELETE /admin/access/users/:id`); Candidates/Recruiters "Manage" link | good |
| `jobs.manage` | admin cannot create/edit/publish jobs; nearest: Moderation "Restrict content" on a job (pauses it) | mismatch |
| `candidates.view` | Applications page, Recruitment page (candidate movement), AI matching oversight (candidate names/percent) | acceptable |
| `pipeline.manage` | **no admin UI** (recruitment is read-only) | mismatch |
| `company.edit` | **no admin UI** (admin "Companies" screen not built, inventory line 108) | mismatch |
| `finance.view` | Payments page + details (`GET /admin/payments*`) | good |
| `finance.approve` | **no UI** (no refunds/approvals) | no UI |
| `reports.view` | Analytics page, Reports page (view history), Overview? | good |
| `reports.export` | Reports generate/download; all CSV exports (Overview, Users, Applications, Payments, Audit) | good |
| `moderation.manage` | Moderation page and all decision endpoints (content, accounts, credentials) | good |
| `audit.view` | Audit logs page + export; Overview "Recent platform activity" | good |
| `learning.manage` | Courses page: upload, manage, publish/unpublish, media upload | good |

**Admin areas with no permission today**: Overview (dashboard), Jobs list + AI summary, AI & matching (policies, activation, suggestion, oversight), Settings, viewing Courses without managing, payments export (finance + export), AI status. Proposed additions (Q3): `dashboard.view`, `jobs.view`, `ai.view`, `ai.manage`, `learning.view`, `settings.manage` (and drop or repurpose `jobs.manage`, `pipeline.manage`, `company.edit`, `finance.approve`, `users.edit`, `users.add` unless their features are built).

### 4.3 What enforcement requires
1. Server middleware `requirePermission(...ids)` on every `/api/admin/*` route (table above), using effective permissions computed per request from DB (no Redis): `AdminAccess` + `Role` lookup (cache per request; small collections).
2. Owner/super-admin bypass and anti-lock-out rules: seeded owner(s) always pass; a user cannot remove their own `roles.assign`; cannot revoke/demote the last owner (Q8).
3. Client: `GET /api/auth/me` returns `permissions`; sidebar items (`workspaces.js:91-106`), page actions (Create custom role, Duplicate, Save/Revoke, Upload course, Publish, Make active, Create policy, decisions, Export buttons) hidden or disabled; route-level guard shows a 403 page (not designed).
4. Archived roles: assignments to an archived role either block archiving or fall back to "no role".
5. Role changes take effect on the next request (DB read per request), so there is no token re-issue problem; suspension uses `tokenVersion`.
6. Audit every Access mutation (none today).
7. Scope/department: either ignored for authorization (labels only) or a data-partition filter added to every query (Q4). The second option needs a department/region field on users, jobs, payments, etc.

---

### 4.4 Permissions needed by the new decisions (§9)

| Area (decision) | Pages / endpoints | Existing id that fits | Proposed new id |
|---|---|---|---|
| Course builder: details, lessons, uploads, quiz, publish (1) | `/admin/courses/*` editor; `POST/PATCH/DELETE /api/admin/courses*`, `/api/admin/uploads` | `learning.manage` | — |
| View courses & learner stats (1) | Courses list, stats, learners drill-down | — | `learning.view` |
| Course revenue (1) | Revenue column/stat | `finance.view` | — |
| Revoke a certificate (1) | `POST /api/admin/certificates/:id/revoke` | `learning.manage` | — |
| Candidate verification queue: approve/reject (2) | `/admin/moderation/verification*`; `POST /api/admin/verification/:id/decision` | `moderation.manage` | optional split `verification.review` |
| Recruiter approval: approve/reject (2) | `/admin/moderation/accounts*` | `moderation.manage` (+ `users.edit`) | optional split `accounts.review` |
| Suspend / reactivate an account (2, 4) | account decision, user detail | `users.deactivate` | — |
| Open sensitive files: KYC, evidence, right-to-work, certificate files (2, 4) | `GET /api/admin/files/:id` | — | `documents.view` |
| Subscriptions & renewals (3) | Payments (filters, details, KPIs), Candidates plan column | `finance.view` | — |
| Cancel / refund / grant a plan (3, if Q67 = B) | new actions | `finance.approve` | — |
| Candidate / recruiter detail pages (4) | `/admin/candidates/:id`, `/admin/recruiters/:id` | `users.view` | — |
| Restrict a profile or photo (4) | moderation decision | `moderation.manage` | — |

## 5. Course content gap

> **Superseded in part by decision 1 (§9.1).** Lessons (title, type, content/file, duration), the final quiz and certificates are now authored in a lesson builder. The gap below still applies to course-level copy and imagery (Q53), the free preview (Q58), tier/access captions (Q27) and the seed mismatches (Q28/Q60).

### 5.1 What the admin form collects (`CourseFormModal.jsx:17-45`)
`audience, title, category, level, lessons (count 1–60), access free|paid, price GBP (0.01–999), mediaName (file name only), status`. Server-managed: `id, updatedAt, enrolled (0), purchased (0)`.

### 5.2 What learners render

**Candidate** (`candidate/learning/data/courses.js:32-163`; pages `LearningPage`, `LearningDetailsPage.jsx`, `CourseCard.jsx`, `LessonRow.jsx`):

| Learner field | In admin form? | How it's faked for uploads today |
|---|---|---|
| id, title, level, price | yes | — |
| category | yes ("Category or skill") | — |
| duration ("2h 20m") | **no** | `lessons × 35 min` (`learnerCourse.js:5,12-18`) |
| tier ("Included"/"Plus" badge) | **no** | `price > 0 ? 'Plus' : 'Included'` (`candidate/…/useCourseCatalogue.js:14`) — contradicts seed (Included courses cost £49) |
| recommended (skill-gap flag) | **no** | `false`; seed flags + static `GAP_SKILL='Interaction Design'` (`courses.js:14`), `SKILLS_TO_EXPLORE=6` (`:12`) |
| summary | **no** | template (`useCourseCatalogue.js:17`) |
| about | **no** | template (`:18`) |
| outcomes[3] | **no** | 3 template lines (`:19-23`) |
| lessons[{id,title}] | count only | "Lesson 1…N" (`learnerCourse.js:7-9`) |
| card photo | **no** | one stock image for every candidate course (`candidate/…/CourseCard.jsx:6,25`) |
| "Free introduction · 3 min" + "Watch free introduction" video | **no** | static copy; modal says "This prototype does not include video playback" (`LearningDetailsPage.jsx:79, 89-91, 213-215`) |
| lesson subtitle "Pre-recorded lesson" / lesson video | **no** | static (`LearningDetailsPage.jsx:119`) |
| "Included" list: "{n} pre-recorded lessons", "Completion assessment", "Course-completion badge", "Learn at your own pace" | **no** | static (`LearningDetailsPage.jsx:13`) |
| access caption "One-time course access" | **no** | static (`CourseCard.jsx:42`, `LearningDetailsPage.jsx:152`) |

**Recruiter** (`recruiter/learning/data/courses.js:28-186`; `CourseDetailsPage.jsx`, `CourseCard.jsx`, `LessonRow.jsx`):

| Learner field | In admin form? | Faked today |
|---|---|---|
| id, title, level, price | yes | — |
| stream | yes (= admin `category`) | — |
| duration | **no** | lessons × 35 min |
| access caption ("Lifetime course access" / "One-time course access" / "Free course access") | **no** | derived from price (`recruiter/…/useCourseCatalogue.js:16`) |
| photo (hero 784×320, card 363×203) | **no** | single stock image (`:4,17`) |
| summary, lead, tagline, designedFor | **no** | templates (`:18-21`) |
| outcomes[3] | **no** | templates (`:22-26`) |
| lessons[{id,title}] | count only | "Lesson N" |
| lesson subtitle "Guided lesson · Practical recruiter example" | **no** | static (`recruiter/…/courses.js:18`) |
| "Included" list incl. "**4** pre-recorded lessons" (wrong: all recruiter courses have 5) | **no** | static (`CourseDetailsPage.jsx:15`) |
| "Recommended for you" suggestions (tag + reason text quoting "3 applications", "3 published roles") | **no** | static `SUGGESTIONS` (`recruiter/…/courses.js:189-208`) |

### 5.3 Gap list (what the backend Course model must add)
1. Lesson records: `order, title, video (file), duration`, optional description/resources; lesson count derived (the "Lessons 1–60" number field becomes redundant).
2. Course duration: sum of lesson durations (or entered).
3. Copy: `summary` (card/hero), `about` (candidate) / `lead` (recruiter), `tagline`, `designedFor`, `outcomes[]` (3?). Per-language? (UI languages en/es/fr: are courses translated or single-language with a `language` field?)
4. Media: cover photo, free intro/preview video (~3 min), lesson videos (Q24).
5. Assessment (questions/answers/pass mark) and badge definition (Q26), or remove those promises.
6. `tier` / `access` caption semantics (Q28).
7. `recommended`: replace with a computed match between course `category/skills` and the learner's skill gaps (needs `skills:[...]` on Course).
8. Currency (Q27), and a course `country/region` availability flag if the country picker is meant to filter courses.
9. Counters `enrolled` / `purchased`: computed (Q31).
10. Seed reconciliation (table in §1.14; Q29).

---

## 6. Static items to replace (master list)

Paths relative to `client/src/` (i.e. prefix `client/src/`). "→" = replacement.

**Overview**
* `client/src/features/admin/overview/data/overview.js:7-13` OVERVIEW_STATS (applications 9, verifiedProfiles 0, courseEnrollments 0, courseBadges 0, averageRoleMatch '68%') → aggregations §1.1
* `…/overview.js:16-23` MARKETPLACE_HEALTH values → aggregations
* `…/overview.js:26-33` DEMANDED_SKILLS → job skills aggregation
* `…/overview.js:35` RECENT_ACTIVITY → audit feed
* `…/overview.js:42` BAR_SCALE_MAX 25 → computed max
* `…/overview.js:44-73` ACTIVITY_PERIODS (labels, bars, line index) → `/admin/activity`
* `client/src/features/admin/overview/pages/OverviewPage.jsx:20-23,60` counts from static `ADMIN_USERS` → `/admin/overview`
* `…/OverviewPage.jsx:26,28,47,54` demo captions
* `client/src/features/admin/overview/components/PlatformActivityCard.jsx:13` fixed 0–100 ticks; `:143` "Illustrative…"

**Shared users / directories**
* `client/src/features/admin/shared/data/users.js:6-9` USER_STATUSES (add suspended…); `:11-52` ADMIN_USERS (4 accounts, verification labels, learning strings, statuses, joined dates); `:55-57` en-US formatter
* `client/src/features/admin/shared/components/UsersDirectory.jsx:55` Manage → access-management link (Q5); `:85-95` CSV with raw ISO

**Jobs / AI summary**
* `client/src/features/recruiter/jobs/data/jobs.js:26-99` SEED_JOBS (via `lwm.recruiter.jobs`) → `Job` collection
* `client/src/features/recruiter/jobs/data/jobFields.js:162-171` `$…k` salary
* `client/src/features/admin/jobs/components/JobSummaryModal.jsx:9-16,18-38` template "AI"; `:60,62,114-115` demo copy

**Applications**
* `client/src/features/admin/applications/pages/ApplicationsPage.jsx:14-15` APPLICANT "Alex Morgan"; `:23,38` raw ISO date; `:17` tones
* `client/src/features/candidate/jobs/data/applications.js:13-17` SEED_APPLICATIONS (via `lwm.candidate.applications`)

**Recruitment**
* `client/src/features/admin/recruitment/data/recruitment.js:3` stage enum; `:6-14` CANDIDATES (7, incl. 4 non-existent people, tint colours); `:16-20` PUBLISHED_ROLES; `:22-26` APPLICATION_COVERAGE (raw ISO dates); `:29-36` FUNNEL_STAGES 9/6/5/4/3/2
* `client/src/features/admin/recruitment/pages/RecruitmentPage.jsx:55` Reviewed outreach `0`
* `client/src/features/admin/recruitment/components/CandidateMovement.jsx:45` "No outreach"
* `client/src/features/admin/recruitment/components/OversightSidebar.jsx:36-38` "Published" literal

**Access management**
* `client/src/features/admin/access-management/data/accessData.js:6-57` PERMISSION_GROUPS; `:62` ACCESS_SCOPES; `:64-99` SYSTEM_ROLES; `:102-104` DEFAULT_USER_ACCESS (Sarah → Manager/Talent); `:106-111` FIGMA_ORDER + ACCESS_USERS from ADMIN_USERS
* `client/src/features/admin/access-management/hooks/useAccess.js:5-6` localStorage keys; `:57` default description; `:18-23` id scheme
* `client/src/features/admin/access-management/components/RoleCard.jsx:17` "Active" literal
* `client/src/features/admin/access-management/pages/RolesPage.jsx:36,54`; `UserAccessPage.jsx:120`; `client/src/components/ManageAccessModal.jsx:138` demo copy

**Courses**
* `client/src/features/admin/courses/data/courses.js:3` levels; `:11-13` defaults (enrolled 0, purchased 0, mediaName ''); `:15-28` INITIAL_COURSES (prices/titles disagree with learners)
* `client/src/features/admin/courses/utils/courseFormat.js:1` en-US; `:9-11` `£`; `:23` "£0 … £999" message
* `client/src/features/admin/courses/utils/learnerCourse.js:5-18` fabricated lessons/duration
* `client/src/features/admin/courses/components/CourseFormModal.jsx:79` "Price (GBP)"; `:88-97` name-only media; `:94-95` demo hints
* `client/src/features/admin/courses/pages/CoursesPage.jsx:65,94,125-128` copy/demo
* `client/src/features/candidate/learning/hooks/useCourseCatalogue.js:7-26` and `client/src/features/recruiter/learning/hooks/useCourseCatalogue.js:4,8-29` fromUpload templates
* `client/src/features/candidate/learning/data/courses.js:4-7,12,14,32-163`; `client/src/features/recruiter/learning/data/courses.js:13-16,18,28-186,189-208` learner catalogues (+ `CourseDetailsPage.jsx:15` "4 pre-recorded lessons", `LearningDetailsPage.jsx:13,79,119,213-215`, candidate `CourseCard.jsx:6,42`)

**Payments**
* `client/src/features/payments/data/payments.js:21` `£`; `:24-26` en-US; `:28` demo decline text; `:38-45` SEED_PAYMENTS
* `client/src/features/payments/hooks/usePayments.js:14` `lwm.payments`; `:19` filter by hard-coded workspace user name; `:27-30` reference numbering
* `client/src/features/admin/payments/pages/PaymentsPage.jsx:52` single-currency sum; `:68` "Amount (GBP)"; `:106` "in GBP"; `:87-89` demo copy

**AI & matching**
* `client/src/features/admin/ai-matching/data/matching.js:2-18` signals; `:20-23` human review; `:25-31` DEFAULT_POLICY; `:34-39` OVERSIGHT_CANDIDATES; `:41-47` MATCH_EVIDENCE; `:50-53` template suggestion
* `client/src/features/admin/ai-matching/components/OversightSection.jsx:17` "Senior Product Designer"
* `client/src/features/admin/ai-matching/components/PolicySidebar.jsx:50-59` service status
* `client/src/features/admin/ai-matching/components/PolicyEditor.jsx:18,23,68-70`; `CreatePolicyModal.jsx:108`; `pages/AiMatchingPage.jsx:37,55` demo copy

**Analytics**
* `client/src/features/admin/analytics/data/analytics.js:3-8` ANALYTICS_STATS; `:10-17` DEMANDED_SKILLS; `:19-35` QUALITY_NOTES; `:37-41` DATE_RANGES; `:43` DAYS; `:46-65` ACTIVITY_BY_RANGE
* `client/src/features/admin/analytics/components/ActivityCard.jsx:16` "Illustrative…"

**Reports**
* `client/src/features/admin/reports/data/reports.js:4-23` types reading static analytics; `:20` "(this week, illustrative)"; `:33` "Current local workspace"
* `client/src/features/admin/reports/components/ReportForm.jsx:94-104`; `pages/ReportsPage.jsx:37-44,49` demo copy

**Moderation**
* `client/src/features/admin/moderation/data/moderation.js:4-25` CONTENT_ITEMS; `:28-36` PENDING_ACCOUNTS; `:76` demo copy; `:82-88` badge enum
* `client/src/features/admin/moderation/pages/ModerationPage.jsx:152` "Credential reviews" `"0"`; `:87` demo copy; `:47` tab copy (candidate & recruiter)
* `client/src/features/admin/moderation/components/ReviewDetails.jsx:63`; `ReviewDialog.jsx:48` demo copy

**Audit**
* `client/src/features/admin/audit-logs/data/auditEvents.js:2-9` categories; `:15-64` SEED_AUDIT_EVENTS
* `client/src/features/admin/audit-logs/hooks/useAuditLog.js:21` actor literal
* `client/src/features/admin/audit-logs/components/AuditEventRow.jsx:21` "Local event"
* `client/src/features/admin/audit-logs/pages/AuditLogsPage.jsx:56,64,111-114` demo copy; `client/src/features/admin/audit-logs/utils/formatDate.js:1-8` en-US

**Shell / settings**
* `client/src/app/workspaces.js:86-87` admin identity (name, "Acme Studio", candidate avatar); `:89` no location
* `client/src/components/layout/preferencesContext.js:4` LOCATIONS (US/global, not EU27+UK+Remote); `:7` LANGUAGES label-only
* `client/src/components/layout/Header.jsx:171` permanent notification dot
* `client/src/hooks/useCountUp.js:3,38` en-US digit grouping
* `client/src/features/admin/settings/pages/AdminSettingsPage.jsx:14-25` placeholder

**Formatters / hard-coded currency summary**: `formatJoined` (users.js:55), `formatDate`/`formatDateTime` (audit-logs/utils/formatDate.js; used by audit, moderation, AI matching, reports history, payments details), `formatUpdated` + `formatPrice` (courseFormat.js), `formatMoney` + `formatPaymentDate` (payments.js), `formatSalary` (jobFields.js), raw ISO in Applications, Recruitment coverage, all CSVs; `£` at courseFormat.js:10,23, CourseFormModal.jsx:79, payments.js:21, PaymentsPage.jsx:68,106; `$` at jobFields.js:165; inline English plurals at UserAccessPage.jsx:48, ManageAccessModal.jsx:138, DemandedSkillsCard.jsx:19, InsightCards.jsx:20, AuditLogsPage.jsx:56, PaymentsPage.jsx:87. Translatable admin copy ≈ 750 strings (Overview 45, popup 8, Users 35, Jobs 15, AI summary 25, Applications 15, Recruitment 50, Access ~130 incl. catalogue, Courses 55 + modal 20, Payments 45, AI matching 45 + create 20, Analytics 35, Reports 30, Moderation 65, Audit 25 + seeds, Settings 5).

---

## 7. Questions

Each has options and a recommendation (R).

**Access management**
* **Q1. Who are the "users" in Access management › User access?** Today they are the 4 marketplace accounts (3 candidates + 1 recruiter), and the Candidates/Recruiters "Manage" button opens the role dialog for them. (A) Admin staff accounts only, so roles gate admin pages; (B) members of a recruiter company team (employer RBAC, e.g. Acme Studio's Manager/Accounts Head/Staff), managed by the admin; (C) all platform accounts with per-user capability overrides. **R: A.** It is the only option consistent with "one role per account" and "admin custom roles". B would be a recruiter-side feature.
* **Q2. Should admin custom roles enforce permissions on admin endpoints?** (A) Enforce server-side on every `/api/admin/*` route and hide the matching UI, with a seeded non-revocable Owner; (B) store and display only in v1 (informational) and enforce later; (C) enforce only on Access, Payments and Audit. **R: A if Q1 = A.** Retrofitting enforcement onto every route later costs more than doing it once now.
* **Q3. Permission catalogue.** The 20 permissions include employer abilities the admin never performs (`jobs.manage`, `pipeline.manage`, `company.edit`), abilities with no UI (`users.add`, `users.edit`, `roles.edit`, `roles.archive`, `finance.approve`), and they miss AI & matching, Jobs/AI summary, Overview, Analytics view, Courses view and Settings. (A) Replace it with an admin-page catalogue (proposal in §4.2); (B) keep the Figma list verbatim and map it as best we can; (C) keep the Figma list and add the missing ids. **R: C** (keeps the Figma copy, closes the holes). Drop the ids that have no feature behind them.
* **Q4. What do role "Access scope" (Organization / Department / Finance department / Team) and user "Department or scope" (free text ≤60) mean?** (A) Descriptive labels only, with no data restriction; (B) a data partition, e.g. by country/region, applied to every admin query; (C) remove both fields. **R: A for v1.** B needs a partition field on every entity.
* **Q5. Where should "Manage" on Candidates/Recruiters rows go?** Today it opens the access-role dialog for a marketplace user. (A) Remove the link until a user screen is designed; (B) a new admin user-detail page (status, suspend/reactivate, verification, enrollments, payments), which is not in Figma; (C) keep the access dialog (only valid if Q1 = C). **R: B (minimal)**, or A if no new screens are allowed. *(Update: decision 4, structured candidate profiles, makes a candidate detail page necessary. See Q69.)*
* **Q6. Role lifecycle.** `roles.edit` and `roles.archive` exist and RoleCard always shows "Active", but there is no Edit/Archive UI. (A) Add Edit (Create dialog prefilled) and Archive (blocked while users are assigned) to RoleCard; (B) custom roles are immutable (duplicate to change) and are never archived; (C) server endpoints now, UI later. **R: A.**
* **Q7. How are additional admin staff accounts created?** Admins are seeded, `users.add` says "Create or invite a new user record", and the sign-in page says "Production accounts require an invitation". (A) Invite by email from User access (new button + SMTP invite link + set-password page); (B) seed/CLI only; (C) no extra admins in v1. **R: A if Q1 = A, otherwise B.**
* **Q8. Lock-out protection.** (A) Seeded Owner(s) bypass permissions and cannot be revoked; at least one Owner must always exist; nobody can remove their own `roles.assign`; (B) no special rules. **R: A.**

**Overview / Analytics**
* **Q9. Which timezone and week definition drive "This week / Last week / Last month" and daily buckets?** (A) Fixed Europe/London, ISO weeks Mon–Sun; (B) the admin's browser timezone sent as `tz`, ISO weeks; (C) UTC. **R: B.**
* **Q10. Line view.** Today it plots a 0–100 "index" for Mon–Sat only (a Figma artefact), and "Last month" has no line data. (A) Plot the same real counts as the bars (7 days or 4–5 weeks) on an auto-scaled axis; (B) plot cumulative counts; (C) plot % of the period total. **R: A.**
* **Q11. Define "Average role match"** (today a fixed 68% captioned "Evidence summary for Senior Product Designer"). (A) Mean match % over all (candidate, published job) pairs above a threshold; (B) mean of each published job's top-N match %; (C) the mean for one selected job (needs a picker). **R: B**, captioned "Across {n} published roles".
* **Q12. Define "Active users".** (A) Accounts with status = active, candidates + recruiters (today's caption); (B) accounts that signed in during the last 30 days; (C) active candidates only (the card links to Candidates). **R: A**, linking to Candidates is then misleading, so also confirm the link target.
* **Q13. What feeds "Recent platform activity"?** (A) The latest 5 audit events; (B) a separate platform event feed (registrations, applications, purchases, reports); (C) both merged. **R: A** (the audit log already carries System and Marketplace-user events, if Q46 = B).
* **Q14. Analytics "Matching quality needs more than a score" card** (statuses "Not yet connected" / "Not yet measured" / "Human review required"). (A) Keep it as explanatory, translatable copy (not data); (B) build relevance-feedback and recommendation-conversion tracking and show real metrics; (C) remove the card. **R: A for v1.** Note that "nothing static" would otherwise require two new features.
* **Q15. Define "Shortlist conversion"** (today 33%, "Shortlisted / current demo candidates"). (A) Distinct shortlisted candidates ÷ all candidates; (B) shortlisted applications ÷ applications; (C) shortlist entries ÷ candidate profile views. **R: B.**
* **Q16. Does the Analytics/Overview date range apply to the KPI cards, marketplace health and demanded skills, or only to the chart?** (A) Chart only (as today), with KPIs all-time; (B) every widget. **R: A**, with "All time" in the captions.

**Recruitment**
* **Q17. Pipeline unit and funnel semantics.** Today: one stage per *candidate*; the funnel shows "reached" counts that contradict the data view; application statuses (applied / under-review / interview / withdrawn) differ from pipeline stages (Applied…Hired). (A) Per application (candidate × job): the data view counts the current stage, the funnel counts applications that ever reached each stage (needs stage history), one unified stage enum, withdrawn excluded; (B) per candidate at their furthest stage; (C) the funnel shows the same current-stage counts as the data view. **R: A.**
* **Q18. Funnel graphic.** (A) Keep the fixed Figma shapes and make only the numbers dynamic; (B) scale the shapes to the counts. **R: A.**
* **Q19. Define "Reviewed outreach" / "Outreach drafts reviewed".** (A) Count recruiter outreach entries (CandidateActivity type = outreach, each saved after the recruiter reviewed it); (B) add an explicit "reviewed" flag and count only flagged entries. **R: A.**

**Jobs / AI**
* **Q20. Admin Jobs list scope.** Today it shows published jobs only, so restricted (paused) jobs disappear from the admin's view. (A) Keep published only; (B) all statuses with a status filter (new select). **R: B.**
* **Q21. Admin job AI summary generation.** (A) Generate on first open, cache per (job version, language), plus a "Regenerate" button (new); facts and skills stay from the DB, AI writes the overview paragraph and review points; (B) generate automatically when a job is published or updated; (C) call OpenAI on every open. **R: A.**
* **Q22. Salary currency.** Jobs store min/max "annual USD" and show `$140k`. (A) Each job stores a currency (default from the company country) and a period, displayed in the job's currency; (B) convert to the viewer's country currency. **R: A.**

**Courses**
* **[SUPERSEDED by decision 1: media is now per lesson (video / text / PDF-document / external link). Remaining file types and sizes → Q52.] Q23. What is "Course media"?** Today it is any file, name only. (A) One cover image (JPG/PNG/WebP ≤5 MB) + one intro video (MP4/WebM ≤500 MB); (B) a single downloadable file of any type; (C) per-lesson videos (MP4/WebM, e.g. ≤1 GB each) + cover image + free intro video. **R: C.** The learner pages already promise "pre-recorded lessons", a "Free introduction · 3 min" video and photos. Confirm the size limits, given storage is on the server's disk.
* **[PARTLY ANSWERED by decision 1: lessons come from the lesson builder. Course-level copy and the cover image are still open → Q53.] Q24. How does learner content get authored?** Missing today: lesson titles/order/video/duration, summary, about/lead, tagline, designed-for, outcomes, cover, intro. (A) Extend the admin form with a lesson editor and content fields (new UI beyond Figma); (B) generate the missing text with OpenAI from title/category/level, then the admin edits it; (C) keep the generated placeholders ("Lesson N", 35 min/lesson, template outcomes). **R: A (+B as an assist).** C conflicts with "nothing static".
* **[ANSWERED by decision 1: a final quiz (pass mark ~70%) completes the course and generates a PDF certificate with a verification code. Follow-ups → Q54, Q57.] Q25. "Completion assessment" and "Course-completion badge"** are promised on both learner pages but have no data model. (A) Build a per-course quiz authored in admin and issue a badge on pass; (B) the badge is issued when all lessons are completed, and the "Completion assessment" copy is removed; (C) no badges. **R: B for v1.**
* **Q26. Course pricing currency.** The admin form is "Price (GBP)" £0.01–£999, while the country picker "controls currency". (A) All course prices and charges in GBP everywhere; (B) the admin enters a price per currency (GBP, EUR, …) and the learner pays in their country's currency; (C) GBP base price, approximate local display, charge in GBP. **R: A** (simplest with Stripe; the same applies to Plus £9). If B, Payments "Collected" must be per currency.
* **Q27. Candidate "tier" (Included / Plus) and recruiter "access" caption (Lifetime / One-time / Free).** (A) "Plus"-tier courses are free for AI Matches Plus subscribers and "Included" courses are free for everyone; (B) tier/caption are badges derived from price (>0 → Plus / One-time) with no entitlement effect; (C) remove both. **R: B**, but then the seed's "Included" courses priced £49 must be fixed. *(Update: decision 3 says the £9 plan unlocks applying, messaging replies and job alerts. Should it also unlock "Plus"-tier courses? If yes, option A becomes the rule.)*
* **Q28. Seed reconciliation.** Admin and learner catalogues disagree on 9 of 12 prices, one title and one category. (A) Learner catalogue values win (they match the seed payments, e.g. Alex paid £49 for Interaction design foundations); (B) admin values win (many courses become Free). **R: A.**
* **Q29. Unpublish semantics.** (A) Hidden from catalogues; existing purchasers keep access and progress; (B) hidden from everyone, purchasers included. Also: is deleting a course allowed (no UI today)? **R: A, no delete** (archive only, if needed).
* **Q30. Define "enrolled", "purchased", "Active learners" and Overview "Course enrollments".** (A) enrolled = learners who added or bought the course (free + paid); purchased = paid course payments; Active learners = enrollments with ≥1 lesson done and not completed; (B) enrolled = learners who started at least one lesson. **R: A.** *(Update: decision 1 requires the stats enrolled, purchased, completions (= quiz passed = certificate issued) and revenue per course. Only the "enrolled" and "active learner" definitions remain open.)*

**Payments**
* **Q31. Failed payments with Stripe hosted Checkout** (declines inside Checkout don't end the session). (A) Record failed attempts from `payment_intent.payment_failed` webhooks (several per session possible); (B) record only completed payments and drop the "Failed payments" stat and filter. **R: A.**
* **Q32. Plus renewals and refunds.** (A) One Payment row per paid invoice (`invoice.paid`), renewals included; refunds out of scope; (B) only the first subscription payment. **R: A.** Confirm that refunds are out of scope. *(Update: with decision 3 the monthly plan gates applying, messaging and alerts, so renewals and `invoice.payment_failed` → past_due must be tracked. A is effectively required.)*

**AI & matching**
* **Q33. What does a matching policy control, and what is the matching engine?** (A) The active policy's signals switch on/off the inputs of a deterministic server score (skill overlap, experience, location/work preference) used by recruiter match %, candidate AI insights and admin oversight; OpenAI writes only the explanations; (B) OpenAI embeddings + rules; (C) an LLM scores each pair. **R: A** (explainable, cheap, reproducible). Activating or saving a policy triggers a recompute.
* **Q34. Oversight section** is fixed to "Senior Product Designer", 4 candidates and one evidence card. (A) Add a job picker (default: newest published job), show its top 4 candidates, and show evidence for the selected candidate; (B) automatically use the job with the most applications; (C) remove the section. **R: A** (one new control).
* **Q35. Policy management gaps.** There is no rename/description edit/delete/archive, one global active policy, all signals can be switched off, and copy mentions "versioned explanations". (A) Allow editing name/description, archive drafts, require ≥1 signal, and keep a version history that MatchResults reference; (B) keep it exactly as designed. Also: one active policy globally, or one per country? **R: A, one global policy.**

**Reports**
* **Q36. What does OpenAI do for the "report brief"?** (A) Transcribe the voice note (Whisper) and add the transcript plus an AI executive summary (in the admin's language, guided by the brief) to the export; (B) an "Improve brief" button that rewrites the brief text; (C) only transcribe the voice note into the brief. **R: A.** Confirm that CSV (with a summary block) is still the format.
* **Q37. Voice note.** (A) Attach only: mp3/m4a/wav/webm/ogg, ≤25 MB (the Whisper limit), stored on disk; (B) also in-browser recording (the label says "Record or attach"). **R: A** (+B if you want recording).
* **Q38. "Download again" and report period.** (A) Store the generated file and re-serve the identical snapshot, and add a period select (this week / last week / last month) to the form; (B) regenerate from current data (today) with "this week" fixed. **R: A.**

**Moderation**
* **Q39. Where do content reports come from?** No candidate or recruiter screen can file one. (A) Add a "Report" action to job details (candidate), candidate profile (recruiter) and company page (new UI); (B) cases are created only by admins (Jobs › Review); (C) automatic AI flags create cases. **R: A**, with B kept for admin-initiated reviews.
* **Q40. Account review scope and decision set.** *(The end-to-end recruiter approval flow is in §9.2. This question remains open.)* The decision says recruiters must be approved, but the seed has a *pending candidate* (James Chen) and the copy says "candidate and recruiter accounts"; the only actions are Approve / Suspend. (A) Only recruiters enter the queue (candidates are active once their email is verified); actions Approve / Reject / Suspend; (B) both roles are reviewed; (C) keep Approve / Suspend only. **R: A.** Change the seed (James Chen → active candidate, or make the pending account a recruiter).
* **[ANSWERED in part by decision 2: admins review candidate evidence and profile completeness checks. Still open: where the queue lives (recommendation unchanged) → §9.2, Q61–Q62.] Q41. Candidate credential review UI.** It is decided that an admin reviews this evidence, but there is no admin screen and the stat is a literal "0". (A) Add a third Moderation tab "Credential review" using the same QueueRow/ReviewDialog patterns (view file, Verify / Reject with reason); (B) review it from a user-detail page (Q5 B). **R: A.**
* **Q42. Effects and reversibility of "Restrict content".** (A) Job → paused and locked (the recruiter cannot republish until cleared); candidate profile → hidden from recruiter discovery; a later "Dismiss" decision lifts the restriction; every decision is kept in the history and the owner is emailed; (B) restrictions are permanent and there is no email. **R: A.**

**Audit**
* **Q43. What belongs in the audit log?** (A) Admin actions only; (B) admin actions + system and marketplace-user events (as the seed has: "Content report received", "Account registration pending review"), with an actor type. Also: should every CSV export and AI generation be audited (today only Reports and Payments exports are)? **R: B; audit all exports, not AI generations.**
* **Q44. Audit categories.** The enum (Workspace, Policy, Moderation, Reports, Access) has nowhere for course or payment actions. (A) Add `Learning`, `Payments`, `Jobs` (new filter chips); (B) map courses to `Workspace`. **R: A.**

**Shell / cross-cutting**
* **Q45. Admin Settings** (placeholder; also the target of "Profile" and of the notification bell with its permanent dot). (A) Minimal: name, password change, language, email notification preferences, reusing the candidate settings patterns; (B) keep the placeholder and remove the bell dot. **R: A.**
* **Q46. Country picker in the admin workspace** (hidden today). (A) Admins see all countries, with an optional "All countries / {country}" filter on Overview, Analytics and lists (new control); (B) always all data, no picker; (C) the same picker as other roles, filtering everything. Also: is the admin's date/number locale taken from their language or their country? **R: A, locale from the language + an en-GB/es-ES/fr-FR mapping.**
* **Q47. Pagination.** Admin tables have none (except audit, 5 per page). (A) Server pagination + a pager on Users, Applications, Payments and Audit; (B) return every row (fine at demo scale). **R: A** for those four, B for Courses, Jobs and Roles.
* **Q48. Candidates/Recruiters "Verification" and "Learning" columns.** "Not started" and "Not connected" have no backend meaning. (A) Candidates: Not started / In review / {n} of 3 verified / Verified; recruiters: Pending approval / Approved / Suspended; the Learning column is shown for both roles; (B) a different mapping you specify. **R: A.**
* **Q49. Seed vs Figma numbers.** Once computed, the Figma numbers (Applications 9, funnel 9/6/5/4/3/2, 68%, 33%, demanded skills) will not reproduce, and recruitment/oversight show 5 people who have no accounts (Sofia Martinez, Oliver Park, Aisha Patel, Daniel Kim). (A) Seed only coherent entities and let the numbers be whatever they compute to; (B) seed extra accounts, applications and shortlists so the key Figma numbers reproduce. **R: A** (+ create those 4 people as seeded candidates if you want the tables populated).
* **Q50. Emails triggered by admin actions** (SMTP exists). (A) Account approved, rejected and suspended (with reason), credential verified/rejected, content restricted (to the owner), admin invite, all in the recipient's language; (B) the list in A + report dismissed (to the reporter) + access changed + payment receipts; (C) none in v1. **R: A.** *(Update: add "certificate issued" (decision 1), "verification approved/rejected" (decision 2) and "plan renewal failed / plan ended" (decision 3).)*

**New questions raised by the coordinator's decisions (§9)**

*Decision 1: courses with a lesson builder, quiz and certificates*
* **Q51. Where does the course builder live?** The lesson builder and quiz editor don't fit today's 640 px modal (`CourseFormModal.jsx:52`). (A) Full-page editor routes `/admin/courses/new?audience=` and `/admin/courses/:courseId/edit` with tabs Details · Lessons · Quiz · Preview (not in Figma); (B) keep a modal for details and add separate Lessons and Quiz modals; (C) a multi-step wizard modal. **R: A.** Creating the draft first gives a courseId to attach uploads to.
* **Q52. Upload types and sizes for lessons** (files are on the server disk). (A) Video MP4 (H.264/AAC) or WebM ≤1 GB, no server transcoding, streamed with HTTP Range; documents PDF only ≤50 MB; text = rich text ≤50,000 chars (sanitised); links https only; (B) the same, plus DOCX/PPTX as download-only files and video ≤2 GB; (C) small limits (video ≤300 MB, PDF ≤20 MB) to protect disk space. **R: A.** Also confirm the total disk budget and whether lesson duration is entered by hand or read from video metadata (R: prefilled from metadata, editable).
* **Q53. Course-level learner copy and imagery.** Learner pages still show summary, about (candidate), lead/tagline/designed-for (recruiter), outcomes (3), a card/hero photo and a "Free introduction · 3 min" video. (A) Add these fields to the builder's Details tab, with a cover image upload (JPG/PNG/WebP ≤5 MB); (B) generate them with OpenAI from the title, category and lessons, then the admin edits them; (C) drop them from the learner pages. **R: A (+B as an assist button).**
* **Q54. Quiz rules.** (A) Single- and multiple-choice questions; 2–6 options; pass mark default 70% (editable 1–100); unlimited attempts; the quiz unlocks only after all lessons are complete; after an attempt the learner sees the score but not the correct answers; (B) as A but at most 3 attempts per 24 h; (C) single-choice only, the quiz is available at any time, correct answers are shown after submitting. **R: A.** Also confirm whether questions and options are shuffled (R: options shuffled).
* **Q55. When is a lesson "viewed"?** Video is decided at ~90%. For the rest: (A) text = opened and scrolled to the end; PDF = opened in the viewer or downloaded; link = clicked through; video = the server counts ≥90% of *watched* time from progress heartbeats, so seeking to the end doesn't count; (B) every non-video lesson completes on open, and video trusts the reported position; (C) the learner ticks "Mark complete" for non-video lessons. **R: A.**
* **Q56. Editing a published course that has learners.** (A) Version lessons and quizzes: learners keep their progress on unchanged lessons, new lessons become required for incomplete learners, and certificates already issued stay valid; (B) lock the lessons and quiz once anyone is enrolled (only copy and price can change); (C) edits apply immediately and progress is recalculated. **R: B for v1** (simplest and safe); A later.
* **Q57. Certificates.** (A) PDF in the learner's UI language with learner name, course title, completion date, issuer "Local WorkMan" and a 12-character verification code + URL; public verification page `/verify/:code` showing name, course and date; admins can revoke (audited); certificates appear on the candidate profile (decision 4) and are visible to recruiters; recruiters earn certificates for recruiter courses too; (B) as A but without a public verification page (code checked only in admin); (C) as A but the PDF is regenerated on every download (so name changes show) rather than stored. **R: A**, storing the issued PDF snapshot. Name-change handling: offer a re-issue.
* **Q58. Free preview.** Learner pages promise a free 3-minute introduction (`LearningDetailsPage.jsx:79`). (A) A per-lesson "Free preview" flag (typically lesson 1); (B) a separate intro-video field on the course; (C) no free preview. **R: A.**
* **Q59. Course stats and visibility on Admin › Courses.** Decision 1 requires enrolled, purchased, completions and revenue per course. (A) Table "Learning" column shows "{enrolled} enrolled · {purchased} purchased · {completions} completed", plus a Revenue column, plus page stats Total · Published · Completions · Revenue; revenue is shown only with `finance.view`; a "Learners" drill-down list per course; (B) keep today's 4 page stats and only extend the row text; (C) a separate course analytics page. **R: A.**
* **Q60. Seed content for the 12 existing courses.** The builder needs real lessons and quizzes. (A) Seed each course's existing lesson titles as *text* lessons with short written content plus a 5-question quiz (written once and committed with the seed); (B) seed the lesson titles only, keep the courses as drafts, and let the admin complete them; (C) generate the lesson text and quizzes with OpenAI at seed time. **R: A** (deterministic seed; no AI at seed time).

*Decision 2: verification and profile-completeness review; recruiter approval*
* **Q61. Candidate verification review: decision set and scope.** (A) Moderation gets a third tab "Candidate verification" (see §9.2); decisions Approve / Reject (reason required, ≤300 chars), and the candidate can resubmit after rejection; the queue covers identity, academic and employment evidence plus right-to-work evidence and uploaded external certificates (decision 4); the candidate must link academic/employment evidence to a specific education/work-history entry; (B) as A but with an extra "Request more information" decision; (C) review from the candidate detail page only (no queue). **R: A.**
* **Q62. What does "profile completeness checks reviewed by admins" mean?** (A) Completeness % is computed automatically from the filled-in structured sections; admins review only the documents attached to sections (evidence, right to work, certificates); (B) admins approve each profile section (work history, education, languages…) before it counts towards completeness or is shown to recruiters; (C) admins review the whole profile once, at first publication. **R: A.** B would put every profile edit into a manual queue.
* **Q63. Recruiter onboarding gaps.** Onboarding has a phone OTP step (`auth/data/onboarding.js:6,11`, demo code 123456), but only SMTP is decided. Rejection handling isn't defined either. (A) Drop the phone OTP; keep email OTP via SMTP; a rejected applicant can fix the data/documents and resubmit; (B) add an SMS provider (e.g. Twilio) for phone OTP; (C) phone number collected but unverified (shown as "unverified" to admin). **R: C + resubmission allowed.**
* **Q64. Retention of KYC and evidence files after a decision** (identity documents are sensitive personal data under GDPR). (A) Keep until the account is deleted; (B) delete the files N days after a decision and keep only the decision record; (C) keep for a fixed period (e.g. 12 months). **R: B (e.g. 30 days)**, unless legal requires longer. Also: which admin permission may open these files (R: a new `documents.view`).

*Decision 3: paid plan*
* **Q65. Plan catalogue.** The plan name may change ("AI Matches Plus" is hard-coded at `candidate/billing/data/subscription.js:15` and `PaymentsPage.jsx:112`). (A) Plan stored in the DB/seed (name per language, price, interval, Stripe price id, features, entitlements) and read everywhere, edited by seed/config only; (B) as A plus an admin "Plans" screen to rename and edit features (new screen); (C) keep it in code constants. **R: A.** What is the final name?
* **Q66. What happens when the plan lapses** (payment failed → past_due, or cancelled)? (A) A 7-day grace period on past_due; after that, submitted applications stay active but the candidate can't apply again, can't reply to messages, and job alerts pause (not deleted); (B) immediate loss of all three; (C) cancellation takes effect at the period end (Stripe `cancel_at_period_end`) and past_due loses access immediately. **R: A + C** (cancel at period end, grace on failed renewal).
* **Q67. Admin visibility and actions for subscriptions.** (A) View only: Payments shows renewal rows and a subscription status/period in the details; a "Plan" column + filter on Candidates; KPIs "Active subscribers" and "MRR" on Payments (new cards); no admin actions; (B) A plus admin actions: cancel a subscription, refund the last payment, grant a free plan (guarded by `finance.approve`); (C) only the existing Payments page. **R: A** for v1.
* **Q68. Messaging moderation.** Messaging replies are new (today only recruiters send outreach, `recruiter/find-candidates/components/MessageModal.jsx`; candidates have no inbox). (A) Users can report a message, which creates a Moderation case with the thread excerpt; admins never browse threads otherwise; (B) admins can open any thread; (C) no admin involvement. **R: A** (privacy).

*Decision 4: structured candidate profiles*
* **Q69. Admin candidate (and recruiter) detail page, plus table columns and filters.** (A) New screens `/admin/candidates/:userId` (sections listed in §9.4) and `/admin/recruiters/:userId` (company, KYC, jobs); Candidates table adds Country, Right to work, Verification (n/3), Completeness %, Plan, with matching filters; "Manage" opens the detail page; (B) only the detail page, table unchanged; (C) no detail page, and the table gains the columns. **R: A.**
* **Q70. Right to work (EU/UK).** (A) The candidate declares their status per region (EU / UK: citizen-settled / visa-permit with expiry / requires sponsorship) and may attach evidence that admins verify in the verification queue; recruiters can filter by "has right to work in {region}"; it may be a matching input, but nationality never is; (B) self-declared only, never verified; (C) verified evidence is required before applying to jobs in that region. **R: A.**
* **Q71. Profile photo.** (A) Optional; shown to recruiters only after the candidate applies or replies (bias mitigation); never a matching input; moderated on report only; (B) always visible, moderated by an admin before it is shown; (C) visible to recruiters, report-based moderation. **R: A**, or C if bias mitigation isn't wanted.
* **Q72. External certificates on profiles** (not platform course certificates). (A) Self-declared, with an optional file/URL; if a file is attached the candidate can request verification (queue, Q61); recruiters see "Verified" only for reviewed ones; (B) every external certificate must be reviewed before it is shown; (C) self-declared only. **R: A.**

---

## 8. Five biggest risks (updated for the new decisions)
1. **Courses become the largest new build, and today's code is a placeholder.** Decision 1 replaces a 101-line, 8-field modal with a lesson builder (4 lesson types, uploads, reorder), a quiz editor, server-side progress tracking (90% video rule), quiz scoring, PDF certificates with public verification, and real per-course stats. Large video files on the server disk need Range streaming, purchase-gated access, size limits and a disk budget. The fabricated learner content (`learnerCourse.js`, two `fromUpload()` functions) and the price/title mismatches in 9 of 12 seed courses must go, and seed courses need real lessons and quizzes. Editing published courses with enrolled learners needs a versioning rule (Q51–Q60, Q26–Q30).
2. **Access management is semantically undefined.** The user list is marketplace accounts, the permissions describe employer-team actions, scope/department mean nothing, nothing enforces anything, and the new decisions add areas with no permission at all (verification review, documents, course authoring/revenue, subscriptions). Building the wrong model, or adding enforcement later, touches every admin route and the whole sidebar (Q1–Q8, §4.4).
3. **The review workflows decided in decision 2 have no admin UI today.** No verification queue exists ("Credential reviews" is the literal `"0"`); candidates self-approve with "Mark as reviewed (demo)"; the account-review dialog shows only name/email/joined (no company, no KYC files); there is no Reject action; content reports have no source; "Restrict" has no effect; the phone OTP has no provider; and sensitive files (KYC, right to work, evidence) need access control and a retention policy (Q39–Q42, Q61–Q64).
4. **~35 static metrics have no agreed definition**: average role match tied to one job, a funnel "reached" count that needs stage history, timezone/week buckets, a meaningless line index, duplicated demanded-skill lists, an undefined matching engine. Decisions 3–4 add subscription and profile metrics (subscribers, MRR, completeness %). Without definitions the "real numbers" requirement can't be verified (Q9–Q19, Q33–Q35, Q59, Q67).
5. **Payments, entitlements and localisation.** The monthly plan now gates applying, messaging replies and job alerts, so Stripe renewals, failures (past_due), lapse rules and webhook idempotency become business-critical. Hosted Checkout doesn't naturally give the failed-attempt rows, card brand/last4 or per-invoice rows the admin page expects. Currency policy conflicts (GBP prices vs a country-driven currency, `$` salaries). Every formatter is en-US with hard-coded symbols, StatCard's count-up breaks on non-en-US digit grouping, table cells use `white-space: nowrap`, and ~750+ admin strings (more with the builder, verification and detail screens) need translation (Q26, Q31–Q32, Q46, Q65–Q67).

---

## 9. New product decisions (coordinator update): admin impact

### 9.1 Decision 1: courses become real learning content (lesson builder, final quiz, certificates)

**Decided:** the admin course form gets a lesson builder (add / reorder / edit / delete; each lesson has title, type = uploaded video | text | PDF/document | external link, content or file, duration) and a final-quiz editor (questions, options, correct answers, pass mark ~70%). A lesson completes when viewed (video at ~90%). The course completes when the quiz is passed. Completion generates a PDF certificate with a verification code. This replaces the "number of lessons" field and the name-only "course media".

**Component-by-component changes (admin):**

| File | Today | Required change |
|---|---|---|
| `client/src/features/admin/courses/components/CourseFormModal.jsx` (101 lines) | 640 px modal (`:52`); fields title (`:68`, max 80), category (`:70`, max 40), level (`:71`), **Lessons number** (`:74`, state `:21`, payload `:41`), access (`:75`), price GBP (`:77-87`), **Course media file name only** (`:88-97`, state `:24`, payload `:43`), Published checkbox (`:98-103`, default true `:25`) | Remove the Lessons number field and the course-media input (plus their hints, `:92-96`). Keep title/category/level/access/price/published on a **Details** step, plus course-level copy and cover if Q53 = A. Add a **Lessons** builder: a list with Add, Edit, Delete (confirm) and Reorder (drag + keyboard up/down); per lesson: title, type select `video|text|document|link`, type-specific content (video upload with progress / rich-text editor / PDF upload / https URL), duration in minutes (prefilled from video metadata), "Free preview" flag (Q58). Add a **Quiz** editor: questions (text), 2–6 options, correct option(s) (single/multi), pass mark default 70. Publishing is blocked until ≥1 lesson and a valid quiz exist. Recommended to become a full-page editor route (Q51). |
| `client/src/features/admin/courses/utils/courseFormat.js` (23 lines) | `validateCourse` (`:14-26`) validates the lesson count (`:19-20`) and a `£` price message (`:23`); `formatPrice` hard-codes `£` (`:9-11`); `formatUpdated` en-US (`:1-6`) | Drop the lesson-count rule. Add validation for lessons (title 3–120, type enum, content required per type, https URL ≤2,048, duration integer 1–600), the quiz (1–50 questions, question 5–500 chars, option 1–200 chars, ≥1 correct, pass mark 1–100) and publishability. Messages become i18n keys; money and dates use the locale formatters. The server repeats every rule. |
| `client/src/features/admin/courses/components/CoursesTable.jsx` (82 lines) | meta "{category} · {n} lessons" (`:22`); Learning "{enrolled} enrolled · {purchased} purchased" (`:39-41`), always 0; Manage opens the modal (`:65-67`); Publish/Unpublish toggles with no checks (`:68-75`) | meta = lesson count + total duration from real lessons; Learning = real enrolled · purchased · completed; a new **Revenue** column (per currency, `finance.view` only); Manage navigates to the editor; Publish calls the server, which rejects incomplete courses (show the reason); optional "Preview as learner" and "Learners" actions (Q59). |
| `client/src/features/admin/courses/pages/CoursesPage.jsx` (121 lines) | stats Total/Published/Paid/Active learners (`:86-95`), learners = Σ `enrolled` (always 0, `:46`); dialog state + modal (`:33, 130-132`); "Upload course" button (`:67-69`); prototype note (`:125-128`) | Stats from `GET /api/admin/courses/stats?audience=` → total, published, enrolled, purchased, completions, revenue (layout Q59). "Upload course" navigates to `/admin/courses/new?audience=`. Remove the modal state and the note. Notices come from mutation results. |
| `client/src/features/admin/courses/routes.jsx` (9 lines) | `courses`, `courses/recruiter` (`:6-9`) | add `courses/new` and `courses/:courseId/edit` (+ audience param) |
| `client/src/features/admin/courses/hooks/useCourses.js` (21 lines) | `lwm.admin.courses` via `useSharedLocalStorage` (`:6`); `saveCourse` (`:8-18`); `setStatus` (`:20-22`) | Replace with TanStack Query hooks: list, get, create, update details, lesson add/update/delete/reorder, save quiz, set status, upload file. |
| `client/src/features/admin/courses/utils/learnerCourse.js` (16 lines) | fabricates "Lesson N" (`:7-9`) and 35 min/lesson (`:5, 12-18`) | **Delete.** Its importers `client/src/features/candidate/learning/hooks/useCourseCatalogue.js:3` and `client/src/features/recruiter/learning/hooks/useCourseCatalogue.js:3` (and their `fromUpload()` templates `:7-26` / `:8-29`) switch to `GET /api/courses?audience=` returning real lessons and duration. |
| `client/src/features/admin/courses/data/courses.js` (34 lines) | `COURSE_LEVELS` (`:3`), `AUDIENCES` (`:6-9`), `course()` defaults (`:11-13`), `INITIAL_COURSES` (`:15-28`), `STATUS_OPTIONS` (`:30-34`) | Seed data moves to the server (with lessons and quizzes, Q60); levels/status/lesson types stay as shared enums. |

**Learner-side changes this decision forces** (outside admin, listed for the plan): "Mark complete" toggles become read-only progress states (`client/src/features/candidate/learning/components/LessonRow.jsx:43`, `client/src/features/recruiter/learning/components/LessonRow.jsx:12`). `toggleLesson` in `client/src/features/candidate/learning/hooks/useLearning.js:39-47` and `client/src/features/recruiter/learning/hooks/useRecruiterLearning.js:30-36` is replaced by server progress. New lesson player pages (video player with progress heartbeats, text reader, PDF viewer, external link), a quiz page, certificate download and a public `/verify/:code` page. The "Included" lists become derived (`client/src/features/candidate/learning/pages/LearningDetailsPage.jsx:13`, `client/src/features/recruiter/learning/pages/CourseDetailsPage.jsx:15`, the latter wrongly says "4 pre-recorded lessons"). The free-intro copy (`LearningDetailsPage.jsx:79, 213-215`) maps to the preview lesson.

**Completion engine (server):**
* Video: the client posts progress heartbeats (every 10–15 s) `POST /api/lessons/:id/progress {positionSec, durationSec}`; the server accumulates watched time and completes the lesson at ≥90% (anti-seek rule, Q55).
* Text / document / link: completion rule per Q55.
* Quiz: `GET /api/courses/:id/quiz` (no answers) → `POST /api/courses/:id/quiz/attempts {answers:[{questionId, optionIds}]}` → `{scorePercent, passed, certificate?}`; passed when score ≥ passMark (default 70). On pass: `Enrollment.completedAt`, a `Certificate` is created (unique code), the PDF is generated server-side with a JS library (e.g. pdfkit) and stored on disk, and a "certificate issued" email is sent.
* Public verification: `GET /api/certificates/verify/:code` → `{valid, learnerName, courseTitle, issuedAt, revoked}`.

**Entities (new or changed):**
* `Course` + `lessons` (ordered), `quiz {passMark: 70, questions:[{id, text, multiple, options:[{id,text}], correctOptionIds:[]}]}`, `durationMinutes` (computed), `coverFileId?`, `version`, learner copy (Q53).
* `Lesson {courseId, order, title, type: 'video'|'text'|'document'|'link', videoFileId?, textBody?, documentFileId?, url?, durationMinutes, isPreview}`.
* `LessonProgress {userId, courseId, lessonId, watchedSec, durationSec, percent, viewedAt, completedAt}`.
* `QuizAttempt {userId, courseId, quizVersion, answers, scorePercent, passed, submittedAt}`.
* `Certificate {code (unique), userId, courseId, learnerName, courseTitle, issuedAt, fileId, revokedAt?, revokedBy?, revokeReason?}`.
* `Enrollment` + `completedAt`, `certificateId`.
* `File.purpose` + `lesson-video | lesson-document | course-cover | certificate`.

**Admin endpoints:** `POST /api/admin/courses` (create draft) · `PATCH /api/admin/courses/:id` (details) · `POST /api/admin/uploads` (multipart, purpose; returns `{fileId, mime, size, durationSec?}`; multer `limits.fileSize` per Q52) · `POST /api/admin/courses/:id/lessons` · `PATCH|DELETE /api/admin/courses/:id/lessons/:lessonId` · `PUT /api/admin/courses/:id/lessons/order {lessonIds}` · `PUT /api/admin/courses/:id/quiz {passMark, questions}` · `PATCH /api/admin/courses/:id/status` (validates publishability → `422 {errors}`) · `GET /api/admin/courses/stats?audience=` · `GET /api/admin/courses/:id/stats` · `GET /api/admin/courses/:id/learners` · `POST /api/admin/certificates/:id/revoke {reason}`.

**Upload types and sizes to decide (Q52):**

| Asset | Types | Proposed max | Notes |
|---|---|---|---|
| Lesson video | MP4 (H.264/AAC), WebM | 1 GB | server disk; HTTP Range streaming; gated by enrollment unless the lesson is a preview; no transcoding unless decided |
| Lesson document | PDF | 50 MB | DOCX/PPTX only as downloads, if allowed |
| Lesson text | rich text / Markdown | 50,000 chars | sanitised on the server |
| External link | https URL | 2,048 chars | completion on click-through |
| Course cover (Q53) | JPG/PNG/WebP | 5 MB | |
| Certificate | generated PDF | — | stored snapshot |

**Stats that become real:** per course, enrolled = `Enrollment` count; purchased = paid `Payment` (kind course, itemId); completions = `Enrollment.completedAt` (= certificates issued); revenue = Σ paid `Payment.amountMinor` per currency. Optional: average progress, quiz pass rate. Knock-on: Overview "Course enrollments" (`client/src/features/admin/overview/data/overview.js:10`), "Course badges earned" → certificates issued (`:11`), "Course purchases" (`:18`); the Candidates "Learning" column (`client/src/features/admin/shared/data/users.js:19`) → "{n} enrolled · {m} certificates".

**Audit (category `Learning`, Q44):** Course created · Course details updated · Lesson added / updated / deleted · Lessons reordered · Course quiz saved · Course published / unpublished · Certificate revoked.
**Permissions:** `learning.manage` (author, upload, publish, revoke); new `learning.view`; `finance.view` for revenue (§4.4).
**Questions:** Q51–Q60 (plus updated Q26–Q30).

### 9.2 Decision 2: admins review candidate verification evidence and profile completeness; recruiter approval end to end

**Today:**
* Candidates **self-approve**: "Mark as reviewed (demo)" (`client/src/features/candidate/verification/components/CheckRow.jsx:45-47`) calls `handleMarkReviewed` (`client/src/features/candidate/verification/pages/VerificationPage.jsx:47-49`). Statuses are `not-started | in-review | verified` only (`VerificationPage.jsx:15`; there is no `rejected`). An entry is `{status, evidenceType, fileName, submittedAt}` (`client/src/features/candidate/verification/data/verification.js:5-9`). Evidence is PDF/JPG/JPEG/PNG ≤10 MB (`verification.js:41-42`), with 3 evidence types per check (`:17-39`). Phone confirmation is a demo button (`VerificationPage.jsx:104-111`).
* Profile completeness is static: `PROFILE_COMPLETENESS = {percent: 85, provided: 4, total: 5}` (`client/src/features/candidate/ai-insights/data/insights.js:150`); the Overview strength card shows a fixed "85%" and a fixed checklist (`client/src/features/candidate/overview/components/ProfileStrengthCard.jsx:7-11, 25`).
* Admin has no queue: "Credential reviews" is the literal `"0"` (`client/src/features/admin/moderation/pages/ModerationPage.jsx:152`); Overview "Verified candidate profiles" (`overview.js:9`) and "Verification checks in review" (`overview.js:19`) are static.

**Where the queue lives (recommendation): a third Moderation tab "Candidate verification".** Routes `/admin/moderation/verification` and `/admin/moderation/verification/:submissionId`. Code that must change:

| File:line | Change |
|---|---|
| `ModerationPage.jsx:35-49` `TABS` | add a `verification` tab (title, description, path) |
| `ModerationPage.jsx:59-60` splat parsing | today anything that isn't `accounts` is treated as content; add `verification` |
| `ModerationPage.jsx:67-68` `items` / `keyOf` | server queues replace `CONTENT_ITEMS` / `PENDING_ACCOUNTS` |
| `ModerationPage.jsx:149-154` stats | "Credential reviews" becomes real (and a link to the tab) |
| `ModerationPage.jsx:156-162` `QueueTabs` | third tab with count |
| `ModerationPage.jsx:28-33` `AUDIT_TITLES` | add Credential verified / Credential rejected / Account rejected |
| `client/src/features/admin/moderation/data/moderation.js:82-88` `DECISION_BADGES` | add `verified`, `rejected` |
| `moderation.js:38-79` | add `VERIFICATION_ACTIONS` (Approve; Reject with reason required); add Reject to `ACCOUNT_ACTIONS` |
| `client/src/features/admin/moderation/components/ReviewDetails.jsx` | add `VerificationDetails` (evidence preview) and expand `AccountDetails` (`:54-66`) |
| `client/src/features/admin/moderation/components/ReviewDialog.jsx:40` (width 512) | wider variant for document previews |

**What the admin sees per verification submission:** candidate (name, email, photo, link to the detail page, Q69); check type (Identity / Academic qualifications / Employment documents, plus Right to work and external certificates if Q61 = A); evidence type (e.g. Passport); submitted date; file preview (image/PDF via authenticated `GET /api/admin/files/:fileId`, `documents.view`); the profile claim it must match (identity → account name; academic → the selected education entry; employment → the selected work-history entry, so the candidate must pick the entry when submitting, which is new); previous submissions and decisions.
**Decisions:** Approve → `verified`; Reject → `rejected` with a required reason (≤300 chars, the same rule as `ReviewDialog.jsx:6, 28-34`); the candidate may resubmit (Q61). **Effects:** check status and blue tick; "Eligible" when all three are verified (`VerificationPage.jsx:36, 129`); the Overview "Verified candidate profiles" count; an email to the candidate in their language; recruiters see verified badges.
**Audit:** `{title:'Credential verified'|'Credential rejected', category:'Moderation', detail:'{candidate}: {check} ({evidenceType}) {verified|rejected}. Reason: {r}'}`.
**Profile completeness:** interpretation is open (Q62). Recommendation: the server computes completeness % from the structured sections (§9.4) and returns `{percent, missing[]}`; admins review only uploaded documents through this queue.
**Endpoints:** `GET /api/admin/verification?status=in-review&type=&page=` · `GET /api/admin/verification/:submissionId` · `POST /api/admin/verification/:submissionId/decision {decision:'verified'|'rejected', reason}`; candidate side `POST /api/me/verification/:checkType` (multipart: evidenceType, file, profileEntryId).
**Entity:** `VerificationSubmission {userId, checkType: identity|academic|employment|right-to-work|certificate, evidenceType, fileId, profileEntryId?, status: in-review|verified|rejected, submittedAt, reviewedBy, reviewedAt, reason, previousSubmissionId?}` (supersedes `CredentialCheck` in §2.4).

**Recruiter approval, end to end:**
1. **Sign-up and onboarding** (current UI; `client/src/features/auth/data/onboarding.js:2-8`): Account (fullName, jobTitle, workEmail, phone, terms) → Company (companyName, website, businessEmail, industry, companySize with 6 options `:14-21`, country, registrationDetails, businessAddress) → KYC (identity and registration required, authorization optional; PDF/JPG/PNG; `client/src/features/auth/pages/KycVerificationPage.jsx:13-30`) → Verify (email OTP + phone OTP; demo code `123456`, `onboarding.js:11`) → Review page "Under Review" / "Recruiter tools locked" (`client/src/features/auth/pages/AdminReviewPage.jsx:16-23, 61-63`). Today the values sit in localStorage `lwm.onboarding.data` / `lwm.onboarding.completed` (`client/src/features/auth/utils/useOnboardingState.js:11-12`), file names only.
   Server: `POST /api/auth/register {role:'recruiter', fullName, jobTitle, workEmail, phone, password, terms}` → `User{status:'pending'}`; `PUT /api/onboarding/company`; `POST /api/onboarding/kyc` (multipart, 3 files); `POST /api/auth/email-otp/send|verify` (SMTP); phone OTP per Q63; `POST /api/onboarding/submit` → `RecruiterVerification.status='submitted'` + system audit event "Account registration pending review" (Moderation, actor System) + optional admin notification email.
2. **While pending:** sign-in works but `/api/auth/me` returns `status:'pending'` → the client routes to the review page; recruiter APIs return `403 ACCOUNT_PENDING`.
3. **Admin review:** Moderation › Account review lists pending recruiters (oldest first). The dialog must show the applicant, the company record, email/phone verified flags, the KYC files (preview/download), the submitted date and previous decisions. Today it shows only name · email · type · joined (`ReviewDetails.jsx:54-66`). Actions: Approve / **Reject** (new, reason required) / Suspend for review (`moderation.js:60-79`).
4. **Effects:** approved → `User.status='active'`, `Company.verifiedAt`, tools unlocked, "approved" email with a sign-in link. Rejected → `status='rejected'`, email with the reason, resubmission per Q63. Suspended → `status='suspended'`, tokens invalidated (`tokenVersion`), the recruiter's published jobs paused (confirm in Q42).
5. **Audit:** Account approved / Account rejected / Account suspended for review (Moderation).
6. **Seed fix:** the only pending account is a *candidate*, James Chen (`moderation.js:28-36`, `users.js:40`). Make it a recruiter applicant with company and KYC data (Q40).
**Permissions:** `moderation.manage` (or the split ids `verification.review` / `accounts.review`), `users.deactivate`, `documents.view` (§4.4). **Questions:** Q40, Q61–Q64.

### 9.3 Decision 3: the £9/month candidate plan also unlocks applying, messaging replies and job alerts; admin Payments tracks it

**Today:**
* Static plan catalogue `PLANS` in `client/src/features/candidate/billing/data/subscription.js:11-21`. The Free plan lists "Browse and apply to jobs" (`:12`), which **contradicts the decision**. Plus is named "AI Matches Plus" (`:15`), with price string `'£9'` (`:16`), amount `9` (`:17`), "per month" (`:18`) and features (`:19`) that don't mention applying, messaging or alerts. The checkout caption says "demo: no renewal charges are ever made" (`:29`).
* Subscription state: `lwm.candidate.subscription` (`:7`) `{plan, status:'active', startedAt, paymentId}` via `client/src/features/candidate/billing/hooks/useSubscription.js:7-15`. The only gate is `client/src/features/candidate/billing/components/PlusGate.jsx:11-17` (AI insights).
* There is no candidate inbox/messaging (only recruiter outreach `client/src/features/recruiter/find-candidates/components/MessageModal.jsx`). Job alerts (`/candidate/job-alerts`, `client/src/app/workspaces.js:52`) are ungated.

**Admin changes:**

| Where | Change |
|---|---|
| `client/src/features/admin/payments/pages/PaymentsPage.jsx:109-114` "Subscriptions" stat, caption "Paid AI Matches Plus plans" | value = active subscriptions (not a count of paid payments); caption from the plan record name |
| `PaymentsPage.jsx:51-52, 106-108` | renewals appear as one Payment row per invoice; failed renewals as failed rows (Q32) |
| `PaymentsPage.jsx:139-190` details modal | for subscription payments add the billing period (from–to) and the subscription status (active / past_due / canceled, cancel at period end) |
| `PaymentsPage.jsx:65-90` CSV export | add period start/end and subscription id |
| new KPI cards (Q67) | Active subscribers, MRR (and churn) |
| Candidates table (`client/src/features/admin/shared/components/UsersDirectory.jsx:18-60`) | Plan column + filter (Free / Plus / past due) (Q67) |
| Overview (optional) | Plus subscribers KPI (needs design) |

**Entities:** `Plan {id:'plus', name (per language, renameable, Q65), priceMinor: 900, currency: 'GBP' (Q26), interval: 'month', stripePriceId, features[], entitlements: ['jobs.apply', 'messages.reply', 'jobAlerts', 'aiInsights']}`; `Subscription {userId, planId, status: active|past_due|canceled|incomplete, stripeSubscriptionId, stripeCustomerId, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, graceUntil?}`; `Payment` + `periodStart`, `periodEnd`, `invoiceId`.
**Server enforcement** (tracked by admin, enforced outside admin): `POST /api/applications`, message-reply endpoints and job-alert create/run require the entitlement → `402 PLAN_REQUIRED`; lapse rules per Q66.
**Stripe webhooks:** `checkout.session.completed` (mode subscription) · `invoice.paid` (renewal → Payment) · `invoice.payment_failed` (failed Payment + past_due) · `customer.subscription.updated|deleted`.
**Admin endpoints:** `GET /api/admin/subscriptions?status=&page=` (or filter on payments) · `GET /api/admin/payments/stats` (+ activeSubscribers, mrrMinor) · (Q67 B) `POST /api/admin/subscriptions/:id/cancel`, `POST /api/admin/payments/:id/refund`, `POST /api/admin/users/:id/grant-plan`.
**Audit:** Payments exported (existing); if Q67 = B: Subscription cancelled by admin / Payment refunded / Plan granted (category `Payments`, Q44).
**Permissions:** `finance.view`; `finance.approve` for admin actions. **Questions:** Q26, Q32, Q65–Q68.

### 9.4 Decision 4: structured candidate profiles (work history, education, languages with level, EU/UK right to work, photo, links, certificates)

**Today:** the profile is flat (`client/src/features/candidate/profile/data/profile.js:4-17`: name, headline, location, openToOpportunities, about, yearsExperience, skills[], degree, institution, workMode, salaryMin), in localStorage `lwm.candidate.profile` (`:1`). Admin shows none of it. The Candidates table has name/email, role, joined, verification, learning and status (`UsersDirectory.jsx:18-60`). The moderation "Candidate profile" case shows only the report summary (`ReviewDetails.jsx:40-42`). "Manage" goes to access management (`UsersDirectory.jsx:55`).

**Admin Candidates changes:**
* **Table** (`UsersDirectory.jsx` is shared with Recruiters, so split it or make columns configurable): add Country, Right to work (EU / UK), Verification (n of 3), Completeness %, Plan; filters for country, right to work, verification state and plan. Add the columns to the CSV export (`UsersDirectory.jsx:82-98`), excluding file contents.
* **New screen `/admin/candidates/:userId`** (not in Figma, Q69):
  * Header: photo, name, headline, location/country, status, plan, joined.
  * Sections: About; Work history (title, employer, country, start–end / current, description); Education (degree, field, institution, start–end); Languages (language + level A1–C2 / Native); Right to work (EU / UK, basis, permit expiry, evidence + verification status); Links (portfolio / LinkedIn / GitHub / website); Certificates (external: name, issuer, dates, URL/file, verification status; platform: course certificates with verification code); Skills; CV versions; Verification checks (each linking to the queue); Learning (enrollments, certificates); Subscription and payments; Applications; Moderation and account history.
  * Actions: Suspend / Reactivate (`users.deactivate`), Restrict profile or photo (`moderation.manage`), open documents (`documents.view`).
* **Recruiter equivalent** `/admin/recruiters/:userId` (company, KYC, jobs, decisions), same question.
* **Moderation profile case** (`ReviewDetails.jsx:8-51`) renders the structured profile (and photo) instead of only the summary.
* **AI matching:** signals (`client/src/features/admin/ai-matching/data/matching.js:2-18`) could add Languages and Right to work. Nationality and photo must never be inputs (guidance `client/src/features/admin/ai-matching/components/PolicySidebar.jsx:45-46`) (Q70, Q71).

**Entity `CandidateProfile`:** `{userId, photoFileId?, headline, location:{city, country}, about, openToOpportunities, workMode, salaryMin:{amountMinor, currency, period}, skills[], workHistory:[{id, title, employer, country, startDate, endDate|null, current, description}], education:[{id, degree, field, institution, country, startDate, endDate}], languages:[{code (ISO 639-1), level: A1|A2|B1|B2|C1|C2|native}], rightToWork:[{region: 'EU'|'UK', basis: citizen-settled|visa-permit|requires-sponsorship, permitExpiresAt?, evidenceSubmissionId?, verified}], links:[{type: portfolio|linkedin|github|website|other, url}], certificates:[{id, source: 'external'|'platform', name, issuer, issuedAt, expiresAt?, credentialUrl?, fileId?, platformCertificateId?, verificationSubmissionId?}], completeness:{percent, missing[]} (computed)}`.
**Admin endpoints:** `GET /api/admin/candidates?country=&rightToWork=&verification=&plan=&q=&page=` · `GET /api/admin/candidates/:userId` (aggregate) · `GET /api/admin/files/:fileId` · `POST /api/admin/users/:userId/status {status, reason}` (audit Account suspended / reactivated).
**Permissions:** `users.view`, `documents.view`, `users.deactivate`, `moderation.manage`. **Questions:** Q5, Q69–Q72.

---

## 10. Coverage

### 10.1 Method
* `find` over the scope (PowerShell `Get-ChildItem -Recurse -File client/src/features/admin`): **128 files** (84 `.js/.jsx`, 44 `.module.css`), **8,140 lines** in total (5,021 JS/JSX). Line counts are `ReadAllLines().Count`, so blank lines are included.
* Every JS/JSX file was read in full with the Read tool. Every CSS module was read in full via a PowerShell dump of every non-blank line, with line numbers. The CSS is presentation only. The only `content:` declaration is a decorative `''` (`client/src/features/admin/reports/components/ReportForm.module.css:66`); there is no copy and no data. One i18n-relevant point: several table cells use `white-space: nowrap` (`UsersDirectory.module.css:32,40,48`, `JobsPage.module.css:19,27`, `ApplicationsPage.module.css:11,19`, `CoursesTable.module.css:24`), so long es/fr strings will widen the tables.
* The repo was restructured mid-audit (`src/` → `client/src/` via `git mv`). `git status` shows only renames for the admin folder (plus the untracked `client/src/features/admin/payments/` that already existed). Contents are unchanged, so line citations hold.

### 10.2 Storage-hook grep (`useLocalStorage|useSharedLocalStorage|localStorage|sessionStorage` in `client/src/features/admin/**`)

| Hit (file:line) | Key | Where in this report |
|---|---|---|
| `ai-matching/hooks/useMatchingPolicies.js:2,9` (useLocalStorage) | `lwm.admin.matching-policies` | §1.18, §6 |
| `courses/hooks/useCourses.js:1,6` (useSharedLocalStorage) | `lwm.admin.courses` | §1.14–1.16, §9.1 |
| `audit-logs/hooks/useAuditLog.js:2,13` (key const `:5`) | `lwm.admin.audit-log` | §1.27 |
| `reports/pages/ReportsPage.jsx:4,16` (useLocalStorage) | `lwm.admin.reports` | §1.22 |
| `access-management/hooks/useAccess.js:2,31,32` (key consts `:5,:6`) | `lwm.admin.roles`, `lwm.admin.userAccess` | §1.10–1.13, §4 |
| `moderation/hooks/useModerationDecisions.js:2,9` (useLocalStorage) | `lwm.admin.moderation` | §1.23–1.26, §9.2 |

No direct `localStorage` / `sessionStorage` calls exist in scope. **Indirect storage through hooks imported from other features** (also covered):

| Admin importer (file:line) | Hook | Key(s) |
|---|---|---|
| `overview/pages/OverviewPage.jsx:7,18`; `jobs/pages/JobsPage.jsx:12,48`; `moderation/pages/ModerationPage.jsx:10,64` | `client/src/features/recruiter/jobs/hooks/useJobs.js:17` | `lwm.recruiter.jobs` (`recruiter/jobs/data/jobs.js:14`) |
| `applications/pages/ApplicationsPage.jsx:9,32` | `client/src/features/candidate/jobs/hooks/useApplications.js:14` | `lwm.candidate.applications` |
| `applications/pages/ApplicationsPage.jsx:10,33` | `client/src/features/candidate/jobs/hooks/useJobListings.js:15-17` | `lwm.recruiter.jobs`, `lwm.recruiter.company` (`recruiter/company/data/company.js:5`), `lwm.candidate.profile` (`candidate/profile/data/profile.js:1`) |
| `payments/pages/PaymentsPage.jsx:17,42` | `client/src/features/payments/hooks/usePayments.js:14` | `lwm.payments` (`payments/data/payments.js:11`) |
| shell profile menu (§1.2) | `client/src/components/layout/WorkspacePreferences.jsx:7-8` | `lwm.location`, `lwm.language` |

### 10.3 `data/` import grep (36 import statements in scope; every one covered)

| Data module | Imported by (file:line) | Report § |
|---|---|---|
| `admin/shared/data/users.js` | `shared/components/UsersDirectory.jsx:10`, `candidates/pages/CandidatesPage.jsx:2`, `recruiters/pages/RecruitersPage.jsx:2`, `overview/pages/OverviewPage.jsx:9`, `applications/pages/ApplicationsPage.jsx:11`, `access-management/data/accessData.js:1` | §1.1, §1.3–1.4, §1.7, §1.12 |
| `admin/overview/data/overview.js` | `overview/pages/OverviewPage.jsx:14`, `overview/components/PlatformActivityCard.jsx:6` | §1.1 |
| `admin/analytics/data/analytics.js` | `analytics/pages/AnalyticsPage.jsx:6`, `analytics/components/InsightCards.jsx:4`, `analytics/components/ActivityCard.jsx:5`, `reports/data/reports.js:1` | §1.20–1.22 |
| `admin/ai-matching/data/matching.js` | `ai-matching/hooks/useMatchingPolicies.js:3`, `ai-matching/components/CreatePolicyModal.jsx:5`, `ai-matching/components/PolicyEditor.jsx:5`, `ai-matching/components/OversightSection.jsx:6` | §1.18–1.19 |
| `admin/reports/data/reports.js` | `reports/pages/ReportsPage.jsx:8`, `reports/components/ReportForm.jsx:5` | §1.22 |
| `admin/audit-logs/data/auditEvents.js` | `audit-logs/hooks/useAuditLog.js:3`, `audit-logs/pages/AuditLogsPage.jsx:9` | §1.27 |
| `admin/recruitment/data/recruitment.js` | `recruitment/pages/RecruitmentPage.jsx:14`, `recruitment/components/PipelineStages.jsx:1`, `recruitment/components/FunnelChart.jsx:8` | §1.8–1.9 |
| `admin/courses/data/courses.js` | `courses/hooks/useCourses.js:2`, `courses/pages/CoursesPage.jsx:13`, `courses/components/CourseFormModal.jsx:3` | §1.14–1.16, §9.1 |
| `admin/moderation/data/moderation.js` | `moderation/pages/ModerationPage.jsx:15-21` (multi-line import ending `:21`) | §1.23–1.26, §9.2 |
| `admin/access-management/data/accessData.js` | `access-management/hooks/useAccess.js:3`, `access-management/components/CreateRoleModal.jsx:4`, `access-management/components/ManageAccessModal.jsx:6` | §1.10–1.13, §4 |
| `payments/data/payments.js` | `payments/pages/PaymentsPage.jsx:10-15` (multi-line import ending `:15`) | §1.17, §9.3 |
| `recruiter/jobs/data/jobFields.js` | `jobs/pages/JobsPage.jsx:11`, `jobs/components/JobSummaryModal.jsx:6`, `moderation/utils/jobReviewItem.js:1` | §1.5–1.6, §1.24 |
| `recruiter/jobs/data/jobs.js` | `jobs/components/JobSummaryModal.jsx:5` | §1.6 |
| `candidate/jobs/data/applications.js` | `applications/pages/ApplicationsPage.jsx:8` | §1.7 |

(Importer paths are relative to `client/src/features/admin/`; data-module paths are relative to `client/src/features/`.)

### 10.4 Every file in scope

| File | Lines | Read fully? |
|---|---|---|
| `client/src/features/admin/access-management/components/AccessToolbar.jsx` | 41 | Yes, full (Read tool) |
| `client/src/features/admin/access-management/components/AccessToolbar.module.css` | 19 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/access-management/components/CreateRoleModal.jsx` | 91 | Yes, full (Read tool) |
| `client/src/features/admin/access-management/components/CreateRoleModal.module.css` | 59 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/access-management/components/ManageAccessModal.jsx` | 154 | Yes, full (Read tool) |
| `client/src/features/admin/access-management/components/ManageAccessModal.module.css` | 49 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/access-management/components/PermissionOption.jsx` | 18 | Yes, full (Read tool) |
| `client/src/features/admin/access-management/components/PermissionOption.module.css` | 69 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/access-management/components/RoleCard.jsx` | 45 | Yes, full (Read tool) |
| `client/src/features/admin/access-management/components/RoleCard.module.css` | 89 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/access-management/data/accessData.js` | 111 | Yes, full (Read tool) |
| `client/src/features/admin/access-management/hooks/useAccess.js` | 83 | Yes, full (Read tool) |
| `client/src/features/admin/access-management/pages/AccessManagementLayout.jsx` | 29 | Yes, full (Read tool) |
| `client/src/features/admin/access-management/pages/RolesPage.jsx` | 83 | Yes, full (Read tool) |
| `client/src/features/admin/access-management/pages/RolesPage.module.css` | 29 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/access-management/pages/UserAccessPage.jsx` | 130 | Yes, full (Read tool) |
| `client/src/features/admin/access-management/pages/UserAccessPage.module.css` | 36 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/access-management/routes.jsx` | 18 | Yes, full (Read tool) |
| `client/src/features/admin/access-management/utils/validateRole.js` | 12 | Yes, full (Read tool) |
| `client/src/features/admin/ai-matching/components/CreatePolicyModal.jsx` | 123 | Yes, full (Read tool) |
| `client/src/features/admin/ai-matching/components/CreatePolicyModal.module.css` | 94 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/ai-matching/components/OversightSection.jsx` | 89 | Yes, full (Read tool) |
| `client/src/features/admin/ai-matching/components/OversightSection.module.css` | 193 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/ai-matching/components/PolicyEditor.jsx` | 77 | Yes, full (Read tool) |
| `client/src/features/admin/ai-matching/components/PolicyEditor.module.css` | 59 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/ai-matching/components/PolicySidebar.jsx` | 62 | Yes, full (Read tool) |
| `client/src/features/admin/ai-matching/components/PolicySidebar.module.css` | 94 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/ai-matching/data/matching.js` | 53 | Yes, full (Read tool) |
| `client/src/features/admin/ai-matching/hooks/useMatchingPolicies.js` | 43 | Yes, full (Read tool) |
| `client/src/features/admin/ai-matching/pages/AiMatchingPage.jsx` | 97 | Yes, full (Read tool) |
| `client/src/features/admin/ai-matching/pages/AiMatchingPage.module.css` | 23 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/ai-matching/routes.jsx` | 10 | Yes, full (Read tool) |
| `client/src/features/admin/analytics/components/ActivityCard.jsx` | 70 | Yes, full (Read tool) |
| `client/src/features/admin/analytics/components/ActivityCard.module.css` | 122 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/analytics/components/ActivityCharts.jsx` | 154 | Yes, full (Read tool) |
| `client/src/features/admin/analytics/components/ActivityCharts.module.css` | 66 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/analytics/components/InsightCards.jsx` | 48 | Yes, full (Read tool) |
| `client/src/features/admin/analytics/components/InsightCards.module.css` | 74 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/analytics/data/analytics.js` | 65 | Yes, full (Read tool) |
| `client/src/features/admin/analytics/pages/AnalyticsPage.jsx` | 57 | Yes, full (Read tool) |
| `client/src/features/admin/analytics/pages/AnalyticsPage.module.css` | 35 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/analytics/routes.jsx` | 3 | Yes, full (Read tool) |
| `client/src/features/admin/applications/pages/ApplicationsPage.jsx` | 77 | Yes, full (Read tool) |
| `client/src/features/admin/applications/pages/ApplicationsPage.module.css` | 23 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/applications/routes.jsx` | 3 | Yes, full (Read tool) |
| `client/src/features/admin/audit-logs/components/AuditEventRow.jsx` | 46 | Yes, full (Read tool) |
| `client/src/features/admin/audit-logs/components/AuditEventRow.module.css` | 86 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/audit-logs/data/auditEvents.js` | 64 | Yes, full (Read tool) |
| `client/src/features/admin/audit-logs/hooks/useAuditLog.js` | 35 | Yes, full (Read tool) |
| `client/src/features/admin/audit-logs/pages/AuditLogsPage.jsx` | 149 | Yes, full (Read tool) |
| `client/src/features/admin/audit-logs/pages/AuditLogsPage.module.css` | 80 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/audit-logs/routes.jsx` | 3 | Yes, full (Read tool) |
| `client/src/features/admin/audit-logs/utils/formatDate.js` | 18 | Yes, full (Read tool) |
| `client/src/features/admin/candidates/pages/CandidatesPage.jsx` | 15 | Yes, full (Read tool) |
| `client/src/features/admin/candidates/routes.jsx` | 3 | Yes, full (Read tool) |
| `client/src/features/admin/courses/components/CourseFormModal.jsx` | 107 | Yes, full (Read tool) |
| `client/src/features/admin/courses/components/CourseFormModal.module.css` | 17 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/courses/components/CoursesTable.jsx` | 84 | Yes, full (Read tool) |
| `client/src/features/admin/courses/components/CoursesTable.module.css` | 47 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/courses/data/courses.js` | 34 | Yes, full (Read tool) |
| `client/src/features/admin/courses/hooks/useCourses.js` | 25 | Yes, full (Read tool) |
| `client/src/features/admin/courses/pages/CoursesPage.jsx` | 135 | Yes, full (Read tool) |
| `client/src/features/admin/courses/pages/CoursesPage.module.css` | 63 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/courses/routes.jsx` | 9 | Yes, full (Read tool) |
| `client/src/features/admin/courses/utils/courseFormat.js` | 26 | Yes, full (Read tool) |
| `client/src/features/admin/courses/utils/learnerCourse.js` | 18 | Yes, full (Read tool) |
| `client/src/features/admin/jobs/components/JobSummaryModal.jsx` | 120 | Yes, full (Read tool) |
| `client/src/features/admin/jobs/components/JobSummaryModal.module.css` | 190 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/jobs/pages/JobsPage.jsx` | 101 | Yes, full (Read tool) |
| `client/src/features/admin/jobs/pages/JobsPage.module.css` | 42 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/jobs/routes.jsx` | 7 | Yes, full (Read tool) |
| `client/src/features/admin/moderation/components/QueueRow.jsx` | 36 | Yes, full (Read tool) |
| `client/src/features/admin/moderation/components/QueueRow.module.css` | 77 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/moderation/components/QueueTabs.jsx` | 32 | Yes, full (Read tool) |
| `client/src/features/admin/moderation/components/QueueTabs.module.css` | 36 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/moderation/components/ReviewDetails.jsx` | 67 | Yes, full (Read tool) |
| `client/src/features/admin/moderation/components/ReviewDetails.module.css` | 97 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/moderation/components/ReviewDialog.jsx` | 93 | Yes, full (Read tool) |
| `client/src/features/admin/moderation/components/ReviewDialog.module.css` | 48 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/moderation/data/moderation.js` | 88 | Yes, full (Read tool) |
| `client/src/features/admin/moderation/hooks/useModerationDecisions.js` | 22 | Yes, full (Read tool) |
| `client/src/features/admin/moderation/pages/ModerationPage.jsx` | 202 | Yes, full (Read tool) |
| `client/src/features/admin/moderation/pages/ModerationPage.module.css` | 46 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/moderation/routes.jsx` | 10 | Yes, full (Read tool) |
| `client/src/features/admin/moderation/utils/jobReviewItem.js` | 22 | Yes, full (Read tool) |
| `client/src/features/admin/overview/components/DemandedSkillsCard.jsx` | 29 | Yes, full (Read tool) |
| `client/src/features/admin/overview/components/DemandedSkillsCard.module.css` | 52 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/overview/components/MarketplaceHealthCard.jsx` | 26 | Yes, full (Read tool) |
| `client/src/features/admin/overview/components/MarketplaceHealthCard.module.css` | 45 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/overview/components/PlatformActivityCard.jsx` | 176 | Yes, full (Read tool) |
| `client/src/features/admin/overview/components/PlatformActivityCard.module.css` | 223 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/overview/components/RecentActivityCard.jsx` | 30 | Yes, full (Read tool) |
| `client/src/features/admin/overview/components/RecentActivityCard.module.css` | 44 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/overview/data/overview.js` | 73 | Yes, full (Read tool) |
| `client/src/features/admin/overview/pages/OverviewPage.jsx` | 101 | Yes, full (Read tool) |
| `client/src/features/admin/overview/pages/OverviewPage.module.css` | 57 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/overview/routes.jsx` | 3 | Yes, full (Read tool) |
| `client/src/features/admin/payments/pages/PaymentsPage.jsx` | 193 | Yes, full (Read tool) |
| `client/src/features/admin/payments/pages/PaymentsPage.module.css` | 79 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/payments/routes.jsx` | 3 | Yes, full (Read tool) |
| `client/src/features/admin/recruiters/pages/RecruitersPage.jsx` | 15 | Yes, full (Read tool) |
| `client/src/features/admin/recruiters/routes.jsx` | 3 | Yes, full (Read tool) |
| `client/src/features/admin/recruitment/components/CandidateMovement.jsx` | 91 | Yes, full (Read tool) |
| `client/src/features/admin/recruitment/components/CandidateMovement.module.css` | 73 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/recruitment/components/FunnelChart.jsx` | 116 | Yes, full (Read tool) |
| `client/src/features/admin/recruitment/components/FunnelChart.module.css` | 92 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/recruitment/components/OversightSidebar.jsx` | 70 | Yes, full (Read tool) |
| `client/src/features/admin/recruitment/components/OversightSidebar.module.css` | 101 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/recruitment/components/PipelineStages.jsx` | 28 | Yes, full (Read tool) |
| `client/src/features/admin/recruitment/components/PipelineStages.module.css` | 56 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/recruitment/data/recruitment.js` | 36 | Yes, full (Read tool) |
| `client/src/features/admin/recruitment/pages/RecruitmentPage.jsx` | 87 | Yes, full (Read tool) |
| `client/src/features/admin/recruitment/pages/RecruitmentPage.module.css` | 38 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/recruitment/routes.jsx` | 9 | Yes, full (Read tool) |
| `client/src/features/admin/reports/components/ExportHistory.jsx` | 48 | Yes, full (Read tool) |
| `client/src/features/admin/reports/components/ExportHistory.module.css` | 88 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/reports/components/ReportForm.jsx` | 112 | Yes, full (Read tool) |
| `client/src/features/admin/reports/components/ReportForm.module.css` | 127 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/reports/data/reports.js` | 43 | Yes, full (Read tool) |
| `client/src/features/admin/reports/pages/ReportsPage.jsx` | 57 | Yes, full (Read tool) |
| `client/src/features/admin/reports/pages/ReportsPage.module.css` | 23 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/reports/routes.jsx` | 3 | Yes, full (Read tool) |
| `client/src/features/admin/routes.jsx` | 9 | Yes, full (Read tool) |
| `client/src/features/admin/settings/pages/AdminSettingsPage.jsx` | 29 | Yes, full (Read tool) |
| `client/src/features/admin/settings/routes.jsx` | 3 | Yes, full (Read tool) |
| `client/src/features/admin/shared/components/UsersDirectory.jsx` | 154 | Yes, full (Read tool) |
| `client/src/features/admin/shared/components/UsersDirectory.module.css` | 59 | Yes, full (PowerShell dump of every line; presentation only) |
| `client/src/features/admin/shared/data/users.js` | 57 | Yes, full (Read tool) |

### 10.5 Supporting files outside the scope (read because admin imports them or the decisions depend on them)

| File | Read status |
|---|---|
| `client/src/app/workspaces.js` | full |
| `client/src/components/layout/ProfileMenu.jsx`, `Header.jsx`, `preferencesContext.js`, `WorkspacePreferences.jsx` | full |
| `client/src/components/layout/GlobalSearch.jsx` | grep only (imports/admin refs: navigation search, no data) |
| `client/src/components/common/StatCard.jsx` | full |
| `client/src/hooks/useCountUp.js` | full |
| `client/src/utils/downloadCsv.js` | lines 7–17 (function body) |
| `client/src/features/recruiter/jobs/hooks/useJobs.js`, `recruiter/jobs/data/jobs.js` | full |
| `client/src/features/recruiter/jobs/data/jobFields.js` | partial: lines 150–189 (`formatSalary`, `jobMetaLine`, start of `analyzeJob`) |
| `client/src/features/recruiter/company/data/company.js` | grep only (`COMPANY_STORAGE_KEY`, `:5`) |
| `client/src/features/recruiter/find-candidates/hooks/useCandidateActivity.js` | grep only (key and type enum, `:3, :9`) |
| `client/src/features/candidate/jobs/hooks/useApplications.js`, `useJobListings.js`, `candidate/jobs/data/applications.js` | full |
| `client/src/features/payments/data/payments.js`, `hooks/usePayments.js`, `components/PaymentsTable.jsx` | full |
| `client/src/features/payments/components/CheckoutDialog.jsx` | grep only (`record(` call at `:64`) |
| `client/src/features/candidate/learning/hooks/useCourseCatalogue.js`, `hooks/useLearning.js`, `data/courses.js`, `pages/LearningDetailsPage.jsx`, `components/LessonRow.jsx`, `components/CourseCard.jsx`, `components/PurchaseDialog.jsx` | full |
| `client/src/features/candidate/learning/pages/LearningPage.jsx`, `components/LevelTabs.jsx` | not read (learner page; not needed for admin mapping) |
| `client/src/features/recruiter/learning/hooks/useCourseCatalogue.js`, `hooks/useRecruiterLearning.js`, `data/courses.js`, `pages/CourseDetailsPage.jsx`, `components/CourseCard.jsx`, `components/LessonRow.jsx` | full |
| `client/src/features/recruiter/learning/pages/LearningPage.jsx`, `components/SuggestionCard.jsx`, `components/PurchaseDialog.jsx` | not read |
| `client/src/features/auth/data/onboarding.js`, `pages/AdminReviewPage.jsx`, `pages/KycVerificationPage.jsx` | full |
| `client/src/features/auth/utils/useOnboardingState.js`, `utils/session.js`, `routes.jsx`, `pages/SignInPage.jsx`, `pages/VerifyAccountPage.jsx` | grep only (keys, routes, admin copy) |
| `client/src/features/candidate/verification/data/verification.js`, `pages/VerificationPage.jsx`, `components/CheckRow.jsx` | full |
| `client/src/features/candidate/verification/components/SubmitEvidenceModal.jsx` | grep only (size/type checks `:13-14, 47, 55`) |
| `client/src/features/candidate/profile/data/profile.js`, `pages/ProfilePage.jsx` | full |
| `client/src/features/candidate/overview/components/ProfileStrengthCard.jsx` | full |
| `client/src/features/candidate/ai-insights/data/insights.js` | partial: lines 130–150 + grep |
| `client/src/features/candidate/billing/data/subscription.js`, `hooks/useSubscription.js`, `components/PlusGate.jsx` | full |
| `client/src/features/help/**` (mounted at `/admin/help`) | not read (out of scope; static FAQ in `help/data/help.js`) |
| `docs/FIGMA_SCREEN_INVENTORY.md` | admin rows (grep) + lines 93–112 |
| `IMPLEMENTATION_PLAN.md` | grep for admin topics + lines 139–177 + long lines 7, 150, 162, 168 |
