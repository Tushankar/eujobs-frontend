# Candidate workspace audit — input for the Node/Express/MongoDB backend plan

Scope: everything under `client/src/features/candidate/**` plus the candidate use of `client/src/features/payments/**`, and the parts of the shared shell (`client/src/app/workspaces.js`, `client/src/components/layout/*`) that render inside `/candidate`. All 103 JS/JSX files in scope were read in full and all 57 CSS modules were scanned (see the Coverage section). The working tree was audited as it is, including the uncommitted changes in `git status`. Paths are relative to the repo root `C:\Users\tusha\OneDrive\Desktop\Ai Job`; the frontend now lives in `client/` after the `git mv`, and file contents are unchanged. Line numbers are per file.

**Short paths** used in tables:
- A path that starts with a candidate feature folder (`jobs/…`, `cv/…`, `profile/…`, `overview/…`, etc.) is under `client/src/features/candidate/`.
- `recruiter/…`, `admin/…`, `payments/…` and `auth/…` are under `client/src/features/`.
- `features/…`, `components/…`, `hooks/…`, `utils/…` and `app/…` are under `client/src/`.
- A bare layout file name (`Header.jsx`, `ProfileMenu.jsx`, `Sidebar.jsx`, `WorkspaceLayout.jsx`, `WorkspacePreferences.jsx`, `GlobalSearch.jsx`) is in `client/src/components/layout/`.

The coordinator's later decisions **D1–D5** (email-link verification, the apply gate, the "complete profile" definition, the paid-plan scope, and learning with lessons, quiz and certificates) are applied throughout. Section 24 lists every change they require.

Legend: **Static** means a literal in JSX or a mock constant. **Device** means the value lives in `localStorage`/`sessionStorage` and must move to MongoDB. **Derived** means it is computed on the client from Static or Device data. "Q12" refers to the Questions section (section 29).

API conventions used below: base path `/api`; JWT bearer token; a candidate-only router at `/api/candidate/*` (rejects role ≠ candidate with 403); shared reads at `/api/jobs`, `/api/courses` and `/api/meta/*`. Errors are `{ error: { code, message, fields?: { name: code }, missing?: [...] } }`. The plan gate returns 402 `PLAN_REQUIRED` and the profile gate returns 403 `PROFILE_INCOMPLETE` with a `missing[]` list. Validation messages stay in the client's translation files, keyed by the code the server returns, and the server mirrors every rule below.

---

## 0. Screen index (23 existing screen states on 22 routes, 18 dialogs, plus 7 new screens required by D1–D5)

| # | Route | Screen / state | Dialogs |
|---|---|---|---|
| 1 | `/candidate` | Overview | — |
| 2 | `/candidate/jobs` | Find jobs | Filters; AI-assisted job summary |
| 3 | `/candidate/jobs/:jobId` | Job details (+ "no longer available") | AI job summary |
| 4 | `/candidate/applications` | Applications | Activity; Withdraw confirm; AI job summary |
| 5 | `/candidate/job-alerts` | Job alerts | Create/Edit; Delete confirm |
| 6 | `/candidate/profile` | My profile (+ "no profile") | Edit/Create profile; profile "Ai Job Summary" |
| 7 | `/candidate/cv-versions` | CV & versions | — |
| 8 | `/candidate/verification` | Verification | Submit evidence |
| 9 | `/candidate/ai-insights/*` when Free | PlusGate upgrade screen | Checkout |
| 10 | `/candidate/ai-insights` | AI Profile Insights | — |
| 11 | `/candidate/ai-insights/skill-gap` | Skill Gap | Review skill; Source evidence |
| 12 | `/candidate/ai-insights/improve-profile` | Profile Improvement | — |
| 13 | `/candidate/ai-insights/job-match` | Job Match Insights | Source evidence |
| 14 | `/candidate/ai-insights/why-recommended` | Recommendation explanation | Source evidence |
| 15 | `/candidate/learning` | Learning catalogue | Checkout / free-course confirm |
| 16 | `/candidate/learning/:courseId` | Course details (+ not found) | Course intro; Checkout / free confirm |
| 17 | `/candidate/settings/privacy` | Privacy & visibility | — |
| 18 | `/candidate/settings/notifications` | Notifications | — |
| 19 | `/candidate/settings/data-account` | Data & account | 3 confirms |
| 20 | `/candidate/settings/billing` | Billing | Checkout; Cancel plan confirm |
| 21 | `/candidate/onboarding/story` | Onboarding 1 (resume) | — |
| 22 | `/candidate/onboarding/preferences` | Onboarding 2 (preferences) | — |
| 23 | `/candidate/onboarding/plan` | Choose a plan | Checkout |
| N1 | `/candidate/messages` (+ `/:conversationId`) | Messages inbox (decided) | — |
| N2 | `/candidate/profile/complete` (or a panel on My profile) | Profile completeness checklist (D3) | — |
| N3 | modal on Apply | Apply gate (D2): missing items + plan upsell | — |
| N4 | `/candidate/learning/:courseId/lessons/:lessonId` | Lesson viewer: video / text / PDF / link (D5) | — |
| N5 | `/candidate/learning/:courseId/quiz` | Final quiz + result (D5) | — |
| N6 | `/candidate/learning/certificates` (or a profile section) | Certificates & badges (D5) | — |
| N7 | outside the workspace: `/check-email`, `/verify-email?token=`, public `/certificates/verify/:code` | D1 and D5 public pages | — |

Redirects: `/candidate/settings` → `privacy` (`settings/routes.jsx:10`); `/candidate/onboarding` → `story` (`onboarding/routes.jsx:8`); unknown paths → `NotFoundPage` (`client/src/app/router.jsx`). `/candidate/help` is the shared Help page (`features/help`), out of scope. Routes are auto-collected by `client/src/features/candidate/routes.jsx:7-9`.

---

## 0.1 Shell elements rendered inside `/candidate`

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Sidebar user "Alex Morgan", subtitle "Personal account", avatar SVG | `client/src/app/workspaces.js:37` | Static | `GET /api/me` → `user.fullName`; avatar = profile photo (D3, Q2); subtitle from i18n |
| Header avatar | `workspaces.js:38` | Static | Profile photo URL, with initials as fallback |
| Profile-menu name | `components/layout/ProfileMenu.jsx:29` (from `workspace.user`) | Static | `/api/me` |
| Promo "Your next move, smarter." / "A stronger profile means more relevant opportunities." / "Complete your profile" → `onboarding/story` | `workspaces.js:42-47` | Static | i18n; shown while the profile is incomplete; links to the completeness checklist N2 (Q3) |
| Applications badge (live count) | `workspaces.js:51` → `useActiveApplicationsBadge` (`jobs/hooks/useApplications.js:45-47`) | Device | `GET /api/candidate/badges` → `{ activeApplications, unreadMessages, unreadNotifications }`, polled every 15 s |
| "AI" badge on AI insights | `workspaces.js:56` | Static label | i18n; lock icon when Free (D4) |
| Messages nav item + unread badge | — | Missing | New item; badge from `/badges` (D4: Free can read) |
| Location list `'San Francisco, US','London, UK','New York, US','Berlin, Germany','Remote / Global'` | `components/layout/preferencesContext.js:4`; key `lwm.location` (`WorkspacePreferences.jsx:7`) | Static + Device | Country picker from `GET /api/meta/countries` (EU 27 + UK + Remote, each with currency, default language, locale); stored in `User.country` via `PATCH /api/me` |
| Languages `English, Español, Français` | `preferencesContext.js:7`; key `lwm.language` (`WorkspacePreferences.jsx:8`) | Static + Device | `User.language` (`en`/`es`/`fr`) via `PATCH /api/me`; drives i18next, AI output and email language |
| "Local marketplace preference for this workspace." | `Header.jsx:79`, `ProfileMenu.jsx:70` | Static | Rewrite: the country controls jobs, currency and formats |
| Bell with a permanent dot, linking to settings/notifications | `Header.jsx:165-173` (dot at `:171`) | Static | Q4 |
| Candidate ↔ Recruiter switch | `Header.jsx:26-46`, rendered `:159`; `workspaces.js:39` | — | Remove (decided) |
| Footer "© 2026 Local Workman. · AI Job Portal" | `WorkspaceLayout.jsx:30` | Static year | Year computed; brand text from i18n |
| Footer "Interactive demo · Changes saved on this device" | `WorkspaceLayout.jsx:33` | Demo | Remove |
| Breadcrumb "{label} workspace › {title}" (route `handle.title`) | `Header.jsx` usePageTitle; handles in `ai-insights/routes.jsx:9-20`, `onboarding/routes.jsx:9-11`, `settings/routes.jsx:8` | Static | i18n keys |
| Global search ⌘K (page jump over nav labels) | `GlobalSearch.jsx` | Client only | Q5 |

**Actions**: Sign out (`Sidebar.jsx:107` → `endSession()`) → drop the JWT; optional `POST /api/auth/logout`. The session marker `lwm-session` (`features/auth/utils/session.js:8-9`), shared by candidate and recruiter, is replaced by a JWT with `role:'candidate'` checked in the `/candidate` loader (`router.jsx` `workspaceRoute`). **D1**: login is refused until the email is verified (section 24).
**i18n**: about 30 strings. **Cross-role**: none.

---

## 1. Overview — `/candidate`

**Purpose**: greeting, KPIs, three recommended / recent / saved jobs, and a rail with profile strength, verification, an AI teaser and recent applications. Files: `overview/pages/OverviewPage.jsx`, `overview/components/*.jsx`, and the shared `jobs/components/JobCard.jsx`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| "Wednesday, September 30, 2026" | `OverviewPage.jsx:47` | Static | Today's date: `Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long',year:'numeric'})` |
| "Your matches are up to date" | `OverviewPage.jsx:51` | Static | `GET /api/candidate/overview` → `matches.status`, `matches.computedAt` (Free: hidden, Q14) |
| "Good morning, Alex" + sun icon | `OverviewPage.jsx:58` | Static | Part of day from the browser's local hour + first name from `user.fullName` |
| Hero title, lead, "Explore jobs" | `:60-69` | Static | i18n |
| "Recommended jobs" **6**, **"+6 this week"** | `:74` | Static | `stats.recommended.{count,newThisWeek}` (Q15); Free per Q14 |
| "Active applications" | `:77` (`useApplications.js:33`) | Device | `stats.activeApplications` (Q21) |
| "Saved opportunities" | `:80` | Device | `stats.savedJobs` |
| "Profile views" **18**, **"↑ 12%"**, "From verified companies" | `:83` | Static | `stats.profileViews.{count,changePct}` (Q72) |
| Tabs For you / Recently added / Saved | `:21-25`, `:36-40`; "For you" = first 3 listings with **no ranking** (`:39`) | Device + mock | `GET /api/jobs/recommended?limit=3` (Plus; Free per Q14), `GET /api/jobs?sort=newest&limit=3`, `GET /api/candidate/saved-jobs?limit=3` |
| Job cards (`showAiMatch` adds "{x}% AI match", `JobCard.jsx:40-45`) | see Screen 2 | Mock | Job DTO + `match` (Plus only, D4) |
| Empty state "No saved jobs yet…" (shown for any empty tab) | `:110-119` | Static | Per-tab empty copy |
| "AI-powered matching. Your decision, always." | `:137` | Static | i18n |
| Profile strength **85%** + checklist "Resume uploaded ✓ / Skills & experience added ✓ / Add your portfolio +15%" | `ProfileStrengthCard.jsx:25`, `:7-11` | Static | D3 checklist from `GET /api/candidate/profile/completeness` (Q30) |
| Verification card: 3 checks "Not started", "0 of 3", "Premium jobs locked" | `VerificationCard.jsx:7`, `:29`, `:35`, `:38` | Static; **ignores the real state** | `verification.checks[]`, `verifiedCount`; "Premium" per Q38 |
| AI teaser "Your design systems experience is in demand." / "…mentioned in 2 of the available roles…" | `InsightCard.jsx:23-28` | Static | `teaser { id, skill, jobCount, text }` (AI, so Plus only per D4; Free gets an upsell variant) |
| Teaser dismissal `lwm.candidate.overview.insightDismissed` | `InsightCard.jsx:10` | Device | `CandidateUiState.dismissedTeasers[]` |
| Application activity (latest 3, not withdrawn) | `ApplicationActivityCard.jsx:16` | Device | `GET /api/candidate/applications?exclude=withdrawn&limit=3&sort=-updatedAt` |

**Actions**

| Control | Now | Server |
|---|---|---|
| Tab switch | Client | Separate queries per tab |
| Bookmark | `useSavedJobs.js:7` localStorage | `PUT`/`DELETE /api/candidate/saved-jobs/:jobId` → 204 |
| Apply now / Applied | `applyTo` (`useApplications.js:16-25`) | `POST /api/candidate/applications` `{ jobId, cvVersionId?, coverNote?, consent:true }` → 201; 402 `PLAN_REQUIRED`; 403 `PROFILE_INCOMPLETE` + `missing[]`; 409 `ALREADY_APPLIED`; 410 `JOB_CLOSED` (D2 → gate modal N3) |
| "N matching skills · …" disclosure | `whyItMatches` (`JobCard.jsx:14-22`) | `match.matchedSkills`, `match.alignment`; match explanation is Plus only (D4) |
| Dismiss teaser | localStorage | `POST /api/candidate/ui-state/dismiss-teaser { teaserId }` |
| Links (Explore jobs, View all, KPI cards, Preferences → `/candidate/profile`, Track applications, Verify profile, Improve my profile, Explore AI insights) | Navigation | — |

**Entities**: Job, JobMatch, SavedJob, Application, CandidateProfile (completeness), Verification, ProfileView, CandidateUiState. **Formatting**: date (new); `useCountUp` uses `toLocaleString('en-US')` (`client/src/hooks/useCountUp.js:38`). **i18n**: about 70 strings including the rail cards and JobCard.
**D-impact**: D2 apply gate on cards; D3 replaces ProfileStrengthCard with the checklist; D4 hides or upsells match %, teaser and "For you" for Free.
**Cross-role**: profile views come from recruiters; Apply reaches recruiter Applications/Pipeline and admin Applications.
**Gaps**: "Recommended jobs" links to an unsorted Find jobs; "Preferences" links to the profile page. Q4, Q13, Q14, Q15, Q21, Q30, Q38, Q72.

---

## 2. Find jobs — `/candidate/jobs` (+ Filters, + AI job summary)

Files: `jobs/pages/FindJobsPage.jsx`, `jobs/components/*`, `jobs/data/{jobs,jobUtils,recruiterJobs}.js`, `jobs/hooks/*`.

**Source today** (`useJobListings.js:15-31`): 12 mock `JOBS` (`jobs.js:11-294`; in San Francisco, New York, Ottawa and Sydney, so not EU) merged with recruiter jobs from `lwm.recruiter.jobs` (`:15`, status ≠ draft), the single company in `lwm.recruiter.company` (`:16`) and the profile in `lwm.candidate.profile` (`:17`). They are converted by `toCandidateJob` (`recruiterJobs.js:23-64`), and recruiter job `x` becomes candidate job `acme-x` (`recruiterJobs.js:8,12`).

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Title block | `FindJobsPage.jsx:53-59` | Static | i18n |
| Hint "Try “remote product design” or “Figma fintech”…" | `:92` | Static | i18n |
| "N opportunities worth your attention" | `:97-101` | Derived | `total` + i18next plural |
| Sort Recommended / Newest / Highest salary | `jobUtils.js:33-37`; "recommended" **doesn't sort** (`jobUtils.js:61`) | Static | `sort=recommended|newest|salary` (recommended = match score, Plus; Free per Q14) |
| Page size 9, "Showing X of Y", "Show more jobs" | `FindJobsPage.jsx:17`, `:136-145` | Client paging | `page`/`limit=9` → `{ items, total, page, pageSize }` |
| Company + logo (glyph/bg/color/border/serif) | `jobs.js:8-9,15,39,…`; recruiter jobs use the first letter + `LOGO_COLOURS` (`recruiterJobs.js:9,38`) | Static | `company.name`, `company.logoUrl` or a fallback (Q18) |
| "Strong match"/"Good match" + tone | mock `matchLabel`; recruiter jobs use ≥ 2/3 (`recruiterJobs.js:41`); tone by label (`jobUtils.js:29-31`) | Static/Derived | `match.label` (Q13, Q14) |
| "% AI match" | mock `aiMatch`; recruiter jobs use skill share (`recruiterJobs.js:42`) | Static | `match.score` (Plus) |
| Location, mode, type | job fields | Mock | Job document |
| "$140k – $180k / year" | `formatSalary` (`jobUtils.js:9`), "/ year" (`JobCard.jsx:77`) | Static `$`/`k` | `Intl.NumberFormat` with `job.salary.currency` (Q10) |
| "Senior · 5+ years" + skills | `experienceTag` (`jobUtils.js:24-26`) | Derived | Level enum label + years plural |
| "N matching skills · Work preference aligned/Relevant experience" | mock fields; recruiter `recruiterJobs.js:27-28,52` | Static/Derived | `match.matchedSkills.length`, `match.alignment` |
| Why-text | `JobCard.jsx:14-22` using `skills.slice(0, matchingSkills)` (assumes matched skills come first) | Derived | `match.matchedSkills[]`; explanation is Plus only (D4) |
| "2 hours ago" | `formatPosted` (`jobUtils.js:12-17`), English; recruiter jobs compute it from `createdAt` (`recruiterJobs.js:53`) | Derived | `job.publishedAt` + `Intl.RelativeTimeFormat` |

**Actions**

| Control | Now | Server |
|---|---|---|
| Keywords (live) | AND of every word over title, company, location, workMode, level, industry, skills (`jobUtils.js:42-49`) | `GET /api/jobs?q=` (debounced), same semantics, scoped to the user's country (Q11) |
| Location (live) | Substring of `job.location` (`jobUtils.js:50`) | `&location=` |
| Filters: Work model `Remote/Hybrid/On-site`, Experience level `Junior/Mid-level/Senior/Lead`, Match strength `Strong match/Good match` (`JobFiltersModal.jsx:5-9`); OR within a group, AND across groups | Client | `&workModes=&levels=&match=` (match filter Plus only) |
| "Show N jobs" (live) | `results.length` | `total` of the same query |
| Clear all / Clear search and filters | Reset | — |
| Sort | Client (`jobUtils.js:58-62`); a missing salary becomes 0 (`recruiterJobs.js:47`) | Server (mixed currencies, Q10) |
| Show more | +9 | `page+1` |
| Bookmark | localStorage | `PUT`/`DELETE /api/candidate/saved-jobs/:jobId` |
| View job | `jobPath` (`jobUtils.js:3-5`) | — |
| "Ai Job Summary" | Summary of `results[0]` (`FindJobsPage.jsx:35,58,156-162`) | Plus only (D4); Q20 |

**AI job summary dialog** (`AiJobSummaryModal.jsx`, shared by Screens 2, 3 and 4): badge "Local evidence-based preview" (`:40`); template "This {level} {type} role focuses on {skills}. It is based in {location} with a {workMode} working model and lists compensation of {salary} per year." (`:43-49`); "{x}% profile match · Evidence, not a hiring decision" (`:53`, `profileMatch` = matched/required, `jobUtils.js:20-22`); aligned chips (`:9` slice, `:54-62`); **hard-coded** "Your profile reports 5 years of experience and a remote work preference." (`:65-66`); buttons Close summary / Apply Now (`:20-34`, Apply goes through the D2 gate). Becomes `POST /api/jobs/:jobId/ai-summary` → `{ summary, comparison:{ score, matchedSkills, missingSkills, note }, language, generatedAt }`. Input: job fields + description, candidate profile, live CV excerpt and target language. Cache per `(jobId, job.updatedAt, language)` and `(candidateId, jobId, profileVersion, language)` (Q55). Plus only (D4); Free gets an upsell.

**Entities**: Job, Company, JobMatch, SavedJob, Application. **i18n**: about 35 page strings, 14 in Filters, 12 in Summary, 15 in JobCard. **Demo copy**: `AiJobSummaryModal.jsx:40`.
**D-impact**: D4 gates the summary, the match explanation, the match filter and the recommended sort for Free; D2 gates Apply in the summary dialog.
**Cross-role**: only jobs from approved recruiters, published and not moderated (Q19). Q10, Q11, Q13, Q14, Q18, Q19, Q20, Q55.

---

## 3. Job details — `/candidate/jobs/:jobId`

File: `jobs/pages/JobDetailsPage.jsx`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| "This job is no longer available" | `:130-148` | Derived | 404 from `GET /api/jobs/:jobId`; paused/closed per Q16 |
| Company, label, "{x}% profile match" | `:168-173` | Mock/Derived | `company.name`, `match.*` (Plus) |
| "{industry} · Posted {relative}" | `:176` | Mock | `company.industry`, `job.publishedAt` |
| Title, tagline (recruiter tagline = first sentence ≤ 120, `recruiterJobs.js:17-20`) | `:182-183` | Mock/Derived | `job.title`, `job.tagline` (Q17) |
| Meta + salary "/ year" | `:185-199` | Mock | Job fields + currency (Q10) |
| "View complete match insights" → `/candidate/ai-insights/job-match` **without the job id** | `:203-207` | Static link | `…/job-match?jobId=:jobId` (Q48) |
| Match %, "Based on {m} of {n} listed skills…" | `:58`, `:62` | Derived | `match.*` |
| "…· **Matches your work preference**" hard-coded true | `:83-84` | Bug | `match.workPreferenceAligned` |
| Evidence chips (slice) | `:51`, `:90-99` | Derived | `match.matchedSkills` |
| "**5 years** of experience reported in the profile…" | `:102` | Hard-coded | `profile.yearsExperience` vs `job.experienceYears` |
| "Potential gap" | `:107-109` | Derived | `match.missingSkills` |
| About the role / impact / bring / nice to have / perks | `details` or `ROLE_DETAILS` (`jobs.js:297-321`, used `:153`); recruiter jobs `recruiterJobs.js:57-63`; **perks are always `ROLE_DETAILS.perks`** (`recruiterJobs.js:62`) | Static fallbacks | `job.description`, `responsibilities[]`, derived "bring", `preferredSkills[]`, `perks[]` or hidden (Q17) |
| Rail: Apply/Applied, Save/Saved, "Application submitted. Track it in Applications." / "Your information, shared with consent." | `:233-268` | Static/Device | `viewer.{application,saved}`; Apply → D2 gate |
| About {company}, industry, size | `job.companyAbout/industry/companySize`; recruiter jobs read `lwm.recruiter.company` | Mock/Device | `company.*` |

**Actions**: Apply → `POST /api/candidate/applications` (D2 gate N3). Save → saved-jobs. "Ai Job Summary" (Plus). Back. **New**: "Translate" for job content (Plus, D4) → `POST /api/translate { entity:'job', id, fields, target }` (Q74).
**Endpoint**: `GET /api/jobs/:jobId` → `{ job, company, match|null, viewer:{ saved, application|null }, gate:{ canApply, missing[], planRequired } }`.
**i18n**: about 45 strings. **D-impact**: D2 adds the apply gate and the `gate` DTO; D4 hides "Why this job matches you" and the match % for Free.
**Gaps**: missing job id in the link; hard-coded alignment and years; static perks. Q16, Q17, Q48, Q74.

---

## 4. Applications — `/candidate/applications`

Files: `applications/pages/ApplicationsPage.jsx`, `applications/components/ApplicationActivityModal.jsx`, `jobs/data/applications.js`, `jobs/hooks/useApplications.js`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Chips All / Applied / Under review / Interview / Withdrawn | `ApplicationsPage.jsx:21-27` | Static enum | Server enum (Q21) |
| Rows | `lwm.candidate.applications` (`useApplications.js:14`), seed `SEED_APPLICATIONS` (`applications.js:13-17`) | Device + Static | `GET /api/candidate/applications?status=&page=` |
| "Sep 28" | `formatApplied` (`applications.js:22-24`, `toLocaleDateString('en-US')`) | Static locale | Locale formatter |
| Status label/tone `APPLICATION_STATUS` (applied neutral, under-review violet, interview success, withdrawn neutral) | `applications.js:2-7` | Static | Enum + i18n (Q21) |
| "Next step" column holds only "View activity" | `:73-81` | — | Q24 |
| Rows with an unresolvable job are dropped | `:42` | Derived | Job snapshot stored on the application |
| Page "Ai Job Summary" = latest active application | `:46-47`, `:90`, `:133` | Derived | Plus only; Q20 |
| Activity steps Applied → Under review → Interview, "Current status", "Applied {date}" | `ApplicationActivityModal.jsx:14-15`, `:41`, `:47`; `APPLICATION_STEPS` (`applications.js:10`) | Static | `GET /api/candidate/applications/:id` with `history[]` (Q24) |

**Actions**: filter (`?status=`); View activity; Withdraw → confirm "You'll no longer be considered for {title}. You can apply again later." → `POST /api/candidate/applications/:id/withdraw` → `{ status:'withdrawn', withdrawnAt }` and the recruiter is notified (today `useApplications.js:27-31`); View job. Re-apply replaces the withdrawn row with id `app-{jobId}` and a client local date (`useApplications.js:5-10,19-22`) (Q23). Seed: Figma (under-review, 2026-09-28), Notion (interview, 2026-09-25), Vercel (applied, 2026-09-24).
**Emails** (decided): stage updates. **i18n**: about 35 strings.
**D-impact**: D2: re-apply passes through the gate; Q25 covers what happens to applications when the plan lapses or the profile becomes incomplete.
**Cross-role**: recruiter "live applicant" built from this list + `lwm.candidate.profile` (`recruiter/hiring-pipeline/hooks/useLiveApplicant.js:15-53`, fixed id `alex-morgan` `:8`); recruiter Job details count (`recruiter/jobs/pages/JobDetailsPage.jsx:34-35`); admin Applications with a constant applicant (`admin/applications/pages/ApplicationsPage.jsx:32-39`). Recruiter stage moves never reach the candidate today (Q21).
**Gaps**: no pagination. Q20–Q25.

---

## 5. Job alerts — `/candidate/job-alerts`

Files: `job-alerts/*`. List from `lwm.candidate.jobAlerts` (`useJobAlerts.js:7`), seeded with 2 alerts (`alerts.js:2-19`). Each card shows the name, "{frequency} digest · Active|Paused" (`JobAlertsPage.jsx:50`) and a tile. Demo note at `:63`.

| Control | Now | Server / validation |
|---|---|---|
| Create → dialog | id `alert-${Date.now()}` (`JobAlertModal.jsx:36`), prepended, `active:true` | `POST /api/candidate/job-alerts { name, keywords, location, frequency }` → 201 |
| Edit (click the name) | Merge | `PATCH /api/candidate/job-alerts/:id` |
| Pause / Resume | Toggle | `PATCH … { active }` |
| Delete → confirm "“{name}” will stop appearing in your digests." | Remove | `DELETE …` → 204 |
| Alert name | required, trimmed: "Give the alert a name, like “Remote product design roles”." (`JobAlertModal.jsx:8`) | Mirror; max length Q29 |
| Keywords | required: "Add a job title, skill or company to watch for." (`:9`) | Mirror (Q29) |
| Location | optional, placeholder "Anywhere" | Q11, Q29 |
| How often | `FREQUENCIES = ['Daily','Weekly']` (`alerts.js:21`), default Daily, label "{x} digest" | Enum (Q26) |

**Entity — JobAlert**: `{ candidateId, name, keywords, location:'' , frequency:'Daily'|'Weekly', active:true, createdAt, lastRunAt, lastSentAt, sentJobIds[] }`. **Emails**: on publish or as a digest (Q26), in the user's language, honouring the email toggle (Q69), with a pause link. **Scheduler**: `node-cron` in-process with a Mongo lock (no Redis). **i18n**: about 25 strings. **Demo copy**: `JobAlertsPage.jsx:63`, `JobAlertModal.jsx:50`.
**D-impact**: **D4 makes job alerts Plus-only**, so the page needs a gate (reuse PlusGate) and a downgrade rule (Q28). **Missing data**: last sent date, number of matches. Q11, Q26–Q29, Q69.

---

## 6. My profile — `/candidate/profile`

Files: `profile/pages/ProfilePage.jsx`, `profile/components/{EditProfileModal,JobSummaryModal}.jsx`, `profile/data/profile.js`, `profile/utils/profileText.js`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Profile fields | `lwm.candidate.profile` (`profile.js:1`), seed `INITIAL_PROFILE` (`profile.js:4-17`) | Device + Static | `GET /api/candidate/profile` |
| Initials avatar | `initialsOf` (`profileText.js:11-18`) | Derived | Profile photo (D3) with initials fallback |
| "{n} years of relevant professional experience" | `experienceLabel` (`profileText.js:3-5`) | Derived | i18n plural |
| Education line "{degree} · {institution}" | `ProfilePage.jsx:104` area (sections `:83-123`) | Device | D3: Education **list** |
| Salary "$120k+ / year" | `salaryLabel` (`profileText.js:7-9`) | Static `$` | Currency formatter (Q10) |
| Resume card file name / "No resume on this device yet" | `ProfilePage.jsx:139` (`lwm.candidate.cv`, `:21`) | Device | `profile.liveCv` |
| "No profile information is stored on this device" | `:126-129` | Demo | Empty-profile state |
| "Profile saved on this device." | `:32` | Demo | "Profile saved." |

**Edit/Create profile validation (mirror on the server)** — `EditProfileModal.jsx:28-63`: headline required, ≤ 60 ("Enter your current role or headline." / "Keep your headline to 60 characters or fewer."); location required, ≤ 60 ("Enter where you are based." / "Keep your location to 60 characters or fewer."); about trimmed 20–600 with hint "{n} / 600 characters" ("Tell your story in at least 20 characters." / "Keep your story to 600 characters or fewer."); yearsExperience required, `/^\d+$/`, ≤ 50 ("Enter your years of experience." / "Enter a whole number from 0 to 50."); skills ≥ 1, each ≤ 30, unique case-insensitive, ≤ 12 (`MAX_SKILLS` `:9`) ("Add at least one skill." / "Keep each skill to 30 characters or fewer." / "{skill} is already in your skills." / "You can list up to 12 skills."); degree required ("Enter your qualification, like BFA, Interaction Design."); institution required ("Enter the institution."); workMode from `WORK_MODES = ['Remote','Hybrid','On-site']` (`profile.js:33`); salaryMin optional, `/^\d+$/`, ≤ 1000, stored as `''` or a Number, hint "Optional. 120 shows as $120k+ / year." (`:217`) ("Enter thousands as a whole number, from 0 to 1000."); openToOpportunities checkbox; **name is not editable**, kept from `INITIAL_PROFILE.name` (`:105`) (Q1). `BLANK_PROFILE` (`profile.js:20-31`) holds the empty-form defaults.
Server: `PUT /api/candidate/profile` → 200 or 422 `fields`. After a save, recompute the embedding and matches and invalidate AI caches (Q55).

**Profile "Ai Job Summary"** (`JobSummaryModal.jsx`): template `buildJobSummary` (`profileText.js:21-31`), description "Composed on this device from your profile fields. No AI service is connected." (`:32`), Copy summary via the clipboard. Becomes `POST /api/candidate/profile/ai-summary` (Plus, D4; Q56).
**D-impact (D3, large)**: the single dialog cannot hold the new structure. My profile needs sections and editors for Photo (upload/crop), Work history (list of `{employer, title, start, end|current}`), Education (list replaces `degree`/`institution`), Languages (`{language, level A1–C2|native}`), Right to work (`{country, status citizen|permit|needs-sponsorship}`), Links (LinkedIn, portfolio), plus completeness badges, the live-CV state, phone verification and verification-check status. See section 24.
**Cross-role**: recruiters see these fields today via `useLiveApplicant.js:32-52` (name, headline, location, workMode, years, skills, availability, about, education), gated by privacy (Q68). Profile edits move match scores for both sides. **i18n**: about 30 page strings, 35 in Edit, 8 in Summary. **Demo copy**: `ProfilePage.jsx:32,128-129,139`, `EditProfileModal.jsx:232`, `JobSummaryModal.jsx:32`. Q1, Q2, Q10, Q11, Q30–Q36, Q42, Q56, Q68, Q74.

---

## 7. CV & versions — `/candidate/cv-versions`

Files: `cv/pages/CvVersionsPage.jsx`, `cv/components/*`, `cv/data/cvVersions.js`, `cv/utils/cvVersions.js`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Version list "Version {n} · {fileName}", tag, badge, "{date} · {source}", note | `lwm.candidate.cv` (`data/cvVersions.js:1`, page `:17`), seed `INITIAL_CV` (`data:20-55`), `CV_FILE_NAME` (`data:3`) | Device + Static | `GET /api/candidate/cv` → `{ liveVersionId, versions }` |
| Badge: live "Current live CV"; unapproved "Awaiting your approval"; otherwise "Approved snapshot" | `VersionRow.jsx:8-18` | Derived | Same rule |
| "13 Oct 2026, 10:36" | `formatVersionDate` (`utils/cvVersions.js:6-10`), English `MONTHS` (`:3`) | Static locale | `Intl.DateTimeFormat` |
| Sources "Candidate upload"/"AI-assisted draft"; notes `DRAFT_NOTE` (`data:13`), "Resume uploaded and approved by the candidate." (`utils:44`), original note (`data:51`) | Static | Enum + i18n; AI note |
| Compare panel role/experience/skills + difference sentence | `ComparePanel.jsx:7-15,31-52`; `BASE_SNAPSHOT` (`data:7-11`) | Static | `version.snapshot` (Q43) |
| "PDF or DOCX · Up to 10 MB" | `UploadDropzone.jsx:41`; `MAX_CV_SIZE_MB` (`data:4`), `ACCEPTED_CV_EXTENSIONS` (`data:5`) | Config | `GET /api/meta/upload-limits` |

| Control | Now | Server |
|---|---|---|
| Upload (click/drop) | `validateCvFile` (`utils:13-23`): wrong extension → "{name} is not a PDF or DOCX file. Choose a .pdf or .docx resume."; 0 bytes → "{name} is empty. Choose a different file."; > 10 MB → "{name} is {x.x} MB. Resumes can be up to 10 MB."; `addUpload` (`utils:34-48`): next version, approved, live, **snapshot copied from the previous live version** | `POST /api/candidate/cv/versions` multipart → extension + MIME + magic bytes + ≤ 10 MB; disk `uploads/cv/{userId}/{versionId}.{ext}`; text extraction; embedding; AI snapshot (Q43) → 201 |
| Create assisted draft (disabled with 0 versions) | `addDraft` (`utils:51-65`) sorts skills, pending | `POST /api/candidate/cv/versions/draft` → OpenAI (**Plus**, D4; Q44) |
| Compare (max 2) | Client | Client |
| Approve as live / Set as live | `approveVersion` (`utils:67-72`) | `POST /api/candidate/cv/versions/:id/approve` |
| Download / delete one version | Not available | Q45 |

**i18n**: about 35 strings. **Demo copy**: `CvVersionsPage.jsx:35,47,85-86,120`; `ComparePanel.jsx:25`. **D-impact**: D3 makes a live CV a completeness item; D4 gates the draft and CV-based matching. **Cross-role**: recruiter resume tab and "Request earlier version" (`recruiter/find-candidates/components/EarlierVersionModal.jsx`), with consent per `ComparePanel.jsx:61-62` (Q46). Q43–Q47, Q68, Q75.

---

## 8. Verification — `/candidate/verification`

Files: `verification/pages/VerificationPage.jsx`, `verification/components/{CheckRow,SubmitEvidenceModal}.jsx`, `verification/data/verification.js`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Email "alex@example.com" + always "Verified" | `ACCOUNT_EMAIL` (`verification.js:3`); pills `VerificationPage.jsx:76-78`, `:154` | Static | `user.email`, `emailVerifiedAt` (always set after D1) |
| Phone + Verified/Not verified | `lwm.candidate.verification` (`verification.js:1`, page `:23`), `INITIAL_VERIFICATION` (`:10-14`) | Device | `verification.phone`, `phoneVerifiedAt` |
| Three checks (label, description, accepted, evidence types) | `CREDENTIAL_CHECKS` (`verification.js:17-39`) | Static config | `GET /api/meta/verification-checks` + i18n |
| Status per check, "Submitted: {type} · {file}", tick | `CheckRow.jsx:8`, `:17-21`, `:25-29`; `STATUS_LABEL` (`VerificationPage.jsx:15`) | Device | `checks.{id}.{status, evidenceType, fileName, submittedAt, reviewedAt, rejectionReason}` (Q37) |
| Eligible / Not yet eligible | all three verified (`VerificationPage.jsx:36`) | Derived | `verification.eligible` (Q36, Q38) |

| Control | Now | Server |
|---|---|---|
| Phone field | Saved on every keystroke; normalised by removing `[\s().-]` (`:17-19`); `/^\+[1-9]\d{6,14}$/` (`:14`); error after blur: "Enter the number in international format, like +44 7700 900000." (`:32`); hint "…No code is actually sent." (`:91`) | Persist when a code is requested |
| "Confirm demo code" | Sets `verifiedPhone` (`:108`); editing the number un-verifies it | D3: code shown on screen. `POST /api/candidate/verification/phone/code { phone }` → `{ code, expiresAt }`; `POST …/phone/confirm { phone, code }` → `{ phoneVerifiedAt }` (Q40) |
| Submit for review → evidence type, file `.pdf/.jpg/.jpeg/.png` ≤ 10 MB (`verification.js:41-42`), "This evidence is mine and accurate." | `fileProblem` (`SubmitEvidenceModal.jsx:10-17`): "Choose the evidence file you want to submit." / "{name} must be a PDF, JPG, or PNG file." / "{name} is empty. Choose a different file." / "{name} is larger than 10 MB."; "Confirm that this evidence is yours and accurate." (`:30`) | `POST /api/candidate/verification/checks/:checkId` multipart → `{ status:'in-review', submittedAt }`; 409 when in review or verified; private disk storage |
| "Mark as reviewed (demo)" | Self-approves (`CheckRow.jsx:46`; `VerificationPage.jsx:47-49`) | Remove. Admin: `GET /api/admin/verifications?status=in-review`, `GET …/:id/file`, `POST …/:id/decision { decision, reason? }` |

**i18n**: about 45 strings. **Demo copy**: `VerificationPage.jsx:91,110`; `CheckRow.jsx:46`; `SubmitEvidenceModal.jsx:94`. **D-impact**: D3 makes phone verified and admin-approved checks completeness items; D1 makes the email always verified. **Cross-role**: admin review queue (Q37), recruiter badges (Q39). Q36–Q41, Q75.


---

## 9. PlusGate (AI insights locked for Free) — `/candidate/ai-insights/*`

Files: `billing/components/PlusGate.jsx` (layout route, `ai-insights/routes.jsx:7`), `billing/data/subscription.js`, `billing/hooks/useSubscription.js`, `payments/components/CheckoutDialog.jsx`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Eyebrow `plus.name` "AI Matches Plus", title "Unlock your AI insights", lead "Profile insights, skill-gap guidance and match explanations are part of AI Matches Plus." | `PlusGate.jsx:21-25`; `PLANS` (`subscription.js:11-21`) | Static | `GET /api/meta/plans` → `{ plans:[{ id, name(i18n), price:{ amount, currency }, interval, features[] }] }` for the user's country; plan name and copy configurable (D2 says the name may change; Q67) |
| "£9 per month" | `PlusGate.jsx:27-29`; `price:'£9'`, `amount:9`, `period:'per month'` (`subscription.js:16-18`) | Static `£` | Price per currency (Q9) formatted with `Intl.NumberFormat` |
| Features "AI job recommendations tuned to your profile / Match reasons and skill-gap guidance / Priority review of your CV versions" | `subscription.js:19` | Static | D4 feature list (all AI, applying, messaging, job alerts); "Priority review…" has nothing behind it (Q14) |
| Plan state | `useSubscription` → `lwm.candidate.subscription` (`useSubscription.js:7`, key `subscription.js:7`, `INITIAL_SUBSCRIPTION = null` means Free `:9`) | Device | `GET /api/candidate/subscription` |

**Actions**: "Start AI Matches Plus" opens `CheckoutDialog` with `PLUS_CHECKOUT_ITEM` (`subscription.js:24-30`; caption "…· demo: no renewal charges are ever made" `:29`). `onPaid` calls `setPlan('plus', payment.id)` (`PlusGate.jsx:49`; `useSubscription.js:9-13` writes `{ plan, status:'active', startedAt, paymentId }`). The new flow is `POST /api/billing/checkout-session { kind:'subscription', planId:'plus' }` → `{ url }` (Stripe hosted Checkout, mode=subscription, `success_url=/candidate/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`, `cancel_url` = page of origin). Webhooks then create the Subscription and Payment, and the client polls `GET /api/candidate/subscription` until it is active. "Manage billing" links to `/candidate/settings/billing`.

**Server gate**: every Plus feature (D4) returns 402 `PLAN_REQUIRED` for Free. The client gate is cosmetic only.
**D-impact**: D4 turns PlusGate into a reusable gate used by AI insights, Job alerts, every AI button (job summary, profile summary, CV draft, match explanation, translate), Apply (D2) and the Messages reply box. **i18n**: about 8 strings + features. Q9, Q14, Q67.

### 9a. Checkout dialog (candidate use of `payments/`)

`CheckoutDialog.jsx` collects a card form today: name ≤ 60 (`:114`); number formatted in groups of 4 and ≤ 19 digits (`card.js:9-11`); expiry MM/YY (`card.js:13-16`); CVC 3–4 digits. `validateCheckout` (`card.js:50-60`) returns "Enter the name on the card." / "Enter your card number." / "Enter a valid card number." (13–19 digits + Luhn, `card.js:26-37`) / "Enter the expiry as MM/YY." / "Enter a month from 01 to 12." / "This card has expired." / "Enter the 3 or 4 digit security code.". A fake 900 ms delay (`:10`), the decline card `4000000000000002` (`card.js:5`), brand detection (`card.js:18-23`), and a record of every attempt with `payerName = WORKSPACES[payerRole].user.name` (`:66`) round it out. Copy: "Pay {£x}" (`:94`), description "Demo checkout: no payment provider is connected…" (`:86`), decline "Your card was declined. No money was taken…" (`:76`), demo card note (`:147-150`).
**Must become**: no card fields in our UI (Stripe hosted Checkout validates cards). The dialog shrinks to an order summary (item name, caption, amount in the user's currency) with a "Continue to secure payment" button → `POST /api/billing/checkout-session` → redirect. All of `card.js` and the demo copy are removed. Payment records come only from webhooks (Q65).

---

## 10. AI Profile Insights — `/candidate/ai-insights` (Plus)

Files: `ai-insights/pages/AiInsightsPage.jsx`, `ai-insights/components/{AiPageShell,AiSafetyNotice,MatchCard,RoleLogo,SectionHeading}.jsx`, `ai-insights/data/insights.js`, `ai-insights/hooks/useInsightsState.js`, `ai-insights/utils/matching.js`.

**Important**: the AI insights group uses **its own static copy of the profile** (`PROFILE`, `insights.js:7-15`) and **5 fake roles** (`ROLES`, `insights.js:34-95`) whose skills, salaries and minimum years disagree with the job records (for example, Figma role min 4 years and salary "$130k – $170k" vs the job's "3+ years" and 135–170). Nothing here reads `lwm.candidate.profile` or the job list.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Shell: eyebrow "· {name}", badge "AI-assisted · You're in control", tabs Profile insights / Skill gap / Improve profile / Job match / Why recommended (carry `?role=`) | `AiPageShell.jsx:8-14`, `:22-44` | Static | i18n; tabs carry `?jobId=` |
| Closing notice "…Semantic AI, verification, and predictive confidence are not connected. Your information stays on this device." | `AiSafetyNotice.jsx:13-14` | Demo | Rewrite for OpenAI + server storage |
| Avatar "AM", name, "Product Designer · San Francisco, US" | `AiInsightsPage.jsx:29-35` from `PROFILE` | Static | `GET /api/candidate/insights/overview` → `profile` (photo, D3) |
| "Skills in your profile" = `skills.length` (`PROFILE.skills` + locally added) | `:46`; `useAddedSkills` (`useInsightsState.js:12-20`) | Static + Device | `profile.skills.length` (Q50) |
| "Roles with aligned skills" **9**, caption "Among the current demo opportunities" | `:47-52`; `ROLES_WITH_ALIGNED_SKILLS` (`insights.js:19`) | Static | Count of visible published jobs with ≥ 1 required-skill overlap (Q53) |
| "Experience reported" "5 yrs" | `:53` | Static | `profile.yearsExperience` |
| Strength bars: "{skill} … {n} roles", width = n/9 | `:63-86`; `SKILL_DEMAND` (`insights.js:22-31`), `DEMO_OPPORTUNITY_COUNT` 9 (`insights.js:18`); note "…of the 9 current demo opportunities…" (`:88`) | Static | `skillDemand[{ skill, jobCount }]`, `jobsConsidered` (Q53) |
| Evidence card "Your **Product Design** experience is a useful starting point…" | `:95-97` hard-coded skill | Static | AI `strengthInsight { skill, text }` in the user's language (Q49) |
| Context card "…compare your listed skills with the available demo roles… A connected AI service would add semantic analysis…" | `:110-111` | Demo | Rewrite |
| "The evidence behind your matches" = top 4 of `rankRoles` | `:19`, `:128-132`; `rankRoles` (`matching.js:26-35`: ≥ 1 listed skill, sorted by listed count, then work alignment, then years met) | Static | `topMatches[]` over real jobs (Q13, Q48) |
| MatchCard: logo/title/company link to `/candidate/jobs/{jobId}`, "{n} skills align · Matches/Review work preference", detail: listed, missing, "You: Remote · Role: …", "5 years reported · Role lists {minYears}+" | `MatchCard.jsx:20-62` (`PROFILE` at `:53`, `:59`); `RoleLogo.jsx` | Static | `match` DTO per job |

**Actions**: navigation only (Improve my profile, Strengthen my profile, Explore skill gaps, View match insights `?role=`, Why recommended?). The "AI Match Insights" disclosure toggle is client-side.
**Endpoint**: `GET /api/candidate/insights/overview` → `{ profile, stats:{ skillsCount, rolesWithAlignedSkills, jobsConsidered, yearsExperience }, skillDemand[], strengthInsight, topMatches[] }` (402 for Free).
**i18n**: about 25 strings + shell 10 + notice. **Demo copy**: `AiInsightsPage.jsx:51,88,110-111`; `AiSafetyNotice.jsx:13-14`. Q13, Q48, Q49, Q50, Q53, Q55.

---

## 11. Skill Gap — `/candidate/ai-insights/skill-gap` (Plus)

Files: `ai-insights/pages/SkillGapPage.jsx`, `components/{RolePicker,GapCard,ReviewSkillModal,LearningPlanCard,SourceEvidenceModal}.jsx`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Role picker: summary (logo, title, "{company} · {workMode} · {salary}") + "Compare with a role" select | `RolePicker.jsx:7` (options from `ROLES`), `roleMeta` (`matching.js:80-82`), salary strings in `ROLES` (`insights.js:41,53,65,77,89`) | Static | `GET /api/candidate/insights/roles` → candidate's jobs (Q48); salary via the formatter |
| Default role `stripe`, selection in `?role=` | `SkillGapPage.jsx:20`; `useSelectedRole` (`useInsightsState.js:47-51`) | Static | `?jobId=`; default = top-ranked job |
| Stats: "Listed skills that align {x} of {y}", "Required skills not listed {n}", "Experience to review: Aligned/To review", caption "Role lists {min}+ years; you reported 5" | `:51-72`; `compareRole` (`matching.js:8-19`, uses static `PROFILE.yearsReported`) | Derived from static | `GET /api/candidate/insights/skill-gap?jobId=` |
| Gap cards = required skills **not in the static `PROFILE.skills`** | `:29` | Static | `missingSkills` from the real profile |
| GapCard badge "Required · Not listed" / "Added · Candidate-reviewed"; text; tip "A practical way to build evidence" | `GapCard.jsx:15-41`; tip from `SKILL_GUIDANCE` (`insights.js:98-102`) or `DEFAULT_GUIDANCE` (`:104`), at `GapCard.jsx:38` | Static | AI `guidance` per skill and language, cached (Q49) |
| Learning plan card (skills, Remove, "Explore learning courses") | `LearningPlanCard.jsx`; `useLearningPlan` (`useInsightsState.js:23-26`, key `lwm.ai-insights.learning-plan`) | Device | `CandidateProfile.learningPlan[]` (Q52) |
| No-gap panel + "See the evidence side by side" | `:99-109` | Static | i18n |

**Actions**

| Control | Now | Server |
|---|---|---|
| Select role | URL param | `?jobId=` refetch |
| View source evidence → `SourceEvidenceModal` (profile: skills, "5 years", work preference, location from static `PROFILE`, `SourceEvidenceModal.jsx:13-15`; listing: required skills, min years, work mode, location) | Static | Data from the skill-gap DTO |
| "I have this skill" → `ReviewSkillModal`: checkbox "I confirm that {skill} is part of my experience and want to add it to my profile." enables "Add reviewed skill"; "Keep my profile unchanged" | `ReviewSkillModal.jsx:7-35`; adds to `lwm.ai-insights.added-skills` (`useInsightsState.js:13`); announcement "…Saved on this device." (`SkillGapPage.jsx:34`) | `POST /api/candidate/profile/skills { skill, source:'skill-gap-review', confirmed:true }` → 201; 422 `MAX_SKILLS`/`TOO_LONG`/`DUPLICATE` (Q50) |
| Undo | Remove from local list (`:37-40`) | `DELETE /api/candidate/profile/skills/:skill` (only `source:'skill-gap-review'`) |
| Add to learning plan / In your learning plan | Toggle (`useInsightsState.js:25`) | `PUT`/`DELETE /api/candidate/learning-plan/:skill` |
| Find a course → `/candidate/learning` (unfiltered) | Link | `/candidate/learning?skill={skill}` (Q52) |
| Review my profile | Link | — |

**i18n**: about 35 + 7 (review) + 12 (source). **Demo copy**: `SkillGapPage.jsx:34`, `GapCard.jsx:28` ("…saved on this device…"), `SourceEvidenceModal.jsx:33` ("Provided locally, not independently verified."). Q48–Q52, Q55.

---

## 12. Profile Improvement — `/candidate/ai-insights/improve-profile` (Plus)

File: `ai-insights/pages/ImproveProfilePage.jsx`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Completeness **85%**, bar, "4 of 5 core areas provided" | `:18`, `:40-52`; `PROFILE_COMPLETENESS` (`insights.js:150`) | Static | D3 checklist (`GET /api/candidate/profile/completeness`) (Q30) |
| Hero copy "Profile completeness measures fields you've provided…" | `:26-38` | Static | i18n (copy must match D3 semantics: completeness now gates applying) |
| 5 suggestion cards (portfolio "Worth adding"; summary/skills/experience/resume "Provided · Can refine"), each linking to `/candidate/profile` or `/candidate/cv-versions` | `:61-90`; `IMPROVEMENTS` (`insights.js:107-148`) | Static | `suggestions[]` = D3 checklist items with status + AI improvement text per area (Plus) |
| Learning plan card | `:93-95` | Device | As in Screen 11 |

The Figma inventory lists "accept / dismiss / undo suggestions" for this frame (`docs/FIGMA_SCREEN_INVENTORY.md:41`); the code only links. **Endpoint**: `GET /api/candidate/insights/improve-profile` → `{ completeness, suggestions:[{ id, area, status, title, description, action:{ route } }] }`. **i18n**: about 30. Q30, Q49.

---

## 13. Job Match Insights — `/candidate/ai-insights/job-match` (Plus)

File: `ai-insights/pages/JobMatchPage.jsx`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Default role `linear` | `:31` | Static | Top job, or `?jobId=` |
| Verdict "Strong match" (all skills + years met + work aligned) or "Partial overlap" | `:38`, `:69` | Derived | `verdict` (Q13) |
| Tiles "Required skills {x} of {y} listed" / "Relevant experience 5 years reported" / "Work preference Remote → {mode}" + Aligned/To review | `:41-49` (`PROFILE` at `:47-48`) | Static profile | DTO |
| Evidence rows (one per required skill + Experience + Work preference + Location; Location aligned = **exact string equality**) | `buildEvidenceRows` (`matching.js:38-73`); `compareRole` location check (`matching.js:18`) | Derived | `evidenceRows[]` server-side; location rule per Q11 |
| Gaps text | `:117-125` | Derived | `missingSkills` + AI text |
| "View role & apply" → `/candidate/jobs/{role.jobId}` | `:139` | Static mapping | Job id |
| "Save this opportunity" / "Saved on this device" | `:142-150`; `useSavedRoles` (`useInsightsState.js:28-31`, key `lwm.ai-insights.saved-roles`) | Device | Same SavedJob as the bookmark (Q51) |
| Context copy | `:157-162` | Static | i18n |

**Endpoint**: `GET /api/candidate/insights/job-match?jobId=` → `{ job, verdict, tiles[], evidenceRows[], gaps:{ missingSkills, text } }`. **i18n**: about 30. **Demo copy**: `:149`. Q11, Q13, Q48, Q51.

---

## 14. Recommendation explanation — `/candidate/ai-insights/why-recommended` (Plus)

File: `ai-insights/pages/WhyRecommendedPage.jsx`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Badges "Evidence-led explanation", "Role {rank} in this profile preview" | `:128-134`; rank from `rankRoles` (`:69`) | Derived | `rank` from the real ranking |
| Three reasons (skills overlap + tag "{x} of {y} required skills"; experience "Your profile reports 5 years…" tag "Candidate-provided"; preferences "You prefer Remote…" tag) | `buildReasons` (`:25-53`, `PROFILE` at `:38`, `:47`) | Static profile + templates | AI-written reasons grounded on deterministic fields, in the user's language (Q49) |
| Accordion "How this preview is ordered" ("…transparent local comparison, not semantic AI ranking…" `:84`), "What was not assessed", "How to change the evidence" ("…New evidence updates these local comparisons." `:105`) | `:72-115` | Static/Demo | Rewrite to the real model (Q13) |
| Feedback Helpful / Needs review; "Your feedback is a local note, not a model training submission." (`:190`); "Saved as a local note on this device. Nothing was sent." (`:207`) | `:55-58`, `:186-209`; `useExplanationFeedback` (`useInsightsState.js:34-44`, key `lwm.ai-insights.explanation-feedback`) | Device | `PUT /api/candidate/insights/feedback/:jobId { value:'helpful'|'needs-review'|null }` (Q54) |
| Sources list (3 fixed bullets) | `SOURCES` (`:19-23`) | Static | i18n (accurate once AI is used) |
| "Context, not confidence" + "No AI confidence score is available…" | `:229-241` (`:234-235`) | Demo | Rewrite |

**Endpoint**: `GET /api/candidate/insights/why-recommended?jobId=` → `{ rank, reasons[{ title, text, tag }], feedback }`. **i18n**: about 40. Q13, Q48, Q49, Q54.

---

## 15. Learning catalogue — `/candidate/learning`

Files: `learning/pages/LearningPage.jsx`, `learning/components/{CourseCard,LevelTabs,PurchaseDialog,LessonRow}.jsx`, `learning/data/courses.js`, `learning/hooks/{useLearning,useCourseCatalogue}.js`; reads the admin store through `admin/courses/hooks/useCourses.js` (key `lwm.admin.courses`, seed `admin/courses/data/courses.js:15-28`) and `admin/courses/utils/learnerCourse.js`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Pill "Learning Plus active" (shown to everyone) | `LearningPage.jsx:48` | Static | Remove, or show the real entitlement (Q58) |
| "Courses in progress" | `inProgressCount` (`useLearning.js:55`: purchased, ≥ 1 lesson done, not complete) | Device | `stats.inProgress` (D5: progress = lessons viewed) |
| "Completion badges" | `completedCount` (`useLearning.js:56`: all lessons done) | Device | `stats.certificates` (D5: quiz passed) |
| "Skills to explore" **6** | `SKILLS_TO_EXPLORE` (`courses.js:12`), `LearningPage.jsx:72` | Static | Count of gap skills (Q52) |
| "Courses for **Interaction Design**" + lead; grid = `course.recommended` (includes a Fintech course) | `GAP_SKILL` (`courses.js:14`), `LearningPage.jsx:21,82-92` | Static | `GET /api/candidate/learning/recommended` → `{ gapSkills[], courses[] }` (Q52) |
| Level tabs All levels + Foundation/Intermediate/Advanced | `LEVELS` (`courses.js:9`), `LevelTabs.jsx:6` | Static enum | Enum + i18n; `GET /api/courses?audience=candidate&level=` |
| Catalogue = built-in `COURSES` (`courses.js:32-163`) minus admin drafts + admin uploads with generated copy | `useCourseCatalogue.js:32-40`; `fromUpload` (`:7-26`: tier from price, `recommended:false`, template summary/about/outcomes, lessons "Lesson N" and 35 min/lesson from `learnerCourse.js:5-18`) | Static | `GET /api/courses` (admin-authored, D5) |
| Card: stock photo (one image for all), tier badge, title, "category · level · duration", summary, "Course price £49.00", "One-time course access", View/Continue, Buy now/Purchased | `CourseCard.jsx:12-62` (photo `:25`, price `:40` via `formatPrice` `useLearning.js:5-7`) | Static `£` + photo | `course.coverImageUrl`, price in the user's currency (Q9), `viewer.enrollment` |
| Footer "Courses are bought through a demo checkout… saved only in this browser." | `LearningPage.jsx:106-109` | Demo | Remove/rewrite |

**Price conflict**: built-in prices are 49, 39, 19, 49, 49, 49 (`courses.js:40,59,78,101,124,147`) while the admin seed has 0, 39, 0, 49, 59, 0 (`admin/courses/data/courses.js:16-21`). The seed payment says Alex paid £49 for `interaction-design-foundations` (`payments/data/payments.js:39`), which admin lists as free. The pre-purchase lives in `INITIAL_LEARNING` (`courses.js:4-7`) (Q57).

**Actions**

| Control | Now | Server |
|---|---|---|
| Level tab | Client filter (`LearningPage.jsx:22`) | `?level=` |
| Buy now (paid) | `PurchaseDialog` → `CheckoutDialog` item `{ kind:'course', … caption:'One-time course access' }` (`PurchaseDialog.jsx:9-17`) → `purchase()` (`useLearning.js:33-37`) | `POST /api/billing/checkout-session { kind:'course', courseId }` → Stripe (mode=payment); webhook creates Enrollment + Payment; 409 `ALREADY_ENROLLED` |
| Buy now (free) | Confirm "Add “{title}”?" / "This course is free, so there is nothing to pay. It is added to your learning in this browser." (`PurchaseDialog.jsx:18-25`) | `POST /api/candidate/learning/enrollments { courseId }` (price must be 0) |
| View / Continue course | Link | — |

**i18n**: about 30. **D-impact**: D5 (section 24). D4: courses stay separate purchases, so they are not gated by Plus. Q9, Q52, Q57, Q58, Q59.

---

## 16. Course details — `/candidate/learning/:courseId`

File: `learning/pages/LearningDetailsPage.jsx`, `learning/components/LessonRow.jsx`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Not-found state | `:24-37` | Derived | 404 |
| Eyebrow "{category} · {level}", title, summary, pill Completed/Purchased | `:56-67` | Mock | `course`, `viewer.enrollment.status` |
| Hero "Free introduction · 3 min", "Preview the course before you decide." + text + "Watch free introduction" | `:77-92` (`:79` static duration) | Static | Free-preview lesson (D5, Q63) with a real duration |
| "What you'll learn" outcomes | `:95-104` | Mock (`courses.js:16-22`) | `course.outcomes[]` |
| Curriculum lead "Free introduction + {n} lessons · {duration} · Learn at your pace" | `:110` | Derived | From lessons (D5) |
| Intro row "Course introduction" / "Preview · 3 minutes" / "Free" | `:113`; `LessonRow.jsx:12-24` | Static | Preview lesson |
| Lesson rows "{i}. {title}", "Pre-recorded lesson", Locked / Mark complete / Completed | `:114-124`; `LessonRow.jsx:27-46` (state text `:43`) | Mock | D5: lesson type icon + duration, Locked / Not started / Viewed; **no manual "Mark complete"** |
| About + tags (level, duration, "{n} lessons", category) | `:129-145` | Mock | `course.*` |
| Price card "Course price", `formatPrice`, "One-time course access", INCLUDED "{n} pre-recorded lessons / Completion assessment / Course-completion badge / Learn at your own pace" | `:150-160`; `INCLUDED` (`:13`) | Static | i18n + counts by lesson type (D5 makes the assessment and badge real) |
| Buy Now / Purchased | `:161-169` | Device | As Screen 15 |
| "Your progress" {x}% + "{done} of {total} lessons complete" | `:173-187`; `courseProgress` (`useLearning.js:10-23`, percent = round(done/total × 100) at `:19`) | Device | `GET /api/candidate/learning/enrollments/:courseId` → `{ viewedLessons, total, quiz:{ passed, bestScore }, certificate }` (Q61) |
| "Evidence, not a shortcut." copy | `:190-197` | Static | i18n; must match D5 (quiz) |
| Intro modal "This prototype does not include video playback…" | `:202-217` (`:213-215`) | Demo | Lesson viewer N4 |

**Actions**: Watch intro → lesson viewer (N4). Buy Now → as Screen 15. Clicking a lesson row toggles it complete today (`useLearning.js:39-47`). Only the client stops this for unpurchased courses, by disabling the row (`LessonRow.jsx:31`), so the server must enforce it. In D5 a click opens the viewer and completion is automatic. Back.
**i18n**: about 30. **Demo copy**: `:213-215`. Q60–Q63.

---

## 17. Settings · Privacy & visibility — `/candidate/settings/privacy`

Files: `settings/pages/PrivacySettingsPage.jsx`, `settings/components/{SettingsLayout,SettingsCard,ToggleRow}.jsx`, `settings/data/settings.js`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Layout title "Your workspace. Your terms." + tabs Privacy & visibility / Notifications / Data & account / Billing | `SettingsLayout.jsx:6-11`, `:18-19` | Static | i18n |
| Card "Choose how you're discovered" / "Your resume isn't shared just because your profile is visible." | `PrivacySettingsPage.jsx:15-16` | Static | i18n |
| Toggles: `discoverable` "Profile visibility & recruiter discovery", `resumeVisible` "Resume visibility", `matchingConsent` "Matching consent" with descriptions | `PRIVACY_OPTIONS` (`settings.js:11-30`); values in `lwm.candidate.settings.privacy` (`settings.js:5`, page `:11`); defaults `{ discoverable:true, resumeVisible:false, matchingConsent:true }` (`settings.js:8`) | Device | `GET /api/candidate/settings` → `privacy` |
| Note "These are local prototype preferences. No personal information is transmitted to a recruitment service." | `PrivacySettingsPage.jsx:31` | Demo | Rewrite |

**Action**: toggle → `PATCH /api/candidate/settings/privacy { [key]: boolean }` → 200 (optimistic). **Enforcement**: none today; no recruiter or admin code reads these flags (verified by grep), so Q68 applies. D5: the certificate badge's visibility may need a toggle (Q62). **i18n**: about 12. Q62, Q68.

## 18. Settings · Notifications — `/candidate/settings/notifications`

`NotificationSettingsPage.jsx`: card "Useful updates. Less noise." (`:12`); toggles from `NOTIFICATION_OPTIONS` (`settings.js:32-43`): `inApp` "Show a notification indicator when new recommendations are available." and `email` "Your preference for job digests and application updates. Email delivery is not connected in this demo." (`:41`, demo). Values in `lwm.candidate.settings.notifications` (`settings.js:6`, page `:9`), defaults `{ inApp:true, email:true }` (`settings.js:9`). **Action**: `PATCH /api/candidate/settings/notifications`. **Email categories** (decided): job alerts, application-stage updates, message updates, verification and forgot password, plus D1 links, D5 certificates and payment emails, so Q69 covers which ones the toggle controls. **i18n**: about 6. Q4, Q69.

## 19. Settings · Data & account — `/candidate/settings/data-account`

Files: `settings/pages/DataAccountSettingsPage.jsx`, `settings/utils/localData.js`, `client/src/utils/downloadCsv.js`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Notice "This interactive prototype stores reviewed profile fields… No real account or server-side data exists." | `DATA_NOTICE` (`settings.js:2-3`), page `:93` | Demo | Real data/retention notice |
| Status line (results survive the reload via `sessionStorage` flag `lwm.session.candidateData`) | `localData.js:16-20,58-72`; page `:67-69` | Session | Ordinary toast after the API call |
| Confirm dialogs: resume "Delete resume reference?", data "Delete local candidate information?" (body mentions "only Reset demo clears them"), reset "Reset demo workspace?" | `CONFIRMATIONS` (`:29-45`) | Demo | Rewritten copy (Q70) |

**Actions**

| Control | Now | Server |
|---|---|---|
| Export data → `candidate-profile.csv` | Client CSV `profileExportRows` (`localData.js:77-111`): Name, Current role, Location, Open to opportunities, Experience, Skills (`; ` joined), Education, Work preference, Minimum salary, Live CV file name, CV versions count, Phone verified, 3 check statuses, 3 privacy flags, 2 notification flags; `downloadCsv` (`utils/downloadCsv.js:7-17`); message "…created in your browser and not sent anywhere." (`:73`) | `GET /api/candidate/export` (CSV or ZIP, Q71), headers in the user's language; D3 adds work history, education, languages, right to work, links and certificates |
| Delete resume → confirm | `setCv(EMPTY_CV)` (`:79-81`) | `DELETE /api/candidate/cv` → deletes all versions and files (Q47); profile becomes incomplete (D3) |
| Delete my data → confirm | `deleteCandidateData` (`localData.js:47-55`): removes `lwm.candidate.*` except settings; sets profile `null`, CV empty, learning `{purchased:[],completedLessons:{}}`, saved/applications/alerts `[]`; reloads. **It misses the `lwm.ai-insights.*` keys** (prefix `lwm.ai-insights.`, `useInsightsState.js:5`), so AI state survives deletion | `DELETE /api/candidate/account` or `/data` (Q70); must also cover AI state, messages, notifications, embeddings, CV/evidence/photo files, certificates, and the Stripe subscription |
| Reset demo → confirm | `resetDemoData` removes every `lwm.` key (`localData.js:39-41`) | **Remove** (decided) |

**i18n**: about 25. **Demo copy**: `settings.js:2-3`; page `:32,36-37,41-43,73,81,103,116,123-125`. **Cross-role**: deletion removes the candidate from recruiter search, shortlists, pipeline and applications and from admin lists; payment records are kept (decided). Q47, Q70, Q71.

## 20. Settings · Billing — `/candidate/settings/billing`

Files: `settings/pages/BillingSettingsPage.jsx`, `payments/components/PaymentsTable.jsx`, `payments/data/payments.js`, `payments/hooks/usePayments.js`.

| Item | Current source | Static? | Must become |
|---|---|---|---|
| Card description "AI insights is part of AI Matches Plus. Plans are paid through a demo checkout and nothing is really charged." | `BillingSettingsPage.jsx:32` | Demo | D4 copy |
| Plan name + **"Active" pill always** (also for Free) | `:35-39`; `PLANS[plan]` (`:23`) | Static | `subscription.{ planName, status }` with status labels (active, past_due, canceled-at-period-end…) (Q64) |
| "{price} {period} · Active since {date}" | `:41-44`; `formatPaymentDate` (`payments.js:24-26`, `toLocaleDateString('en-US')`) | Static locale | `startedAt`, `currentPeriodEnd`, `cancelAtPeriodEnd`, locale formatter |
| Upgrade to AI Matches Plus / Cancel plan | `:46-54` | — | Checkout session / cancel |
| Payment history description "…through the demo checkout. Declined attempts are listed too." | `:58` | Demo | Q65 |
| Table: Reference, Item, Type, Amount (`formatMoney` "£x.xx", `payments.js:21`), Method "Visa •••• 4242", Status Paid/Failed, Date | `PaymentsTable.jsx:19,34-43`; labels `PAYMENT_STATUS` (`payments.js:13-16`), `PAYMENT_KIND_LABEL` (`:18`) | Static `£` | `GET /api/candidate/payments` → `{ items:[{ reference, itemName, kind, amount, currency, method:{ brand, last4 }, status, at, receiptUrl }] }` |
| Rows = local records + `SEED_PAYMENTS` (`payments.js:38-45`), **filtered by payer name** `=== 'Alex Morgan'` (`usePayments.js:19-20`) | `lwm.payments` (`payments.js:11`, `usePayments.js:14`) | Device + Static | Filter by `payerId` |
| Empty state "No payments yet" | `:63` | Static | i18n |

**Actions**: Upgrade → checkout session (Screen 9). Cancel plan → confirm "Cancel AI Matches Plus?" / "AI insights will be locked again. This demo makes no further charges either way." (`:77-86`, description `:80`) → `POST /api/billing/subscription/cancel` → `{ cancelAtPeriodEnd:true, currentPeriodEnd }` (Q64). "Keep plan" closes. **New**: "Manage payment method" via the Stripe Customer Portal? (not in UI; Q64). Reference format `LWM-` + 5 digits from 01001 (`payments.js:31`, `usePayments.js:30`), currency `'GBP'` hard-coded (`payments.js:31`, `usePayments.js:32`).
**Webhooks**: `checkout.session.completed` (course → Enrollment + Payment; subscription → Subscription), `invoice.paid` (renewal Payment), `invoice.payment_failed`, `customer.subscription.updated|deleted`, `charge.refunded`. **i18n**: about 20 + 12 table. **D-impact**: D4 copy; the plan name is configurable (Q67). Q9, Q64, Q65, Q67.

---

## 21. Onboarding · Your story — `/candidate/onboarding/story`

Files: `onboarding/pages/StoryStepPage.jsx`, `onboarding/components/OnboardingStep.jsx` (eyebrow "Step {n} of 2 · {name}" at `:15`, `TOTAL_STEPS` 2 `onboarding/data/onboarding.js:3`), reuses `cv/components/UploadDropzone.jsx`.

| Item | Current source | Must become |
|---|---|---|
| Title "A better match starts with you." / lead | `:49-50` | i18n |
| Chosen file chip: name + size `formatFileSize` ("84 KB", "2.4 MB", English units, `onboarding/utils/onboarding.js:4-7`) + remove | `:70-76` | Uploaded CvVersion (name, size from the server) |
| Privacy copy "Your resume is processed in your browser. We don't upload the file…" | `:81-82` | Rewrite |
| Recorded resume name `lwm.candidate.onboarding.resumeName` | `:22-25`; `INITIAL_ONBOARDING` (`onboarding/data/onboarding.js:6`) | `onboarding.cvVersionId` |

**Actions**: choose/drop (same CV validation as Screen 7) → today it is only remembered; on Continue `addUpload` creates a live CV version (`:39-43`). Server: upload immediately with `POST /api/candidate/cv/versions`, then on Continue `PUT /api/candidate/onboarding { step:'story' }`. "I'll add my resume later" skips. **D-impact**: D3 (live CV required for completeness) and Q6 (onboarding scope). **i18n**: about 10.

## 22. Onboarding · Your preferences — `/candidate/onboarding/preferences`

`PreferencesStepPage.jsx`: WorkModePicker "How do you like to work?" (`:64-70`; tiles `WorkModePicker.jsx:11-25`, `WORK_MODES`); "Preferred location" with a datalist of `LOCATIONS` (US cities etc.) (`:71-84`, `:81`); "Minimum annual salary ($k)" (`:86`); submit "Find my next chapter" (`:94`); Back (`:58`). The initial values come from the stored profile or `INITIAL_PROFILE` (`:24-27`, so a brand-new user sees Alex's values).
**Validation** (`onboarding/utils/onboarding.js:10-23`): location required, ≤ 60 (`MAX_LOCATION_LENGTH` `data:10`) → "Enter your preferred location." / "Keep your location to 60 characters or fewer."; salary required, `/^\d+$/`, ≥ 1, ≤ 1000 (`MAX_SALARY_K` `data:9`) → "Enter your minimum annual salary in thousands, for example 120." / "Enter a whole number above 0, in thousands (120 means $120k)." / "Enter 1000 or less. The amount is in thousands (1000 means $1M)." (Q42).
**Action**: today it saves `lwm.candidate.onboarding` and merges into the profile **only if a profile exists** (`:43-46`), then goes to `/candidate/onboarding/plan` (`:47`). The inventory still says it goes to `/candidate/jobs` (`docs/FIGMA_SCREEN_INVENTORY.md:94`); the code wins. Server: `PUT /api/candidate/onboarding/preferences { workMode, location, salaryMin }` → updates or creates the (draft) profile (Q6). **i18n**: about 12. Q6, Q10, Q11, Q42.

## 23. Onboarding · Choose a plan — `/candidate/onboarding/plan`

`PlanStepPage.jsx`: eyebrow "Your profile is ready · Choose a plan" (with D3 the profile is probably *not* ready, so the copy must change), title and lead (`:34`). Free card from `PLANS.free` "£0 forever", features "Browse and apply to jobs / Basic job matches" (`subscription.js:12`; **"apply" becomes false under D2/D4**). Plus card (`:49-60`). "Continue with Free" calls `setPlan('free')` and then navigates to `/candidate/jobs` (`:21-24`), which **silently downgrades an existing Plus subscriber** (Q66). "Start AI Matches Plus" → checkout → `/candidate/ai-insights` (`:26-30`). Back (`:63`).
Server: `POST /api/candidate/onboarding/complete { plan:'free' }`; Plus goes through the checkout session with `success_url=/candidate/ai-insights`. **i18n**: about 12. Q6, Q14, Q66, Q67.

---

## 24. New decisions D1–D5: required changes

### D1 — Email verification by link before the first login
- **Changes**: candidate sign-up (`client/src/features/auth/pages/SignUpPage.jsx:28-36` currently calls `startSession('candidate')` and navigates to onboarding right away) must stop there and show a new **"Check your email"** screen (N7). Sign-in returns 403 `EMAIL_NOT_VERIFIED` with a "Resend link" action. The consent checkbox copy "I understand that this demo saves profile changes on this device. No real account is created." (`SignUpPage.jsx:88`) and the password hint "Don't use a real password in this demo." (`:73`) must change (auth scope, noted for completeness). The Verification page email row (`VerificationPage.jsx:74-78`) becomes truthful (always verified). Email change, if allowed, must re-verify (Q7).
- **New screens**: `/check-email` (after sign-up, with resend), `/verify-email?token=…` (success → sign in; expired → resend).
- **Entities**: `User.emailVerifiedAt`; `EmailToken { userId, purpose:'verify-email'|'reset-password'|'change-email', tokenHash, expiresAt, usedAt }`.
- **Endpoints**: `POST /api/auth/register { fullName, email, password, language, country }` → 201 (no JWT); `POST /api/auth/verify-email { token }` → 200; `POST /api/auth/resend-verification { email }` → 204 (rate-limited); `POST /api/auth/login` → 403 `EMAIL_NOT_VERIFIED`.
- **Emails**: verification link in the user's language. **Question**: Q7.

### D2 — Applying requires a complete profile AND the paid plan
- **Changed controls** (all must call the gate before applying): Overview card "Apply now" (`JobCard.jsx:112-121`), Job details "Apply now" (`JobDetailsPage.jsx:237-245`), AI summary "Apply Now" (`AiJobSummaryModal.jsx:26-33`), Job match "View role & apply" label (`JobMatchPage.jsx:139`), and re-apply after withdraw (`ApplicationsPage.jsx`, withdraw copy "You can apply again later" at `:124`).
- **New screen N3 — Apply gate modal**: lists the missing completeness items with links (from `missing[]`) and the plan state with "Upgrade" (checkout) when Free; the Apply button is enabled only when `gate.canApply`. The job card/detail DTO gets `gate: { canApply, planRequired, missing[] }` so the UI can label the button ("Complete your profile to apply" / "Upgrade to apply").
- **Copy that becomes false**: `PLANS.free.features` "Browse and apply to jobs" (`subscription.js:12`); Plan step eyebrow "Your profile is ready" (`PlanStepPage.jsx:34`).
- **Server**: `POST /api/candidate/applications` checks plan (402 `PLAN_REQUIRED`) and completeness (403 `PROFILE_INCOMPLETE`, `missing[]`) atomically. **Questions**: Q22, Q25.

### D3 — "Complete profile" definition
The required items (12) are compared below with what exists today.

| # | Required item | Exists today? | UI change (candidate) | Data |
|---|---|---|---|---|
| 1 | headline, location, about ≥ 20, years, ≥ 1 skill, work preference | Yes (`EditProfileModal.jsx:35-63`) | Keep; `degree`/`institution` move to item 3 | `CandidateProfile` core fields |
| 2 | Work history entries (employer, title, start–end) | **No** | New "Work history" section on My profile + add/edit/delete dialog; shown to recruiters (recruiter profile "Experience" tab exists) | `workHistory[{ employer, title, startDate, endDate|null, current }]` (Q31) |
| 3 | Education entries (institution, degree, dates) | Only a single `degree` + `institution` (`profile.js:13-14`) | Replace the line (`ProfilePage.jsx` Education section) with a list + dialog; migrate the seed | `education[{ institution, degree, startDate, endDate|null }]` (Q32) |
| 4 | Languages with level A1–C2 / native | **No** | New section + dialog (language picker + level select) | `languages[{ code, level:'A1'|'A2'|'B1'|'B2'|'C1'|'C2'|'native' }]` (Q33) |
| 5 | EU/UK right to work per country (citizen / permit / needs sponsorship) | **No** | New section: per-country rows | `rightToWork[{ countryCode, status:'citizen'|'permit'|'needs-sponsorship', permitExpiry? }]` (Q34) |
| 6 | Profile photo | **No** (initials only, `profileText.js:11-18`; static header avatar `workspaces.js:37-38`) | Upload/crop control on My profile; used in header, sidebar, profile menu, recruiter views | `photo { path, mime, size, width, height, updatedAt }`; `POST /api/candidate/profile/photo` (multipart), `DELETE …/photo` (Q2) |
| 7 | Links (LinkedIn / portfolio) | **No** (Overview "Add your portfolio" checklist `ProfileStrengthCard.jsx:10`, Improve "Add portfolio" `insights.js:108-115` point to a missing field) | Links section + validation | `links { linkedinUrl, portfolioUrl }` (Q35) |
| 8 | Live CV (PDF/DOCX) | Yes (CV page) | Checklist item links to CV page | `liveCvVersionId` |
| 9 | Phone verified (code on screen) | Partly (demo confirm, `VerificationPage.jsx:108`) | Real code flow | `phoneVerifiedAt` (Q40) |
| 10 | Admin-approved verification checks | No (self "Mark as reviewed (demo)") | Remove self-approve; show In review / Approved / Rejected | `checks.*.status` (Q36, Q37) |

- **New screen N2 — completeness checklist**: one component reused on Overview (replaces `ProfileStrengthCard.jsx`), Improve profile (replaces `PROFILE_COMPLETENESS`/`IMPROVEMENTS`), the Apply gate N3, the sidebar promo, and My profile. **Endpoint**: `GET /api/candidate/profile/completeness` → `{ complete, done, total, items:[{ id, done, route, reason? }] }`, computed on the server and also embedded in `/api/me`.
- **My profile** turns from one dialog (`EditProfileModal.jsx`) into section cards with per-section editors. Endpoints: `PUT /api/candidate/profile` (core), `POST|PATCH|DELETE /api/candidate/profile/work-history[/:id]`, `…/education[/:id]`, `…/languages[/:id]`, `PUT /api/candidate/profile/right-to-work`, `PUT /api/candidate/profile/links`, `POST|DELETE /api/candidate/profile/photo`.
- **Export CSV and Delete my data** must include the new data. Recruiter candidate views read the new fields (cross-role).
- **Questions**: Q2, Q6, Q30–Q36, Q42.

### D4 — What the paid plan unlocks
- **Gate (402 `PLAN_REQUIRED`) and an upsell in the UI for**:
  - AI job summary (`AiSummaryButton.jsx` on Find jobs `:58`, Job details `:179`, Applications `:90`) and the profile summary (`ProfilePage.jsx` "Ai Job Summary").
  - The five AI insights pages (already gated by `PlusGate`).
  - Match explanations: JobCard disclosure (`JobCard.jsx:91-105,124-128`), Job details "Why this job matches you" (`JobDetailsPage.jsx:201-210`), Overview teaser (`InsightCard.jsx`).
  - CV assisted draft (`CvVersionsPage.jsx` button) and CV-based matching (scores/labels; Q14).
  - AI translation (Q74).
  - Applying (D2).
  - Starting and replying to messages (Free can read).
  - Job alerts (whole page `/candidate/job-alerts`, sidebar item shows a lock; Q28).
- **Not gated**: browsing and searching jobs, saving jobs, profile/CV/verification, learning purchases (courses stay one-time).
- **Copy changes**: `PLANS` features and the Free list (`subscription.js:12,19`), PlusGate title/lead (`PlusGate.jsx:23-24`), Billing description (`BillingSettingsPage.jsx:32`), cancel dialog "AI insights will be locked again…" (`:80`), Learning pill (`LearningPage.jsx:48`).
- **Server**: `requirePlan('plus')` middleware; plan state in `/api/me` so the UI can show locks; lapse/downgrade rules (Q25, Q28). **Questions**: Q14, Q25, Q28, Q67, Q73, Q74.

### D5 — Learning: mixed lessons, auto-completion, final quiz, certificate, badge
- **Changed**:
  - `LessonRow.jsx` loses the manual "Mark complete" toggle (`:27-46`) and shows type icon, duration and viewed state.
  - `useLearning.js` progress (`:10-23`, `:39-47`) becomes server-side.
  - `LearningDetailsPage.jsx`: curriculum shows types; progress card shows lessons viewed + quiz status + certificate download; INCLUDED list (`:13`) becomes data-driven; intro modal (`:202-217`) replaced by the viewer; "Evidence, not a shortcut." copy (`:190-197`) must mention the quiz.
  - `LearningPage.jsx` "Completion badges" stat (`:64-69`) = certificates.
  - `CourseCard.jsx` adds progress/completed state.
  - My profile gets a "Certificates & badges" section visible to recruiters.
- **New screens**:
  - **N4 Lesson viewer** `/candidate/learning/:courseId/lessons/:lessonId`: video player (reports watched %, completes at about 90%), text renderer (completes on open), PDF/document viewer (completes on open), external link (completes on click; Q60); previous/next.
  - **N5 Quiz** `/candidate/learning/:courseId/quiz`: unlocked per Q61; questions, submit, score, pass/fail (pass ≥ about 70%), retake rules.
  - **N6 Certificates**: list + PDF download.
  - **N7 public** `/certificates/verify/:code`: verification page.
- **Entities**: `Lesson { courseId, order, type:'video'|'text'|'document'|'link', title, durationSec?, videoPath?, body?, documentPath?, url?, freePreview }`; `Quiz { courseId, passMarkPct:70, questions:[{ id, prompt, type, options[], correct[] }] }`; `QuizAttempt { candidateId, courseId, answers, scorePct, passed, submittedAt }`; `LessonProgress` inside `Enrollment.lessons[{ lessonId, watchedPct, viewedAt }]`; `Certificate { candidateId, courseId, code (unique, random), issuedAt, nameSnapshot, courseTitleSnapshot, language, pdfPath }`.
- **Endpoints**:
  - `GET /api/candidate/learning/courses/:courseId/lessons/:lessonId` (403 when not enrolled and not `freePreview`)
  - `GET /api/media/lessons/:lessonId` (authenticated stream with HTTP Range)
  - `POST /api/candidate/learning/lessons/:lessonId/progress { watchedPct }` or `{ opened:true }`
  - `GET /api/candidate/learning/courses/:courseId/quiz` (no answers)
  - `POST /api/candidate/learning/courses/:courseId/quiz/attempts { answers }` → `{ scorePct, passed, certificate? }`
  - `GET /api/candidate/certificates`, `GET /api/candidate/certificates/:id/pdf`
  - public `GET /api/public/certificates/:code`
  - Admin authoring is in admin scope.
- **Questions**: Q60–Q63, Q70.

---

## 25. Messages (N1, decided) and in-app notifications

- **Messages** (decided: two-way inbox, "Messages" sidebar item, polling about every 15 s, unread badge; D4: Free can read, Plus can reply and start). No candidate UI exists. The only related recruiter code is `recruiter/find-candidates/components/MessageModal.jsx` ("Create message preview", required text "Write a message before creating the preview.").
- **New screens**: inbox list (counterpart, company, job, last message, time, unread) and a thread view with a composer. The composer is disabled with an upsell for Free.
- **Entities**: `Conversation { participants:[userId], candidateId, recruiterId, companyId, jobId?, applicationId?, lastMessageAt, unread:{ [userId]: n } }`, `Message { conversationId, senderId, body, createdAt, readAt }`.
- **Endpoints**: `GET /api/messages/conversations?page=`, `GET /api/messages/conversations/:id/messages?after=`, `POST /api/messages/conversations` (start; Plus), `POST /api/messages/conversations/:id/messages { body }` (Plus), `POST /api/messages/conversations/:id/read`, `GET /api/candidate/badges` (unread).
- **Emails**: message updates in the user's language (throttling Q73). Translation on demand (Plus, Q74). **Questions**: Q29 (length), Q73, Q74.
- **Notifications**: the bell dot (`Header.jsx:171`) and the `inApp` toggle imply a `Notification { userId, type:'application-status'|'job-alert'|'verification'|'message'|'certificate'|'payment', payload, readAt, createdAt }` collection; `GET /api/notifications?unread=1`, `POST /api/notifications/read` (Q4).

---

## 26. Entities (candidate-relevant; types, enums and defaults as found in code + D1–D5)

| Entity | Fields (type, enum, default) | Source in code |
|---|---|---|
| **User** | `role:'candidate'|'recruiter'|'admin'`; `email` (unique, `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, `auth/utils/validation.js:7`); `passwordHash` (min 8, `validation.js:8`); `fullName`; `emailVerifiedAt` (D1); `language:'en'|'es'|'fr'`; `country` (EU 27 ISO2 + `GB` + `REMOTE`); `planId` (derived from Subscription); `onboardingCompletedAt` (Q6); `createdAt`, `lastLoginAt` | `app/workspaces.js:37`; `auth/pages/SignUpPage.jsx:24`; `preferencesContext.js:4,7` |
| **EmailToken** (D1) | `userId, purpose:'verify-email'|'reset-password'|'change-email', tokenHash, expiresAt, usedAt` | new |
| **CandidateProfile** | `userId`; `headline` (≤ 60, req); `location` (≤ 60, req; structured per Q11); `openToOpportunities:boolean = true`; `about` (20–600); `yearsExperience:int 0–50`; `skills:[{ name ≤ 30, source:'profile'|'skill-gap-review'|'cv' }]` (1–12, unique case-insensitive); `workMode:'Remote'|'Hybrid'|'On-site'`; `salaryMin:int|null` (thousands 0–1000 today; Q10, Q42); **D3**: `workHistory[{ employer, title, startDate, endDate|null, current }]`, `education[{ institution, degree, startDate, endDate|null }]` (replaces `degree`/`institution`), `languages[{ code, level:'A1'|'A2'|'B1'|'B2'|'C1'|'C2'|'native' }]`, `rightToWork[{ countryCode, status:'citizen'|'permit'|'needs-sponsorship', permitExpiry? }]`, `photo{ path, mime, size, w, h }`, `links{ linkedinUrl, portfolioUrl }`; `liveCvVersionId`; `learningPlan:[skill]`; `embedding:[number], embeddingUpdatedAt`; `updatedAt` | `profile/data/profile.js:4-33`; `EditProfileModal.jsx:28-63`; `useInsightsState.js:23-26` |
| **Onboarding** (embedded in the profile) | `cvVersionId|null` (was `resumeName`), `workMode, location, salaryMin`, `completedAt` | `onboarding/data/onboarding.js:6` |
| **CandidateSettings** | `privacy{ discoverable:true, resumeVisible:false, matchingConsent:true }`; `notifications{ inApp:true, email:true }` | `settings/data/settings.js:8-9` |
| **CandidateUiState** | `dismissedTeasers:[id]` | `InsightCard.jsx:10` |
| **Company** (recruiter-owned, read-only here) | `name, logoUrl? (Q18), industry, size` (`'1–10 employees'…'1,000+ employees'`; mock jobs use other values such as '5,000+ employees'), `description, location, website, approved` | `recruiter/company/data/company.js:7-24`; `jobs/data/jobs.js:32,56,80` |
| **Job** (recruiter-owned) | `status:'published'|'paused'|'draft'|'closed'`; `title`; `companyId`; `description`; `tagline?` (Q17); `location` (Q11); `workPreference:'Remote'|'Hybrid'|'On-site'`; `employmentType:'Full-time'|'Part-time'|'Contract'|'Internship'`; `level:'Junior'|'Mid-level'|'Senior'|'Lead'`; `experienceYears:int`; `requiredSkills[]`; `preferredSkills[]`; `responsibilities[]`; `perks[]?` (Q17); `salary{ min, max, currency }` (Q10); `publishedAt`; `moderation` (Q19); `embedding` | `recruiter/jobs/data/jobs.js:1-25`; `recruiterJobs.js:23-64`; `JobFiltersModal.jsx:5-9` |
| **JobMatch** (computed per candidate × job, cached) | `score:0–100`, `label:'strong'|'good'|null`, `matchedSkills[]`, `missingSkills[]`, `workPreferenceAligned`, `yearsMet`, `locationAligned`, `alignment:'work-preference-aligned'|'relevant-experience'`, `computedAt` | `jobUtils.js:20-31`; `matching.js:8-73`; `recruiterJobs.js:27-28,41-42,52` |
| **SavedJob** | `candidateId, jobId, createdAt`; unique pair. Also replaces saved roles (Q51) | `useSavedJobs.js`; `useInsightsState.js:28-31` |
| **Application** | `candidateId, jobId, companyId, status:'applied'|'under-review'|'interview'|'withdrawn'` (+ `offer|hired|not-selected` per Q21), `appliedAt`, `withdrawnAt`, `cvVersionId`, `coverNote?`, `consentAt` (Q22), `history[{ status, at, actorId }]`, `jobSnapshot{ title, companyName, logo }`, `recruiterStageId` | `jobs/data/applications.js:2-24`; `useApplications.js` |
| **JobAlert** | `candidateId, name, keywords, location:'', frequency:'Daily'|'Weekly'` (+ `'Instant'` per Q26), `active:true, createdAt, lastRunAt, lastSentAt, sentJobIds[]` | `job-alerts/data/alerts.js`; `JobAlertModal.jsx` |
| **CvVersion** | `candidateId, version:int, fileName, storagePath, mimeType, sizeBytes (≤ 10 MB), createdAt, source:'candidate-upload'|'ai-draft', tag?, approved:boolean, note, snapshot{ role, experience, skills[] }, extractedText, embedding, deletedAt` | `cv/data/cvVersions.js`; `cv/utils/cvVersions.js` |
| **CvAccessRequest** (Q46) | `cvVersionId, recruiterId, reason` (from `EarlierVersionModal.jsx` REASONS), `details, status:'pending'|'approved'|'declined', decidedAt` | `recruiter/find-candidates/components/EarlierVersionModal.jsx:5-10` |
| **Verification** | `candidateId, phone, phoneE164, phoneVerifiedAt, phoneCode{ hash, expiresAt, attempts }`; `checks.{identity|academic|employment}: null | { status:'in-review'|'verified'|'rejected'(Q37), evidenceType, fileName, storagePath, mime, size, confirmed:true, submittedAt, reviewedAt, reviewedBy, rejectionReason }`. Evidence types: identity `Passport|Driving licence|National identity card`; academic `Degree certificate|Diploma|Official transcript`; employment `Employment letter|Contract page|Verified reference` | `verification/data/verification.js:10-42`; `VerificationPage.jsx:14-15` |
| **AiCache** | `kind:'job-summary'|'job-comparison'|'profile-summary'|'insights-overview'|'skill-guidance'|'job-match'|'why-recommended'|'improve-profile'|'cv-draft'|'translation'`, `ownerId?, jobId?, skill?, language, inputHash, output, model, tokens, createdAt` | new |
| **ExplanationFeedback** | `candidateId, jobId, value:'helpful'|'needs-review', at` | `useInsightsState.js:34-44` |
| **Course** (admin-owned) | `audience:'candidate'|'recruiter', title, category, level:'Foundation'|'Intermediate'|'Advanced', summary, about, outcomes[], price{ amount, currency }` (Q9, Q57), `status:'published'|'draft'`, `coverImageUrl`, `skills[]` (Q52), `language` (Q59), `updatedAt`; tier/recommended removed (Q52, Q58) | `learning/data/courses.js:24-163`; `admin/courses/data/courses.js:3-28` |
| **Lesson** (D5) | `courseId, order, type:'video'|'text'|'document'|'link', title, durationSec?, videoPath?, body?, documentPath?, url?, freePreview:boolean` | new (today `{ id, title }`, `courses.js:24-26`) |
| **Quiz / QuizAttempt** (D5) | `Quiz{ courseId, passMarkPct:70, questions[{ id, prompt, type:'single'|'multiple', options[], correct[] }] }`; `QuizAttempt{ candidateId, courseId, answers, scorePct, passed, submittedAt }` | new |
| **Enrollment** | `candidateId, courseId, purchasedAt, paymentId|null, lessons[{ lessonId, watchedPct, viewedAt }], quizPassedAt, completedAt` (was `{ purchased[], completedLessons{} }`) | `courses.js:4-7`; `useLearning.js:10-23` |
| **Certificate** (D5) | `candidateId, courseId, code (unique), issuedAt, nameSnapshot, courseTitleSnapshot, language, pdfPath, revokedAt` | new |
| **Plan** (Q67) | `id:'free'|'plus', name{ en, es, fr }, prices[{ currency, amount, stripePriceId }], interval:'month', features[]` | `billing/data/subscription.js:11-21` |
| **Subscription** | `userId, planId, status` (Stripe: `active|trialing|past_due|canceled|unpaid|incomplete`), `startedAt, currentPeriodEnd, cancelAtPeriodEnd, stripeCustomerId, stripeSubscriptionId, currency, amount`. Today `{ plan:'free'|'plus', status:'active', startedAt, paymentId? }` or `null` = Free | `subscription.js:3-9`; `useSubscription.js:9-13` |
| **Payment** | `reference` (`LWM-` + 5 digits from 01001), `at, payerId, payerRole:'candidate'|'recruiter', payerName (snapshot), kind:'course'|'subscription', itemId, itemName, amount, currency` (`'GBP'` today), `method{ brand, last4 }, status:'paid'|'failed'` (+ `refunded`?), `failureReason, stripe{ sessionId, paymentIntentId, invoiceId }, receiptUrl` | `payments/data/payments.js:1-45`; `usePayments.js:23-40` |
| **ProfileView** (Q72) | `candidateId, recruiterId, companyId, day, at` | `OverviewPage.jsx:83` |
| **Conversation / Message** | see section 25 | decided |
| **Notification** | see section 25 | `Header.jsx:171`; `settings.js:32-37` |
| **EmailOutbox** | `to, template, language, payload, status, attempts, sentAt` (no Redis: a Mongo-backed queue with a cron worker) | decided SMTP |

---

## 27. Endpoints (candidate-facing; JWT, `role=candidate` unless noted)

| Method + path | Payload → response | Screens |
|---|---|---|
| `POST /api/auth/register` | `{ fullName, email, password, language, country }` → 201 (no token) | sign-up (D1) |
| `POST /api/auth/verify-email` / `POST /api/auth/resend-verification` | `{ token }` / `{ email }` | N7 |
| `POST /api/auth/login` | → `{ token, user }`; 403 `EMAIL_NOT_VERIFIED` | sign-in |
| `GET /api/me`, `PATCH /api/me` | → user + plan + completeness summary; `{ language?, country?, fullName? }` | shell, all |
| `GET /api/meta/countries`, `/plans`, `/verification-checks`, `/upload-limits`, `/job-filters` | config lists | shell, 2, 7, 8, 9 |
| `GET /api/candidate/badges` | → `{ activeApplications, unreadMessages, unreadNotifications }` (poll 15 s) | shell |
| `GET /api/candidate/overview` | → `{ matches, stats, teaser, recentApplications, completeness, verification }` | 1 |
| `POST /api/candidate/ui-state/dismiss-teaser` | `{ teaserId }` → 204 | 1 |
| `GET /api/jobs` | `?q&location&workModes&levels&match&sort&page&limit` → `{ items, total, page, pageSize }` | 1, 2 |
| `GET /api/jobs/recommended` | `?limit` → items (Plus; Free per Q14) | 1 |
| `GET /api/jobs/:jobId` | → `{ job, company, match|null, viewer, gate }` | 3 |
| `POST /api/jobs/:jobId/ai-summary` | → `{ summary, comparison, language, generatedAt }` (Plus) | 2, 3, 4 |
| `POST /api/translate` | `{ entity, id, fields[], target }` → `{ translations }` (Plus) | 3, messages |
| `GET /api/candidate/saved-jobs`, `PUT`/`DELETE /api/candidate/saved-jobs/:jobId` | list / 204 | 1, 2, 3, 13 |
| `GET /api/candidate/applications`, `GET /api/candidate/applications/:id` | `?status&exclude&page&limit&sort` → list / detail + history | 1, 4 |
| `POST /api/candidate/applications` | `{ jobId, cvVersionId?, coverNote?, consent }` → 201; 402/403/409/410/422 | 1, 2, 3, 4 |
| `POST /api/candidate/applications/:id/withdraw` | → `{ status, withdrawnAt }` | 4 |
| `GET/POST /api/candidate/job-alerts`, `PATCH/DELETE /api/candidate/job-alerts/:id` | `{ name, keywords, location, frequency, active }` (Plus) | 5 |
| `GET/PUT /api/candidate/profile` | core fields → profile / 422 | 6, 22 |
| `GET /api/candidate/profile/completeness` | → `{ complete, done, total, items[] }` | 1, 6, 12, N2, N3 |
| `POST/PATCH/DELETE /api/candidate/profile/work-history[/:id]`, `…/education[/:id]`, `…/languages[/:id]`; `PUT …/right-to-work`, `PUT …/links`; `POST/DELETE …/photo` | D3 sections | 6 |
| `POST /api/candidate/profile/skills`, `DELETE /api/candidate/profile/skills/:skill` | `{ skill, source, confirmed }` | 11 |
| `PUT/DELETE /api/candidate/learning-plan/:skill` | 204 | 11, 12 |
| `POST /api/candidate/profile/ai-summary` | → `{ summary }` (Plus) | 6 |
| `GET /api/candidate/cv` | → `{ liveVersionId, versions }` | 6, 7 |
| `POST /api/candidate/cv/versions` | multipart `file` (PDF/DOCX ≤ 10 MB) → 201 | 7, 21 |
| `POST /api/candidate/cv/versions/draft` | → 201 (Plus) | 7 |
| `POST /api/candidate/cv/versions/:id/approve` | → `{ liveVersionId }` | 7 |
| `GET /api/candidate/cv/versions/:id/file`, `DELETE /api/candidate/cv/versions/:id` | Q45 | 7 |
| `DELETE /api/candidate/cv` | delete all versions and files | 19 |
| `GET/POST /api/candidate/cv/access-requests[/:id/decision]` | Q46 | 7 |
| `GET /api/candidate/verification` | → phone + checks | 1, 8 |
| `POST /api/candidate/verification/phone/code`, `…/phone/confirm` | `{ phone }` → `{ code, expiresAt }`; `{ phone, code }` → `{ phoneVerifiedAt }` | 8 |
| `POST /api/candidate/verification/checks/:checkId` | multipart `{ evidenceType, file, confirmed }` | 8 |
| (admin) `GET /api/admin/verifications`, `GET …/:id/file`, `POST …/:id/decision` | `{ decision, reason? }` | cross-role |
| `GET /api/candidate/insights/overview`, `/roles`, `/skill-gap?jobId`, `/improve-profile`, `/job-match?jobId`, `/why-recommended?jobId` | DTOs in sections 10–14 (Plus) | 10–14 |
| `PUT /api/candidate/insights/feedback/:jobId` | `{ value }` | 14 |
| `GET /api/courses`, `GET /api/courses/:id` | `?audience=candidate&level&skill` | 15, 16 |
| `GET /api/candidate/learning`, `/learning/recommended`, `/learning/enrollments/:courseId` | stats, gap courses, progress | 15, 16 |
| `POST /api/candidate/learning/enrollments` | `{ courseId }` (free only) | 15, 16 |
| `GET /api/candidate/learning/courses/:courseId/lessons/:lessonId`; `GET /api/media/lessons/:lessonId` (Range) | lesson / stream | N4 |
| `POST /api/candidate/learning/lessons/:lessonId/progress` | `{ watchedPct }` or `{ opened:true }` | N4 |
| `GET /api/candidate/learning/courses/:courseId/quiz`; `POST …/quiz/attempts` | `{ answers }` → `{ scorePct, passed, certificate? }` | N5 |
| `GET /api/candidate/certificates`, `GET …/:id/pdf`; public `GET /api/public/certificates/:code` | list / PDF / verification | N6, N7 |
| `POST /api/billing/checkout-session` | `{ kind:'subscription', planId }` or `{ kind:'course', courseId }` → `{ url }` | 9, 15, 16, 20, 23 |
| `GET /api/candidate/subscription`, `POST /api/billing/subscription/cancel`, `POST /api/billing/portal-session` | Q64 | 9, 20 |
| `GET /api/candidate/payments` | list | 20 |
| `POST /api/stripe/webhook` | Stripe events (raw body, signature check) | — |
| `GET /api/candidate/settings`, `PATCH …/settings/privacy`, `PATCH …/settings/notifications` | toggles | 17, 18 |
| `GET /api/candidate/export`, `DELETE /api/candidate/account` | Q70, Q71 | 19 |
| `PUT /api/candidate/onboarding`, `PUT …/onboarding/preferences`, `POST …/onboarding/complete` | steps | 21–23 |
| `GET/POST /api/messages/conversations[/:id/messages]`, `POST …/:id/read` | section 25 | N1 |
| `GET /api/notifications`, `POST /api/notifications/read` | Q4 | shell |

---

## 28. Static items to replace (every one cites file:line)

Paths are short paths (see header): candidate folders sit under `client/src/features/candidate/`; `app/`, `components/`, `hooks/` and `utils/` sit under `client/src/`.

| # | Location | Static item → replacement |
|---|---|---|
| S1 | `app/workspaces.js:37` | Demo user `{ name:'Alex Morgan', subtitle:'Personal account', avatar }` → `/api/me` + photo |
| S2 | `app/workspaces.js:38` | Header avatar SVG → profile photo |
| S3 | `app/workspaces.js:39` | `showWorkspaceSwitch:true` → remove switch |
| S4 | `app/workspaces.js:42-47` | Promo copy/target → i18n + completeness |
| S5 | `app/workspaces.js:51,56` | Applications badge from localStorage; "AI" badge → `/badges`, i18n |
| S6 | `components/layout/preferencesContext.js:4` | `LOCATIONS` (US/DE cities) → countries |
| S7 | `components/layout/preferencesContext.js:7` | `LANGUAGES` labels → i18n config |
| S8 | `components/layout/WorkspacePreferences.jsx:7-8` | Keys `lwm.location`, `lwm.language` → `User.country/language` |
| S9 | `components/layout/Header.jsx:79,171`; `ProfileMenu.jsx:70` | Location note; permanent bell dot |
| S10 | `components/layout/WorkspaceLayout.jsx:30,33` | "© 2026…", "Interactive demo · Changes saved on this device" |
| S11 | `features/auth/utils/session.js:8-9` | `lwm-session` marker → JWT |
| S12 | `hooks/useCountUp.js:38` | `toLocaleString('en-US')` → user locale |
| S13 | `overview/pages/OverviewPage.jsx:39,47,51,58,74,83` | First-3 "For you"; date; "up to date"; greeting; KPI 6/+6; KPI 18/↑12% |
| S14 | `overview/components/ProfileStrengthCard.jsx:7-11,25` | Checklist + 85% → D3 completeness |
| S15 | `overview/components/VerificationCard.jsx:7,29,35,38` | Checks, "Not started", "0 of 3", "Premium jobs locked" |
| S16 | `overview/components/InsightCard.jsx:10,23-28` | Dismiss key; teaser text |
| S17 | `jobs/data/jobs.js:8-9,11-294,297-321` | Mock logos, 12 mock jobs, `ROLE_DETAILS` → Job/Company from DB (seed EU data) |
| S18 | `jobs/data/recruiterJobs.js:8-9,17-20,41-42,46-47,52-53,57-63` | `acme-` prefix + colours; tagline; label/aiMatch; k-units; alignment/posted; detail fallbacks (perks `:62`) |
| S19 | `jobs/data/jobUtils.js:3-5,9,12-17,20-22,24-26,29-31,33-37,39,42-62` | jobPath, `$` salary, English relative time, profileMatch, experienceTag, tone-by-label, sort options, filters, client search/sort |
| S20 | `jobs/data/applications.js:2-7,10,13-17,19,22-24` | Status map, steps, seed applications, seed saved ids, `en-US` date |
| S21 | `jobs/hooks/useApplications.js:5-10,14,22`; `useSavedJobs.js:7`; `useJobListings.js:15-17` | Client date, key, id format; saved key; reads recruiter/company/profile keys |
| S22 | `jobs/components/JobFiltersModal.jsx:5-9` | Filter option lists |
| S23 | `jobs/components/JobCard.jsx:14-22,77` | Why-template; "/ year" |
| S24 | `jobs/components/AiJobSummaryModal.jsx:40,43-49,65-66` | "Local evidence-based preview"; template summary; hard-coded "5 years… remote" |
| S25 | `jobs/pages/JobDetailsPage.jsx:83-84,102,153,204` | Hard-coded "Matches your work preference"; "5 years"; ROLE_DETAILS fallback; link without job id |
| S26 | `jobs/pages/FindJobsPage.jsx:17,35,92` | Page size; summary of first result; hint |
| S27 | `job-alerts/data/alerts.js:2-19,21`; `hooks/useJobAlerts.js:7`; `components/JobAlertModal.jsx:36,50`; `pages/JobAlertsPage.jsx:63` | Seed alerts, frequencies, key, client id, demo copy |
| S28 | `profile/data/profile.js:1,4-17,20-31,33` | Key, seed profile, blank profile, work modes |
| S29 | `profile/utils/profileText.js:3-5,7-9,21-31` | English plural, `$…k+ / year`, template summary |
| S30 | `profile/pages/ProfilePage.jsx:32,128-129,139`; `components/EditProfileModal.jsx:9,105,217,232`; `components/JobSummaryModal.jsx:32` | Device copy; MAX_SKILLS; name from seed; `$` hint; "No AI service is connected." |
| S31 | `cv/data/cvVersions.js:1,3,4-5,7-11,13,20-55,57` | Key, file name, limits, base snapshot, draft note, seed versions, empty CV |
| S32 | `cv/utils/cvVersions.js:3,6-10,34-48,51-65` | English months, date format, upload copies the previous snapshot, rule-based "AI" draft |
| S33 | `cv/pages/CvVersionsPage.jsx:35,47,85-86,120`; `components/ComparePanel.jsx:25`; `components/UploadDropzone.jsx:41` | Demo copy; limits text |
| S34 | `verification/data/verification.js:1,3,10-14,17-39,41-42` | Key, `alex@example.com`, initial state, checks copy, evidence limits |
| S35 | `verification/pages/VerificationPage.jsx:14-15,76-78,91,110,154`; `components/CheckRow.jsx:46`; `components/SubmitEvidenceModal.jsx:94` | Regex/labels (keep as rules), always-verified email, demo phone copy, self-review |
| S36 | `ai-insights/data/insights.js:7-15,18,19,22-31,34-95,98-102,104,107-148,150` | Duplicate PROFILE, counts 9/9, SKILL_DEMAND, 5 fake ROLES (salaries `:41,53,65,77,89`), guidance, improvements, 85% |
| S37 | `ai-insights/hooks/useInsightsState.js:5,13,24,29,35` | `lwm.ai-insights.*` keys |
| S38 | `ai-insights/utils/matching.js:8-19,26-35,38-73,80-82` | Client comparison/ranking against static PROFILE |
| S39 | `ai-insights/pages/AiInsightsPage.jsx:29-35,50-51,53,88,95-97,110-111` | Identity, stat 9, "5 yrs", bar note, Product Design insight, context copy |
| S40 | `ai-insights/pages/SkillGapPage.jsx:20,29,34`; `JobMatchPage.jsx:31,47-48,149`; `WhyRecommendedPage.jsx:19-23,38,47,62,84,105,190,207,234-235` | Default roles, static profile, device copy |
| S41 | `ai-insights/components/AiSafetyNotice.jsx:13-14`; `MatchCard.jsx:53,59`; `SourceEvidenceModal.jsx:13-15,33`; `GapCard.jsx:28,38`; `RolePicker.jsx:7` | Notice, static profile, guidance, role options |
| S42 | `billing/data/subscription.js:7,9,11-21,24-30` | Key, null=Free, PLANS (`£0`, `£9`, features), checkout item caption |
| S43 | `billing/hooks/useSubscription.js:7,9-13` | Local plan state |
| S44 | `payments/data/payments.js:11,13-19,21,24-26,28,30-32,38-45` | Key, labels, `£` formatMoney, `en-US` date, decline text, reference/currency `GBP`, 6 seed payments |
| S45 | `payments/hooks/usePayments.js:14,19-20,27-32` | Key, filter by payer **name**, reference counter, `GBP` |
| S46 | `payments/utils/card.js:5,9-60` | Demo decline card + card validation (replaced by Stripe) |
| S47 | `payments/components/CheckoutDialog.jsx:10,66,73,76,86,94,147-150` | Fake delay, payer name from WORKSPACES, demo copy |
| S48 | `settings/pages/BillingSettingsPage.jsx:32,37-39,43,58,80` | Demo copy, always-"Active", en-US date |
| S49 | `learning/data/courses.js:1,4-7,9,12,14,16-22,32-163` | Key, pre-purchased course, levels, "6", "Interaction Design", outcomes, built-in catalogue (prices `:40,59,78,101,124,147`) |
| S50 | `learning/hooks/useCourseCatalogue.js:7-26,32-40`; `features/admin/courses/utils/learnerCourse.js:5-18`; `features/admin/courses/data/courses.js:15-28` | Generated copy, 35 min/lesson, "Lesson N", admin seed prices |
| S51 | `learning/hooks/useLearning.js:5-7,10-23,27` | `£` price, client progress, key |
| S52 | `learning/pages/LearningPage.jsx:48,72,82,106-109`; `components/CourseCard.jsx:25,40`; `components/PurchaseDialog.jsx:13,21` | Pill, static stat, gap skill, demo note, stock photo, price, captions |
| S53 | `learning/pages/LearningDetailsPage.jsx:13,79,113,119,213-215` | INCLUDED, "3 min", "Preview · 3 minutes", "Pre-recorded lesson", prototype copy |
| S54 | `settings/data/settings.js:2-3,5-6,8,9,11-30,32-43` | Data notice, keys, defaults, options copy (`:41` demo) |
| S55 | `settings/utils/localData.js:8-20,39-41,47-55,77-111` | Prefixes/flags, reset, delete, client export |
| S56 | `settings/pages/DataAccountSettingsPage.jsx:29-45,73,81,123-127`; `PrivacySettingsPage.jsx:31` | Demo confirms, reset row, prototype note |
| S57 | `onboarding/data/onboarding.js:1,3,6,9-10` | Key, steps, initial state, limits |
| S58 | `onboarding/utils/onboarding.js:4-7,18-20` | English size units; `$120k`/`$1M` copy |
| S59 | `onboarding/pages/StoryStepPage.jsx:81-82`; `PreferencesStepPage.jsx:24-27,81,86`; `PlanStepPage.jsx:21-24,34` | Privacy copy; Alex defaults; US locations; "($k)"; silent downgrade; "Your profile is ready" |
| S60 | `utils/downloadCsv.js:7-17` | Client-side CSV → server export |

### 28a. Formatters and hard-coded currency / locale

| Formatter | Location | Problem |
|---|---|---|
| `formatSalary` | `jobs/data/jobUtils.js:8-10` | `$` + `k`, no currency |
| `formatPosted` | `jobs/data/jobUtils.js:12-17` | English, hours/days only |
| `experienceTag` | `jobs/data/jobUtils.js:24-26` | English "years" in data |
| `profileMatch` → "{x}%" | `jobs/data/jobUtils.js:20-22` | Percent without `Intl` |
| `formatApplied` | `jobs/data/applications.js:22-24` | `'en-US'` |
| `salaryLabel` | `profile/utils/profileText.js:7-9` | `$…k+ / year` |
| `experienceLabel` | `profile/utils/profileText.js:3-5` | English plural |
| `formatVersionDate` | `cv/utils/cvVersions.js:3,6-10` | English month array, 24 h clock |
| `validateCvFile` size text | `cv/utils/cvVersions.js:20` | `toFixed(1)` "MB" |
| `formatFileSize` | `onboarding/utils/onboarding.js:4-7` | "KB/MB" English |
| `formatMoney` | `payments/data/payments.js:21` | `£` |
| `formatPaymentDate` | `payments/data/payments.js:24-26` | `'en-US'` |
| `formatPrice` | `learning/hooks/useLearning.js:5-7` | `£` |
| `durationFor` | `features/admin/courses/utils/learnerCourse.js:12-18` | "2h 20m" |
| `useCountUp` | `hooks/useCountUp.js:38` | `'en-US'` |
| Card mask | `payments/components/PaymentsTable.jsx:37` | "•••• last4" (fine) |
| Hard-coded `$` in copy | `profile/components/EditProfileModal.jsx:217`; `onboarding/pages/PreferencesStepPage.jsx:86`; `onboarding/utils/onboarding.js:19-20`; `ai-insights/data/insights.js:41,53,65,77,89` | — |
| Hard-coded `£` | `billing/data/subscription.js:12,16` | — |
| Plurals hand-written | `FindJobsPage.jsx:99`, `JobFiltersModal.jsx:30`, `JobDetailsPage.jsx:83`, `MatchCard.jsx:36`, `AiInsightsPage.jsx:71`, `JobMatchPage.jsx:124` | Use i18next plurals |

### 28b. Demo-only copy that must change (all verified by grep)

- **Shell**: `WorkspaceLayout.jsx:33`.
- **Jobs**: `AiJobSummaryModal.jsx:40`.
- **Alerts**: `JobAlertsPage.jsx:63`; `JobAlertModal.jsx:50`.
- **Profile**: `ProfilePage.jsx:32,128,129,139`; `EditProfileModal.jsx:232`; `JobSummaryModal.jsx:32`.
- **CV**: `CvVersionsPage.jsx:35,47,85-86,120`; `ComparePanel.jsx:25`.
- **Verification**: `VerificationPage.jsx:91,110`; `CheckRow.jsx:46`; `SubmitEvidenceModal.jsx:94`.
- **AI insights**: `AiInsightsPage.jsx:51,88,110-111`; `SkillGapPage.jsx:34`; `GapCard.jsx:28`; `JobMatchPage.jsx:149`; `WhyRecommendedPage.jsx:84,105,190,207,234-235`; `AiSafetyNotice.jsx:14`; `SourceEvidenceModal.jsx:33`.
- **Learning**: `LearningPage.jsx:48,106-109`; `LearningDetailsPage.jsx:213-215`; `PurchaseDialog.jsx:21`.
- **Payments and billing**: `CheckoutDialog.jsx:76,86,147-150`; `subscription.js:29`; `BillingSettingsPage.jsx:32,58,80`.
- **Settings**: `settings.js:2-3,41`; `PrivacySettingsPage.jsx:31`; `DataAccountSettingsPage.jsx:32,36-37,41-43,73,81,103,116,123-125`.
- **Onboarding**: `StoryStepPage.jsx:81-82`.
- **Auth** (scope edge): `SignUpPage.jsx:73,88`.

**Translatable UI copy**: about 750 hard-coded user-facing strings across the candidate workspace (per-screen counts in each section). No i18n library is installed today.

---

## 29. Questions (each with options and a recommendation)

Q1. Name: The Edit profile dialog has no name field (`EditProfileModal.jsx:105` keeps `INITIAL_PROFILE.name`), while sign-up collects "Full name". Where is the name stored and edited? (a) `User.fullName` from sign-up, editable in Edit profile; (b) editable only in a separate account section; (c) not editable after sign-up. Recommendation: (a).

Q2. Profile photo (D3): (a) JPG/PNG/WebP ≤ 5 MB, square crop in the browser, stored at 400×400 plus a 96×96 thumbnail, shown in the header, sidebar, profile menu and to recruiters, with no pre-moderation (an admin can remove one through moderation); (b) the same, but an admin approves each photo before it shows and before it counts toward completeness. Recommendation: (a).

Q3. The sidebar promo "Complete your profile" (`workspaces.js:42-47`) always links to onboarding step 1: (a) show it only while the profile is incomplete and link to the completeness checklist; (b) always show it, linking to onboarding; (c) remove it. Recommendation: (a).

Q4. The bell icon has a permanent dot and links to notification settings (`Header.jsx:165-173`): (a) build an in-app notifications dropdown fed by a Notification collection (application status, alert matches, verification decisions, messages, certificates, payments) with an unread dot; (b) dot = unread messages + application updates, and the click opens Messages; (c) remove the dot and keep the settings link. Recommendation: (a).

Q5. "Search anything… ⌘K" only jumps between pages (`GlobalSearch.jsx`): (a) keep it as a page jump with translated labels; (b) extend it to server search over jobs, applications, courses and messages. Recommendation: (a).

Q6. Onboarding scope and completion: today sign-up lands on step 1, sign-in always opens Overview, and nothing records completion; D3 adds many required sections. (a) keep the 3 steps (resume, preferences, plan), allow a partial (draft) profile, store `onboardingCompletedAt`, then send the candidate to the completeness checklist; redirect to onboarding after login until it is completed; (b) extend onboarding into a full wizard covering every D3 section; (c) onboarding only once, right after sign-up, never forced again. Recommendation: (a).

Q7. Email verification link (D1): (a) single-use link valid 24 h, "Resend" allowed (max 5 per hour), and changing the email requires verifying the new address before it takes effect; (b) link valid 1 h, same rules. Also confirm that sign-up uses the link only (no 6-digit email code). Recommendation: (a), link only.

Q8. "Remote" in the country picker: (a) Remote = remote-flagged jobs from any EU/UK country, EUR currency, en-GB formats, English default; (b) Remote = no country filter at all. Recommendation: (a).

Q9. Currency for non-euro EU countries (PL, SE, DK, CZ, HU, RO, BG): (a) local currency per country, with admin-entered course prices and a Stripe Price per currency for the plan; (b) only EUR and GBP (UK → GBP, every EU country → EUR); (c) one base price converted with a stored FX table. Recommendation: (b) for payments.

Q10. Salaries are stored as "thousands" with a hard-coded "$" and no currency (`jobUtils.js:9`, `profileText.js:8`, onboarding copy): (a) store full annual amounts with the job's currency (from the job's country) and display them in that currency, with no conversion; the candidate's minimum salary is stored with the candidate's currency; (b) convert everything to the viewer's currency with an FX table. Recommendation: (a); salary filters and sorts compare same-currency values only.

Q11. Location model: profile, onboarding, alert and job locations are free text ≤ 60. (a) structured `{ countryCode, city }` (city free text); the header country (`User.country`) drives which jobs are visible and is defaulted from the profile country at onboarding; (b) keep free text and match by substring. Recommendation: (a).

Q12. Formatting locale: (a) `Intl` locale = `{language}-{countryCode}` (e.g. en-DE, fr-BE, es-ES), with dates in the browser timezone; (b) locale from the language only. Recommendation: (a).

Q13. One match model: the code has three inconsistent measures (mock `aiMatch`, e.g. 100% for Notion; `profileMatch` = matched/required skills; `matchLabel` Strong ≥ 2/3, else Good), and the AI pages claim "no scores". (a) one server score 0–100 that blends CV/profile embedding similarity with required-skill overlap; labels Strong ≥ 75, Good ≥ 50, none below; thresholds stored in the admin AI & matching policy; (b) two numbers: "AI match" (embeddings) and "profile match" (skill overlap). Recommendation: (a).

Q14. What do Free candidates see of matching, given that D4 makes CV-based matching and match explanations paid? (a) Free sees no score, label, "why it matches" or "For you" (replaced by "Latest jobs" plus an upsell); (b) Free sees a basic skill-overlap label only (as "Basic job matches" promises, `subscription.js:12`), and Plus adds the CV/embedding score and explanations. Also, "Priority review of your CV versions" (`subscription.js:19`) has no feature behind it: drop it or define it? Recommendation: (b); drop "Priority review".

Q15. "Recommended jobs" (Overview KPI, For you tab): (a) published jobs in the candidate's country with a score ≥ the Good threshold, ranked by score; "+N this week" = those published in the last 7 days; (b) top N by score regardless of threshold. Recommendation: (a).

Q16. Job details for paused, closed or removed jobs: (a) a read-only page with "No longer accepting applications" for candidates who applied to or saved the job, and the "no longer available" state for everyone else; (b) always the "no longer available" state. Recommendation: (a).

Q17. Job sections recruiters can't fill today: "Room to do your best work" always shows the same 4 static perks (`jobs.js:315-320` via `recruiterJobs.js:62`), "impact" and "nice to have" fall back to static copy, and the tagline is the first sentence of the description. (a) add `perks[]` (and optionally `tagline`) to the recruiter job form and hide empty sections; (b) hide empty sections and add no fields. Recommendation: (b), unless the recruiter audit adds the fields.

Q18. Company logo (today a letter on a coloured tile): (a) logo upload (PNG/JPG/SVG ≤ 2 MB) with an initial-letter fallback in a colour derived from the company id; (b) initial letter only. Recommendation: (a).

Q19. Which jobs can candidates see? (a) only published jobs of admin-approved recruiters that moderation has not hidden; (b) all published jobs. Recommendation: (a).

Q20. Page-level "Ai Job Summary" buttons summarise an implicit job (Find jobs → the first result, `FindJobsPage.jsx:35`; Applications → the latest active application, `ApplicationsPage.jsx:46-47`): (a) keep them and name the job in the dialog title; (b) move the button onto each job card and application row and remove the page-level one. Recommendation: (b).

Q21. Application status vocabulary: candidate statuses are applied / under-review / interview / withdrawn (`applications.js:2-7`); the recruiter pipeline has applied, screening, shortlisted, interview, offer, hired, rejected and custom stages (≤ 24 chars). (a) map applied → Applied; screening, shortlisted and custom stages → Under review; interview → Interview; and add candidate statuses Offer, Hired and Not selected; (b) show the recruiter's stage name to the candidate verbatim. Recommendation: (a), with stage-change emails only when the mapped status changes.

Q22. Apply flow beyond the D2 gate: today it is one click with no CV choice or consent step, although the copy says "Your information, shared with consent." (a) an apply dialog: choose a CV version (default live), an optional cover note (max 2,000 chars), and a consent checkbox; (b) one click after a one-time consent. Recommendation: (a).

Q23. Re-apply after withdrawal ("You can apply again later"): (a) a new application record, with the old one kept as withdrawn; (b) reactivate the same record; (c) not allowed. Recommendation: (a).

Q24. Application activity: (a) store a status history (status, date, actor) and show dated steps plus a real "Next step" column (e.g. an interview date); (b) current step only, and drop the "Next step" header. Recommendation: (a), without interview scheduling for now.

Q25. When the plan lapses or the profile becomes incomplete after applying (e.g. a check is rejected or the CV is deleted): (a) existing applications continue and the candidate can still view and withdraw them; only new applications are blocked; (b) applications are paused or hidden from recruiters until restored. Recommendation: (a).

Q26. Alert delivery vs frequency: alerts are "Daily/Weekly digest", but the decision says email "when a matching job is published". (a) add an "Instant" frequency (email on publish) alongside Daily/Weekly digests sent at 08:00 in the user's timezone; (b) digests only; (c) instant only, and drop the frequency field. Recommendation: (a).

Q27. Alert matching rule: (a) the Find jobs search semantics (every keyword must appear in the title, company, skills, location, work mode, level or industry; location substring; the candidate's country); (b) semantic/embedding matching. Recommendation: (a).

Q28. Job alerts for Free candidates (D4): (a) the page is locked for Free; on downgrade, existing alerts are paused (kept) and resume after re-subscribing; (b) alerts are deleted on downgrade. Recommendation: (a).

Q29. Length and count limits not defined in code: alert name/keywords/location, cover note, message body, work-history and education text fields, max alerts, max CV versions, max work-history/education entries. (a) name 80, keywords 120, location 60, cover note 2,000, message 2,000, employer/title/institution/degree 100, 10 alerts, 20 CV versions, 20 entries each; (b) your numbers. Recommendation: (a), confirm.

Q30. Completeness display (D3): (a) a checklist of the D3 items with "x of N complete" and percent = done/N (equal weight), reused on Overview, Improve profile, the Apply gate, the promo and My profile; `degree`/`institution` replaced by the Education list; salary not counted; (b) a weighted percent. Recommendation: (a).

Q31. Work history (D3): (a) month + year dates, "I currently work here" (no end date), at least 1 entry required, and `yearsExperience` stays a separate field; (b) `yearsExperience` computed from the entries. And how does a candidate with no work history (e.g. a graduate) complete the profile: through an explicit "No work experience yet" choice that satisfies the item, or is the item mandatory? Recommendation: (a) plus the explicit choice.

Q32. Education (D3): (a) month + year dates, "Still studying" allowed, at least 1 entry required, with a "No formal qualification" choice that satisfies the item; (b) at least 1 entry, mandatory, with no opt-out. Recommendation: (a).

Q33. Languages (D3): (a) the language list is ISO 639-1 names translated into the UI language; at least 1 entry; levels A1–C2 + Native; one level per language; (b) only EU official languages plus a few others. Recommendation: (a).

Q34. Right to work "per country" (D3): (a) at least one entry, required for the currently selected country, with others optional; status citizen / permit / needs sponsorship, with an optional permit expiry date; (b) an entry for every one of the 28 countries; (c) entries required for every country the candidate wants to work in. Is it shown to recruiters? Recommendation: (a), shown to recruiters.

Q35. Links (D3): (a) at least one of LinkedIn or portfolio; LinkedIn must match `https://(www.)linkedin.com/in/…`; portfolio can be any https URL; (b) LinkedIn required, portfolio optional; (c) both required. Recommendation: (a).

Q36. Which admin-approved checks are required for completeness (D3)? (a) all three (identity, academic, employment), which means a candidate with no degree or prior employer can never apply; (b) identity only; (c) identity always, plus academic if an education entry exists and employment if a work-history entry exists. Recommendation: (c).

Q37. Verification review: only in-review and verified statuses exist. (a) add Rejected with a reason, allow resubmission, email the candidate on approve/reject, and review in a new "Verification" queue in admin Moderation; (b) approve only. Recommendation: (a).

Q38. "Premium jobs" (Overview "Premium jobs locked"; "eligible for premium job opportunities") have no data behind them, and D2/D3 already require approved checks for every application. (a) drop the premium concept and its copy; (b) add `job.premium` with an extra requirement. Recommendation: (a).

Q39. Verification badges for recruiters: (a) a tick per approved check on recruiter candidate cards and profiles; (b) one overall "Verified" badge; (c) not shown. Recommendation: (a).

Q40. Phone code (shown on screen, D3): (a) a 6-digit code, valid 10 min, 5 attempts, a new code allowed after 60 s, and a phone number may be verified on only one account; (b) your rules. Recommendation: (a).

Q41. Retention of evidence files (passports, diplomas, contracts): (a) delete the file 30 days after the admin decision and keep the metadata; (b) keep it until the account is deleted. Recommendation: (a).

Q42. Minimum salary is required (1–1000) in onboarding (`onboarding/utils/onboarding.js:17-20`) but optional (0–1000) in Edit profile (`EditProfileModal.jsx:58-61`), and D3 does not list it: (a) optional everywhere, 1–1000 (thousands), or a full amount per Q10, when set; (b) required everywhere. Recommendation: (a).

Q43. CV upload processing: (a) the server extracts the text and AI proposes a snapshot (role, years, skills) that the candidate reviews before it counts; the profile changes only on explicit confirmation; (b) snapshot = the current profile fields at upload time, with no extraction review. Recommendation: (a).

Q44. "Create assisted draft" (Plus): (a) AI returns suggestions, a revised snapshot and a note (no new file), and pending drafts can be deleted; (b) AI generates a full revised CV document (DOCX/PDF) stored as a new version. Recommendation: (a).

Q45. CV files: (a) candidates can download their own versions and delete any version except the live one; (b) no per-version download or delete (only "Delete resume" for all). Recommendation: (a).

Q46. Recruiter requests for earlier CV versions (`EarlierVersionModal.jsx`; consent required per `ComparePanel.jsx:61-62`): (a) the candidate sees the requests on the CV page (and as a notification) and approves or declines each one; (b) an admin approves; (c) drop the feature. Recommendation: (a).

Q47. "Delete resume" when applications used a CV: (a) delete the files everywhere, and recruiters see "CV removed by the candidate"; (b) keep the submitted copy attached to existing applications. Recommendation: (a).

Q48. The AI insights role picker today shows 5 fixed roles with their own skills, salaries and years: (a) the candidate's top 10 recommended jobs plus saved and applied jobs, defaulting to the top-ranked one; (b) any published job in the country (searchable select). Recommendation: (a).

Q49. Which parts of the AI pages come from OpenAI? (a) deterministic evidence (listed/missing skills, years, work mode, location) is computed in code, and OpenAI writes the narrative (strength insight, per-skill guidance, improvement suggestions, recommendation reasons, match explanation), cached per candidate + job + language; (b) everything is generated by OpenAI as JSON. Recommendation: (a).

Q50. "I have this skill" (skill gap) is stored separately (`lwm.ai-insights.added-skills`) and never reaches My profile, although the checkbox says "add it to my profile": (a) add it to `profile.skills` (12-skill and 30-char rules; refuse when there are already 12); (b) keep a separate "reviewed skills" list used only by the AI pages. Recommendation: (a).

Q51. "Save this opportunity" on Job match uses its own list (`lwm.ai-insights.saved-roles`): (a) use the same SavedJob as the bookmark; (b) keep a separate AI shortlist. Recommendation: (a).

Q52. Learning suggestions: "Courses for Interaction Design", "Skills to explore 6" and `course.recommended` are static. (a) gap skills = missing required skills across the candidate's top 10 recommended jobs plus the learning-plan skills; recommended courses = courses tagged with those skills (needs admin-entered `Course.skills` tags); "Find a course" filters by skill; (b) an admin-curated `recommended` flag. Recommendation: (a).

Q53. Skill-demand denominator ("of the 9 current demo opportunities"): (a) all published jobs visible in the candidate's country; (b) only the candidate's recommended jobs. Recommendation: (a).

Q54. Explanation feedback (Helpful / Needs review): (a) store it and show aggregates to admin AI & matching; (b) store it for the candidate only. Recommendation: (a).

Q55. AI generation and caching: (a) generate on first view, cache, and invalidate when the profile, CV or job changes, with a daily cap per user (e.g. 50 AI calls) and a friendly limit message; (b) generate on every view. Recommendation: (a), confirm the cap.

Q56. Profile "Ai Job Summary" (Plus): (a) OpenAI writes a recruiter-ready summary from the profile + live CV in the user's language, copyable; (b) keep the template. Recommendation: (a).

Q57. Canonical course prices: the candidate catalogue says 49/39/19/49/49/49 (`courses.js:40,59,78,101,124,147`), admin says 0/39/0/49/59/0 (`admin/courses/data/courses.js:16-21`), and the seed payment shows Alex paying £49 for a course admin lists as free (`payments.js:39`). (a) admin values are canonical and the seed is fixed; (b) candidate values. Recommendation: (a).

Q58. Course tier badges "Included"/"Plus" and the "Learning Plus active" pill: (a) drop the tiers and the pill, and show Free or the price; (b) Plus subscribers get "Included" courses free. Recommendation: (a) (D4 says courses are separate purchases).

Q59. Course language: (a) one language per course, with on-demand (Plus) translation of titles and summaries; (b) courses filtered by UI language. Recommendation: (a).

Q60. Lesson content (D5): (a) video MP4 (H.264) ≤ 500 MB per file on server disk, streamed with HTTP Range; text = Markdown; documents = PDF only; an external link completes when opened; video completion from client-reported progress (≥ 90%) with server sanity checks; (b) your limits and types (e.g. allow DOCX/PPTX, or rich-text HTML). Recommendation: (a).

Q61. Final quiz (D5): (a) single- and multiple-choice questions, unlocked after all lessons are viewed, pass mark per course (default 70%), unlimited retakes, correct answers not revealed, best score kept; course progress % = lessons viewed / total, and the course completes only on a passed quiz; (b) limited retakes and/or a cooldown (how many, how long?). Recommendation: (a).

Q62. Certificate and badge (D5): (a) a PDF with the candidate's name (from the profile at issue time), course title, issue date, verification code and platform name, generated in the user's language; a public verification page `/certificates/verify/:code` (no login) showing name, course and date; the badge is visible to recruiters unless the candidate is not discoverable; (b) the certificate in English only and/or verification only for logged-in recruiters. Recommendation: (a).

Q63. "Free introduction · 3 min": (a) any lesson flagged `freePreview` can be opened without purchase; (b) a separate intro-video field on the course. Recommendation: (a).

Q64. Plan cancellation and failed renewals: (a) cancel at period end (access until `currentPeriodEnd`), and lock when Stripe marks the subscription unpaid or canceled after its retries; offer the Stripe Customer Portal for card changes and invoices; (b) cancel immediately. Recommendation: (a).

Q65. Payment history with Stripe Checkout (Stripe handles declines, so most failed attempts never reach us): (a) record completed payments, renewals, failed renewals and refunds, each with a Stripe receipt link; (b) also record abandoned or expired sessions. Recommendation: (a).

Q66. The plan step's "Continue with Free" silently downgrades a Plus subscriber (`PlanStepPage.jsx:21-24`): (a) show "You're on {plan}" and continue, with plan changes only through Billing; (b) treat it as a cancel. Recommendation: (a).

Q67. Plan name, price and features (D2: the name may change): (a) a Plan collection in MongoDB (name per language, price per currency, Stripe Price ids, feature list), seeded and editable by admin; (b) a server config file. Recommendation: (a) (nothing static); the admin editing UI is in admin scope.

Q68. Privacy flags are enforced nowhere today. (a) `discoverable=false` hides the candidate from recruiter search and shortlists but not from recruiters of jobs they applied to; `resumeVisible=false` limits the CV to recruiters of jobs applied to; `matchingConsent=false` removes the candidate from AI matching both ways (no scores, recommendations or insights for them, and not in recruiter AI matching); (b) your rules. Recommendation: (a).

Q69. Email categories vs the single "Email alerts" toggle: (a) the toggle controls job-alert, application-update and message emails; verification links, password resets, phone and verification decisions, certificate and payment emails are always sent; "In-app notifications" controls the bell dot only; (b) separate toggles per category. Recommendation: (a).

Q70. "Delete my data": (a) GDPR erasure: delete the account, profile, photo, CV and evidence files, applications (removed from recruiter views), alerts, messages, notifications, AI caches, enrollments and certificates (the public verification page then says "revoked"); cancel the Stripe subscription immediately; keep payment records with the payer name anonymised; sign out; (b) wipe the candidate data but keep the login (blank profile, Free plan), as the current UI does. Recommendation: (a), subject to legal review.

Q71. Export: (a) a server CSV with the current rows plus the D3 sections, with labels in the user's language; (b) a ZIP with JSON + the uploaded files (CV, photo, certificates) for GDPR portability. Recommendation: (b).

Q72. Profile views ("18 ↑12% From verified companies"): (a) record a ProfileView when an approved recruiter opens a candidate profile (one per recruiter per day), and show the last 30 days and the change vs the previous 30; (b) a 7-day window. Recommendation: (a).

Q73. Messages (D4: Plus can start and reply, Free can read): (a) Plus candidates may start conversations only with recruiters of jobs they applied to; recruiters may start with applicants or discoverable candidates; text only; an email for a new message at most once per conversation per 15 min; (b) Plus candidates may message any recruiter of a published job. Recommendation: (a).

Q74. On-demand translation (Plus, D4): (a) a "Translate" control on Job details sections, the company "About", message bubbles and recruiter-written texts, with translations cached per entity + field + language; (b) automatic translation everywhere. Recommendation: (a).

Q75. Upload safety for CVs, photos, evidence and lesson media: (a) check extension + MIME + magic bytes + size, use random file names outside the web root, and serve files only through authenticated endpoints with ownership checks; (b) (a) plus antivirus scanning (ClamAV). Recommendation: (a) for now.

---

## 30. The 5 biggest risks

1. **The apply gate (D2 + D3) makes applying depend on about 10 items, including three admin-approved document checks and the paid plan.** It needs a large new profile UI (one dialog becomes 7 structured sections plus a photo upload) and server validation. No candidate can apply until an admin reviews their identity, academic and employment evidence, so throughput depends on admin capacity. Candidates without a degree or employer may be blocked for good (Q36). The seed and demo accounts must be pre-approved.
2. **The matching core is undefined and duplicated.** There are three inconsistent match measures (mock `aiMatch`, `profileMatch`, `matchLabel`), skill matching assumes matched skills come first in the list, and "5 years / remote" is hard-coded in two places. The AI insights pages run on a second static `PROFILE` and 5 fake `ROLES` that are unrelated to the real profile and jobs. About ten screens, the job alerts and the recruiter side all depend on one model that is not specified yet and is now plan-gated (Q13, Q14, Q48, Q49).
3. **Cross-role links rely on one hard-coded demo candidate and on vocabularies that don't match.** Recruiter and admin screens read candidate localStorage directly: `useLiveApplicant` uses the fixed id `'alex-morgan'`, admin uses a constant applicant name, recruiter jobs are joined through the `acme-` id prefix, and payments are filtered by the payer's *name*. The candidate has 4 statuses where the recruiter pipeline has 7 stages plus custom ones, and the privacy flags are never enforced. This has to be designed together with the recruiter and admin audits (Q21, Q68).
4. **Money and locale are hard-coded.** `£` and `$` appear in about 10 formatters, salaries are "thousands" with no currency, and the candidate and admin course prices conflict. Non-euro EU currencies are unresolved, yet Stripe needs a Price per currency. The Stripe subscription lifecycle (cancel, past_due, lapse) now drives the D4 gates on applying, AI, alerts and messaging (Q9, Q10, Q57, Q64).
5. **Sensitive files and GDPR deletion on local disk.** Passports, diplomas, contracts, CVs, photos and lesson videos will sit on the server disk with no object store, Docker or Redis. That means designing access control, retention, video streaming, backups and real deletion (Q41, Q47, Q60, Q70, Q75), while about 60 UI strings currently promise the data "never leaves this device".

---

## 31. Coverage

`find client/src/features/candidate client/src/features/payments -type f` (run after the move to `client/`) returns **160 files**: 103 JS/JSX (7118 lines) and 57 CSS modules (5439 lines). No other file types exist in scope.

- **JS/JSX: every file read fully**, line by line, with the code, not just the file names.
- **CSS**: every file was scanned with `grep -nE 'content:|url\(|@import|attr\(|font-family'`, the only ways a stylesheet can carry user-visible text, data or assets. The only hits are two empty pseudo-elements, `content: ''` at `ai-insights/components/RoleLogo.module.css:28` and `jobs/pages/JobDetailsPage.module.css:333`, plus font-family declarations. There is no `url()`, `@import` or `attr()`. CSS files were therefore **scanned, not read line by line**; they hold no data to migrate.

| File (under `client/src/features/`) | Lines | Status |
|---|---:|---|
| `candidate/ai-insights/components/AiPageShell.jsx` | 51 | Read fully |
| `candidate/ai-insights/components/AiPageShell.module.css` | 53 | Scanned (styling only, no data) |
| `candidate/ai-insights/components/AiSafetyNotice.jsx` | 18 | Read fully |
| `candidate/ai-insights/components/AiSafetyNotice.module.css` | 17 | Scanned (styling only, no data) |
| `candidate/ai-insights/components/GapCard.jsx` | 80 | Read fully |
| `candidate/ai-insights/components/GapCard.module.css` | 66 | Scanned (styling only, no data) |
| `candidate/ai-insights/components/LearningPlanCard.jsx` | 43 | Read fully |
| `candidate/ai-insights/components/LearningPlanCard.module.css` | 63 | Scanned (styling only, no data) |
| `candidate/ai-insights/components/MatchCard.jsx` | 76 | Read fully |
| `candidate/ai-insights/components/MatchCard.module.css` | 125 | Scanned (styling only, no data) |
| `candidate/ai-insights/components/ReviewSkillModal.jsx` | 46 | Read fully |
| `candidate/ai-insights/components/ReviewSkillModal.module.css` | 55 | Scanned (styling only, no data) |
| `candidate/ai-insights/components/RoleLogo.jsx` | 23 | Read fully |
| `candidate/ai-insights/components/RoleLogo.module.css` | 33 | Scanned (styling only, no data) |
| `candidate/ai-insights/components/RolePicker.jsx` | 29 | Read fully |
| `candidate/ai-insights/components/RolePicker.module.css` | 40 | Scanned (styling only, no data) |
| `candidate/ai-insights/components/SectionHeading.jsx` | 17 | Read fully |
| `candidate/ai-insights/components/SectionHeading.module.css` | 26 | Scanned (styling only, no data) |
| `candidate/ai-insights/components/SourceEvidenceModal.jsx` | 59 | Read fully |
| `candidate/ai-insights/components/SourceEvidenceModal.module.css` | 47 | Scanned (styling only, no data) |
| `candidate/ai-insights/data/insights.js` | 150 | Read fully |
| `candidate/ai-insights/hooks/useInsightsState.js` | 51 | Read fully |
| `candidate/ai-insights/pages/AiInsightsPage.jsx` | 136 | Read fully |
| `candidate/ai-insights/pages/AiInsightsPage.module.css` | 199 | Scanned (styling only, no data) |
| `candidate/ai-insights/pages/ImproveProfilePage.jsx` | 98 | Read fully |
| `candidate/ai-insights/pages/ImproveProfilePage.module.css` | 143 | Scanned (styling only, no data) |
| `candidate/ai-insights/pages/JobMatchPage.jsx` | 170 | Read fully |
| `candidate/ai-insights/pages/JobMatchPage.module.css` | 233 | Scanned (styling only, no data) |
| `candidate/ai-insights/pages/SkillGapPage.jsx` | 123 | Read fully |
| `candidate/ai-insights/pages/SkillGapPage.module.css` | 66 | Scanned (styling only, no data) |
| `candidate/ai-insights/pages/WhyRecommendedPage.jsx` | 248 | Read fully |
| `candidate/ai-insights/pages/WhyRecommendedPage.module.css` | 234 | Scanned (styling only, no data) |
| `candidate/ai-insights/routes.jsx` | 24 | Read fully |
| `candidate/ai-insights/utils/matching.js` | 82 | Read fully |
| `candidate/applications/components/ApplicationActivityModal.jsx` | 64 | Read fully |
| `candidate/applications/components/ApplicationActivityModal.module.css` | 78 | Scanned (styling only, no data) |
| `candidate/applications/pages/ApplicationsPage.jsx` | 136 | Read fully |
| `candidate/applications/pages/ApplicationsPage.module.css` | 51 | Scanned (styling only, no data) |
| `candidate/applications/routes.jsx` | 3 | Read fully |
| `candidate/billing/components/PlusGate.jsx` | 54 | Read fully |
| `candidate/billing/components/PlusGate.module.css` | 39 | Scanned (styling only, no data) |
| `candidate/billing/data/subscription.js` | 30 | Read fully |
| `candidate/billing/hooks/useSubscription.js` | 16 | Read fully |
| `candidate/cv/components/ComparePanel.jsx` | 67 | Read fully |
| `candidate/cv/components/ComparePanel.module.css` | 102 | Scanned (styling only, no data) |
| `candidate/cv/components/UploadDropzone.jsx` | 44 | Read fully |
| `candidate/cv/components/UploadDropzone.module.css` | 59 | Scanned (styling only, no data) |
| `candidate/cv/components/VersionRow.jsx` | 60 | Read fully |
| `candidate/cv/components/VersionRow.module.css` | 88 | Scanned (styling only, no data) |
| `candidate/cv/data/cvVersions.js` | 57 | Read fully |
| `candidate/cv/pages/CvVersionsPage.jsx` | 144 | Read fully |
| `candidate/cv/pages/CvVersionsPage.module.css` | 86 | Scanned (styling only, no data) |
| `candidate/cv/routes.jsx` | 3 | Read fully |
| `candidate/cv/utils/cvVersions.js` | 82 | Read fully |
| `candidate/job-alerts/components/JobAlertModal.jsx` | 92 | Read fully |
| `candidate/job-alerts/components/JobAlertModal.module.css` | 17 | Scanned (styling only, no data) |
| `candidate/job-alerts/data/alerts.js` | 21 | Read fully |
| `candidate/job-alerts/hooks/useJobAlerts.js` | 27 | Read fully |
| `candidate/job-alerts/pages/JobAlertsPage.jsx` | 85 | Read fully |
| `candidate/job-alerts/pages/JobAlertsPage.module.css` | 91 | Scanned (styling only, no data) |
| `candidate/job-alerts/routes.jsx` | 3 | Read fully |
| `candidate/jobs/components/AiJobSummaryModal.jsx` | 70 | Read fully |
| `candidate/jobs/components/AiJobSummaryModal.module.css` | 104 | Scanned (styling only, no data) |
| `candidate/jobs/components/AiSummaryButton.jsx` | 18 | Read fully |
| `candidate/jobs/components/AiSummaryButton.module.css` | 17 | Scanned (styling only, no data) |
| `candidate/jobs/components/JobCard.jsx` | 131 | Read fully |
| `candidate/jobs/components/JobCard.module.css` | 204 | Scanned (styling only, no data) |
| `candidate/jobs/components/JobFiltersModal.jsx` | 50 | Read fully |
| `candidate/jobs/components/JobFiltersModal.module.css` | 26 | Scanned (styling only, no data) |
| `candidate/jobs/components/JobLogo.jsx` | 20 | Read fully |
| `candidate/jobs/components/JobLogo.module.css` | 14 | Scanned (styling only, no data) |
| `candidate/jobs/data/applications.js` | 24 | Read fully |
| `candidate/jobs/data/jobUtils.js` | 62 | Read fully |
| `candidate/jobs/data/jobs.js` | 321 | Read fully |
| `candidate/jobs/data/recruiterJobs.js` | 65 | Read fully |
| `candidate/jobs/hooks/useApplications.js` | 47 | Read fully |
| `candidate/jobs/hooks/useJobListings.js` | 32 | Read fully |
| `candidate/jobs/hooks/useSavedJobs.js` | 15 | Read fully |
| `candidate/jobs/pages/FindJobsPage.jsx` | 165 | Read fully |
| `candidate/jobs/pages/FindJobsPage.module.css` | 121 | Scanned (styling only, no data) |
| `candidate/jobs/pages/JobDetailsPage.jsx` | 290 | Read fully |
| `candidate/jobs/pages/JobDetailsPage.module.css` | 493 | Scanned (styling only, no data) |
| `candidate/jobs/routes.jsx` | 6 | Read fully |
| `candidate/learning/components/CourseCard.jsx` | 67 | Read fully |
| `candidate/learning/components/CourseCard.module.css` | 126 | Scanned (styling only, no data) |
| `candidate/learning/components/LessonRow.jsx` | 47 | Read fully |
| `candidate/learning/components/LessonRow.module.css` | 77 | Scanned (styling only, no data) |
| `candidate/learning/components/LevelTabs.jsx` | 25 | Read fully |
| `candidate/learning/components/LevelTabs.module.css` | 35 | Scanned (styling only, no data) |
| `candidate/learning/components/PurchaseDialog.jsx` | 28 | Read fully |
| `candidate/learning/data/courses.js` | 163 | Read fully |
| `candidate/learning/hooks/useCourseCatalogue.js` | 41 | Read fully |
| `candidate/learning/hooks/useLearning.js` | 58 | Read fully |
| `candidate/learning/pages/LearningDetailsPage.jsx` | 220 | Read fully |
| `candidate/learning/pages/LearningDetailsPage.module.css` | 287 | Scanned (styling only, no data) |
| `candidate/learning/pages/LearningPage.jsx` | 114 | Read fully |
| `candidate/learning/pages/LearningPage.module.css` | 95 | Scanned (styling only, no data) |
| `candidate/learning/routes.jsx` | 6 | Read fully |
| `candidate/onboarding/components/OnboardingStep.jsx` | 24 | Read fully |
| `candidate/onboarding/components/OnboardingStep.module.css` | 32 | Scanned (styling only, no data) |
| `candidate/onboarding/components/WorkModePicker.jsx` | 30 | Read fully |
| `candidate/onboarding/components/WorkModePicker.module.css` | 90 | Scanned (styling only, no data) |
| `candidate/onboarding/data/onboarding.js` | 10 | Read fully |
| `candidate/onboarding/pages/PlanStepPage.jsx` | 69 | Read fully |
| `candidate/onboarding/pages/PlanStepPage.module.css` | 55 | Scanned (styling only, no data) |
| `candidate/onboarding/pages/PreferencesStepPage.jsx` | 99 | Read fully |
| `candidate/onboarding/pages/PreferencesStepPage.module.css` | 9 | Scanned (styling only, no data) |
| `candidate/onboarding/pages/StoryStepPage.jsx` | 86 | Read fully |
| `candidate/onboarding/pages/StoryStepPage.module.css` | 67 | Scanned (styling only, no data) |
| `candidate/onboarding/routes.jsx` | 14 | Read fully |
| `candidate/onboarding/utils/onboarding.js` | 23 | Read fully |
| `candidate/overview/components/ApplicationActivityCard.jsx` | 56 | Read fully |
| `candidate/overview/components/InsightCard.jsx` | 36 | Read fully |
| `candidate/overview/components/ProfileStrengthCard.jsx` | 42 | Read fully |
| `candidate/overview/components/RailCards.module.css` | 317 | Scanned (styling only, no data) |
| `candidate/overview/components/VerificationCard.jsx` | 45 | Read fully |
| `candidate/overview/pages/OverviewPage.jsx` | 150 | Read fully |
| `candidate/overview/pages/OverviewPage.module.css` | 246 | Scanned (styling only, no data) |
| `candidate/overview/routes.jsx` | 3 | Read fully |
| `candidate/profile/components/EditProfileModal.jsx` | 247 | Read fully |
| `candidate/profile/components/EditProfileModal.module.css` | 84 | Scanned (styling only, no data) |
| `candidate/profile/components/JobSummaryModal.jsx` | 56 | Read fully |
| `candidate/profile/components/JobSummaryModal.module.css` | 18 | Scanned (styling only, no data) |
| `candidate/profile/data/profile.js` | 33 | Read fully |
| `candidate/profile/pages/ProfilePage.jsx` | 162 | Read fully |
| `candidate/profile/pages/ProfilePage.module.css` | 234 | Scanned (styling only, no data) |
| `candidate/profile/routes.jsx` | 3 | Read fully |
| `candidate/profile/utils/profileText.js` | 31 | Read fully |
| `candidate/routes.jsx` | 9 | Read fully |
| `candidate/settings/components/SettingsCard.jsx` | 13 | Read fully |
| `candidate/settings/components/SettingsCard.module.css` | 19 | Scanned (styling only, no data) |
| `candidate/settings/components/SettingsLayout.jsx` | 33 | Read fully |
| `candidate/settings/components/SettingsLayout.module.css` | 32 | Scanned (styling only, no data) |
| `candidate/settings/components/ToggleRow.jsx` | 15 | Read fully |
| `candidate/settings/components/ToggleRow.module.css` | 30 | Scanned (styling only, no data) |
| `candidate/settings/data/settings.js` | 43 | Read fully |
| `candidate/settings/pages/BillingSettingsPage.jsx` | 88 | Read fully |
| `candidate/settings/pages/BillingSettingsPage.module.css` | 50 | Scanned (styling only, no data) |
| `candidate/settings/pages/DataAccountSettingsPage.jsx` | 146 | Read fully |
| `candidate/settings/pages/DataAccountSettingsPage.module.css` | 82 | Scanned (styling only, no data) |
| `candidate/settings/pages/NotificationSettingsPage.jsx` | 26 | Read fully |
| `candidate/settings/pages/PrivacySettingsPage.jsx` | 35 | Read fully |
| `candidate/settings/pages/SettingsPage.module.css` | 22 | Scanned (styling only, no data) |
| `candidate/settings/routes.jsx` | 17 | Read fully |
| `candidate/settings/utils/localData.js` | 111 | Read fully |
| `candidate/verification/components/CheckRow.jsx` | 58 | Read fully |
| `candidate/verification/components/CheckRow.module.css` | 84 | Scanned (styling only, no data) |
| `candidate/verification/components/SubmitEvidenceModal.jsx` | 108 | Read fully |
| `candidate/verification/components/SubmitEvidenceModal.module.css` | 39 | Scanned (styling only, no data) |
| `candidate/verification/data/verification.js` | 42 | Read fully |
| `candidate/verification/pages/VerificationPage.jsx` | 193 | Read fully |
| `candidate/verification/pages/VerificationPage.module.css` | 238 | Scanned (styling only, no data) |
| `candidate/verification/routes.jsx` | 3 | Read fully |
| `payments/components/CheckoutDialog.jsx` | 155 | Read fully |
| `payments/components/CheckoutDialog.module.css` | 62 | Scanned (styling only, no data) |
| `payments/components/PaymentsTable.jsx` | 60 | Read fully |
| `payments/components/PaymentsTable.module.css` | 19 | Scanned (styling only, no data) |
| `payments/data/payments.js` | 45 | Read fully |
| `payments/hooks/usePayments.js` | 43 | Read fully |
| `payments/utils/card.js` | 59 | Read fully |

### 31a. Every storage call site in scope (grep `useLocalStorage(|useSharedLocalStorage(|localStorage|sessionStorage`) → where it is covered

| Call site | Key | Report section |
|---|---|---|
| `candidate/ai-insights/hooks/useInsightsState.js:13` | `lwm.ai-insights.added-skills` | §11, Q50, S37 |
| `candidate/ai-insights/hooks/useInsightsState.js:24` | `lwm.ai-insights.learning-plan` | §11, §12, Q52, S37 |
| `candidate/ai-insights/hooks/useInsightsState.js:29` | `lwm.ai-insights.saved-roles` | §13, Q51, S37 |
| `candidate/ai-insights/hooks/useInsightsState.js:35` | `lwm.ai-insights.explanation-feedback` | §14, Q54, S37 |
| `candidate/billing/hooks/useSubscription.js:7` | `lwm.candidate.subscription` (shared) | §9, §20, §23, S43 |
| `candidate/cv/pages/CvVersionsPage.jsx:17` | `lwm.candidate.cv` | §7, S31 |
| `candidate/job-alerts/hooks/useJobAlerts.js:7` | `lwm.candidate.jobAlerts` | §5, S27 |
| `candidate/jobs/hooks/useApplications.js:14` | `lwm.candidate.applications` (shared) | §4, S21 |
| `candidate/jobs/hooks/useJobListings.js:15` | `lwm.recruiter.jobs` (recruiter-owned, read here) | §2, S21 |
| `candidate/jobs/hooks/useJobListings.js:16` | `lwm.recruiter.company` (recruiter-owned, read here) | §2, §3, S21 |
| `candidate/jobs/hooks/useJobListings.js:17` | `lwm.candidate.profile` | §2, S21 |
| `candidate/jobs/hooks/useSavedJobs.js:7` | `lwm.candidate.savedJobs` (shared) | §1, §2, S21 |
| `candidate/learning/hooks/useLearning.js:27` | `lwm.candidate.learning` | §15, §16, S51 |
| `candidate/onboarding/pages/PreferencesStepPage.jsx:22` | `lwm.candidate.profile` | §22 |
| `candidate/onboarding/pages/PreferencesStepPage.jsx:23` | `lwm.candidate.onboarding` | §22, S57 |
| `candidate/onboarding/pages/StoryStepPage.jsx:22` | `lwm.candidate.onboarding` | §21, S57 |
| `candidate/onboarding/pages/StoryStepPage.jsx:23` | `lwm.candidate.cv` | §21 |
| `candidate/overview/components/InsightCard.jsx:10` | `lwm.candidate.overview.insightDismissed` | §1, S16 |
| `candidate/profile/pages/ProfilePage.jsx:20` | `lwm.candidate.profile` | §6, S28 |
| `candidate/profile/pages/ProfilePage.jsx:21` | `lwm.candidate.cv` | §6 |
| `candidate/settings/pages/DataAccountSettingsPage.jsx:61-65` | profile, cv, verification, settings.privacy, settings.notifications | §19 |
| `candidate/settings/pages/NotificationSettingsPage.jsx:9` | `lwm.candidate.settings.notifications` | §18, S54 |
| `candidate/settings/pages/PrivacySettingsPage.jsx:11` | `lwm.candidate.settings.privacy` | §17, S54 |
| `candidate/settings/utils/localData.js:23,25` | enumerates and removes `lwm.*` / `lwm.candidate.*` keys | §19, S55 |
| `candidate/settings/utils/localData.js:31,60,68` | `sessionStorage` key `lwm.session.candidateData` | §19, S55 |
| `candidate/settings/utils/localData.js:50-53` | writes profile `null`, empty CV, empty learning, `[]` for saved jobs, applications and alerts | §19, S55 |
| `candidate/verification/pages/VerificationPage.jsx:23` | `lwm.candidate.verification` | §8, S34 |
| `payments/hooks/usePayments.js:14` | `lwm.payments` (shared with recruiter and admin) | §20, S45 |

Keys read indirectly through imported hooks:
- `lwm.admin.courses`, via `features/admin/courses/hooks/useCourses.js`, used by `learning/hooks/useCourseCatalogue.js:33` (§15, S50).
- `lwm.location` / `lwm.language` in the shell, `components/layout/WorkspacePreferences.jsx:7-8` (§0.1, S8).
- `lwm-session`, `features/auth/utils/session.js:8` (§0.1, S11).

### 31b. Every import from a `data/` folder in scope → where it is covered

| Importer | Imported from (`data/`) | Covered in |
|---|---|---|
| `ai-insights/components/GapCard.jsx:5` | `insights.js` DEFAULT_GUIDANCE, SKILL_GUIDANCE | §11, S36, S41 |
| `ai-insights/components/MatchCard.jsx:6` | `insights.js` PROFILE | §10, S41 |
| `ai-insights/components/RolePicker.jsx:2` | `insights.js` ROLES | §11, S41 |
| `ai-insights/components/SourceEvidenceModal.jsx:3` | `insights.js` PROFILE | §11, S41 |
| `ai-insights/hooks/useInsightsState.js:3` | `insights.js` PROFILE, ROLES | §10–14, S37 |
| `ai-insights/pages/AiInsightsPage.jsx:9` | `insights.js` DEMO_OPPORTUNITY_COUNT, PROFILE, ROLES_WITH_ALIGNED_SKILLS, SKILL_DEMAND | §10, S39 |
| `ai-insights/pages/ImproveProfilePage.jsx:9` | `insights.js` IMPROVEMENTS, PROFILE_COMPLETENESS | §12, S36 |
| `ai-insights/pages/JobMatchPage.jsx:11` | `insights.js` PROFILE | §13, S40 |
| `ai-insights/pages/SkillGapPage.jsx:13` | `insights.js` PROFILE | §11, S40 |
| `ai-insights/pages/WhyRecommendedPage.jsx:12` | `insights.js` PROFILE | §14, S40 |
| `ai-insights/utils/matching.js:1` | `insights.js` PROFILE, ROLES | §10–13, S38 |
| `applications/components/ApplicationActivityModal.jsx:6-7` | `jobs/data/applications.js` APPLICATION_STATUS, APPLICATION_STEPS, formatApplied; `jobs/data/jobUtils.js` jobPath | §4, S20 |
| `applications/pages/ApplicationsPage.jsx:14-15` | `applications.js` APPLICATION_STATUS, formatApplied; `jobUtils.js` jobPath | §4, S20 |
| `billing/components/PlusGate.jsx:7` | `subscription.js` PLANS, PLUS_CHECKOUT_ITEM | §9, S42 |
| `billing/data/subscription.js:1` | `payments/data/payments.js` formatMoney | §9, S44 |
| `billing/hooks/useSubscription.js:3` | `subscription.js` INITIAL_SUBSCRIPTION, SUBSCRIPTION_STORAGE_KEY | §9, S42 |
| `cv/components/UploadDropzone.jsx:5` | `cvVersions.js` ACCEPTED_CV_EXTENSIONS, MAX_CV_SIZE_MB | §7, S31 |
| `cv/pages/CvVersionsPage.jsx:11` | `cvVersions.js` CV_STORAGE_KEY, INITIAL_CV | §7, S31 |
| `cv/utils/cvVersions.js:1` | `cvVersions.js` ACCEPTED_CV_EXTENSIONS, DRAFT_NOTE, MAX_CV_SIZE_MB | §7, S31, S32 |
| `job-alerts/components/JobAlertModal.jsx:3` | `alerts.js` FREQUENCIES | §5, S27 |
| `job-alerts/hooks/useJobAlerts.js:3` | `alerts.js` SEED_ALERTS | §5, S27 |
| `jobs/components/AiJobSummaryModal.jsx:3` | `jobUtils.js` formatSalary, profileMatch | §2, S19, S24 |
| `jobs/components/JobCard.jsx:9` | `jobUtils.js` experienceTag, formatPosted, formatSalary, matchTone | §2, S19 |
| `jobs/components/JobFiltersModal.jsx:2` | `jobUtils.js` EMPTY_FILTERS | §2, S19 |
| `jobs/hooks/useApplications.js:3` | `applications.js` SEED_APPLICATIONS | §4, S20 |
| `jobs/hooks/useJobListings.js:3-7` | `recruiter/company/data/company.js` COMPANY_STORAGE_KEY, INITIAL_COMPANY; `recruiter/jobs/data/jobs.js` JOBS_STORAGE_KEY, SEED_JOBS; `profile/data/profile.js` INITIAL_PROFILE, PROFILE_STORAGE_KEY; `jobs/data/jobs.js` JOBS; `jobs/data/recruiterJobs.js` recruiterJobIdOf, toCandidateJob, candidateJobId | §2, S17, S18, S21 |
| `jobs/hooks/useSavedJobs.js:3` | `applications.js` SEED_SAVED_JOB_IDS | §1, S20 |
| `jobs/pages/FindJobsPage.jsx:11` | `jobUtils.js` EMPTY_FILTERS, SORT_OPTIONS, jobPath, searchJobs, sortJobs | §2, S19 |
| `jobs/pages/JobDetailsPage.jsx:26-27` | `jobs.js` ROLE_DETAILS; `jobUtils.js` formatPosted, formatSalary, matchTone, profileMatch | §3, S17, S19, S25 |
| `learning/hooks/useCourseCatalogue.js:4` | `courses.js` COURSES | §15, S49, S50 |
| `learning/hooks/useLearning.js:2` | `courses.js` INITIAL_LEARNING, LEARNING_STORAGE_KEY | §15, S49, S51 |
| `learning/pages/LearningPage.jsx:10` | `courses.js` GAP_SKILL, LEVELS, SKILLS_TO_EXPLORE | §15, S49, S52 |
| `onboarding/components/OnboardingStep.jsx:4` | `onboarding.js` TOTAL_STEPS | §21, S57 |
| `onboarding/pages/PlanStepPage.jsx:6` | `billing/data/subscription.js` PLANS, PLUS_CHECKOUT_ITEM | §23, S42 |
| `onboarding/pages/PreferencesStepPage.jsx:7,10` | `profile.js` INITIAL_PROFILE, PROFILE_STORAGE_KEY, WORK_MODES; `onboarding.js` INITIAL_ONBOARDING, ONBOARDING_STORAGE_KEY | §22, S28, S57 |
| `onboarding/pages/StoryStepPage.jsx:7,10` | `cvVersions.js` CV_STORAGE_KEY, INITIAL_CV; `onboarding.js` INITIAL_ONBOARDING, ONBOARDING_STORAGE_KEY | §21, S31, S57 |
| `onboarding/utils/onboarding.js:1` | `onboarding.js` MAX_LOCATION_LENGTH, MAX_SALARY_K | §22, S57 |
| `overview/components/ApplicationActivityCard.jsx:6-7` | `applications.js` APPLICATION_STATUS; `jobUtils.js` jobPath | §1, S20 |
| `overview/pages/OverviewPage.jsx:11` | `jobUtils.js` jobPath | §1 |
| `profile/components/EditProfileModal.jsx:5` | `profile.js` BLANK_PROFILE, INITIAL_PROFILE, WORK_MODES | §6, S28 |
| `profile/pages/ProfilePage.jsx:11,14` | `cvVersions.js` CV_STORAGE_KEY, INITIAL_CV; `profile.js` INITIAL_PROFILE, PROFILE_STORAGE_KEY | §6, S28, S31 |
| `settings/pages/BillingSettingsPage.jsx:7,11` | `subscription.js` PLANS, PLUS_CHECKOUT_ITEM; `payments.js` formatPaymentDate | §20, S42, S44 |
| `settings/pages/DataAccountSettingsPage.jsx:8-10,18` | `cvVersions.js` CV_STORAGE_KEY, EMPTY_CV, INITIAL_CV; `profile.js` INITIAL_PROFILE, PROFILE_STORAGE_KEY; `verification.js` INITIAL_VERIFICATION, VERIFICATION_STORAGE_KEY; `settings.js` DATA_NOTICE, DEFAULT_NOTIFICATIONS, DEFAULT_PRIVACY, NOTIFICATIONS_STORAGE_KEY, PRIVACY_STORAGE_KEY | §19, S54 |
| `settings/pages/NotificationSettingsPage.jsx:4` | `settings.js` DEFAULT_NOTIFICATIONS, NOTIFICATION_OPTIONS, NOTIFICATIONS_STORAGE_KEY | §18, S54 |
| `settings/pages/PrivacySettingsPage.jsx:6` | `settings.js` DEFAULT_PRIVACY, PRIVACY_OPTIONS, PRIVACY_STORAGE_KEY | §17, S54 |
| `settings/utils/localData.js:1-3,5` | `cvVersions.js` CV_STORAGE_KEY, EMPTY_CV; `courses.js` LEARNING_STORAGE_KEY; `profile.js` PROFILE_STORAGE_KEY; `verification.js` CREDENTIAL_CHECKS | §19, S55 |
| `verification/components/SubmitEvidenceModal.jsx:4` | `verification.js` EVIDENCE_EXTENSIONS, MAX_EVIDENCE_SIZE_MB | §8, S34 |
| `verification/pages/VerificationPage.jsx:10` | `verification.js` ACCOUNT_EMAIL, CREDENTIAL_CHECKS, INITIAL_VERIFICATION, VERIFICATION_STORAGE_KEY | §8, S34 |
| `payments/components/CheckoutDialog.jsx:4` | `payments.js` formatMoney | §9a, S44, S47 |
| `payments/components/PaymentsTable.jsx:4-10` | `payments.js` PAYER_ROLE_LABEL, PAYMENT_KIND_LABEL, PAYMENT_STATUS, formatMoney, formatPaymentDate | §20, S44 |
| `payments/hooks/usePayments.js:4` | `payments.js` PAYMENTS_STORAGE_KEY, SEED_PAYMENTS | §20, S44, S45 |

Non-`data/` imports that also carry static data:
- `payments/hooks/usePayments.js` and `payments/components/CheckoutDialog.jsx` import `WORKSPACES` from `app/workspaces.js` to get the payer name (S1, S45, S47).
- `learning/hooks/useCourseCatalogue.js` imports `features/admin/courses/hooks/useCourses.js` and `features/admin/courses/utils/learnerCourse.js` (S50).
- `onboarding/pages/PreferencesStepPage.jsx` imports `LOCATIONS` from `components/layout/preferencesContext.js` (S6, S59).

### 31c. Supporting files outside the scope that were consulted (for cross-role and shell facts)

**Read fully**:
- `client/src/app/workspaces.js`, `router.jsx`, `App.jsx`, `lazyPage.js`
- `client/src/hooks/useLocalStorage.js`, `useSharedLocalStorage.js`, `useCountUp.js`
- `client/src/components/layout/WorkspaceLayout.jsx`, `Header.jsx`, `Sidebar.jsx`, `ProfileMenu.jsx`, `GlobalSearch.jsx`, `WorkspacePreferences.jsx`, `preferencesContext.js`
- `client/src/components/common/StatCard.jsx`
- `client/src/utils/downloadCsv.js`
- `client/src/features/auth/utils/session.js`
- `client/src/features/auth/pages/SignUpPage.jsx`
- `client/src/features/recruiter/company/data/company.js`
- `client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js`
- `client/src/features/admin/courses/data/courses.js`, `hooks/useCourses.js`, `utils/learnerCourse.js`
- `client/src/features/help/routes.jsx`
- `IMPLEMENTATION_PLAN.md`

**Read in part**:
- `client/src/features/auth/utils/validation.js:1-60`
- `client/src/features/recruiter/jobs/data/jobs.js:1-80`
- `client/src/features/recruiter/hiring-pipeline/data/pipeline.js:1-41`
- `client/src/features/recruiter/find-candidates/components/EarlierVersionModal.jsx:1-40`
- `client/src/features/admin/applications/pages/ApplicationsPage.jsx:28-50`
- `docs/USER_FLOW.md:1-60`
- `docs/FIGMA_SCREEN_INVENTORY.md` (candidate rows, via grep)

**Grep only**:
- `client/src/features/recruiter/jobs/pages/JobDetailsPage.jsx`
- `client/src/features/recruiter/find-candidates/components/MessageModal.jsx`
- every file under `features/` for readers of the privacy flags (none exist outside candidate settings)
