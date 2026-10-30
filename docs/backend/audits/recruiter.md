# Recruiter workspace: backend audit (Local WorkMan)

Date: 2026-10-29 · Mode: read-only (nothing in the repo was changed) · Repo: `C:\Users\tusha\OneDrive\Desktop\Ai Job`

**Scope:**
- The frontend now lives in `client/`; it was moved with `git mv` during this audit, and the contents are unchanged (12,839 lines before and after).
- `client/src/features/recruiter/**` (all of it).
- The recruiter sign-in, sign-up and onboarding parts of `client/src/features/auth/**` (the candidate `SignUpPage.jsx` is listed in Coverage for completeness).
- The shared Help page `client/src/features/help/**`, which is mounted in the recruiter workspace.
- Cross-role bridges that I read and cite:
  - `client/src/features/candidate/jobs/data/recruiterJobs.js`, `client/src/features/candidate/jobs/hooks/useJobListings.js`, `client/src/features/candidate/jobs/hooks/useApplications.js`
  - `client/src/features/admin/courses/hooks/useCourses.js`, `client/src/features/admin/courses/utils/learnerCourse.js`
  - `client/src/features/payments/` (all files)
  - the layout files `client/src/components/layout/{Header,ProfileMenu,GlobalSearch,WorkspacePreferences,Sidebar}.jsx` and `preferencesContext.js`
  - `client/src/app/workspaces.js`, `client/src/app/router.jsx`

**Method:** every JS/JSX file in scope was read in full with line numbers. CSS modules were scanned for any copy or data (see the Coverage section at the end). Every static item below cites `file:line`.

**Path rule:**
- Paths are relative to the repo root and start with `client/src/`.
- `docs/` and `IMPLEMENTATION_PLAN.md` stay at the repo root.
- A bare file name such as `JobStepFields.jsx:91`, or a bare `:line`, refers to the file named in that section's heading or in the same table row.

**Decisions applied:**
- The ones given in the brief.
- The four new decisions from the coordinator: candidate email verification and paid plan to apply; the extended candidate profile; messaging rules; and the new learning model. They are covered in Part B, and in the screens they touch.

**Wording rule:** where the code and the decisions do not settle something, it is raised as a question (`RQ-n`, Part H). I do not assume an answer.

---

## 0. Summary

**What the code covers today.**
- **Existing units:** 55 in total.
  - 33 routes: 26 workspace routes, including the 7 candidate-profile tabs and 2 redirects, plus 7 public routes (recruiter sign-in, sign-up and the 5 onboarding steps).
  - 9 job-wizard steps.
  - 12 dialogs, panels and menus.
  - The recruiter shell.
- **New screens required by the decisions:** 11.
  - Messages inbox and conversation.
  - Lesson viewer, quiz, quiz result/certificate, and the public certificate verification page.
  - Forgot password and reset password.
  - Recruiter email-code entry.
  - An "account status" gate (pending, rejected or suspended).
  - A job filter on the board (replaces a static chip).

**How the data is held today.**
- **All recruiter data is device-local.** It lives in 12 `lwm.*` localStorage keys plus one sessionStorage key (§0.1).
- Recruiter screens read three candidate keys and one admin key directly. This is how the "cross-role" behaviour works today.
- **Every number on the Overview except "Open positions" and "Shortlisted" is a literal:**
  - the Recommended and Applications KPIs;
  - all 6 funnel counts;
  - both 7-day momentum series;
  - the 3 talent cards.

  The rest of the workspace is no better:
  - "N relevant" on jobs is a seeded field.
  - "N aligned skills" on pipeline cards is seeded.
  - The course suggestions and their reasons ("3 applications", "3 published roles") are literal.

**Biggest structural gaps.**
1. The hiring pipeline is keyed by **candidate**, not by **application** (`client/src/features/recruiter/hiring-pipeline/data/pipeline.js:32-39`, `usePipeline.js:32,37`). It has one company-wide stage list, and there is no link between recruiter stages and the candidate's application status (`client/src/features/candidate/jobs/data/applications.js:49-54`).
2. Discovery ignores candidate privacy and consent flags (`discoverable`, `resumeVisible`, `matchingConsent`, `client/src/features/candidate/settings/data/settings.js:8`). The Find candidates list is a static array (`client/src/features/recruiter/find-candidates/data/candidates.js:13-104`).
3. **Several things exist only as demo copy and need real implementations:**
   - AI: everything is local rules, and the copy says "No AI model is connected".
   - Messaging, CV files, KYC uploads, OTP and payments.
4. Currency, location and language are hard-coded:
   - USD salary inputs and `$…k` formatting.
   - £ course prices with a fixed `'GBP'`.
   - Free-text "City, Country" locations, mostly US.
   - English enum values used as stored data.
   - About 700 English UI strings in scope.

### 0.1 Browser-storage inventory (every key must be replaced by the API)

| Key | Hook / file:line | Shape | Replaced by |
|---|---|---|---|
| `lwm.recruiter.jobs` | `client/src/features/recruiter/jobs/hooks/useJobs.js:17`; also read by `client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:18`, `client/src/features/candidate/jobs/hooks/useJobListings.js:15`, and admin Jobs/Overview/Moderation via `useJobs` | `Job[]` (seed `client/src/features/recruiter/jobs/data/jobs.js:26-99`) | `Job` collection |
| `lwm.recruiter.jobWizardDraft` | `client/src/features/recruiter/jobs/pages/CreateJobPage.jsx:10,32` | `{ values, step }` | server draft (RQ-26) |
| `lwm.recruiter.shortlist` | `client/src/features/recruiter/find-candidates/hooks/useShortlist.js:3,13` (shared) | `candidateId[]`, default `['oliver-park','james-chen']` (`:6`) | `ShortlistEntry` |
| `lwm.recruiter.match-job` | `client/src/features/recruiter/find-candidates/hooks/useMatchJob.js:4,14` (shared) | `jobId`, default `'senior-product-designer'` (`:5`) | `User.preferences.matchJobId` |
| `lwm.recruiter.candidate-activity` | `client/src/features/recruiter/find-candidates/hooks/useCandidateActivity.js:3,12` (shared) | `{ [candidateId]: {id,type,text,at}[] }` | `RecruiterActivity` |
| `lwm.recruiter.candidate-notes` | `client/src/features/recruiter/find-candidates/hooks/useCandidateNotes.js:3,9` (shared) | `{ [candidateId]: string }` | `CandidateNote` |
| `lwm.recruiter.pipeline` | `client/src/features/recruiter/hiring-pipeline/data/pipeline.js:1`, `client/src/features/recruiter/hiring-pipeline/hooks/usePipeline.js:26` | `{ stages[], placements{candidateId: stageId} }` | `PipelineStage` + `Application.stageId` |
| `lwm.recruiter.learning` | `client/src/features/recruiter/learning/data/courses.js:7`, `client/src/features/recruiter/learning/hooks/useRecruiterLearning.js:18` | `{ purchased[], completedLessons{} }` | `Enrollment`, `LessonProgress`, `QuizAttempt`, `Certificate` |
| `lwm.recruiter.company` | `client/src/features/recruiter/company/data/company.js:5`, `client/src/features/recruiter/company/pages/CompanyPage.jsx:31`; also read by `client/src/features/candidate/jobs/hooks/useJobListings.js:16` | `Company` | `Company` |
| `lwm.recruiter.settings.notifications` | `client/src/features/recruiter/settings/data/notifications.js:2`, `client/src/features/recruiter/settings/pages/NotificationsPage.jsx:10`, `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:63` | `{ inApp, email }` | `User.notificationSettings` |
| `lwm.onboarding.data` | `client/src/features/auth/utils/useOnboardingState.js:11` | `EMPTY_ONBOARDING_DATA` (`client/src/features/auth/data/onboarding.js:27-42`) | `User`, `Company`, `KycDocument` |
| `lwm.onboarding.completed` | `client/src/features/auth/utils/useOnboardingState.js:12` | `stepId[]` | `RecruiterOnboarding.stepsCompleted` |
| `lwm-session` | `client/src/features/auth/utils/session.js:8,16,25,34` | `'member' \| 'admin'`; candidate and recruiter **share** `member` (`:9`) | JWT |
| `lwm.session.demoReset` (sessionStorage) | `client/src/features/recruiter/settings/data/account.js:9`, `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:36,45,53` | flag | removed with Reset demo |
| `lwm.payments` (read/write) | via `client/src/features/payments/hooks/usePayments.js:169`, `client/src/features/payments/components/CheckoutDialog.jsx:20` | `Payment[]` merged with `SEED_PAYMENTS` | `Payment` (Stripe) |
| `lwm.admin.courses` (read) | via `client/src/features/recruiter/learning/hooks/useCourseCatalogue.js:36` → `client/src/features/admin/courses/hooks/useCourses.js:6` | admin `Course[]` | `Course` |
| `lwm.candidate.applications` (read) | via `useApplications()` in `client/src/features/recruiter/jobs/pages/JobDetailsPage.jsx:21`, `client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:16` | candidate `Application[]` | `Application` |
| `lwm.candidate.profile` (read) | `client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:17` | candidate profile | `CandidateProfile` |
| `lwm.location`, `lwm.language` | `client/src/components/layout/WorkspacePreferences.jsx:7-8`, read in `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:62` | strings | `User.country`, `User.language` |

### 0.2 Conventions used in the endpoint suggestions

- **Base path and auth:** every endpoint sits under `/api`. All endpoints need `Authorization: Bearer <JWT>`, except public auth, Stripe webhooks and certificate verification.
- **Guards:**
  - `R` = `role === 'recruiter'`.
  - `R✓` = recruiter whose company is **approved**; every workspace endpoint needs this.
  - `R…` = recruiter in onboarding (any status).
- **Records:** ids are Mongo ObjectIds. The client never builds ids.
- **Lists:** they accept `?page&limit`, and return `{ items, total }`.
- **Errors:** validation errors return `422 { errors: { field: messageKey } }`. Message keys map to the exact English strings quoted here, plus their ES and FR translations.
- **Money:** amounts are integers in minor units, plus an ISO currency.
- **Dates:** ISO 8601 UTC. The client formats them by the user's country and locale.
- **Enums:** stored as keys (e.g. `full_time`) and translated on the client (RQ-87).

---

# Part A: screens

## A0. Recruiter shell (sidebar, header, profile menu, global search)

**Source:** `client/src/app/workspaces.js:60-80`, `client/src/components/layout/*`.

### Data

| Item | Source (file:line) | Static? | Becomes |
|---|---|---|---|
| Sidebar name "Sarah Miller", subtitle "Acme Studio", avatar image | `client/src/app/workspaces.js:65` | yes | `GET /api/me` → `user.fullName` and `company.displayName`. The avatar becomes initials plus a colour derived from the id; recruiters have no photo upload (RQ-1). |
| Workspace switch Candidate↔Recruiter | `client/src/app/workspaces.js:67` (`showWorkspaceSwitch: true`), `Header.jsx:158` | config | **removed** (decision) |
| Location list | `client/src/components/layout/preferencesContext.js:18` (`'San Francisco, US','London, UK','New York, US','Berlin, Germany','Remote / Global'`) | yes | EU 27 + UK + Remote list. Persisted on `User.country` via `PATCH /api/me`. |
| Language list | `preferencesContext.js:21` (English/Español/Français; "only the label changes") | yes | `User.language`. Drives the translation files and the language of AI answers and emails. |
| Bell red dot | `client/src/components/layout/Header.jsx:171` (always rendered) | yes | unread count (RQ-77). Links to `settings/notifications` (`:167`). |
| Nav items | `workspaces.js:70-79` | config | Add **"Messages"** with an unread badge. It polls `GET /api/conversations/unread-count` every 15 s. |
| Global search | `GlobalSearch.jsx:16-23` (page list only) | config | Stays as a page jump list. No server call unless a real search is requested; not in the decisions, so not proposed. |

### Actions

- **Sign out** (`Sidebar.jsx:107` → `endSession`). It only clears the token on the client, since a JWT is stateless. Optionally `POST /api/auth/logout` to revoke it.

**i18n:** about 15 strings (nav labels and header).

## A1. `/recruiter/sign-in` (`client/src/features/auth/pages/SignInPage.jsx`)

**Purpose:** sign in to an existing account.

**Data:**
- `SIGN_IN_COPY.recruiter` (`:27-34`): static copy.
- Workspace tiles: `client/src/features/auth/data/workspaceChoices.js:4-7`.
- Hero footer: `client/src/features/auth/data/hero.js:2`.

**Actions:**

| Action | Now | Server |
|---|---|---|
| Sign in | `validateSignIn` (`client/src/features/auth/utils/validation.js:54-59`), then `startSession('recruiter')` (`SignInPage.jsx:62`) with no credential check, a 500 ms timer, and navigate to `/recruiter`. | `POST /api/auth/login {email,password}` → `200 {token, user:{id, role, fullName, language, country, emailVerified}, recruiter?:{onboardingStatus, nextStep}}`. Wrong credentials → `401 'auth.invalid'`. The client routes by role and status: `onboardingStatus !== 'approved'` → `/recruiter/onboarding/<nextStep or review>` (RQ-5, RQ-14). |
| Workspace picker | Flips the route between `/sign-in` and `/recruiter/sign-in` (`WorkspacePicker.jsx:43-47`). | None. Keep it as two entry pages, or drop it (RQ-14). |
| Forgot password | **Does not exist.** | New: `POST /api/auth/forgot-password {email}` → `204` (always 204, so the response does not reveal whether an account exists). An email in the user's language links to `/reset-password?token=`. `POST /api/auth/reset-password {token,password}` → `204`. |

**Validation to mirror:**
- Email:
  - required: "Enter your email address."
  - format `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (`validation.js:7`): "Enter a valid email address, like you@company.com."
- Password required: "Enter your password."

**Demo copy to change:**
- "New to matchpoint?" (`SignInPage.jsx:104`); the brand is inconsistent.
- `DemoNote` (`client/src/features/auth/components/DemoNote.jsx:6-9`, "Demo only. Credentials are not sent or stored…") must be removed.
- Hero fallback "matchpoint." (`client/src/components/layout/AuthLayout.jsx:63`).

**i18n:** about 15 strings.

## A2. `/recruiter/sign-up` (`client/src/features/auth/pages/RecruiterSignUpPage.jsx`)

**Purpose:** create a recruiter account. This page acts as onboarding step 1 and continues to `/recruiter/onboarding/company` (`:46-47`).

**Fields** (`client/src/features/auth/components/RecruiterAccountFields.jsx`): fullName, jobTitle, workEmail, phone, password, confirmPassword, plus terms (`TermsConsent.jsx`).

**Now:**
- Validates, then waits 500 ms (`:43`).
- Saves the non-secret fields to `lwm.onboarding.data` (`:45`), marks `account` complete (`:46`) and navigates.
- The password is discarded.

**Server:** `POST /api/auth/register/recruiter`

- **Payload:** `{fullName, jobTitle, workEmail, phone, password, acceptTerms:true, language, country}`.
- **Creates:**
  - a `User` with `role 'recruiter'`, a bcrypt-hashed password, `termsAcceptedAt` and `termsVersion`;
  - a `RecruiterOnboarding` with `status:'in_progress'` and `stepsCompleted:['account']`.
- **Response:** `201 {token, user, onboarding}`.
- **Conflicts:** an existing email → `409 'auth.emailTaken'`.
- **Email code:** optionally sends the email verification code now (RQ-8).

**Validation to mirror** (`validateRecruiterAccount`, `validation.js:73-82`):
- fullName required: "Enter your full name."
- jobTitle required: "Enter your job title or role."
- workEmail:
  - required: "Enter your work email."
  - must match the pattern: "Enter a valid email address, like you@company.com."
- phone (`checkPhone`, `:19-26`):
  - required: "Enter your phone number."
  - regex `/^\+?[\d\s().-]+$/` and 7–15 digits: "Enter a valid phone number, using 7 to 15 digits."
- password:
  - required: "Enter a password."
  - length ≥ 8: "Use at least 8 characters." (`:8,40-48`)
- confirmPassword:
  - required: "Re-enter your password."
  - must equal password: "Passwords do not match."
- terms must be true: "Accept the Terms of Service and Privacy Policy to continue."
- The Create button stays disabled until terms are ticked (`CreateAccountButton.jsx:12`, `RecruiterSignUpPage.jsx:66`).
- **No maximum lengths exist on the client.** Suggested server limits: name ≤ 100, title ≤ 100, email ≤ 254, password ≤ 128. Normalise the phone to E.164, which needs a country code (RQ-10).

**Demo copy to change:**
- Password hint "Don’t use a real password in this demo." (`RecruiterAccountFields.jsx:55`).
- Full-name placeholder 'Alex Morgan', which is the demo candidate's name (`:17`).

**i18n:** about 25 strings, including validation messages.

## A3. Onboarding shell `/recruiter/onboarding/*` (`client/src/features/auth/components/OnboardingLayout.jsx`)

**Data:**
- Steps: `client/src/features/auth/data/onboarding.js:2-8` (account, company, kyc, verify, review), with labels and paths.
- Step state (current, done, todo) comes from `completed` (`:45-48`).
- Percent = `(index+1)/5*100` (`:42`), shown as "N% complete" (`:120`).
- **Guard:** a step can only open when every earlier step is complete; otherwise the user is redirected (`:35-40`).

**Becomes:** `GET /api/recruiter/onboarding`

```
→ { status: 'in_progress'|'pending_review'|'approved'|'rejected'|'suspended',
    stepsCompleted: ['account','company','kyc','verify'],
    account:  {fullName, jobTitle, workEmail, phone, emailVerified, phoneVerified},
    company:  {legalName, website, businessEmail, industry, size, country, registrationDetails, businessAddress},
    documents: [{id, type, fileName, size, mimeType, uploadedAt}],
    submittedAt, decidedAt, decisionReason }
```

- Keep the guard on the client. The server also refuses `submit` while any step is incomplete.
- **Static copy to change:** the privacy note "Non-sensitive details are saved on this device. Passwords, codes, and selected files are never retained." (`:106-108`).
- **i18n:** about 20 strings.

## A4. Step 1 `/recruiter/onboarding/account` (`client/src/features/auth/pages/AccountRegistrationPage.jsx`)

**Now:**
- Same fields and validation as A2.
- Passwords are optional once the step is complete (`:37`; `validation.js:42`).
- Values are saved locally; the password is kept in memory as "secrets" (`:31`).

**Server:** `PUT /api/recruiter/onboarding/account {fullName, jobTitle, workEmail, phone}` → `{account}`.
- Changing `workEmail` or `phone` resets the matching verified flag (RQ-10).
- The password is not editable here (RQ-7).

**i18n:** about 6 strings, plus the shared fields.

## A5. Step 2 `/recruiter/onboarding/company` (`client/src/features/auth/pages/CompanyInformationPage.jsx`)

**Fields:** companyName ("Legal company name"), website, businessEmail, industry, companySize (select from `onboarding.js:14-21`), country (free text), registrationDetails (optional), businessAddress (textarea).

**Now:** "Back" saves without validating (`:29-32`). "Continue" validates, saves and completes the step.

**Server:** `PUT /api/recruiter/onboarding/company {…}` → `{company}`.
- Marks `company` complete when valid.
- A separate `PATCH` (no completion) handles Back.

**Validation to mirror** (`validateCompany`, `validation.js:84-97`):
- companyName required: "Enter the legal company name."
- website (`checkWebsite`, `:28-37`):
  - required: "Enter your company website."
  - an `https://` prefix is added automatically when missing; the URL must parse and its hostname must contain a dot: "Enter a valid website, like https://example.com."
  - ⚠ This differs from the Company page rule (A30): there a regex requires `http(s)://`.
- businessEmail:
  - required: "Enter the business email."
  - must match the pattern: "Enter a valid email address, like hello@company.com."
- industry required: "Enter your industry."
- companySize required: "Select a company size."
- country required: "Enter the country."
- businessAddress required: "Enter the business address."

**Static items:**
- The `COMPANY_SIZES` labels use a hyphen (`onboarding.js:14-21`); the Company page uses an en dash (RQ-4).
- The country is free text (`:100-107`; RQ-13).

**i18n:** about 22 strings.

## A6. Step 3 `/recruiter/onboarding/kyc` (`client/src/features/auth/pages/KycVerificationPage.jsx`, `client/src/features/auth/components/DocumentUpload.jsx`)

**Data:** `DOCUMENTS` (`:13-30`):
- `identity` (required)
- `registration` (required)
- `authorization` (optional)

**Now:**
- A real `<input type=file>` with `accept=".pdf,.jpg,.jpeg,.png,…"` (`DocumentUpload.jsx:22`).
- Only the file **name** is kept (`:10-13`).
- The extension is checked with `/\.(pdf|jpe?g|png)$/i` (`validation.js:9,100-102`): "Choose a PDF, JPG, or PNG file."
- Required documents (`validateKyc`, `:104-109`):
  - "Choose your government-issued identity document."
  - "Choose your company registration certificate."

**Server:**
- `POST /api/recruiter/onboarding/documents`
  - multipart: `type`, `file`
  - checks: MIME by magic bytes, size limit (RQ-11)
  - storage: on disk, at `uploads/kyc/<userId>/<uuid>.<ext>`
  - response: `201 {id,type,fileName,size,mimeType,uploadedAt}`; replaces any previous file of the same type
- `DELETE /api/recruiter/onboarding/documents/:id` → `204`, allowed only while `in_progress` or `rejected`.
- `POST /api/recruiter/onboarding/kyc/complete` → `422` if identity or registration is missing; otherwise marks the step done.

**Copy to change:** "This local prototype retains file names only. It does not upload or store document contents." (`:88`).

**i18n:** about 14 strings.

**Cross-role:** admins must be able to view and download the documents in the account-review dialog: `GET /api/admin/recruiters/:id/documents/:docId` (stream, audited).

## A7. Step 4 `/recruiter/onboarding/verify` (`client/src/features/auth/pages/VerifyAccountPage.jsx`)

**Data:** a checklist (`:29-34`): company name, identity file name, registration file name, authorization file name or "Not provided".

**Now:**
- Two OTP fields (`maxLength 6`, `inputMode numeric`).
- Both compare against `DEMO_OTP = '123456'` (`onboarding.js:11`; `validation.js:111-118`):
  - empty: "Enter the code for your email." / "Enter the code for your phone."
  - mismatch: "That code does not match. Use the demo code shown below the field."
- The hints print the code: "Demo code for {email}: 123456" (`:72`, `:84`).
- A 600 ms timer, then step 5.

**Server** (decision: an email code by SMTP; the phone code stays on screen):
- `POST /api/recruiter/onboarding/verification/email/send` → `204`.
  - Sends a 6-digit code to `workEmail` in the user's language, from a template `email.verifyCode`.
  - Stores a hashed code with an expiry.
  - Rate-limited (RQ-10).
- `POST /api/recruiter/onboarding/verification/phone/send` → `200 {code}`, displayed on screen (RQ-9).
- `POST /api/recruiter/onboarding/submit {emailCode, phoneCode}`:
  - checks both codes and that steps 1–3 are complete;
  - sets `emailVerifiedAt`, `phoneVerifiedAt`, `status:'pending_review'` and `submittedAt`;
  - creates the admin account-review queue item;
  - writes an audit entry;
  - responds `200 {status}`.
  - Errors: `422 {errors:{emailCode:'otp.mismatch'|'otp.expired', phoneCode:…}}`.

**Copy to change:**
- The hints at `:72` and `:84`.
- "OTP delivery and automated document validation are simulated…" (`:103-106`).

**UI to add:** a "Resend code" control, and a "Send code" trigger when the step opens.

**i18n:** about 14 strings.

## A8. Step 5 `/recruiter/onboarding/review` (`client/src/features/auth/pages/AdminReviewPage.jsx`)

**Data:**

| Item | Source | Static? | Becomes |
|---|---|---|---|
| Applicant | `data.fullName` (`:17`) | local | API |
| Company | `data.companyName` (`:18`) | local | API |
| Email "Verified" | literal (`:19`) | yes | `account.emailVerified` |
| Phone "Verified" | literal (`:20`) | yes | `account.phoneVerified`; wording per RQ-9 |
| Documents "N submitted" | computed from file names (`:14,21`) | local | `documents.length` |
| "Locked pending approval" | literal (`:22`) | yes | from `status` |
| Badge "Under Review" | literal (`:37`) | yes | `status`: pending, approved, rejected (with `decisionReason`), suspended |

**Actions:**
- "Return to sign in" stays.
- "Recruiter tools locked" is a disabled button (`:61-63`). It becomes "Open recruiter workspace" when `status === 'approved'`.
- **New:** when `rejected`, show the reason and an "Edit and resubmit" action (RQ-6).

The page polls `GET /api/recruiter/onboarding`, or refreshes on visit.

**i18n:** about 15 strings.

## A9. Overview `/recruiter` (`client/src/features/recruiter/overview/pages/OverviewPage.jsx` and components)

**Purpose:** recruiter dashboard.

### Data

| Item | Source (file:line) | Static? | Becomes |
|---|---|---|---|
| Eyebrow "Good morning, Sarah" | literal `OverviewPage.jsx:60` | **yes** (name and time of day) | Client: the part of day from local time plus `user.firstName` (RQ-63) |
| Title and description | `:61-62` | copy | i18n |
| KPI Open positions | `jobs.filter(status==='published').length` (`:25,30`) | computed from the local store | `stats.openPositions` = count of the company's jobs with `status:'published'` |
| KPI Recommended candidates | `OVERVIEW_STATS.recommendedCandidates` = **6** (`client/src/features/recruiter/overview/data/overview.js:5`, used `:36`) | **yes** | distinct candidates above the match threshold for ≥ 1 open job (RQ-34) |
| KPI Applications | `OVERVIEW_STATS.applications` = **6** (`overview.js:6`, used `:43`) | **yes** | count of active applications (RQ-60) |
| KPI Shortlisted | `shortlistedIds.length` (`:50`) | computed (device) | count of `ShortlistEntry` for the company |
| KPI captions | `:31,37,44,51` | copy | i18n |
| Hiring momentum: periods | `MOMENTUM_PERIODS` (`overview.js:22-35`): This week and Last week, applications `[8,12,9,18,14,21,17]` / `[6,9,11,14,12,16,10]`, shortlisted `[9,18,14,21,17,8,12]` / `[4,7,8,12,9,13,8]` | **yes** | `GET /api/recruiter/overview/momentum?period=this-week\|last-week&tz=Europe/Berlin` → `{days:[{date, applications, shortlisted}]×7}`. Applications are bucketed by `Application.appliedAt` per local day; shortlisted by `ShortlistEntry.createdAt` (RQ-61). |
| Day labels | `MOMENTUM_DAYS` `['Mon',…,'Sun']` (`overview.js:20`) | yes | `Intl.DateTimeFormat(locale,{weekday:'short'})` of each returned date |
| Y scale | `SCALE_MAX = 25` (`HiringMomentumCard.jsx:9`); bars overflow above 25 | yes | dynamic: a nice ceiling of the max value |
| Subtitle | "Illustrative activity across your open roles" (`HiringMomentumCard.jsx:75`) | demo copy | "Activity across your open roles" |
| Funnel | `FUNNEL_STAGES` (`overview.js:10-17`): Applied 3, Screening 0, Shortlisted 2, Interview 1, Offer 0, Hired 0; stage names fixed | **yes** | `funnel:[{stageId,name,count}]` from the company's `PipelineStage`s in order. Count = active applications per stage, excluding rejected and withdrawn (RQ-62). |
| Talent worth meeting | `TALENT` (`overview.js:38-78`): Emma Wilson, James Chen, Sofia Martinez, each with headline, years, workPreference, US/UK location, skills, `matchedSkills`, availability, tone | **yes** | `GET /api/recruiter/overview/talent?limit=3` → top discoverable candidates by match across open jobs, not yet shortlisted or applied. Each card carries `{candidateId,name,photoUrl,initials,headline,experienceYears,workMode,location,skills[0..2],relevantSkills,availability,profileComplete,bestJob:{id,title}}`. |
| Avatar tone | `person.tone` → CSS classes `.lilac/.mint/.peach` (`client/src/features/recruiter/overview/components/TalentCard.module.css:30-43`) | yes | the candidate's photo (decision 2), else initials with a hashed colour |
| "Core profile ready" | literal `TalentCard.jsx:61` | **yes** | the computed `profileComplete` flag (decision 2) |
| "N relevant skills · Y years of experience · mode" and detail | `TalentCard.jsx:78-84` from `matchedSkills` | static input | `relevantSkills` from the match service. The AI narrative appears on expand (RQ-35). |
| Your open roles | first 5 published (`OverviewPage.jsx:19,118`) | computed | `GET /api/recruiter/jobs?status=published&limit=5&sort=-publishedAt` (+ `total` for the "View all jobs" link) |

### Actions

| Action | Now | Server |
|---|---|---|
| KPI card links | navigate | none |
| Bookmark on a talent card | `useShortlist().toggle` | `PUT` or `DELETE /api/recruiter/shortlist/:candidateId` |
| Expand "AI Match Insights" | local toggle | `GET /api/recruiter/candidates/:id/match?jobId=<bestJob>&lang=` (lazy) |
| "Compare" checkbox | local state only, **no effect** (`TalentCard.jsx:89-95`) | none (RQ-39) |
| Ai Job Summary (open roles) | A11 | A11 |
| Create a job | link | none |
| Jobs table manage menu | A10 | A10 |
| Momentum bars/line toggle, period select | local | the period select fires the momentum request |

**i18n:** about 45 strings (Overview 23, funnel 4, momentum 9 plus 7 weekdays, talent card 8).

**Cross-role:** the counts read applications made by candidates.

**Decision 1 effect:** applications exist only from candidates who are email-verified, complete and paying, so every applicant has a full profile.

## A10. Jobs list `/recruiter/jobs` (`client/src/features/recruiter/jobs/pages/JobsPage.jsx`, `client/src/features/recruiter/jobs/components/JobsTable.jsx`, `JobStatusBadge.jsx`)

### Data

| Item | Source | Static? | Becomes |
|---|---|---|---|
| Rows | `useJobs()` → `lwm.recruiter.jobs` (seed `client/src/features/recruiter/jobs/data/jobs.js:26-99`: 3 Acme jobs in San Francisco, New York and London, USD 120–180 k, `relevant` 5/6/5, `applications` 0/2/1) | **seeded** | `GET /api/recruiter/jobs?status=&q=&sort=title\|relevant\|status&dir=asc\|desc&page=` → `{items:[{id,title,location,country,city,workPreference,employmentType,status,restricted,relevantCount,applicationCount,createdAt,publishedAt}], total, statusCounts}` |
| Tabs | `TABS` (`JobsPage.jsx:13-18`): All, Published, Paused, Draft (no Closed) | config | i18n, plus a Closed tab (RQ-24) |
| "N relevant" ("Candidates" column) | `job.relevant` (`JobsTable.jsx:133`) | **seeded field** | `relevantCount` (RQ-30) |
| Role meta "location · employmentType" | `:127` | data | localised enum label |
| Status pill | `JOB_STATUSES` (`client/src/features/recruiter/jobs/data/jobs.js:16-21`), tones (`JobStatusBadge.jsx:4`) | enum | i18n; show a "Restricted" state (RQ-28) |

### Actions

| Action | Now | Server |
|---|---|---|
| Filter, search | client: `matchesQuery` over title, location, workPreference, employmentType (`JobsPage.jsx:20-26`) | query params `status`, `q` (case-insensitive contains over title, city, country and the translated enum labels, or let the client filter). Recommend the server filters on `q`, `status` and pagination. |
| Sort | client: `compareBy` (`:28-31`). `relevant` is numeric; `status` sorts alphabetically **by key** | `sort` param. Status order is defined in RQ-24. |
| Manage → Edit job | link to `/jobs/:id/edit` | A13 |
| Manage → View candidates | link to `/recruiter/find-candidates` (**not job-scoped**, `JobsTable.jsx:56`) | link to `/recruiter/find-candidates?jobId=:id` |
| Status changes | `STATUS_ACTIONS` (`JobsTable.jsx:11-22`): published→paused or closed; paused→published or closed; draft→published; closed→published (Reopen). Closing opens a confirm dialog (`:151-164`). | `PATCH /api/recruiter/jobs/:id/status {status}` → `200 {job}`. The server enforces this transition table, runs **validateAll on any → published** (RQ-23), stamps `publishedAt` and `firstPublishedAt`, triggers job-alert emails on the first publish (RQ-22), refreshes the embedding and relevance, and refuses while `restricted` (`409`). |
| "N relevant" link | to `/recruiter/find-candidates` (`:132`) | add `?jobId=` |
| Eye icon | view details | none |
| Ai Job Summary | over every non-draft job (`JobsPage.jsx:62`) | A11 |

**Empty states:** `:92-107`, copy only.

**i18n:** about 35 strings (page 13, table 16, badge 4, dialog copy).

## A11. AI job summary dialog (`client/src/features/recruiter/jobs/components/AiJobSummary.jsx`)

It is used in three places:
- Overview: published jobs, with a picker.
- Jobs: non-draft jobs, with a picker.
- Job details: a single job.

**Admin** has its own `JobSummaryModal`, which imports `formatSalary` from `client/src/features/recruiter/jobs/data/jobFields.js`.

### Data now (all computed locally from the job)

| Item | Source (file:line) | Becomes |
|---|---|---|
| Lead sentence | `describeRole` (`:10-18`), English, "per year" (`:17`) | OpenAI-generated `summary` in the viewer's language |
| Role readiness checks | `readiness` (`:20-40`): status, skill counts, missing compensation/work model/location/experience | Deterministic checks computed on the server, with texts as i18n keys. They stay rule-based because they are facts. |
| Key facts | `facts` (`:43-50`) | Computed; enum labels translated; salary formatted in the job's currency |
| Required skills list | `job.requiredSkills` | data |
| Badges "Local structured summary" / "Recruiter perspective" | literals `:57`, `:59` | "AI summary" plus model and generation date |
| Disclaimer "…existing job data from this device. No connected AI model…" | literal `:107-110` | a new AI disclaimer ("AI-generated from the job posting; check before relying on it; not a hiring decision") |

### Server

`GET /api/recruiter/jobs/:id/summary?lang=es`

```
→ { jobId, language, generatedAt, model, sourceHash,
    summary: { overview, highlights:[string], considerations:[string] },
    readiness: [{key, ok, params}],
    facts: {...} }
```

- **Caching:** results are stored per `(jobId, language, sourceHash)`. They are regenerated when the job changes. `POST …/summary/regenerate` → same shape.
- **OpenAI input:** title, brief, responsibilities, skills, level, experience, location, work model, salary and currency, and the company's industry and size.
- **OpenAI output:** a JSON schema for `summary`.
- **Language:** the answer uses the user's language (decision).
- **Errors:** a timeout or failure → `503 {fallback:true}`. The client then shows facts and readiness only.

**i18n:** about 25 strings.

**Cross-role:** the same endpoint family is used by admin (`/api/admin/jobs/:id/summary`) and by the candidate job summary (candidate audit).


## A12. Create a job `/recruiter/jobs/new`: 9-step wizard

**Files:** `client/src/features/recruiter/jobs/pages/CreateJobPage.jsx`, `client/src/features/recruiter/jobs/components/JobWizard.jsx`, `JobStepFields.jsx`, `SkillPicker.jsx`, `JobPosting.jsx`, `client/src/features/recruiter/jobs/data/jobFields.js`.

**Shell:**
- Steps: `JOB_STEPS` (`jobFields.js:9-19`).
- The stepper only lets you go back to steps already reached (`JobWizard.jsx:26,61,100`).
- "Continue" validates the current step (`:64-70`).
- The finish buttons (`CreateJobPage.jsx:13-16`) are "Save as draft" (`status:'draft'`) and "Publish job" (`status:'published'`).
- A draft only checks `basics`. Publish checks every step and jumps to the first invalid one (`JobWizard.jsx:72-81`).
- **Autosave:** every change is written to `lwm.recruiter.jobWizardDraft` (`CreateJobPage.jsx:10,32,56`). The note says "New job drafts are automatically saved in this browser." (`:54`).
- **Finish:**
  - `addJob` (`useJobs.js:23-30`) builds an id `slugify(title)-base36(now)`, sets `relevant:0` and `createdAt`, and prepends the job.
  - The wizard draft is cleared.
  - The page navigates to the details page with a notice: "Job published. It now appears in your open roles." or "Draft saved. Find it under Draft in your jobs." (`:39-42`).
- Form values are converted with `valuesToJob` (`jobFields.js:85-104`): every string is trimmed, responsibilities are split per line with empty lines dropped, and numbers are parsed with `toNumber` (empty becomes `null`).

**Server endpoints:**
- `POST /api/recruiter/jobs {fields…, status:'draft'|'published'}` → `201 {job}`.
  - Validation: `basics` only for a draft; everything for publish.
  - **The company is set from the user's company.**
  - Side effects on publish: embedding, `relevantCount`, `firstPublishedAt`, job-alert emails to matching candidates (decision), and an admin audit entry (RQ-89).
- Autosave follows RQ-26.

**Wizard steps:**

| # | Step id / label | Fields and UI (file:line) | Validation to mirror (exact messages) | Static items |
|---|---|---|---|---|
| 1 | `basics` "Basic information" | title, company, employmentType (`JobStepFields.jsx:12-26`) | **title:** required → "Enter a job title, like Senior Product Designer."; ≥ 3 characters after trim → "Job title must be at least 3 characters." **company:** required → "Enter the company name." **employmentType:** must be one of `EMPLOYMENT_TYPES` (`client/src/features/recruiter/jobs/data/jobs.js:24`: Full-time, Part-time, Contract, Internship) → "Choose an employment type." (`jobFields.js:114-119`) | Default company `'Acme Studio'` (`jobFields.js:40`) → from the Company (RQ-29). Default employmentType `'Full-time'` (`:41`). |
| 2 | `responsibilities` "Responsibilities" | description ("The brief"), responsibilities (one per line) (`:27-43`) | **description:** required → "Write a short brief describing the role."; ≥ 40 characters (`MIN_DESCRIPTION_LENGTH`, `jobFields.js:54`) → "The brief needs at least 40 characters so candidates understand the role." **responsibilities:** optional, no limit (RQ-17). | Hints are copy only. |
| 3 | `required-skills` | SkillPicker (`:44-54`) | ≥ 1 skill → "Add at least one required skill." (`jobFields.js:126-128`). In the picker, a case-insensitive duplicate within the same list → "{skill} is already in the list." (`SkillPicker.jsx:18-21,38`). Typed skills are **not** checked against the other list; only suggestions are filtered (`:13`). The server must reject a skill in both lists (RQ-17). | `SKILL_SUGGESTIONS`, 12 fixed skills (`jobFields.js:23-36`; RQ-18) |
| 4 | `preferred-skills` | SkillPicker (`:55-64`) | none (optional) | same |
| 5 | `experience` | level select, experienceYears (`:65-76`) | **level** must be one of `JOB_LEVELS` (`jobFields.js:21`: Junior, Mid-level, Senior, Lead) → "Choose a seniority level." **experienceYears** must be a whole number 0–50 (`isWholeNumber`, `:106-109`) → "Enter the minimum years of experience as a whole number from 0 to 50." | |
| 6 | `location` "Location & work" | location (free text), workPreference, salaryMin, salaryMax (`:77-107`) | **location:** required → "Enter the job location, like San Francisco, US." (`jobFields.js:136`). **workPreference** must be one of `WORK_PREFERENCES` (`jobs.js:23`: Remote, Hybrid, On-site) → "Choose Remote, Hybrid or On-site." **salaryMin/Max:** optional; if present must be a number ≥ 0 → "Enter the minimum salary as a positive number." / "Enter the maximum salary as a positive number."; if both are present, max ≥ min → "Maximum salary must be at least the minimum salary." (`:138-145`). ⚠ Decimals and 0 are accepted; there is no upper bound. | Labels "Minimum salary (USD per year)" / "Maximum salary (USD per year)" (`JobStepFields.jsx:91,97`) and placeholders "e.g. 140000" / "e.g. 180000" (`:93,99`) → currency per RQ-16. Location placeholder "e.g. San Francisco, US" (`:81`) → country picker plus city (RQ-15). **Decision 2 / RQ-19:** this step is where "Required languages + level" and "Visa sponsorship available" would go. |
| 7 | `analysis` "AI analysis" | `analyzeJob` checks (`jobFields.js:179-217`): ≥ 2 title words; brief ≥ 120 characters; ≥ 3 responsibilities; 3–8 required skills; full salary range. English texts with plural ternaries. | none | Copy "A local, rule-based review… No AI model is connected…" (`JobStepFields.jsx:111-114`). Becomes `POST /api/recruiter/jobs/analyze {values}` → `[{key, ok, params}]` (rules), or AI (RQ-25). |
| 8 | `review` | `JobPosting` preview plus meta line (`JobStepFields.jsx:129-140`; `jobMetaLine` `jobFields.js:174-176`, `formatSalary` `:162-171`) | none | "Untitled role" fallback (`:133`). Salary formatted as `$…k`. |
| 9 | `publish` | Summary `<dl>`: Role, Where, Required skills count, Salary (`:141-170`) | full validation on Publish | "Not set", "None", "Not shown" fallbacks |

**Not covered by the client at all:** max lengths, a maximum skill count, salary currency, and a structured country. All of these are raised in RQ-15 to RQ-17.

**i18n:** about 90 strings (fields 36, validation and analysis 41, wizard and page 13).

## A13. Edit job `/recruiter/jobs/:jobId/edit` (`CreateJobPage.jsx:65-95`)

**Data:** `getJob(jobId)` → `jobToValues` (`jobFields.js:66-82`). If the job is not found → `JobNotFound`.

**Finish actions:**
- For a draft: "Save as draft" or "Publish job".
- Otherwise: a single "Save changes" that keeps the current status (`:71-72`) and requires **validateAll**.
- Notice: "Changes saved on this device." (`:76`). Note: "Changes are saved on this device when you finish." (`:86`).

**Server:**
- `GET /api/recruiter/jobs/:id` → `{job}`.
- `PUT /api/recruiter/jobs/:id {fields…, status?}` → `{job}`.
  - Owner company only, otherwise `404`.
  - Same validation as create.
  - Regenerates `sourceHash`, the embedding and the relevant count.
  - Invalidates the AI summary cache.
  - Does not repeat job-alert emails (RQ-20).
  - If the edit moves a draft to published, the publish side effects run.

**i18n:** about 6 strings.

## A14. Job details `/recruiter/jobs/:jobId` (`client/src/features/recruiter/jobs/pages/JobDetailsPage.jsx`, `JobPosting.jsx`, `JobTalentList.jsx`, `JobNotFound.jsx`)

### Data

| Item | Source | Static? | Becomes |
|---|---|---|---|
| Notice banner | `location.state.notice` (`:25-30`) | UI | client only, with translated keys |
| Eyebrow status, title, meta line | `JOB_STATUSES`, `jobMetaLine` (`:54-56`) | data | API job, with currency formatting |
| Brief, responsibilities, skills | `JobPosting.jsx:20-37`; fallback "No brief has been added yet. Use Edit role to add one." (`:23`) | data | API. Add a "Translate" action on the brief and responsibilities (decision; RQ-48). |
| Discover relevant talent | `RELEVANT_TALENT.slice(0, job.relevant)` (`JobTalentList.jsx:9`; data `client/src/features/recruiter/jobs/data/relevantTalent.js:5-10`, 4 people with literal headlines and tones). The seeded `relevant` values (5, 6, 5) are higher than the 4 people listed. | **yes** | `GET /api/recruiter/jobs/:id/relevant-talent?limit=4` → `[{candidateId,name,photoUrl,initials,headline,experienceYears}]` from the match service (RQ-30). Each row links to `/find-candidates/:id?jobId=`. |
| Role activity "N local applications · M profiles with relevant listed skills" | `(job.applications ?? 0)` seed **+** non-withdrawn candidate applications to `acme-<id>` (`:34-36,88`) | **mixed / seeded** | `applicationCount` (active applications) and `relevantCount`. Copy: drop "local". |
| AI tip text | `:105-111` | copy | i18n |

### Actions

| Action | Now | Server |
|---|---|---|
| Ai Summary | A11 | A11 |
| Edit role | link to A13 | |
| Discover candidates | `/recruiter/find-candidates` (`:93`; not job-scoped) | add `?jobId=` |
| Review applications | `/recruiter/applications` (`:99`) | add `?jobId=` (RQ-56) |
| Back to jobs | link | |

**Missing in the UI:** a status menu on this page (it only exists in the table). A delete action does not exist anywhere (RQ-21).

**i18n:** about 15 strings.

## A15. Find candidates `/recruiter/find-candidates`

**Files:** `client/src/features/recruiter/find-candidates/pages/FindCandidatesPage.jsx`, `client/src/features/recruiter/find-candidates/components/DiscoveryToolbar.jsx`, `SortSelect.jsx`, `CandidateCard.jsx`, `CandidateAvatar.jsx`, `MatchInsights.jsx`, `CompareModal.jsx`, `client/src/features/recruiter/find-candidates/utils/discovery.js`, `client/src/features/recruiter/find-candidates/utils/matchEvidence.js`, `client/src/features/recruiter/find-candidates/hooks/useMatchJob.js`, `client/src/features/recruiter/find-candidates/hooks/useShortlist.js`.

### Data

| Item | Source (file:line) | Static? | Becomes |
|---|---|---|---|
| Candidate list | `candidates` (`client/src/features/recruiter/find-candidates/data/candidates.js:13-104`): 6 people (Emma Wilson, Oliver Park, James Chen, Sofia Martinez, Daniel Kim, Aisha Patel) with name, initials, avatar `{bg,fg}`, title, company, headline, location (4 of 6 in the US), workMode, experienceYears, skills, free-text availability, `profileStatus 'Core profile ready'` | **yes** | `GET /api/recruiter/candidates?q&jobId&workMode&availability&minYears&skill&rightToWork&language&languageLevel&verified&sort&page&limit` → `{items:[CandidateCard], total, facets:{availability[], skills[], languages[]}}`. Only candidates allowed by privacy and consent (RQ-31, RQ-33). |
| Result count "N candidates · Profile evidence, not hiring decisions" | `FindCandidatesPage.jsx:60-65` | computed | `total`; plural via i18n |
| "Match candidates to a job" select | `useMatchJob` (open = published or paused jobs; `useMatchJob.js:16-17`), stored in `lwm.recruiter.match-job`, default `'senior-product-designer'` (`:5`) | device | Options from `GET /api/recruiter/jobs?status=published,paused&fields=id,title`. Selection persisted in `PATCH /api/me/preferences {matchJobId}`, or the URL `?jobId=` |
| Filter options | `WORK_MODES` (`DiscoveryToolbar.jsx:8`); `AVAILABILITIES` = distinct free-text availability of the static list (`:9`); `SKILLS` = distinct skills of the static list (`:10`); `MIN_YEARS` `[3,5,7,9]` (`:11`) | **yes / derived from static data** | work modes and availability from enum keys (RQ-37); skills and languages from facets; min years kept |
| Search placeholder "Name, role, skill, or ‘senior Figma remote’" | `:29` | copy | i18n |
| Sort options | `SORT_OPTIONS` (`client/src/features/recruiter/find-candidates/utils/discovery.js:3-7`): recommended, experience, name | config | `sort=recommended\|experience\|name` (+ `recent`?) |
| Card body | `CandidateCard.jsx:38-67`: headline, years, workMode, location, first 3 skills, availability, `profileStatus` | static data | `CandidateCard` DTO (see Part B, decision 2) |
| Avatar colours | `candidate.avatar.bg/fg` (`CandidateAvatar.jsx:9`) | static data | photo URL (decision 2), else initials with a hashed palette |
| AI Match Insights summary | `summarizeMatch` (`matchEvidence.js:19-28`): "N relevant skills · Y years of experience · mode" | computed from static | `match.relevantSkills.length` from the server |
| AI Match Insights detail | `getMatchEvidence` (`matchEvidence.js:8-16`): relevant = job required+preferred skills listed by the candidate (case-insensitive); missing = required skills not listed. "Potential gap" includes the invented `candidateDetails[id].potentialGap` (`MatchInsights.jsx:19`; `candidateDetails.js:20,30,40,50,60,70`). Disclaimer (`:67-69`). | **mixed** | `GET /api/recruiter/candidates/:id/match?jobId&lang` → `{relevantSkills, missingSkills, experienceYears, workMode, languageFit[], rightToWork, gaps[], narrative, generatedAt}` (OpenAI narrative per decision; RQ-35) |

### Search, filter and sort rules to mirror (`client/src/features/recruiter/find-candidates/utils/discovery.js`)

- **Query:** lower-case the text, split it on `/[^a-z0-9+#.]+/`, and require **every** word to appear in name + title + company + location + workMode + availability + skills (`:16-31`).
  - ⚠ Non-ASCII letters (é, ñ, ü, ß) are treated as separators, so "José" or "Müller" break into fragments. The server must use Unicode-aware tokenising, or Mongo text search with ES/FR/DE stemming.
- **Filters** (`:33-40`):
  - workMode: equality.
  - availability: equality on the free text.
  - minYears: ≥.
  - skill: exact, case-sensitive `includes`.
- **Sort** (`:43-49`):
  - experience: descending.
  - name: `localeCompare` ascending; the server needs a collation per locale.
  - recommended: relevant-skill count descending.
- **Compare:** at most 3 (`FindCandidatesPage.jsx:16`); the button is disabled below 2 (`:79`).

### Actions

| Action | Now | Server |
|---|---|---|
| Type, filter, sort | client filtering | query params (debounce about 300 ms) |
| Change match job | shared localStorage | preference or URL |
| Bookmark | `useShortlist().toggle` | `PUT` or `DELETE /api/recruiter/shortlist/:candidateId` → `{shortlisted}` |
| Compare tick, then "Compare candidates" | local | none. The modal composes from loaded cards and the match DTO. Optionally `GET /api/recruiter/candidates/compare?ids=a,b,c&jobId=`. |
| Clear search and filters | local | |
| View profile | link | |

### Compare modal (`CompareModal.jsx:9-24`)

Rows today: Current role, Experience, Work mode, Location, Availability, "Skills relevant to {job}", Listed skills.

New rows (decision 2):
- Languages (with level)
- Right to work in the job's country
- Verification (admin-approved checks, phone)
- Latest employer and tenure
- Highest education
- Certificates

i18n: about 9 strings.

**i18n for the whole screen:** about 40 strings.

## A16. Candidate profile layout `/recruiter/find-candidates/:candidateId`

**Files:** `client/src/features/recruiter/find-candidates/pages/CandidateProfilePage.jsx`, `client/src/features/recruiter/find-candidates/components/ProfileSummary.jsx`, `ProfileTabs.jsx`, `ProfileSidebar.jsx`, `MessageModal.jsx`.

### Data

| Item | Source | Static? | Becomes |
|---|---|---|---|
| Candidate | `getCandidate(id)` (static list) **or** the live applicant (`CandidateProfilePage.jsx:25`) | **yes / device** | `GET /api/recruiter/candidates/:id` → `{profile (privacy-filtered), relationship:{shortlisted, applications:[{id, job:{id,title}, stageId, status, appliedAt}], conversationId}}`. Returns `404` if the candidate is not visible (RQ-31). |
| Summary | `ProfileSummary.jsx:8-46`: name, "title at company", availability pill, location, years, workMode, first 4 skills | static | API, plus photo, links, verification badges, languages and right to work (decision 2) |
| Tabs | `ProfileTabs.jsx:5-13`, 7 tabs | config | i18n |
| Stage select | `stageId` = placement or **`stages[0]`** if not an applicant (`:50`); options = stages, plus "Rejected" only when already rejected (`:51-54`) | device | One select per application; hidden for non-applicants (RQ-51) |
| Sidebar "Match evidence for" select + MatchInsights (open) | `ProfileSidebar.jsx:54-64` | | `…/match?jobId=` |
| Reminder copy | `ProfileSidebar.jsx:66-69` | copy | i18n |

### Actions

| Action | Now | Server |
|---|---|---|
| Start a conversation | Opens MessageModal. On submit: activity `'outreach'` "Message preview created. Nothing was sent to the candidate." and notice "Message preview created; nothing was sent." (`:64-68`). | **Real message** (decision 3): `POST /api/conversations {candidateId, jobId?, body}` → `201 {conversationId, message}`. If a conversation already exists, append to it (`POST /api/conversations/:id/messages`). Side effects: an `outreach` activity, an email to the candidate (RQ-83), and the candidate's unread count. The notice becomes "Message sent", with a link to Messages. |
| Add/Remove shortlist | toggle | `PUT`/`DELETE /api/recruiter/shortlist/:candidateId` |
| Change stage | `moveTo(candidate.id, stageId)` plus activity "Moved to {name}." (`:58-62`). Bug: selecting "Rejected" here logs "Moved to undefined." because the name lookup excludes `rejected`. | `PATCH /api/recruiter/applications/:applicationId/stage {stageId}` (A25) |
| Change match job | preference | as A15 |

### Message modal (`MessageModal.jsx`)

- **Default text:** "Hi {firstName}, your profile stood out for our {job.title} role. I’d like to learn more… Would you be open to a short conversation?" (`:10-12`; RQ-82).
- **Validation:** non-blank → "Write a message before creating the preview." (`:17-19`). No max length (RQ-81).
- **Copy to change:**
  - title "Start a conversation with {firstName}" (keep)
  - description "This is a local preview on this device. Nothing is sent to the candidate." (`:29`)
  - button "Create message preview" (`:36`) → "Send message"

**Free-plan candidates** (decision 3): they can read but not reply. On the recruiter side nothing changes when sending; the recruiter UI should not reveal the candidate's plan (RQ-47).

**i18n:** about 25 strings (layout, sidebar, modal).

## A17. Tab: Overview (`client/src/features/recruiter/find-candidates/pages/CandidateOverviewPage.jsx`)

| Item | Source | Static? | Becomes |
|---|---|---|---|
| "The person behind the profile" | `getCandidateDetails(c).about` (`candidateDetails.js:13-14` etc.; live: `profile.about`) | **yes** | `profile.about` (candidate-written; "Translate" on demand) |
| Relevant experience: current role | `roles[0]` (`:10,18-22`) | yes | the latest `workHistory` entry (decision 2): employer, title, start–end formatted per locale, computed duration |
| Role summary "Contributed to product strategy… This demo summary illustrates candidate-provided experience…" | literal `:23-26` | **yes** | `workHistory[0].description` if added (RQ-46), else omit |
| "A possible next step: Seeking {workMode} opportunities with space to grow…" | template `:30-33` | **yes** | candidate preferences: work mode, desired locations, availability, right to work. Rendered from fields, or omitted. |
| New (decision 2) | n/a | n/a | right to work per country; languages summary; links |

**i18n:** about 5 strings.

## A18. Tab: Experience (`client/src/features/recruiter/find-candidates/pages/CandidateExperiencePage.jsx`)

- **Now:** a list of `roles` `{role, org, period:'2022–present'}` (`candidateDetails.js:15-18…`), each with a literal summary "Worked with engineering and product partners… Sample career history for this demo profile." (`:21-24`).
- **Becomes:** `workHistory[]` `{employer, title, startDate (YYYY-MM), endDate|null (current), description?}`.
  - Sorted newest first.
  - Dates formatted per locale; "present" translated.
  - Total experience can be computed from these (RQ-46).
- **Live applicant now:** a single synthetic role with `org: 'Self-reported experience'` and period "N years" (`useLiveApplicant.js:49`).
- **i18n:** about 3 strings.

## A19. Tab: Skills (`client/src/features/recruiter/find-candidates/pages/CandidateSkillsPage.jsx`)

- **Now:** every skill shows a `"Candidate-provided"` badge (`:17`, a literal). The note is at `:21-24`.
- **Becomes:**
  - Skills with source badges: "Candidate-provided", or "Certificate: {course}" where a course certificate maps to a skill (RQ-45).
  - **Languages** with CEFR level (A1–C2, Native).
  - **Course certificates and badges**, each linked to its public verification URL (decision 2 and 4).
- **i18n:** about 4 strings, plus CEFR labels.

## A20. Tab: Education (`client/src/features/recruiter/find-candidates/pages/CandidateEducationPage.jsx`)

- **Now:** a single `{degree, period}` with the literal prefix "Sample education ·" (`:20`).
  - The live applicant's `period` is the **institution name** (`useLiveApplicant.js:50`), which is a mismatch.
- **Becomes:** `education[]` `{institution, degree, fieldOfStudy?, startDate, endDate}` (decision 2).
- **i18n:** about 4 strings.

## A21. Tab: Resume (`client/src/features/recruiter/find-candidates/pages/CandidateResumePage.jsx`, `ResumePreviewModal.jsx`, `EarlierVersionModal.jsx`)

### Data

| Item | Source | Static? | Becomes |
|---|---|---|---|
| File name | synthesised `${name}_CV.pdf` (`CandidateResumePage.jsx:17`) | **yes** | `GET /api/recruiter/candidates/:id/cv` → `{versionId, fileName, mimeType, size, approvedAt, isLive:true}` or `403/404` per RQ-43 |
| "Candidate-approved · Current live version", "Live" pill | literals `:49,51-53` | yes | from the version metadata (date formatted) |
| Preview modal | profile text: about, roles, skills, education (`ResumePreviewModal.jsx:8-56`); "Sample education ·" (`:55`); description "This demo has no CV file." (`:15`) | yes | Render the actual PDF (`GET …/cv/file?inline=1`, streamed with `Content-Disposition: inline`), or the parsed CV text. Decide which (RQ-43). |
| Policy and request copy | `:69-72,84-87` | copy | Revise. "require legal and product approval before production" is demo copy. |

### Actions

| Action | Now | Server |
|---|---|---|
| View live CV | modal over the profile text | as above |
| Download | status "This demo has no CV file to download…" (`:62`) | `GET /api/recruiter/candidates/:id/cv/file` → stream. Permission per RQ-43. Logs a `cv-download` activity plus a candidate-visible access log. |
| Request earlier version | `EarlierVersionModal`. Reasons `REASONS` (`EarlierVersionModal.jsx:5-10`): "Verify employment history", "Review an earlier role-specific CV", "Compliance or audit check", "Other recruitment purpose". Validation: reason required → "Choose a reason for the request." (`:23-25`); details optional, no limit. On record: activity `'cv-request'` "Requested an earlier CV version ({reason}). Recorded on this device; the candidate was not contacted." (`CandidateResumePage.jsx:20-23`) and status text (`:25`). | `POST /api/recruiter/candidates/:id/cv-requests {reason:'verify_employment'\|'earlier_role_cv'\|'compliance'\|'other', details≤1000}` → `201 {id,status:'pending'}`. The candidate gets an in-app notification and an email; on approval the recruiter gets access to that version (RQ-44). |

**i18n:** about 30 strings (tab plus two modals).

## A22. Tab: Activity (`client/src/features/recruiter/find-candidates/pages/CandidateActivityPage.jsx`)

**Now:**
- "Current stage: {stageName}" (`:17-22`).
- "No outreach yet…" is shown if no `outreach` event exists (`:23-25`).
- "Your activity on this device" lists `{text, at}` (`:28-38`).
- Time format: `toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'})` (`:8`).
- Events are stored as **English sentences** (`CandidateProfilePage.jsx:61,65`; `CandidateResumePage.jsx:22`).

**Becomes:** `GET /api/recruiter/candidates/:id/activity` → `[{id, type, params, at, actor:{id,name}}]`.
- Types: `outreach`, `message_reply`, `cv_request`, `cv_request_decided`, `cv_download`, `stage`, `rejected`, `applied`, `withdrawn`, `shortlisted`, `note_updated`.
- Rendered with i18n templates. Dates use the user's locale and country formatting (RQ-42).
- "Current stage" becomes a list per application.

**i18n:** about 6 strings, plus one template per activity type.

## A23. Tab: Notes (`client/src/features/recruiter/find-candidates/pages/CandidateNotesPage.jsx`)

**Now:**
- One textarea per candidate.
- Save writes `lwm.recruiter.candidate-notes[id]` (`:15-19`).
- Status "Notes saved on this device." (`:42`).
- No validation; an empty note is allowed.

**Server:**
- `GET /api/recruiter/candidates/:id/note` → `{text, updatedAt, updatedBy}`.
- `PUT …/note {text ≤ 5000}` → same shape.
- Private to the company; never shown to candidates (RQ-41).

**i18n:** about 5 strings.

## A24. Shortlists `/recruiter/shortlists` (`client/src/features/recruiter/shortlists/pages/ShortlistsPage.jsx`)

**Now:**
- The same toolbar, sort and compare as A15, applied to `[...candidates, liveApplicant]` filtered by `shortlistedIds` (`:35`).
- Default shortlist: Oliver Park and James Chen (`useShortlist.js:6`).
- Empty states at `:98-120`.

**Server:**
- `GET /api/recruiter/shortlist?q&filters&sort&jobId` → same DTO as discovery, plus `{addedAt, addedBy}`.
  - It must include shortlisted candidates who later turned discovery off. Show them as "No longer discoverable", or hide them (RQ-40).
- `DELETE /api/recruiter/shortlist/:candidateId` → `204`.

**i18n:** about 12 strings.

## A25. Applications `/recruiter/applications` (`client/src/features/recruiter/applications/pages/ApplicationsPage.jsx`)

### Data

| Item | Source | Static? | Becomes |
|---|---|---|---|
| Rows | `usePipeline().applicants` = the 6 static `APPLICANTS` (`client/src/features/recruiter/hiring-pipeline/data/pipeline.js:23-30`) + the live applicant, with `stageId` from placements (`usePipeline.js:29-32`) | **yes** | `GET /api/recruiter/applications?q&stageId&jobId&status&page` → `{items:[{id, candidate:{id,name,photoUrl,initials,headline,experienceYears,workMode}, job:{id,title}, stageId, status, appliedAt, lastActivityAt}], total}` |
| Role column | `applicant.title`, the candidate's own title (`:53`) | | the **job applied for** (RQ-56) |
| Experience column | "N years" (`:54`) | | plural via i18n |
| Stage filter options | stages + "Rejected" (`:24-25`) | | from `PipelineStage` (+ withdrawn per RQ-55) |
| "Candidate portal activity" section | a static empty state "Room for your next great application…", eyebrow "Local applications created in this prototype" (`:116-127`) | **yes** | remove, or a recent-applications feed (RQ-57) |

### Actions

**Search** (name + title, contains, `:28-33`): query param `q`.

**Change stage (`StageSelect`):** `PATCH /api/recruiter/applications/:id/stage {stageId}` → `{application}`. Side effects:
- a `StageHistory` record
- an activity entry
- the candidate-visible status mapped through `stage.candidateStatus` (RQ-52)
- a candidate email if that status changed (decision; RQ-54)
- the funnel and momentum data

**Reject:**
- **Now:** selecting "Rejected" opens a confirm: "Reject this application?" — "{name} will be moved out of your pipeline. You can move them back to a stage from this page at any time." (`:129-140`), then `moveTo(id,'rejected')`.
- **Server:** `PATCH …/stage {stageId:'rejected', notifyCandidate:boolean, reason?}`. It sets `rejectedAt` and `status:'not_selected'`, and sends an email if `notifyCandidate` (RQ-53). Un-rejecting moves the application back to a stage.

**i18n:** about 18 strings.

**Decision 1 effect:** only email-verified, complete, paying candidates can create rows (RQ-59 covers a lapsed plan).

## A26. Hiring pipeline `/recruiter/hiring-pipeline` (`client/src/features/recruiter/hiring-pipeline/pages/HiringPipelinePage.jsx`, `client/src/features/recruiter/hiring-pipeline/components/PipelineColumn.jsx`, `ApplicantCard.jsx`, `StageSelect.jsx`)

### Data

| Item | Source | Static? | Becomes |
|---|---|---|---|
| Stages | `DEFAULT_STAGES` (`pipeline.js:9-16`): applied (neutral), screening, shortlisted, interview (primary), offer, hired (success) | seed | `GET /api/recruiter/pipeline?jobId=` → `{stages:[{id,name,tone,order,candidateStatus,count}], applications:[…]}` |
| Chip "All open roles" | literal `:47` | **yes** | job filter select (RQ-49) |
| "N candidates · M stages" | `:49`; plural not handled | computed | i18n plural |
| Cards | `openApplicants` (all except rejected) | static data | applications (one per application, RQ-50) |
| Card "N aligned skills" | `APPLICANTS[].alignedSkills` **literal** 3/2/1/3/0/1 (`pipeline.js:24-29`); the live applicant computes required-only (`useLiveApplicant.js:26-29`) | **yes** | `relevantSkillsCount` for the application's job (RQ-36) |
| Card "Demo profile activity" | literal `ApplicantCard.jsx:48` | **yes** | `lastActivityAt` → "Applied 3 days ago", "Moved 2 h ago" (relative time, `Intl.RelativeTimeFormat`) |
| Card role | `applicant.title` | | the job title, plus the candidate's headline |
| Column empty copy | `PipelineColumn.jsx:22-26` | copy | i18n |
| Stage dot colours | CSS `.neutral/.primary/.success` (`PipelineColumn.module.css:30-40`) | enum | `stage.tone` |

### Actions

- **Drag and drop** (`:26-32`): `PATCH /api/recruiter/applications/:id/stage`, with an optimistic update.
- **Card stage select** (`ApplicantCard.jsx:39-45`): the same request.
- **Manage stages:** navigates to `/hiring-pipeline/manage-stage` (A27).

**i18n:** about 12 strings.

## A27. Manage stages dialog `/recruiter/hiring-pipeline/manage-stage` (`client/src/features/recruiter/hiring-pipeline/components/ManageStagesModal.jsx`, `client/src/features/recruiter/hiring-pipeline/hooks/usePipeline.js:13-82`)

| Action | Now (rule and message) | Server |
|---|---|---|
| Add | trim; empty → "Enter a stage name."; > 24 characters (`MAX_STAGE_NAME_LENGTH`, `pipeline.js:6`) → "Stage names can be up to 24 characters."; case-insensitive duplicate → "A stage called “{name}” already exists." (`usePipeline.js:13-18`). New `{id:'stage-<base36>', tone:'primary'}` is appended (`:46`). | `POST /api/recruiter/pipeline/stages {name, candidateStatus?}` → `201 {stage}`; `422` with the same message keys |
| Rename | inline; commits on blur or Enter; Esc reverts; same rules ignoring itself (`ManageStagesModal.jsx:13-22,36-45`); input `maxLength` 34 (`:35`) | `PATCH /api/recruiter/pipeline/stages/:id {name}` |
| Reorder | ↑/↓ swaps neighbours (`usePipeline.js:62-71`) | `PUT /api/recruiter/pipeline/stages/order {ids:[…]}` → `{stages}` (full order, idempotent) |
| Remove | fewer than 2 stages left → "A pipeline needs at least two stages."; stage not empty → "Move the candidate out of {stage} before removing it." / "Move the {n} candidates out of {stage} before removing it." (`:73-82`) | `DELETE /api/recruiter/pipeline/stages/:id` → `204`, or `409 {error:'stage.notEmpty', count}`. Count only active applications (RQ-58). |

**i18n:** about 10 strings.

**New field:** a `candidateStatus` mapping per stage, if RQ-52 option (a) is chosen. This needs a select in each row, which is a UI change.



## A28. Recruiter learning library `/recruiter/learning` (`client/src/features/recruiter/learning/pages/LearningPage.jsx`, `client/src/features/recruiter/learning/components/CourseCard.jsx`, `SuggestionCard.jsx`, `PurchaseDialog.jsx`, `client/src/features/recruiter/learning/hooks/useRecruiterLearning.js`, `client/src/features/recruiter/learning/hooks/useCourseCatalogue.js`, `client/src/features/recruiter/learning/data/courses.js`)

### Data

| Item | Source (file:line) | Static? | Becomes |
|---|---|---|---|
| Catalogue | `COURSES` (`client/src/features/recruiter/learning/data/courses.js:28-186`, 6 courses: title, stream, level, duration string, price 49/49/49/29/29/29, access caption, bundled photo, summary, lead, tagline, designedFor, 3 outcomes, 5 lesson titles), minus admin-drafted ones, plus published admin uploads mapped by `fromUpload` (`useCourseCatalogue.js:8-29,35-43`) with generic generated copy and a single photo (`:4`) | **yes** | `GET /api/courses?audience=recruiter&q&stream&page` → `[{id,title,stream,level,durationMinutes,lessonCount,lessonTypes,price:{amount,currency},access,imageUrl,summary, progress:{purchased,lessonsDone,lessonsTotal,quizPassed,certificateId}}]` (decision 4). |
| Admin seed conflict | `client/src/features/admin/courses/data/courses.js:22-27`: the same ids with **price 0** and different title/category for `fair-hiring-inclusive-selection` ("Fair, Inclusive & Responsible Hiring" / "Ethical Hiring") | conflict | one `Course` collection (RQ-66) |
| Starting state | `INITIAL_LEARNING`: course 1 purchased, lesson 1 done (`courses.js:13-16`); matches `SEED_PAYMENTS[1]` (`client/src/features/payments/data/payments.js:40`) | seed | demo seed only |
| Stat "Courses in progress" | purchased and ≥ 1 lesson done and not complete (`useRecruiterLearning.js:13,46`) | computed (device) | purchased and ≥ 1 lesson completed and no certificate yet (decision 4) |
| Stat "Certificates earned", caption "Completed knowledge checks" | courses with all lessons done (`:47`); caption `LearningPage.jsx:56` | computed with wrong semantics | count of `Certificate` docs (final quiz passed, decision 4) |
| Stat "Specialist streams" | distinct streams (`:23,57`) | computed | distinct `stream` of visible courses (server facet) |
| Header pill "Learning profile active" | literal `:47-50` | **yes** | remove, or show the enrolment count |
| Suggestion tags "Enterprise SaaS", "3 active roles" | literals `:72-73` | **yes** | `company.industry` and the active job count |
| Suggestions | `SUGGESTIONS` (`courses.js:189-208`): fixed course ids, tags "Best match", "Suggestion 2", "Suggestion 3", reasons with literal numbers ("Your workspace has 3 applications and 1 candidate at interview stage.", "You are managing 3 published roles…") | **yes** | `GET /api/recruiter/learning/suggestions?lang=` → `[{courseId, rank, reasonKey, params}]`, rules or AI (RQ-67) |
| AI note "Suggestions use your company profile… No connected AI model is used." | `:81-84` | demo copy | revise per RQ-67 |
| Library description "{n} practical courses with guided lessons and knowledge checks." | `:107` | computed + copy | `total`, with copy matching decision 4 ("…with a final quiz and certificate") |
| Price | `formatPrice` = `` `£${price.toFixed(2)}` `` (`useRecruiterLearning.js:5`), used in `CourseCard.jsx:29` | **hard-coded £** | `Intl.NumberFormat(locale,{style:'currency',currency})` with the price for the user's currency (RQ-64) |
| Notice "Recruiter learning progress and certificates are local prototype states saved in this browser…" | `:119-121` | demo copy | revise |

### Actions

**Search and stream filter** (`:31-38`): client-side, or `q` and `stream` params.

**Buy now** goes through `PurchaseDialog` (`PurchaseDialog.jsx:8-28`).

*Paid course, now:* the demo `CheckoutDialog` (`client/src/features/payments/components/CheckoutDialog.jsx`) runs card validation (Luhn, expiry, CVC; `client/src/features/payments/utils/card.js`), records a payment to `lwm.payments` with `payerName` from the static `WORKSPACES[role].user.name` (`CheckoutDialog.jsx:66`), and on success `purchase(id)`.

*Paid course, server:*
- `POST /api/payments/checkout {kind:'course', courseId}` → `{checkoutUrl}`. This creates a Stripe Checkout Session (`mode:'payment'`) in the user's currency; `metadata:{userId, courseId, kind}`; `success_url=/recruiter/learning/:courseId?checkout=success&session_id={CHECKOUT_SESSION_ID}`; `cancel_url=…?checkout=cancelled`.
- Stripe webhook `POST /api/payments/webhook`, for `checkout.session.completed`, `checkout.session.async_payment_failed` and `checkout.session.expired`. It upserts a `Payment` and creates the `Enrollment` (idempotent on `session.id`).
- After the redirect, the client polls `GET /api/payments/checkout/:sessionId` → `{status:'paid'|'pending'|'failed', enrollment?}`.
- The card form, `card.js` and the "Demo cards" copy (`CheckoutDialog.jsx:147-150`) are removed.

*Free course:*
- **Now:** a confirm dialog, "This course is free. It will be added to your learning and saved in this browser." (`PurchaseDialog.jsx:19-26`).
- **Server:** `POST /api/learning/enrollments {courseId}` → `201 {enrollment}`; `409` if the course is not free.

**View or continue course:** a link.

**i18n:** about 30 strings. Course content is DB data, translated per RQ-72.

## A29. Course view `/recruiter/learning/:courseId` (`client/src/features/recruiter/learning/pages/CourseDetailsPage.jsx`, `client/src/features/recruiter/learning/components/LessonRow.jsx`)

### Data

| Item | Source | Static? | Becomes |
|---|---|---|---|
| Eyebrow, title, lead, duration pill, hero photo, tagline, outcomes, details (stream, level, time, designedFor) | course object (`:54-119`) | static catalogue | `GET /api/courses/:id` → full course with `lessons:[{id,order,type:'video'\|'text'\|'pdf'\|'link',title,durationMinutes,locked}]`, `quiz:{questionCount, passMark}` |
| Curriculum description "{total} lessons · {duration} · Self-paced · {done} of {total} complete" | `:87` | computed | from the API |
| Lesson subtitle "Guided lesson · Practical recruiter example" | `LESSON_SUBTITLE` (`courses.js:18`), used `LessonRow.jsx:28` | **yes** | the lesson type and duration ("Video · 12 min", "PDF · 6 pages", "Reading · 5 min", "External link") |
| Lesson state Start course / Mark complete / Completed | `LessonRow.jsx:12` | | Locked / Start / In progress (video %) / Completed (auto, decision 4) |
| "What's included" | `INCLUDED` = `['4 pre-recorded lessons','Completion assessment','Course-completion badge','Learn at your own pace']` (`CourseDetailsPage.jsx:15`). Every built-in course has **5** lessons. | **yes / wrong** | computed: "{n} lessons ({v} videos, {t} readings, {p} PDFs, {l} links)", "Final quiz, pass mark {70}%", "PDF certificate with verification code" |
| Price card | `formatPrice` (`:125`), `course.access` (`:126`) | £ hard-coded | currency (RQ-64) |
| Accountability copy | `:145-149` | copy | i18n |

### Actions

| Action | Now | Server |
|---|---|---|
| Click a lesson row | Toggles complete when purchased, otherwise opens the purchase (`:97`) | Opens the **Lesson viewer** (new screen, Part B decision 4). Locked rows open the purchase. **No manual toggle.** |
| Buy Now | as A28 | as A28 |
| (new) Take final quiz | n/a | `GET /api/learning/courses/:id/quiz` and `POST …/quiz/attempts` (Part B) |
| (new) Download certificate | n/a | `GET /api/certificates/:id/pdf` |

**i18n:** about 25 strings.

## A30. Company `/recruiter/company` (+ `/recruiter/company/create-role` → redirect to `/recruiter/jobs/new`, `client/src/features/recruiter/company/routes.jsx:7`)

**Files:** `client/src/features/recruiter/company/pages/CompanyPage.jsx`, `client/src/features/recruiter/company/data/company.js`.

### Data

| Item | Source | Static? | Becomes |
|---|---|---|---|
| Profile | `INITIAL_COMPANY` (`company.js:16-24`): Acme Studio, Enterprise SaaS, San Francisco, US, https://acme.example, 51–200, description | **seed** | `GET /api/recruiter/company` → `{id, displayName, legalName, industry, country, city, website, size, description, verifiedAt, logoUrl?}` |
| Logo tile | first letter of the name (`:75`) | computed | keep. A logo upload is not requested. |
| Badge "Demo company" | literal `:80-83` | **yes** | "Verified company" when approved (`verifiedAt`) |
| Size options | `COMPANY_SIZES` (`company.js:7-14`, en dash) | enum | shared enum keys (RQ-4) |
| Saved message "Company profile saved on this device." | `:144-149` | copy | "Company profile saved." |

### Actions

**Save company profile:**
- **Server:** `PUT /api/recruiter/company {displayName, industry, country, city, website, size, description}` → `{company}`. Values are trimmed. Locked fields follow RQ-3.
- **Validation to mirror** (`:12-27`):
  - name: required → "Enter your company name."
  - industry: required → "Enter your industry, for example Enterprise SaaS."
  - location: required → "Enter where your company is based, for example San Francisco, US."
  - website: required → "Enter your company website."; must match `URL_PATTERN` `/^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i` (`:10`) → "Enter a valid website address starting with https://, like https://acme.example."
  - size: required → "Choose your company size."
  - description: required → "Tell candidates what you’re building."; ≥ 20 characters → "Write at least 20 characters so candidates understand what you’re building."
  - No max lengths. Suggested: name ≤ 120, industry ≤ 80, description ≤ 3,000.
  - ⚠ The website rule differs from onboarding (A5). The server should use one rule (recommend the onboarding one, normalised to `https://`).

**Create your next role:** a link to the wizard.

**Cross-role:**
- Candidates' job cards and job pages read `company.industry`, `company.size`, `company.description` and `company.name` (`client/src/features/candidate/jobs/data/recruiterJobs.js:37-38,54-56`). These fields are therefore **public**.
- The admin recruiters directory shows the company.

**i18n:** about 25 strings.

## A31. Settings: Notifications `/recruiter/settings/notifications` (`/recruiter/settings` redirects here; `client/src/features/recruiter/settings/routes.jsx:7`)

**Files:** `client/src/features/recruiter/settings/pages/NotificationsPage.jsx`, `client/src/features/recruiter/settings/data/notifications.js`, `client/src/features/recruiter/settings/components/SettingsLayout.jsx`, `SettingsCard.jsx`.

**Data:**
- `DEFAULT_NOTIFICATIONS = {inApp:true, email:true}` (`notifications.js:4`).
- `NOTIFICATION_OPTIONS` (`:6-18`). The email description says "…Email delivery is not connected in this demo." (`:15-16`).

**Action: toggle.**
- **Now:** saved immediately to localStorage.
- **Server:** `PATCH /api/me/notification-settings {inApp?, email?}` → `{inApp, email}`. Granularity per RQ-76.

**Shared layout:**
- Title "Your workspace. Your terms."; lead "Simple controls for your privacy, notifications, and personal information." (`SettingsLayout.jsx:16-17`). Recruiters have no privacy tab (RQ-80).
- Tabs: `SettingsLayout.jsx:5-9`.

**i18n:** about 12 strings.

## A32. Settings: Data & account `/recruiter/settings/data-account` (`client/src/features/recruiter/settings/pages/DataAccountPage.jsx`, `client/src/features/recruiter/settings/data/account.js`)

| Item / action | Now | Becomes |
|---|---|---|
| Notice | `DATA_NOTICE` "This interactive prototype stores… No real account or server-side data exists." (`account.js:2-3`) | a real data notice (retention, what is stored, where) |
| Export data | CSV built in the browser: Name and Company from the static `workspace.user` (`DataAccountPage.jsx:73-74`), Workspace, Market location, the two toggles; file `recruiter-profile.csv` (`:69-83`) | `GET /api/me/export?format=json\|csv` → file download (RQ-78). The CSV helper here (`:13-28`) duplicates `client/src/utils/downloadCsv.js`. |
| Reset demo | Removes every `lwm.*` key, sets the sessionStorage flag, reloads (`:30-57,100-108,116-136`) | **removed** (decision). Delete `STORAGE_PREFIX` and `RESET_FLAG_KEY` (`account.js:6,9`). |
| (new?) Delete account | does not exist | RQ-79 |

**i18n:** about 15 strings.

## A33. Settings: Billing `/recruiter/settings/billing` (`client/src/features/recruiter/settings/pages/BillingPage.jsx`, `client/src/features/payments/components/PaymentsTable.jsx`)

**Data:**
- `usePayments('recruiter')` filters by `payerRole==='recruiter'` **and** `payerName === WORKSPACES.recruiter.user.name` (`client/src/features/payments/hooks/usePayments.js:173-175`).
- It merges with `SEED_PAYMENTS` (`client/src/features/payments/data/payments.js:38-45`). Sarah Miller's rows are seeds 2 and 6.
- Columns: reference `LWM-xxxxx`, item, type, amount (`formatMoney` £, `payments.js:21`), method `brand •••• last4`, status, date (`formatPaymentDate` en-US, `:24-26`).

**Server:** `GET /api/me/payments?page` → `[{id, reference, at, itemName, kind, amount, currency, method:{brand,last4}, status:'paid'|'failed'|'pending'|'refunded', failureReason?, receiptUrl?}]`. The method and receipt URL come from the Stripe PaymentIntent and Charge.

**Copy:** "Every course payment from this workspace. The checkout is a demo, so nothing is actually charged." (`BillingPage.jsx:16`) must be revised.

**i18n:** about 12 strings.

## A34. Help `/recruiter/help` (`client/src/features/help/pages/HelpPage.jsx`, `client/src/features/help/data/help.js`, `client/src/features/help/components/FaqItem.jsx`, `HelpLinkCard.jsx`)

**Data:**
- `FAQS`: 6 Q&As (`help.js:4-41`). Demo answers:
  - "The current prototype uses local comparisons; semantic AI requires a connected service" (`:9`)
  - "This demo doesn’t upload or transmit your personal information." (`:15`)
  - "Text extraction runs in your browser" (`:21`)
  - `live-marketplace` (`:30-34`)
  - `reset-demo` (`:35-40`), which must be removed
- `HELP_LINKS` (`:47-60`): the recruiter targets are `settings/data-account` and `find-candidates`.

**Actions:** search is a client filter over question and answer (`HelpPage.jsx:77-80`). No server is needed if the FAQ lives in translation files (RQ-88).

**i18n:** about 20 strings. The FAQ answers are long.

## A35. Not-found and empty states

- `JobNotFound` (`client/src/features/recruiter/jobs/components/JobNotFound.jsx`): "We couldn’t find that job" and so on. The API returns `404` for jobs that are missing **or owned by another company**; the client shows the same component.
- Candidate not found (`CandidateProfilePage.jsx:32-48`): `404` or `403` (not visible). The copy "does not exist or is no longer available" fits both.
- Course not found (`CourseDetailsPage.jsx:31-47`): `404`, including draft courses.
- Workspace catch-all: `client/src/app/router.jsx:133`.

## A36. Screens required by the decisions but absent from the code

| New screen / route (suggested) | Why | Main endpoints |
|---|---|---|
| `/recruiter/messages` (inbox list, unread badge in the sidebar) | decision: two-way inbox, 15 s polling | `GET /api/conversations`, `GET /api/conversations/unread-count` |
| `/recruiter/messages/:conversationId` (thread, composer, "Translate" per message) | decision 3 | `GET/POST /api/conversations/:id/messages`, `POST /api/conversations/:id/read`, `GET /api/messages/:id/translation?lang=` |
| `/forgot-password`, `/reset-password` (shared by roles) | decision: forgot-password email | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` |
| Recruiter email-code entry (inside onboarding, or right after sign-up) | decision: SMTP verification code; RQ-8 | `…/verification/email/send`, `…/verify` |
| Account status gate (pending, rejected with reason and resubmit, suspended) | approval gate | `GET /api/recruiter/onboarding` |
| `/recruiter/learning/:courseId/lessons/:lessonId` (lesson viewer: video, text, PDF, link) | decision 4 | `GET /api/learning/lessons/:id`, `POST …/progress` |
| `/recruiter/learning/:courseId/quiz` (quiz and result) | decision 4 | `GET …/quiz`, `POST …/quiz/attempts` |
| Certificate view and download (from the course page) | decision 4 | `GET /api/certificates/:id/pdf` |
| `/certificates/verify/:code` (public, no login; shared by roles) | decision 4 | `GET /api/certificates/verify/:code` |
| Hiring pipeline job filter (replaces the static chip) | RQ-49 | `GET /api/recruiter/pipeline?jobId=` |
| (optional) Notifications panel behind the bell | RQ-77 | `GET /api/notifications` |

---

# Part B: impact of the four new decisions on the recruiter side

## B1. Candidates verify email before first login; applying needs a complete profile **and** the £9/month plan

**Recruiter-side changes:**
1. **Discovery:** only email-verified candidates can ever appear. Whether discovery also requires a complete profile is RQ-31.
   - The `profileStatus` text "Core profile ready" (`candidates.js:27…102`; `TalentCard.jsx:61`) becomes a computed badge from `CandidateProfile.completeness`: complete, or missing N items.
2. **Applications and pipeline:** every applicant passed the completeness and plan checks at apply time.
   - The UI can rely on structured work history, education, languages, right to work, photo and live CV being present for applicants.
   - A lapsed subscription after applying is RQ-59.
3. **Overview KPIs and the funnel** count applications that already passed those gates; no special handling is needed.
4. **Messaging** (with decision 3): recruiters may write to Free candidates. The recruiter UI must not show that a candidate cannot reply because of their plan (RQ-47).
5. **Server:** application creation (candidate audit) enforces `emailVerified && profileComplete && subscription.active`. The recruiter endpoints simply read the applications.

**Entities touched:**
- `User.emailVerifiedAt`
- `CandidateProfile.completeness {complete:boolean, missing:[key]}`, which the server recomputes on every profile change
- `Subscription {userId, plan:'plus', status, currentPeriodEnd, stripeSubscriptionId}` (candidate audit; recruiter screens read `applications` only)

**Questions:** RQ-31, RQ-47, RQ-59.

## B2. Extended candidate "complete profile": what recruiter screens must show and filter

New candidate fields:
- `workHistory[]`
- `education[]`
- `languages[] {language (ISO 639-1), level: A1|A2|B1|B2|C1|C2|native}`
- `rightToWork[] {country (EU27+UK code), status: citizen|permit|needs_sponsorship}`
- `photoUrl`
- `links {linkedin?, portfolio?, other?}`
- the live CV
- `phoneVerifiedAt`
- admin-approved `verificationChecks[] {type, status:'approved', approvedAt}`
- `certificates[] {courseId, title, issuedAt, verificationCode}`

| Recruiter surface (file) | Change |
|---|---|
| `CandidateCard.jsx` (Find candidates, Shortlists) | Photo instead of the initials chip (`CandidateAvatar.jsx`). A verified badge if any admin check is approved, plus phone verified. Right to work for the selected country or the match job's country, e.g. "Right to work: DE · citizen" or "Needs sponsorship". The top 2 languages with level. The `profileStatus` badge becomes completeness. |
| `TalentCard.jsx` (Overview) | Same as the card: photo, verified badge, right to work, languages. |
| `ProfileSummary.jsx` | Photo, LinkedIn and portfolio links (external, `rel="noopener noreferrer"`), verification badges, the current employer from `workHistory[0]`, languages, right-to-work chips. |
| Overview tab (`CandidateOverviewPage.jsx`) | The current role from `workHistory[0]` with dates. Right-to-work summary. The "next step" text built from preferences. Remove the literal paragraphs (`:23-26,30-33`). |
| Experience tab (`CandidateExperiencePage.jsx`) | A structured list with employer, title, start–end (locale format), duration and optional description (RQ-46). Remove the literal `:21-24`. |
| Skills tab (`CandidateSkillsPage.jsx`) | Add a **Languages** section (CEFR) and a **Certificates and badges** section with verification links. Skills evidenced by a certificate get a different badge (RQ-45). |
| Education tab (`CandidateEducationPage.jsx`) | `education[]` with institution, degree and dates. Remove "Sample education" (`:20`). |
| Resume tab | The real live CV metadata and file (RQ-43). |
| Activity tab | Also candidate events: CV updated, verification approved (optional), certificate earned (optional). Confirm under RQ-42. |
| Notes tab | No change. |
| `CompareModal.jsx` | New rows: Languages; Right to work in the job's country; Verification; Latest employer and tenure; Highest education; Certificates. |
| Discovery filters (`DiscoveryToolbar.jsx`) | New: Right to work (country + accepted statuses), Language + minimum level, Verified only, Has live CV, Has certificates (RQ-38). Availability becomes an enum (RQ-37). |
| Sort (`client/src/features/recruiter/find-candidates/utils/discovery.js:3-7`) | Optionally "Recently updated". "Recommended" uses embeddings (RQ-34). |
| Match insights (`MatchInsights.jsx`, `matchEvidence.js`) | Add language fit (job required languages vs candidate levels) and right to work vs the job country and sponsorship flag. That needs new job fields (RQ-19). The narrative also uses work history and education (RQ-35). |
| Job wizard (`JobStepFields.jsx` step 6 or a new step) | Add "Required languages (+ minimum level)" and "Visa sponsorship available" (RQ-19). |
| Applications table and pipeline cards | Optional photo; right-to-work indicator. |

**Endpoints:**
- `GET /api/recruiter/candidates`: the filter params above.
- `GET /api/recruiter/candidates/:id`: the full structured profile filtered by privacy.
- `GET /api/certificates/verify/:code` (public).
- Photo served from `GET /uploads/photos/:file` (authenticated or signed URL, per RQ-43 logic).

**Questions:** RQ-19, RQ-37, RQ-38, RQ-45, RQ-46.

## B3. Messaging: recruiters can message any candidate; Free candidates read but must pay to reply

**Recruiter side:**
- "Start a conversation" sends a real message (A16).
- New Messages inbox and thread screens (A36).
- A sidebar "Messages" item with an unread badge, polled every 15 s.
- Email to the recruiter when the candidate replies (decision).
- "Translate" per message (decision).

**Entities:**
- `Conversation {companyId, candidateId, recruiterUserIds[], jobId?, lastMessageAt, lastMessagePreview, unread:{[userId]:count}}`
- `Message {conversationId, senderId, senderRole, body, createdAt, readBy:[{userId,at}], translations?}`

**Endpoints:**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/conversations?page` | |
| GET | `/api/conversations/unread-count` | |
| POST | `/api/conversations {candidateId, jobId?, body}` | **R✓ only** |
| GET | `/api/conversations/:id/messages?before&limit` | |
| POST | `/api/conversations/:id/messages {body}` | candidate: `402 'plan.required'` if Free |
| POST | `/api/conversations/:id/read` | |
| GET | `/api/messages/:id/translation?lang=` | |

**Free-plan behaviour:** only the candidate side changes ("Upgrade to reply"). The recruiter thread shows nothing plan-related (RQ-47).

**"Any candidate" versus privacy (RQ-32):** decide whether non-discoverable candidates who never applied can be messaged.

**Questions:** RQ-32, RQ-47, RQ-81, RQ-82, RQ-83.

## B4. Recruiter learning uses the new mixed-lesson model, viewed-to-complete lessons, a final quiz and a PDF certificate

**Recruiter Learning library (A28) changes:**
- "Courses in progress" = enrolled, ≥ 1 lesson completed, no certificate.
- "Certificates earned" = number of `Certificate` docs. The caption "Completed knowledge checks" (`LearningPage.jsx:56`) becomes "Final quizzes passed".
- The library description (`:107`) mentions the quiz and certificate.
- The card meta "level · duration · N lessons" (`CourseCard.jsx:22`) uses the computed duration and lesson count.
- "Continue course" = started; "View certificate" = certified.

**Course view (A29) changes:**
- Lesson rows show type, duration and state (Locked, Not started, In progress with %, Completed). There is no "Mark complete" toggle (`LessonRow.jsx:12` logic replaced).
- A "Final quiz" block: locked until all lessons are complete (RQ-70); shows the pass mark, last score and attempts.
- A "Certificate" block once passed: download PDF, plus the verification code and URL.
- `INCLUDED` (`CourseDetailsPage.jsx:15`) is computed.
- `LESSON_SUBTITLE` (`courses.js:18`) is dropped.

**New screens:** lesson viewer, quiz, certificate verification (A36).

**Entities (shared with candidates):**
- `Course {audience, …, lessons:[Lesson], quiz:{questions:[{id, text, options:[{id,text}], correctOptionIds:[id], multi:boolean}], passMark:70}}`
- `Lesson {id, order, type:'video'|'text'|'pdf'|'link', title, durationMinutes, videoPath?, videoDurationSec?, textBody?, pdfPath?, pdfPages?, linkUrl?}`
- `LessonProgress {userId, courseId, lessonId, watchedSeconds, maxPositionSec, percent, completedAt}`
- `QuizAttempt {userId, courseId, answers:[{questionId, optionIds}], score, passed, at}`
- `Certificate {userId, courseId, code (unique, e.g. 10-char base32), holderName, courseTitle, issuedAt, language, pdfPath}`

**Endpoints:**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/learning/courses/:id` | with progress |
| GET | `/api/learning/lessons/:lessonId` | 403 unless enrolled; returns a content URL or text |
| GET | `/api/learning/lessons/:lessonId/media` | HTTP range streaming for video and PDF |
| POST | `/api/learning/lessons/:lessonId/progress {positionSec, durationSec}` | heartbeat; marks complete at ≥ 90% for video; on open for text, PDF and link (RQ-69) |
| GET | `/api/learning/courses/:id/quiz` | questions without answers |
| POST | `/api/learning/courses/:id/quiz/attempts {answers}` | → `{score, passed, certificate?}` |
| GET | `/api/certificates?mine` | |
| GET | `/api/certificates/:id/pdf` | |
| GET | `/api/certificates/verify/:code` | public |

**Questions:** RQ-69, RQ-70, RQ-71, RQ-72, RQ-73, RQ-74.



---

# Part C: entities (recruiter-relevant; Mongoose)

Types: `S` string, `N` number, `B` boolean, `D` date, `Id` ObjectId. `?` means optional. Defaults are given where the client implies one.

**User** (shared)
- `role:'candidate'|'recruiter'|'admin'`
- `email` S, unique, lower-case
- `passwordHash` S
- `fullName` S (≤ 100)
- `jobTitle?` S, recruiter only (≤ 100)
- `phone` S (E.164)
- `emailVerifiedAt?` D, `phoneVerifiedAt?` D
- `language:'en'|'es'|'fr'` (default from country, RQ-85)
- `country` (EU27 ISO-2 | `GB` | `REMOTE`)
- `termsAcceptedAt` D, `termsVersion` S
- `status:'active'|'suspended'|'deleted'`
- `notificationSettings:{inApp:B=true, email:B=true}` (`client/src/features/recruiter/settings/data/notifications.js:4`)
- `preferences:{matchJobId?:Id}` (`useMatchJob.js`)
- `lastLoginAt` D, timestamps

**RecruiterOnboarding** (or embedded on the recruiter user)
- `userId`, `companyId`
- `status:'in_progress'|'pending_review'|'approved'|'rejected'|'suspended'` (default `in_progress`)
- `stepsCompleted:['account'|'company'|'kyc'|'verify']` (`client/src/features/auth/data/onboarding.js:2-8`)
- `submittedAt?`, `decidedAt?`, `decidedBy?`, `decisionReason?`
- `history:[{status, at, by, reason}]`

**VerificationCode**
- `userId`
- `channel:'email'|'phone'`
- `purpose:'onboarding'|'password_reset'` (password reset may use a token instead)
- `codeHash`, `expiresAt`, `attempts:N=0`, `sentAt`, `consumedAt?`

**Company**
- `legalName` S (onboarding "Legal company name")
- `displayName` S (Company page "Company name"; RQ-2)
- `website` S (normalised `https://`)
- `businessEmail` S
- `industry` S (free text, ≤ 80; examples "Enterprise SaaS")
- `size:'1_10'|'11_50'|'51_200'|'201_500'|'501_1000'|'1000_plus'` (RQ-4)
- `country` (EU27 | GB)
- `city?` S (Company page "Location")
- `businessAddress` S
- `registrationDetails?` S
- `description` S (≥ 20 characters, `CompanyPage.jsx:23-25`)
- `logoInitial` (derived)
- `verifiedAt?` D
- `ownerUserId`, `memberUserIds[]` (RQ-1)

**KycDocument**
- `companyId`, `userId`
- `type:'identity'|'registration'|'authorization'` (`KycVerificationPage.jsx:13-30`)
- `originalName`, `storedPath`
- `mimeType:'application/pdf'|'image/jpeg'|'image/png'`
- `size` N, `uploadedAt`
- `reviewStatus?:'pending'|'accepted'|'rejected'`

**Job**
- `companyId`, `createdBy`
- `title` S (3..120)
- `companyName` S (snapshot of the company display name; RQ-29)
- `employmentType:'full_time'|'part_time'|'contract'|'internship'` (`client/src/features/recruiter/jobs/data/jobs.js:24`; default `full_time`, `jobFields.js:41`)
- `description` S (≥ 40, `jobFields.js:54`)
- `responsibilities:[S]`
- `requiredSkills:[S]` (≥ 1 to publish), `preferredSkills:[S]`
- `level:'junior'|'mid'|'senior'|'lead'` (`jobFields.js:21`)
- `experienceYears` N (int, 0–50)
- `country`, `city?` S, `remoteCountries?:[country]` (RQ-15)
- `workPreference:'remote'|'hybrid'|'on_site'` (`jobs.js:23`)
- `salaryMin?` N, `salaryMax?` N (≥ 0, max ≥ min), `salaryCurrency` (ISO 4217), `salaryPeriod:'year'|'month'` (RQ-16)
- `requiredLanguages?:[{language, minLevel}]`, `visaSponsorship?:B` (RQ-19)
- `status:'draft'|'published'|'paused'|'closed'` (default `draft`, `useJobs.js:26`)
- `moderation:{restricted:B=false, reason?, by?, at?}` (RQ-28)
- `createdAt`, `updatedAt`, `publishedAt?`, `firstPublishedAt?`, `closedAt?`
- `sourceHash` S
- `embedding:[N]`, `embeddingModel` S
- `relevantCount` N (cached), `applicationCount` N (cached or aggregated)
- `aiSummaries:{[lang]:{sourceHash, generatedAt, model, summary}}`

**Application** (shared with the candidate audit)
- `candidateId`, `jobId`, `companyId`
- `appliedAt` D
- `status` (candidate-facing): `'applied'|'under_review'|'interview'|'offer'|'hired'|'not_selected'|'withdrawn'` (today the candidate side has only `applied`, `under-review`, `interview`, `withdrawn`: `client/src/features/candidate/jobs/data/applications.js:49-54`; RQ-52)
- `stageId:Id|'rejected'` (default = the company's first stage)
- `rejectedAt?`, `withdrawnAt?`, `lastActivityAt`
- `relevantSkillsCount` N (cached)
- `consentSnapshot?` (fields shared at apply time)
- `stageHistory:[{fromStageId, toStageId, fromName, toName, at, byUserId}]`

**PipelineStage**
- `companyId` (or `jobId` per RQ-49)
- `name` S (1..24, unique case-insensitive per pipeline; `pipeline.js:6`, `usePipeline.js:13-18`)
- `tone:'neutral'|'primary'|'success'` (default `primary` for new stages, `usePipeline.js:46`)
- `order` N
- `candidateStatus?` (RQ-52)
- `isEntry` B (first stage)
- Defaults: the six from `pipeline.js:9-16`, created at company approval.

**ShortlistEntry**
- `companyId`, `candidateId`, `addedBy`, `createdAt`, `jobId?`
- Unique on `(companyId, candidateId)` (RQ-40)

**CandidateNote**
- `companyId`, `candidateId`
- `text` S (≤ 5,000)
- `updatedBy`, `updatedAt` (RQ-41)

**RecruiterActivity**
- `companyId`, `candidateId`, `actorUserId|null`
- `type:'outreach'|'cv_request'|'cv_request_decided'|'cv_download'|'stage'|'rejected'|'shortlisted'|'unshortlisted'|'note_updated'|'applied'|'withdrawn'|'message_reply'`
  - today only `outreach`, `cv-request` and `stage` exist (`useCandidateActivity.js:9`)
- `params` (`stageName`, `reason`, `jobTitle`…)
- `at` D

**CvAccessRequest**
- `companyId`, `candidateId`, `requestedBy`
- `reason:'verify_employment'|'earlier_role_cv'|'compliance'|'other'` (`EarlierVersionModal.jsx:5-10`)
- `details?` S (≤ 1,000)
- `status:'pending'|'approved'|'declined'`
- `cvVersionId?`, `createdAt`, `decidedAt?`

**Conversation** and **Message**: see B3.

**Course**, **Lesson**, **LessonProgress**, **QuizAttempt**, **Certificate**: see B4.
- Course also has: `audience:'candidate'|'recruiter'`, `title`, `stream` (today recruiter `stream` and admin `category` for the same thing), `level:'foundation'|'intermediate'|'advanced'` (`client/src/features/admin/courses/data/courses.js:3`), `prices:[{currency, amount}]`, `access:'lifetime'|'one_time'|'free'` (captions in `courses.js:36,63…`), `imageUrl`, `summary`, `lead`, `tagline`, `designedFor`, `outcomes:[S]`, `status:'draft'|'published'`, `enrolledCount`, `purchasedCount`, `updatedAt`.

**Enrollment**
- `userId`, `courseId`
- `source:'purchase'|'free'|'seed'`
- `paymentId?`, `enrolledAt`, `completedAt?`, `certificateId?`

**Payment** (`client/src/features/payments/data/payments.js:1-10`)
- `userId`, `payerRole`, `payerName` (snapshot)
- `kind:'course'|'subscription'`, `itemId`, `itemName`
- `amount` (minor units), `currency`
- `status:'pending'|'paid'|'failed'|'refunded'`
- `failureReason?`
- `method:{brand, last4}`
- `reference` (`LWM-xxxxx`, unique)
- `stripeCheckoutSessionId`, `stripePaymentIntentId`
- `at`

**Notification** (optional, RQ-77)
- `userId`, `type`, `params`, `readAt?`, `createdAt`

**TranslationCache**
- `entityType`, `entityId`, `field`, `lang`, `sourceHash`, `text`, `createdAt`

**MatchInsightCache**
- `candidateId`, `jobId`, `lang`, `profileHash`, `jobHash`, `evidence`, `narrative`, `generatedAt`

**AuditLog** (admin)
- `actorId`, `category`, `title`, `detail`, `at`
- Recruiter events per RQ-89.

---

# Part D: endpoints (recruiter side; guards per §0.2)

| # | Method + path | Guard | Request → response | Used by |
|---|---|---|---|---|
| 1 | POST `/api/auth/register/recruiter` | public | `{fullName, jobTitle, workEmail, phone, password, acceptTerms, language, country}` → `201 {token,user,onboarding}` / `409` / `422` | A2 |
| 2 | POST `/api/auth/login` | public | `{email,password}` → `{token,user,recruiter?}` / `401` | A1 |
| 3 | POST `/api/auth/forgot-password` | public | `{email}` → `204` | new |
| 4 | POST `/api/auth/reset-password` | public | `{token,password}` → `204` / `422` | new |
| 5 | GET `/api/me` | any | → `{user, company?, onboarding?, unread:{messages}}` | shell |
| 6 | PATCH `/api/me` | any | `{fullName?, language?, country?, jobTitle?, phone?}` → `{user}` | shell, profile menu |
| 7 | PATCH `/api/me/preferences` | R✓ | `{matchJobId}` → `{preferences}` | A15, A16, A24 |
| 8 | GET / PATCH `/api/me/notification-settings` | any | `{inApp?, email?}` | A31 |
| 9 | GET `/api/me/export?format=json\|csv` | any | → file | A32 |
| 10 | DELETE `/api/me` | any | `{password}` → `204` | RQ-79 |
| 11 | GET `/api/recruiter/onboarding` | R… | → onboarding DTO (A3) | A3–A8 |
| 12 | PUT `/api/recruiter/onboarding/account` | R… | account fields → `{account}` | A4 |
| 13 | PUT / PATCH `/api/recruiter/onboarding/company` | R… | company fields → `{company}` (PUT completes the step, PATCH only saves) | A5 |
| 14 | POST `/api/recruiter/onboarding/documents` | R… | multipart `{type,file}` → `201 {document}` | A6 |
| 15 | DELETE `/api/recruiter/onboarding/documents/:id` | R… | → `204` | A6 |
| 16 | POST `/api/recruiter/onboarding/kyc/complete` | R… | → `{stepsCompleted}` / `422` | A6 |
| 17 | POST `/api/recruiter/onboarding/verification/email/send` | R… | → `204` / `429` | A7 |
| 18 | POST `/api/recruiter/onboarding/verification/phone/send` | R… | → `{code}` (on screen) / `429` | A7 |
| 19 | POST `/api/recruiter/onboarding/submit` | R… | `{emailCode, phoneCode}` → `{status:'pending_review'}` / `422` | A7 |
| 20 | GET `/api/recruiter/overview` | R✓ | → `{stats:{openPositions, recommendedCandidates, applications, shortlisted}, funnel[], openRoles:{items, total}}` | A9 |
| 21 | GET `/api/recruiter/overview/momentum` | R✓ | `?period&tz` → `{days[7]}` | A9 |
| 22 | GET `/api/recruiter/overview/talent` | R✓ | `?limit=3&lang` → `[TalentCard]` | A9 |
| 23 | GET `/api/recruiter/jobs` | R✓ | `?status&q&sort&dir&page&limit&fields` → `{items,total,statusCounts}` | A9, A10, A15 |
| 24 | POST `/api/recruiter/jobs` | R✓ | job fields + status → `201 {job}` | A12 |
| 25 | GET `/api/recruiter/jobs/:id` | R✓ | → `{job, stats}` | A13, A14 |
| 26 | PUT `/api/recruiter/jobs/:id` | R✓ | fields (+ status) → `{job}` | A13 |
| 27 | PATCH `/api/recruiter/jobs/:id/status` | R✓ | `{status}` → `{job}` / `409` / `422` | A10 |
| 28 | DELETE `/api/recruiter/jobs/:id` | R✓ | → `204` (drafts only, RQ-21) | — |
| 29 | POST `/api/recruiter/jobs/analyze` | R✓ | `{values}` → `[{key,ok,params}]` | A12 step 7 |
| 30 | GET `/api/recruiter/jobs/:id/summary` | R✓ | `?lang` → AI summary DTO / `503 {fallback}` | A11 |
| 31 | POST `/api/recruiter/jobs/:id/summary/regenerate` | R✓ | → same | A11 |
| 32 | GET `/api/recruiter/jobs/:id/relevant-talent` | R✓ | `?limit=4` → `[…]` | A14 |
| 33 | GET `/api/skills/suggestions` | R✓ | `?q&lang&limit=12` → `[S]` | A12 steps 3–4 |
| 34 | GET `/api/recruiter/candidates` | R✓ | filters (A15, B2) → `{items,total,facets}` | A15 |
| 35 | GET `/api/recruiter/candidates/:id` | R✓ | → `{profile, relationship}` / `404` | A16–A21 |
| 36 | GET `/api/recruiter/candidates/:id/match` | R✓ | `?jobId&lang` → match DTO | A9, A15, A16 |
| 37 | GET `/api/recruiter/candidates/:id/cv` | R✓ | → metadata / `403` | A21 |
| 38 | GET `/api/recruiter/candidates/:id/cv/file` | R✓ | `?inline` → stream / `403` | A21 |
| 39 | POST `/api/recruiter/candidates/:id/cv-requests` | R✓ | `{reason,details}` → `201` | A21 |
| 40 | GET `/api/recruiter/candidates/:id/activity` | R✓ | → `[…]` | A22 |
| 41 | GET / PUT `/api/recruiter/candidates/:id/note` | R✓ | `{text}` | A23 |
| 42 | GET `/api/recruiter/shortlist` | R✓ | filters → `{items,total}` | A24, A9 KPI |
| 43 | PUT / DELETE `/api/recruiter/shortlist/:candidateId` | R✓ | → `{shortlisted}` / `204` | A9, A15, A16, A24 |
| 44 | GET `/api/recruiter/applications` | R✓ | `?q&stageId&jobId&status&page` → `{items,total}` | A25 |
| 45 | PATCH `/api/recruiter/applications/:id/stage` | R✓ | `{stageId, notifyCandidate?, reason?}` → `{application}` | A16, A25, A26 |
| 46 | GET `/api/recruiter/pipeline` | R✓ | `?jobId` → `{stages, applications}` | A26 |
| 47 | POST `/api/recruiter/pipeline/stages` | R✓ | `{name, candidateStatus?}` → `201` / `422` | A27 |
| 48 | PATCH `/api/recruiter/pipeline/stages/:id` | R✓ | `{name?, candidateStatus?, tone?}` | A27 |
| 49 | PUT `/api/recruiter/pipeline/stages/order` | R✓ | `{ids}` → `{stages}` | A27 |
| 50 | DELETE `/api/recruiter/pipeline/stages/:id` | R✓ | → `204` / `409` / `422` | A27 |
| 51 | GET `/api/conversations` (+ `/unread-count`) | R✓ / C | → list / `{count}` | A36 |
| 52 | POST `/api/conversations` | R✓ | `{candidateId, jobId?, body}` → `201` | A16 |
| 53 | GET / POST `/api/conversations/:id/messages`, POST `/:id/read` | R✓ / C | | A36 |
| 54 | GET `/api/messages/:id/translation` | any | `?lang` → `{text}` | A36 |
| 55 | GET `/api/translate` | any | `?entity=job\|profile\|workHistory&id&field&lang` → `{text}` | A14, A17, A18 |
| 56 | GET `/api/courses` | R✓ | `?audience=recruiter&q&stream` → `[…]` | A28 |
| 57 | GET `/api/learning/courses/:id` | R✓ | → course + progress | A29 |
| 58 | GET `/api/recruiter/learning/summary` | R✓ | → `{inProgress, certificates, streams, suggestions[]}` | A28 |
| 59 | POST `/api/learning/enrollments` | R✓ | `{courseId}` → `201` (free only) | A28 |
| 60 | Lesson, quiz and certificate endpoints | R✓ (verify: public) | see B4 | A29, new |
| 61 | POST `/api/payments/checkout` | R✓ | `{kind:'course', courseId}` → `{checkoutUrl}` | A28, A29 |
| 62 | GET `/api/payments/checkout/:sessionId` | R✓ | → `{status, enrollment?}` | A28, A29 |
| 63 | POST `/api/payments/webhook` | Stripe signature | Stripe event → `200` | — |
| 64 | GET `/api/me/payments` | any | → `[…]` | A33 |
| 65 | GET `/api/recruiter/company`, PUT same | R✓ | company fields | A30 |
| 66 | GET `/api/notifications`, POST `/api/notifications/read` | any | optional (RQ-77) | shell |

**Background jobs, no Redis.**
- These run in-process: on a timer (`setInterval` / `node-cron`) or on the triggering request.
- **On job publish:**
  - compute the embedding;
  - recompute `relevantCount`;
  - send job-alert emails (batched);
  - send the recruiter's "new application" email.
- **Nightly:** recompute relevance counts.
- **Delayed stage-change emails** (RQ-54) need a persisted `EmailOutbox {to, template, params, lang, sendAfter, sentAt}` that a 1-minute timer sends from.

---

# Part E: static items to replace (every literal with file:line)

| # | file:line | Current static value | Replacement |
|---|---|---|---|
| S1 | `client/src/app/workspaces.js:65` | user `'Sarah Miller'`, `'Acme Studio'`, avatar image | `/api/me` |
| S2 | `client/src/app/workspaces.js:67` | `showWorkspaceSwitch: true` | removed |
| S3 | `client/src/components/layout/preferencesContext.js:18` | US/UK/DE location list | EU 27 + UK + Remote |
| S4 | `client/src/components/layout/preferencesContext.js:21` | language labels only | real i18n |
| S5 | `client/src/components/layout/Header.jsx:171` | bell dot always shown | unread state |
| S6 | `client/src/features/recruiter/overview/pages/OverviewPage.jsx:60` | "Good morning, Sarah" | computed |
| S7 | `client/src/features/recruiter/overview/data/overview.js:4-7` (used `OverviewPage.jsx:36,43`) | recommendedCandidates 6, applications 6 | API stats |
| S8 | `client/src/features/recruiter/overview/data/overview.js:10-17` | funnel stages and counts | API funnel |
| S9 | `client/src/features/recruiter/overview/data/overview.js:20` | weekday labels | Intl |
| S10 | `client/src/features/recruiter/overview/data/overview.js:22-35` | momentum series | API |
| S11 | `client/src/features/recruiter/overview/components/HiringMomentumCard.jsx:9` | `SCALE_MAX = 25` | dynamic |
| S12 | `client/src/features/recruiter/overview/components/HiringMomentumCard.jsx:75` | "Illustrative activity…" | copy |
| S13 | `client/src/features/recruiter/overview/data/overview.js:38-78` | TALENT (3 people) | API talent |
| S14 | `client/src/features/recruiter/overview/components/TalentCard.jsx:61` | "Core profile ready" | completeness |
| S15 | `client/src/features/recruiter/overview/components/TalentCard.jsx:89-95` | Compare checkbox with no effect | remove (RQ-39) |
| S16 | `client/src/features/recruiter/overview/components/TalentCard.module.css:30-43` | avatar tones lilac, mint, peach | photo or hashed colour |
| S17 | `client/src/features/recruiter/jobs/data/jobs.js:26-99` | 3 seed jobs (US/UK, USD, `relevant`, `applications`) | DB seed (EU-localised, RQ-86) |
| S18 | `client/src/features/recruiter/jobs/data/jobs.js:16-24` | status, workPreference and employment enums as English labels | enum keys + i18n |
| S19 | `client/src/features/recruiter/jobs/data/jobFields.js:9-19` | step labels | i18n |
| S20 | `client/src/features/recruiter/jobs/data/jobFields.js:21` | levels as English labels | keys |
| S21 | `client/src/features/recruiter/jobs/data/jobFields.js:23-36` | SKILL_SUGGESTIONS | API suggestions |
| S22 | `client/src/features/recruiter/jobs/data/jobFields.js:40` | company `'Acme Studio'` | company display name |
| S23 | `client/src/features/recruiter/jobs/data/jobFields.js:115-144` | English validation messages | i18n keys (server mirrors) |
| S24 | `client/src/features/recruiter/jobs/data/jobFields.js:162-171` | `$…k` salary formatter | Intl currency, compact |
| S25 | `client/src/features/recruiter/jobs/data/jobFields.js:179-217` | local "AI analysis" rules and texts | server rules or AI |
| S26 | `client/src/features/recruiter/jobs/components/JobStepFields.jsx:81` | placeholder "e.g. San Francisco, US" | country picker |
| S27 | `client/src/features/recruiter/jobs/components/JobStepFields.jsx:91,93,97,99` | "(USD per year)", 140000 / 180000 | currency-aware |
| S28 | `client/src/features/recruiter/jobs/components/JobStepFields.jsx:111-114` | "No AI model is connected" | copy |
| S29 | `client/src/features/recruiter/jobs/pages/CreateJobPage.jsx:10,32,54` | browser draft key and note | server draft |
| S30 | `client/src/features/recruiter/jobs/pages/CreateJobPage.jsx:76,86` | "saved on this device" | copy |
| S31 | `client/src/features/recruiter/jobs/hooks/useJobs.js:17,24` | localStorage store; slug id | API, ObjectId |
| S32 | `client/src/features/recruiter/jobs/data/relevantTalent.js:5-10` | 4 relevant-talent people | API |
| S33 | `client/src/features/recruiter/jobs/components/JobTalentList.jsx:9` | `slice(0, job.relevant)` | API |
| S34 | `client/src/features/recruiter/jobs/pages/JobDetailsPage.jsx:34-36,88` | seed `applications` + local count; "local applications" | API counts |
| S35 | `client/src/features/recruiter/jobs/pages/JobDetailsPage.jsx:93`, `client/src/features/recruiter/jobs/components/JobsTable.jsx:56,132` | discovery links not job-scoped | `?jobId=` |
| S36 | `client/src/features/recruiter/jobs/components/JobsTable.jsx:133` | `job.relevant` seeded | `relevantCount` |
| S37 | `client/src/features/recruiter/jobs/components/AiJobSummary.jsx:10-40,57,59,107-110` | local summary; "Local structured summary"; disclaimer | OpenAI summary |
| S38 | `client/src/features/recruiter/jobs/pages/JobsPage.jsx:13-18` | no Closed tab | add |
| S39 | `client/src/features/recruiter/find-candidates/data/candidates.js:13-104` | 6 candidates (US/UK, free-text availability, avatar colours, profileStatus) | API |
| S40 | `client/src/features/recruiter/find-candidates/data/candidateDetails.js:11-72` | about, roles, education, potentialGap | API profile and AI |
| S41 | `client/src/features/recruiter/find-candidates/components/DiscoveryToolbar.jsx:8-11` | filter option lists derived from static data | enums and facets |
| S42 | `client/src/features/recruiter/find-candidates/components/DiscoveryToolbar.jsx:29` | search example placeholder | i18n |
| S43 | `client/src/features/recruiter/find-candidates/hooks/useMatchJob.js:4-5` | key; default job id `'senior-product-designer'` | preference |
| S44 | `client/src/features/recruiter/find-candidates/hooks/useShortlist.js:3,6` | key; default `['oliver-park','james-chen']` | API (seed) |
| S45 | `client/src/features/recruiter/find-candidates/hooks/useCandidateActivity.js:3,20` | key; English sentences | API typed events |
| S46 | `client/src/features/recruiter/find-candidates/hooks/useCandidateNotes.js:3` | key | API |
| S47 | `client/src/features/recruiter/find-candidates/utils/discovery.js:3-7,16-49` | sort options; ASCII-only tokeniser; client search | server query |
| S48 | `client/src/features/recruiter/find-candidates/utils/matchEvidence.js:8-28` | client evidence | server match |
| S49 | `client/src/features/recruiter/find-candidates/components/MatchInsights.jsx:19` | invented `potentialGap` | AI gaps |
| S50 | `client/src/features/recruiter/find-candidates/components/CandidateAvatar.jsx:9` | per-candidate colours | photo |
| S51 | `client/src/features/recruiter/find-candidates/pages/CandidateProfilePage.jsx:50` | default stage = first stage for non-applicants | per application |
| S52 | `client/src/features/recruiter/find-candidates/pages/CandidateProfilePage.jsx:61,65,67` | English activity texts; "preview" notice | typed events; "Message sent" |
| S53 | `client/src/features/recruiter/find-candidates/components/MessageModal.jsx:11,29,36` | template; "local preview" copy; button label | real send |
| S54 | `client/src/features/recruiter/find-candidates/pages/CandidateOverviewPage.jsx:23-26,30-33` | demo role summary; templated next step | structured data |
| S55 | `client/src/features/recruiter/find-candidates/pages/CandidateExperiencePage.jsx:21-24` | demo summary per role | work-history description |
| S56 | `client/src/features/recruiter/find-candidates/pages/CandidateSkillsPage.jsx:17` | "Candidate-provided" on every skill | source badge |
| S57 | `client/src/features/recruiter/find-candidates/pages/CandidateEducationPage.jsx:20` | "Sample education ·" | data |
| S58 | `client/src/features/recruiter/find-candidates/pages/CandidateResumePage.jsx:17,49,51-53,62,22,25,84-87` | synthetic file name; live labels; download stub; local-only copy | CV API |
| S59 | `client/src/features/recruiter/find-candidates/components/ResumePreviewModal.jsx:15,55` | "This demo has no CV file."; "Sample education" | real CV |
| S60 | `client/src/features/recruiter/find-candidates/components/EarlierVersionModal.jsx:5-10,35` | reasons as labels; "recorded on this device only" | enum keys; real request |
| S61 | `client/src/features/recruiter/find-candidates/pages/CandidateActivityPage.jsx:8,28` | `toLocaleString(undefined…)`; "on this device" | locale from user |
| S62 | `client/src/features/recruiter/find-candidates/pages/CandidateNotesPage.jsx:42` | "Notes saved on this device." | copy |
| S63 | `client/src/features/recruiter/shortlists/pages/ShortlistsPage.jsx:35` | static candidates + live applicant | API |
| S64 | `client/src/features/recruiter/applications/pages/ApplicationsPage.jsx:53` | role = candidate title | job title |
| S65 | `client/src/features/recruiter/applications/pages/ApplicationsPage.jsx:116-127` | "Candidate portal activity" static empty state | remove or feed |
| S66 | `client/src/features/recruiter/hiring-pipeline/data/pipeline.js:9-16` | default stages | seed per company |
| S67 | `client/src/features/recruiter/hiring-pipeline/data/pipeline.js:23-30` | APPLICANTS + `alignedSkills` literals | API |
| S68 | `client/src/features/recruiter/hiring-pipeline/data/pipeline.js:32-39` | DEFAULT_PLACEMENTS by candidate | `Application.stageId` |
| S69 | `client/src/features/recruiter/hiring-pipeline/hooks/usePipeline.js:26,29-32` | localStorage; applicant assembly | API |
| S70 | `client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:8,17-18,36,38,44-45,49-50` | `'alex-morgan'`; reads candidate storage; fixed colour; `company ''`; availability mapping; `'Self-reported experience'`; education period = institution | API |
| S71 | `client/src/features/recruiter/hiring-pipeline/pages/HiringPipelinePage.jsx:47` | "All open roles" chip | job filter |
| S72 | `client/src/features/recruiter/hiring-pipeline/components/ApplicantCard.jsx:35,48` | "N aligned skills" (static input); "Demo profile activity" | API |
| S73 | `client/src/features/recruiter/learning/data/courses.js:13-16` | INITIAL_LEARNING | seed enrollment |
| S74 | `client/src/features/recruiter/learning/data/courses.js:18` | LESSON_SUBTITLE | lesson type and duration |
| S75 | `client/src/features/recruiter/learning/data/courses.js:28-186` | 6 courses (copy, prices, durations, bundled photos) | `Course` |
| S76 | `client/src/features/recruiter/learning/data/courses.js:189-208` | SUGGESTIONS with literal reasons | API suggestions |
| S77 | `client/src/features/recruiter/learning/hooks/useCourseCatalogue.js:4,8-29` | single photo; generated generic copy for uploads | `Course` fields |
| S78 | `client/src/features/recruiter/learning/hooks/useRecruiterLearning.js:5` | `£` price formatter | Intl currency |
| S79 | `client/src/features/recruiter/learning/hooks/useRecruiterLearning.js:18,24-36` | localStorage purchase and lesson toggle | API (decision 4) |
| S80 | `client/src/features/recruiter/learning/pages/LearningPage.jsx:47-50,56,72-73,81-84,107,119-121` | "Learning profile active"; "Completed knowledge checks"; "Enterprise SaaS" / "3 active roles"; "No connected AI model"; "knowledge checks"; local notice | data and copy |
| S81 | `client/src/features/recruiter/learning/pages/CourseDetailsPage.jsx:15` | INCLUDED (says 4 lessons; courses have 5) | computed |
| S82 | `client/src/features/recruiter/learning/components/PurchaseDialog.jsx:22` | "saved in this browser" | copy |
| S83 | `client/src/features/payments/components/CheckoutDialog.jsx:66,86,147-150` | payer name from config; demo description; demo cards | Stripe Checkout |
| S84 | `client/src/features/payments/data/payments.js:21,24-26,31,38-45` | `£` formatter; `en-US` date; `'GBP'`; seed payments | Intl; seed |
| S85 | `client/src/features/payments/hooks/usePayments.js:174-175,187` | filter by the static name; `currency 'GBP'` | `userId`; currency |
| S86 | `client/src/features/admin/courses/data/courses.js:22-27` | recruiter course seeds that conflict | unify (RQ-66) |
| S87 | `client/src/features/recruiter/company/data/company.js:7-14` | sizes with en dash | enum keys |
| S88 | `client/src/features/recruiter/company/data/company.js:16-24` | Acme Studio seed (San Francisco) | DB seed |
| S89 | `client/src/features/recruiter/company/pages/CompanyPage.jsx:80-83,147` | "Demo company"; "saved on this device" | verified badge; copy |
| S90 | `client/src/features/recruiter/settings/data/notifications.js:4,15-16` | defaults; "Email delivery is not connected in this demo." | API; copy |
| S91 | `client/src/features/recruiter/settings/data/account.js:2-3,6,9` | DATA_NOTICE demo; storage prefix; reset flag | copy; remove |
| S92 | `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:30-57,69-83,100-108,116-136` | Reset demo; export built from static workspace data | remove; export API |
| S93 | `client/src/features/recruiter/settings/pages/BillingPage.jsx:16` | "The checkout is a demo…" | copy |
| S94 | `client/src/features/recruiter/settings/components/SettingsLayout.jsx:17` | lead mentions privacy | copy (RQ-80) |
| S95 | `client/src/features/help/data/help.js:9,15,21,30-40` | demo FAQ answers incl. reset-demo | copy |
| S96 | `client/src/features/auth/data/onboarding.js:11` | `DEMO_OTP '123456'` | server codes |
| S97 | `client/src/features/auth/data/onboarding.js:14-21` | sizes with hyphen | enum keys |
| S98 | `client/src/features/auth/utils/useOnboardingState.js:11-12` | localStorage onboarding | API |
| S99 | `client/src/features/auth/utils/session.js:8-9,13-39` | `lwm-session`; shared member group | JWT |
| S100 | `client/src/features/auth/pages/SignInPage.jsx:62-63,104,108` | session without credentials; "matchpoint"; DemoNote | real login; copy |
| S101 | `client/src/features/auth/components/DemoNote.jsx:6-9` | demo disclaimer | remove |
| S102 | `client/src/features/auth/components/RecruiterAccountFields.jsx:17,55` | placeholder 'Alex Morgan'; "Don’t use a real password in this demo." | copy |
| S103 | `client/src/features/auth/pages/RecruiterSignUpPage.jsx:43-48` | fake 500 ms latency; local save | API |
| S104 | `client/src/features/auth/pages/VerifyAccountPage.jsx:47,72,84,103-106` | fake latency; demo-code hints; "simulated" note | real OTP |
| S105 | `client/src/features/auth/pages/AdminReviewPage.jsx:19-20,22,37` | "Verified" ×2, "Locked pending approval", "Under Review" literals | status API |
| S106 | `client/src/features/auth/pages/KycVerificationPage.jsx:88` | "retains file names only" | copy |
| S107 | `client/src/features/auth/components/DocumentUpload.jsx:10-13` | file name only | multipart upload |
| S108 | `client/src/features/auth/components/OnboardingLayout.jsx:106-108` | privacy note "saved on this device" | copy |
| S109 | `client/src/features/auth/pages/CompanyInformationPage.jsx:100-107` | free-text country | picker |
| S110 | `client/src/features/auth/data/hero.js:2`, `client/src/components/layout/AuthLayout.jsx:63` | hero footers ("Local Workman" / "matchpoint.") | brand copy |
| S111 | `client/src/features/candidate/jobs/data/recruiterJobs.js:8-15,41-42,46-47,53` | `acme-` id bridge; `aiMatch` % / matchLabel from skill share; salary `/1000`; posted hours | API (candidate audit) |
| S112 | `client/src/features/candidate/jobs/data/jobUtils.js:9` | candidate `$Nk` salary display of recruiter jobs | Intl currency |

---

# Part F: formatting, currency, country and i18n inventory

## Formatters and hard-coded units

1. `client/src/features/recruiter/jobs/data/jobFields.js:162-171` `formatSalary`:
   - output: `$` + thousands + `k`, with one decimal for non-integers, an en-dash range, and the English words "From" / "Up to"
   - also used by admin `client/src/features/admin/jobs/pages/JobsPage.jsx:11`, `client/src/features/admin/jobs/components/JobSummaryModal.jsx:6` and `client/src/features/admin/moderation/utils/jobReviewItem.js:1`
2. `client/src/features/recruiter/jobs/data/jobFields.js:174-176` `jobMetaLine`: joins with " · ".
3. `client/src/features/recruiter/jobs/components/AiJobSummary.jsx:17` "per year"; `:47` "{n}+ years".
4. `client/src/features/recruiter/jobs/components/JobStepFields.jsx:91,97` "(USD per year)".
5. `client/src/features/recruiter/learning/hooks/useRecruiterLearning.js:5` `formatPrice` → `£x.xx`.
6. `client/src/features/payments/data/payments.js:21` `formatMoney` → `£`; `:24-26` `formatPaymentDate` uses `'en-US'` ("Oct 29, 2026"); `client/src/features/payments/hooks/usePayments.js:187` `currency:'GBP'`.
7. `client/src/features/recruiter/find-candidates/pages/CandidateActivityPage.jsx:8`: `toLocaleString(undefined, …)` (browser locale, not the user's chosen one).
8. `client/src/features/recruiter/overview/data/overview.js:20`: English weekdays.
9. `client/src/features/auth/components/OnboardingLayout.jsx:42,120`: "{n}% complete" (FR needs "{n} %").
10. Duration strings `'2h 20m'` (`client/src/features/recruiter/learning/data/courses.js:33,…`) and `client/src/features/admin/courses/utils/learnerCourse.js:37-43` ("h", "m").
11. Period strings `'2022–present'` (`client/src/features/recruiter/find-candidates/data/candidateDetails.js`) and `` `${years} years` `` (`useLiveApplicant.js:49`).
12. Company sizes with "1,000" (`company.js:12-13`, `onboarding.js:19-20`): thousands separators baked into labels.
13. Candidate side (cross-role): `client/src/features/candidate/jobs/data/jobUtils.js:9` `$Nk`; `recruiterJobs.js:46-47` (÷ 1000); `client/src/features/candidate/jobs/data/applications.js:69-71` `'en-US'`.
14. `client/src/components/common/StatCard.jsx:7` via `useCountUp`: integers without locale grouping (needs `Intl.NumberFormat` above 999).

## Pluralisation done with English ternaries, or not at all

Needs ICU plurals for ES and FR:
- `FindCandidatesPage.jsx:62`
- `ShortlistsPage.jsx:71`
- `matchEvidence.js:22`
- `jobFields.js:207`
- `usePipeline.js:78`
- `useLiveApplicant.js:49`
- **no plural handling at all:**
  - "N candidates · N stages" (`HiringPipelinePage.jsx:49`)
  - "N relevant skills" (`TalentCard.jsx:78`)
  - "N aligned skills" (`ApplicantCard.jsx:35`)
  - "N years experience" (`CandidateCard.jsx:44`, `TalentCard.jsx:39`)
  - "N years" (`ApplicationsPage.jsx:54`, `ApplicantCard.jsx:30`, `CompareModal.jsx:11`)
  - "N local applications" (`JobDetailsPage.jsx:88`)
  - "{n} lessons" (`CourseCard.jsx:22`, `CourseDetailsPage.jsx:87`)

## Country rules (decision) applied to the recruiter side

- **Discovery:** country filters the candidates shown (RQ-33).
- **Salaries:** shown in the job's currency (RQ-16).
- **Course prices and Stripe:** in the country's currency (RQ-64, RQ-65).
- **Dates and numbers:** `Intl` with a locale derived from language + country (e.g. `fr-BE`, `es-ES`, `en-IE`).
- **Default language:** RQ-85.
- **Own data is not filtered by country:** Jobs, Applications and Pipeline (RQ-84).

## Translatable UI copy, rough counts

- Shell 15; sign-in 15; sign-up 25; onboarding shell 20; account 6; company step 22; KYC 14; verify 14; review 15.
- Overview 45; Jobs 35; AI summary 25; wizard 90; edit 6; job details 15.
- Find candidates 40; profile layout and modal 25; tabs 5 / 3 / 4 / 4 / 30 / 6 / 5; Shortlists 12; Applications 18; Pipeline 12; Manage stages 10.
- Learning 30; course view 25; Company 25; Settings 12 + 15 + 12; Help 20.
- **Total: about 700 strings, plus about 40 enum labels**:
  - 4 statuses, 3 work modes, 4 employment types, 4 levels, 6 company sizes
  - 6 default stage names, 4 CV-request reasons, 3 sort options, 9 wizard steps, 5 onboarding steps
  - 7 profile tabs, 3 course levels, CEFR levels, right-to-work statuses
- The 6 default stage names become user content once created (RQ-87).

## Demo-only copy to remove or rewrite

S12, S28, S30, S37, S52, S53, S57–S62, S65, S72, S80, S82, S83, S89–S95, S100–S108, S110 (Part E).

---

# Part G: cross-role effects

**1. Jobs → candidates.**
- **Today:** published recruiter jobs appear in candidate Find jobs through `client/src/features/candidate/jobs/hooks/useJobListings.js:79-96`, using `toCandidateJob` (`recruiterJobs.js:23-65`) with the id prefix `acme-` (`:8,12,15`).
  - Paused, closed and removed jobs disappear from the list, but `getJob` still resolves them so existing applications keep their details (`useJobListings.js:89-95`).
  - Company industry, size and description come from the recruiter company store (`recruiterJobs.js:54-56`).
- **Server:** one `Job` collection.
  - The candidate endpoints return only `status:'published' && !restricted` jobs in the candidate's country (+ Remote).
  - A candidate who applied can still read the job.
  - **Publishing triggers job-alert emails** to candidates whose alerts match (decision; RQ-22).

**2. Candidates → recruiter (applications).**
- **Today:** a candidate application to an Acme job turns the demo candidate (Alex Morgan) into the "live applicant" (`client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:15-52`). The applicant enters at the first stage with no placement (`usePipeline.js:32`) and shows up in Applications, Pipeline, Shortlists (if shortlisted) and the profile.
  - Withdrawing removes the candidate everywhere.
  - Job details counts the applications (`JobDetailsPage.jsx:34-36`).
- **Server:**
  - `Application` is created by the candidate (requires email verified + complete profile + paid plan; decision 1).
  - The recruiter gets an email (decision) and an in-app badge.
  - Withdraw sets `status:'withdrawn'` (RQ-55).

**3. Recruiter → candidates (stages).**
- **Today:** recruiter stage changes **do not reach** the candidate at all. Candidate statuses are a separate seeded field (`client/src/features/candidate/jobs/data/applications.js:60-64`).
- **Server:** a stage change updates `Application.status` via the mapping (RQ-52) and emails the candidate in their language (decision; RQ-53, RQ-54). Rejection becomes `not_selected` (RQ-53).

**4. Messages.**
- Recruiter → candidate: a new conversation or message, an email to the candidate, and the candidate's unread badge.
- Candidate reply: paid plan required (decision 3); recruiter email (decision) and unread badge.

**5. Privacy (candidate → discovery).**
- **Today:** candidate settings `discoverable`, `resumeVisible` and `matchingConsent` (`client/src/features/candidate/settings/data/settings.js:8`) are **not read** by any recruiter code (grep: only candidate settings files use them).
- **Server:** discovery and talent queries require `discoverable && matchingConsent && emailVerified`.
  - CV access requires `resumeVisible` or an application (RQ-43).
  - Applicants stay visible to that company through their application even if not discoverable (RQ-31).

**6. Recruiter onboarding → admin.**
- **Today:** submission creates nothing for the admin. The admin account-review queue is static (`client/src/features/admin/moderation/data/moderation.js:28-36`, one candidate "James Chen").
- **Server:** submit creates a review item. Admin approve/reject (admin audit) sets `RecruiterOnboarding.status` and `Company.verifiedAt`, writes an audit entry, and emails the recruiter (RQ-6). Recruiter tools unlock only when approved.

**7. Admin moderation → jobs.**
- **Today:** "Restrict content" claims "Restricting a job pauses it" (`client/src/features/admin/moderation/data/moderation.js:55`), but it only records a decision.
- **Server:** RQ-28. A restricted job leaves candidate listings; the recruiter sees a restricted state and reason, and cannot publish it.

**8. Admin pages read recruiter jobs.**
- **Today:** Admin Jobs (`client/src/features/admin/jobs/pages/JobsPage.jsx:48`), Overview (`client/src/features/admin/overview/pages/OverviewPage.jsx:18,23`) and Moderation (`ModerationPage.jsx:64`) call the recruiter `useJobs` hook, and use the recruiter `formatSalary` (with `$`).
- **Server:** admin endpoints over the same `Job` collection; a shared currency formatter.

**9. Courses.**
- **Today:** admin course status and uploads feed the recruiter catalogue (`useCourseCatalogue.js:35-43`). Admin edits to a built-in course's title or price do not reach learners (documented in `IMPLEMENTATION_PLAN.md:287`). Purchases do not update the admin counters.
- **Server:** one `Course` collection; `enrolledCount` and `purchasedCount` aggregated from `Enrollment` and `Payment`.

**10. Payments → admin.** Recruiter payments appear in Admin → Payments (`client/src/features/payments/hooks/usePayments.js` with no role filter = admin). The server exposes them through admin endpoints.

**11. Certificates.** A recruiter's own certificates are not shown to candidates; recruiters have no public profile. A candidate's certificates are shown to recruiters (B2) and can be checked on the public verification page.

**12. Audit and AI policies.**
- Recruiter events in the admin audit log: RQ-89.
- Whether admin AI and matching policies drive recruiter matching: RQ-90.
- Whether admin custom roles enforce permissions is **undecided** in the brief. If enforced, any admin restriction of recruiter features would need a permission check in the `R✓` middleware.


---

# Part H: questions (each needs a product-owner answer; my recommendation is marked **Rec**)

## H1. Accounts, onboarding, approval

**RQ-1** Can a company have several recruiter users? Options: (a) one recruiter user = one company; (b) a company with several equal members; (c) an owner plus invited members with roles. **Rec:** (a) for v1, but store a separate Company document and scope every recruiter record (jobs, stages, shortlist, notes, conversations) by `companyId` so (b) or (c) can follow.

**RQ-2** One company name or two? Onboarding asks for "Legal company name" (`client/src/features/auth/pages/CompanyInformationPage.jsx:58`); the Company page asks for "Company name" (seed 'Acme Studio', `client/src/features/recruiter/company/data/company.js:17`). Options: (a) a single `name`; (b) `legalName` (KYC, admin-verified) + `displayName` (public). **Rec:** (b), with `displayName` defaulting to `legalName`.

**RQ-3** After approval, which company fields can the recruiter edit? Options: (a) all, freely; (b) all, but verified fields (legal name, country, registration, address) trigger re-review; (c) public fields only (display name, industry, size, city, website, description). **Rec:** (c).

**RQ-4** Company size lists differ. Onboarding uses hyphens ('1-10 employees', `client/src/features/auth/data/onboarding.js:14-21`); the Company page uses en dashes ('1–10 employees', `client/src/features/recruiter/company/data/company.js:7-14`). Should both use one enum of keys (`1_10`, `11_50`, `51_200`, `201_500`, `501_1000`, `1000_plus`) with translated labels, and are these six buckets final? **Rec:** yes to both.

**RQ-5** What does a signed-in recruiter see before approval (in progress, pending, rejected, suspended)? Options: (a) always redirected to onboarding: the first open step, or the review page with live status; (b) the workspace is visible read-only with tools locked. **Rec:** (a); only `approved` opens the workspace.

**RQ-6** When the admin approves or rejects, is the recruiter emailed, and can a rejected recruiter edit and resubmit? Options: (a) email both outcomes, and allow resubmission with the admin's reason shown; (b) email approval only, rejection is final. **Rec:** (a). Note: this email is not in the decided email list.

**RQ-7** The sign-up page is also onboarding step 1 (it collects the password), and the onboarding "Account registration" step repeats the password fields. **Rec:** sign-up creates the account and returns a JWT. `onboarding/account` becomes "edit your details" without password fields; password changes go through forgot/reset or a settings form.

**RQ-8** Candidates must verify their email before first login (new decision). Should recruiters be allowed to sign in before verifying (to resume onboarding), with email verified only at step 4? Options: (a) yes, the current flow; (b) verify the email right after sign-up with a code, so step 4 only handles the phone. **Rec:** (b), for consistency with candidates.

**RQ-9** Phone verification codes "stay on-screen". Options: (a) the server generates a random 6-digit code per request, returns it in the response for display, and verifies it; (b) a fixed code; (c) drop phone verification. **Rec:** (a). The review summary should then say "Phone: confirmed on screen (no SMS)" rather than "Verified" (`client/src/features/auth/pages/AdminReviewPage.jsx:20`).

**RQ-10** OTP policy. **Rec:**
- a 6-digit code with a 10-minute expiry;
- at most 5 wrong attempts per code;
- resend allowed after 60 s, at most 5 sends per hour;
- add a "Resend code" link (none exists today);
- changing the work email or phone after verification resets that verification;
- phone numbers stored in E.164, which needs a country-code input.

Confirm.

**RQ-11** KYC uploads: the client checks the extension only (`client/src/features/auth/utils/validation.js:9`) and has no size limit. Options: 5 MB, 10 MB or 20 MB per file. **Rec:**
- 10 MB per file, with MIME sniffing (magic bytes) for PDF, JPEG and PNG;
- stored outside the public folder;
- downloadable only by admins and the owner;
- replace or delete allowed only while onboarding is in progress or rejected.

**RQ-12** How long are KYC documents kept? Options: (a) for the account's lifetime; (b) deleted N days after the decision. **Rec:** (b), 90 days after approval; legal to confirm.

**RQ-13** The onboarding country is free text (`client/src/features/auth/pages/CompanyInformationPage.jsx:100-107`). **Rec:** a picker limited to EU 27 + UK (Remote is not valid for a legal entity). It seeds the recruiter's default country, currency and language.

**RQ-14** One role per account, but the sign-in pages still show a Candidate/Recruiter picker. Options: (a) a role-agnostic login endpoint, with the client routing by the returned role; (b) reject the login with "This is a candidate account" when it is used on the recruiter page. **Rec:** (a), plus a friendly notice on a mismatch.

## H2. Jobs

**RQ-15** Job location is free text ("San Francisco, US"). Options: (a) country (EU 27 + UK) + city text, plus `Remote` with a list of eligible countries; (b) country + city from a gazetteer; (c) free text. **Rec:** (a).

**RQ-16** Salary currency and period. The labels say "USD per year" (`client/src/features/recruiter/jobs/components/JobStepFields.jsx:91,97`) and the display is `$140k`. Options: (a) currency from the job's country, editable; (b) always EUR; (c) the recruiter's country currency. Also: should a monthly salary period be allowed (common in parts of the EU)? **Rec:** (a); store integer amounts + ISO currency + period (`year` | `month`), and show every viewer the job's currency (no FX).

**RQ-17** Field limits; today only minimums exist. **Rec:**
- title 3–120 characters
- brief 40–5,000
- responsibilities at most 20 lines of 300 characters
- required skills 1–20; preferred at most 20; each skill 1–50 characters
- experience 0–50 (already in place)
- salary: integers 0–10,000,000
- the server rejects a skill that is in both lists (the SkillPicker only filters suggestions, not typed text, `client/src/features/recruiter/jobs/components/SkillPicker.jsx:13`)

Confirm.

**RQ-18** Skills: free text or a taxonomy? (`SKILL_SUGGESTIONS` is a fixed list, `client/src/features/recruiter/jobs/data/jobFields.js:23-36`.) Options: (a) free text, with suggestions = the most-used skills in the DB per market or language; (b) an admin-managed taxonomy with translations; (c) ESCO. **Rec:** (a), with case-insensitive normalisation; embeddings handle synonyms.

**RQ-19** Should jobs gain new fields so they can be matched against the new candidate profile (languages with CEFR level, right to work)? Options: (a) add "Required languages (+ minimum level)" and "Visa sponsorship available (yes/no)", in a new step or in step 5/6; (b) add languages only; (c) neither, with filtering only on the discovery page. **Rec:** (a).

**RQ-20** Can a published job be edited? Options: (a) edit live (current behaviour, "Save changes"); (b) edits create a revision that needs admin moderation; (c) lock key fields once applications exist. **Rec:** (a). Regenerate the AI summary and embedding, do not repeat job-alert emails, and do not notify applicants.

**RQ-21** Deleting jobs: `removeJob` exists (`client/src/features/recruiter/jobs/hooks/useJobs.js:40-42`) but no UI calls it. Options: (a) never delete, close only; (b) drafts only; (c) soft-delete any job. **Rec:** (b).

**RQ-22** Job-alert emails: send on the first publish only, or also on resume and reopen? **Rec:** first publish only (`firstPublishedAt`).

**RQ-23** Publishing a draft from the Jobs table menu skips validation (`client/src/features/recruiter/jobs/components/JobsTable.jsx:20,68`). **Rec:** the server validates every transition to `published` with validateAll. On a 422 the UI opens the wizard at the first invalid step.

**RQ-24** The Jobs page has no "Closed" tab (`client/src/features/recruiter/jobs/pages/JobsPage.jsx:13-18`), and status sorts alphabetically by key (`:28-31`). **Rec:** add a Closed tab, and sort status in a defined order: published, paused, draft, closed.

**RQ-25** Wizard step 7 "AI analysis" is local rules (`client/src/features/recruiter/jobs/data/jobFields.js:179-217`) and is not in the decided OpenAI list. Options: (a) keep the rules, run them on the server, and rename the step "Quality checks"; (b) an OpenAI review in the user's language; (c) rules plus optional AI suggestions. **Rec:** (a) for v1.

**RQ-26** The wizard autosaves to localStorage `lwm.recruiter.jobWizardDraft` (`client/src/features/recruiter/jobs/pages/CreateJobPage.jsx:10`). Options: (a) keep it in the browser; (b) save a draft Job on the server once step 1 is valid; (c) a separate server WizardDraft document. **Rec:** (b). The draft then appears under Draft, and Cancel keeps it (copy change).

**RQ-27** Job ids are a slug plus a base36 timestamp (`client/src/features/recruiter/jobs/hooks/useJobs.js:24`), and candidates reach them through an `acme-<id>` bridge (`client/src/features/candidate/jobs/data/recruiterJobs.js:8-15`). **Rec:** Mongo ObjectIds everywhere, one Job collection read by both roles, and drop the prefix bridge.

**RQ-28** Admin "Restrict content" on a job. The copy says it "pauses it" (`client/src/features/admin/moderation/data/moderation.js:55`). Options: (a) set the status to paused, which the recruiter can resume; (b) a separate `moderation.restricted` flag with a reason, and the recruiter cannot publish until the admin lifts it. **Rec:** (b), with the reason shown on Job details.

**RQ-29** The job's "Company" field is free text per job, defaulting to 'Acme Studio' (`client/src/features/recruiter/jobs/data/jobFields.js:40`). Options: (a) always the company display name, not editable; (b) editable, for agencies hiring on behalf of clients. **Rec:** (a).

**RQ-30** How is the "relevant" count computed? It appears as "N relevant" in the Jobs table, "profiles with relevant listed skills" on Job details, and in the Candidates column. Options: (a) discoverable candidates in the job's market who list ≥ 1 required skill; (b) candidates who list ≥ 50% of the required skills; (c) embedding similarity ≥ a threshold. **Rec:** (c) with (a) as fallback. Count only consenting, discoverable, email-verified candidates; cache on the job, refresh on job save and nightly.

## H3. Discovery and matching

**RQ-31** Who is listed in Find candidates? Options: (a) email-verified candidates with `discoverable=true` and `matchingConsent=true` in the selected country; (b) the same, but also incomplete profiles; (c) everyone. Also: does the new "complete profile" rule apply to discovery, or only to applying? **Rec:** (a), with completeness required for discovery too. Applicants stay visible to that company through their application.

**RQ-32** The new rule says recruiters can message "any candidate". Does that include a non-discoverable candidate who never applied (e.g. reached by a direct link)? Options: (a) only applicants and discoverable candidates; (b) literally any candidate account. **Rec:** (a).

**RQ-33** What does the country filter mean in discovery? Options: (a) the candidate's residence country; (b) right to work (citizen or permit) for that country; (c) the candidate's preferred work locations; or a combination. For "Remote": open-to-remote candidates in any country? **Rec:** residence country OR right to work (citizen/permit) for that country; Remote = open-to-remote candidates in any country.

**RQ-34** What drives the ranking for the "Recommended" sort, "Talent worth meeting" and the "Recommended candidates" KPI? Options: (a) embeddings (job vs CV and profile), with skill overlap as a tie-break; (b) skill overlap only. **Rec:** (a). The KPI = distinct candidates above the threshold for at least one open job.

**RQ-35** What do AI Match Insights contain? Options: (a) deterministic evidence only; (b) evidence (relevant and missing skills, years, work mode, languages, right to work) plus an OpenAI narrative including potential gaps, generated when the panel is expanded and cached per (candidate, job, language, profile hash). **Rec:** (b). Never a score or percentage, and remove the invented `potentialGap` texts (`client/src/features/recruiter/find-candidates/data/candidateDetails.js:20,30,40,50,60,70`).

**RQ-36** One definition for skill overlap. Today:
- "N relevant skills" in Find candidates counts required + preferred skills listed by the candidate.
- "N aligned skills" in the pipeline is a literal (`client/src/features/recruiter/hiring-pipeline/data/pipeline.js:24-29`), or counts required skills only for the live applicant (`client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:26-29`).
- The Overview uses "matchedSkills".

**Rec:** one server function (required + preferred skills listed by the candidate) and the same label everywhere.

**RQ-37** Availability is free text today ("Available in 2 weeks"). Options: (a) an enum: available now, within 2 weeks, within 1 month, open to opportunities, not looking; (b) an availability date. **Rec:** (a), set by the candidate. Note that the candidate profile only has an `openToOpportunities` boolean today.

**RQ-38** Which new discovery filters ship in v1? Candidates: right to work (country + status), language + minimum CEFR level, verified only (admin checks), phone verified, has a live CV, has certificates. Is filtering out "needs sponsorship" acceptable under non-discrimination rules? **Rec:** right to work, language and verified only for v1, and a legal review of the sponsorship filter.

**RQ-39** The "Compare" checkbox on the Overview talent card does nothing (`client/src/features/recruiter/overview/components/TalentCard.jsx:89-95`). Options: (a) remove it; (b) carry the selection into the Find candidates compare. **Rec:** (a).

**RQ-40** Shortlist scope: per recruiter user or per company; one list or several named lists (the page is called "Shortlists"); per job? And what happens to shortlisted candidates who later turn discovery off? **Rec:**
- One list per company, with `addedBy` and `createdAt` (needed for the momentum chart).
- An optional job tag later.
- The candidate is not notified.
- Hide candidates who turned discovery off, with a "no longer available" count.

**RQ-41** Private notes. Options: (a) one text per candidate (today); (b) several timestamped notes. Also: are notes visible to colleagues, and are they included in the candidate's GDPR access export? **Rec:** (a), one note per (company, candidate) with `updatedBy`/`updatedAt` and a 5,000-character limit; legal to confirm the export question.

**RQ-42** The Activity tab shows only your own actions "on this device". Should it also show candidate events (applied, withdrew, replied, CV request decided, CV updated) and colleagues' actions? **Rec:** yes: a company-wide timeline stored as type + params and rendered through translations.

**RQ-43** CV file access on the Resume tab. Options: (a) view and download if the candidate set `resumeVisible=true` or applied to one of the company's jobs; (b) applicants only; (c) on-screen only, never the file. **Rec:** (a). Log every download in Activity and in an access log the candidate can see.

**RQ-44** "Request earlier version". Options: (a) a real request: the candidate is notified (in-app and email) and approves or declines a specific version, and the recruiter then gets access; (b) remove the feature. **Rec:** (a) only if candidate CV versions are stored on the server; otherwise (b).

**RQ-45** Where do the new profile items appear (decision 2)? **Rec:**
- photo, links and verification badges: ProfileSummary
- languages and certificates: the Skills tab
- right to work: the Overview tab and the sidebar
- structured work history: Experience
- structured education: Education

Confirm. Also: should a course certificate count as "verified" evidence for a skill?

**RQ-46** Work-history entries have employer, title and start–end dates only, but the Experience and Overview tabs show a summary paragraph per role (static today). Should each role get an optional description? **Rec:** yes: optional, at most 1,000 characters, translatable on demand.

**RQ-47** Free candidates can read but cannot reply. Should the recruiter see that a candidate is on the Free plan (e.g. "This candidate can reply after upgrading")? Options: (a) hide the plan entirely; (b) a neutral "Awaiting reply". **Rec:** (a) or (b), but never reveal a candidate's billing status.

**RQ-48** Which recruiter-visible blocks get an on-demand "Translate" action? **Rec:** the job brief and responsibilities, the candidate "about" text, work-history descriptions, and messages. Not skills or names. Cache per (entity, field, language, hash).

## H4. Applications and pipeline

**RQ-49** Pipeline scope. Today there is one company-wide board, and placements are keyed by candidate id, not by application. Options: (a) stages per company, a placement per application, and a job filter on the board (the "All open roles" chip becomes that filter); (b) stages per job, copied from a company template; (c) one board without a job filter. **Rec:** (a).

**RQ-50** A candidate who applied to two jobs: one card per application (showing the job title), or one card per candidate? **Rec:** one per application.

**RQ-51** Stage select on the candidate profile. Today a candidate with no application defaults to the first stage and a placement is created (`client/src/features/recruiter/find-candidates/pages/CandidateProfilePage.jsx:50`). **Rec:** hide the select for non-applicants, and show one select per application otherwise. Also: can recruiters add sourced (non-applying) candidates to the pipeline? **Rec:** no in v1.

**RQ-52** Mapping recruiter stages to the candidate-visible status. The candidate statuses today are applied, under-review, interview and withdrawn; recruiter stages are custom. Options: (a) each stage has a `candidateStatus` category chosen in Manage stages; (b) a fixed mapping by position; (c) the candidate sees the stage name. **Rec:** (a), and add the candidate statuses offer, hired and not-selected.

**RQ-53** When a recruiter rejects an application, is the candidate emailed? Options: (a) always, automatically; (b) the recruiter chooses (a checkbox in the confirm dialog, on by default); (c) never. **Rec:** (b), with a templated email in the candidate's language.

**RQ-54** Stage-change emails: on every move, or only when the candidate-visible status changes? **Rec:** only on a status change, delayed about 10 minutes and collapsed to absorb drag-and-drop noise.

**RQ-55** Withdrawn applications vanish from the recruiter views today. **Rec:** keep them in Applications with a Withdrawn filter or badge, and remove them from the board.

**RQ-56** The Applications table shows the candidate's own title rather than the job they applied for (`client/src/features/recruiter/applications/pages/ApplicationsPage.jsx:53`), and has no applied date. Should Job and Applied columns and a job filter be added? **Rec:** yes.

**RQ-57** The "Candidate portal activity" section is always an empty state (`client/src/features/recruiter/applications/pages/ApplicationsPage.jsx:116-127`). Options: (a) remove it; (b) turn it into a "Recent applications" feed. Please choose.

**RQ-58** Stage limits. **Rec:** 2–12 stages; names 1–24 characters, unique (case-insensitive); removal blocked only by active applications in the stage; history keeps snapshots of stage names. Should the first ("Applied") stage be fixed: never removed or moved? **Rec:** yes.

**RQ-59** Applying requires a complete profile and the paid plan (decision 1). If a candidate's subscription lapses, do their existing applications stay visible and active for the recruiter? **Rec:** yes; only new applications need the plan.

## H5. Overview numbers

**RQ-60** The Overview "Applications" KPI: all-time, active (not rejected or withdrawn), or within a period? **Rec:** active applications to the company's jobs.

**RQ-61** Hiring momentum. Is the "Shortlisted" series the shortlist additions per day, or moves into a stage named "Shortlisted"? Are This week / Last week the only periods, and in which timezone? **Rec:** shortlist additions (`createdAt`); a timezone parameter from the browser; ISO weeks starting Monday; keep the two periods.

**RQ-62** The funnel: current counts per stage (as now), or a cumulative "reached this stage"? **Rec:** current counts over the company's own stages (custom names), excluding rejected and withdrawn.

**RQ-63** The greeting "Good morning, Sarah": should the part of day be computed on the client from local time, plus the user's first name? **Rec:** yes.

## H6. Learning and payments (incl. decision 4)

**RQ-64** Course prices are a single £ amount today. Options: (a) the admin sets a price per currency (GBP and EUR required, others optional with EUR as fallback); (b) a single EUR price converted with FX; (c) GBP everywhere. **Rec:** (a).

**RQ-65** Which currency applies where? The non-euro EU currencies are CZK, DKK, HUF, PLN, RON and SEK (Bulgaria uses EUR since 2026-01-01; please verify), plus Remote. This covers salary display defaults, course prices and Stripe. **Rec:** job salaries in the local currency; course prices in GBP for the UK and EUR everywhere else, unless the admin sets more currencies.

**RQ-66** Which course data is the source of truth? The recruiter catalogue copy (lead, outcomes, lessons, photos, prices 49/29, `client/src/features/recruiter/learning/data/courses.js:28-186`) differs from the admin seed (price 0, and a different title and category for fair-hiring, `client/src/features/admin/courses/data/courses.js:22-27`). **Rec:** one Course collection, the admin form extended with every learner-facing field, and the seed taken from the recruiter copy.

**RQ-67** AI course suggestions (static `SUGGESTIONS`, `client/src/features/recruiter/learning/data/courses.js:189-208`). Options: (a) OpenAI using the company profile, active roles, pipeline stats and progress; (b) server rules, e.g. many candidates at interview stage suggests the Interviewing course, with reasons built from real numbers. **Rec:** (b), relabelled "Suggested for you". AI course suggestions are not in the decided OpenAI list.

**RQ-68** Does a course purchase belong to the user or to the company (shared with colleagues)? **Rec:** the user.

**RQ-69** Lesson completion rules (decision 4). Video completes at ≥ 90% watched. For text: on open, or after scrolling to the end? PDF: on open? Link: on click? **Rec:** text, PDF and link complete on open; video at 90%, measured from heartbeats the server tracks.

**RQ-70** Quiz rules: is the 70% pass mark fixed or set per course? Are attempts unlimited or limited, with a cooldown? Are questions randomised? Does the quiz unlock only after every lesson is complete? **Rec:**
- a pass mark per course, default 70;
- unlimited attempts, with a 1-hour cooldown after 3 failures;
- the quiz unlocks after all lessons are complete.

**RQ-71** Certificate details. Whose name is printed: the account's full name, and can it be edited? In which language is the PDF? Is the public verification page (`/certificates/verify/:code`) visible without signing in, and what does it show? **Rec:** the account name; the PDF in the user's language at the time of issue; a public verify page showing name, course and date only.

**RQ-72** Lesson content localisation: does the admin author one language or a version per language? **Rec:** one source language, with on-demand translation for text lessons. Videos and PDFs stay single-language, with a language tag shown on the card.

**RQ-73** Video and PDF hosting on the server disk: what size limits, and how are they streamed? **Rec:** video at most 500 MB as MP4 (H.264), served with HTTP range requests; PDF at most 20 MB.

**RQ-74** The lesson "Mark complete" toggle (`client/src/features/recruiter/learning/components/LessonRow.jsx:12`) goes away under the new model, since completion becomes automatic. Confirm there is no manual completion.

**RQ-75** Refunds, invoices and VAT for EU B2B recruiters (company VAT number, reverse charge)? **Rec:** in test mode, Stripe receipts only; production VAT (e.g. Stripe Tax) is flagged as out of scope for now.

## H7. Settings, notifications, messaging

**RQ-76** Notification settings granularity. Today there are two toggles, `inApp` and `email` (`client/src/features/recruiter/settings/data/notifications.js:4`). Options: (a) keep two toggles, with `email` covering the non-transactional emails (new application, candidate reply); (b) a toggle per event. OTP, password reset and approval emails are always sent either way. **Rec:** (a).

**RQ-77** The header bell has a static dot (`client/src/components/layout/Header.jsx:171`) and links to settings. Is an in-app Notification entity and feed in scope? **Rec:** for now, the dot = unread messages or new applications since the last visit; a full feed later.

**RQ-78** Export data: today it is a 6-field CSV. Options: (a) account, company and settings as CSV; (b) a full JSON export (account, company, jobs, notes, messages, payments). **Rec:** (b), plus a CSV summary.

**RQ-79** Recruiters have no account deletion (candidates have "Delete my data"). Should it be added, and what happens to jobs, applications, messages and payments? **Rec:** add it: close the jobs, anonymise the author, and keep payments for accounting.

**RQ-80** The settings lead mentions "privacy" (`client/src/features/recruiter/settings/components/SettingsLayout.jsx:17`), but recruiters have no Privacy tab. Options: (a) change the copy; (b) add recruiter privacy settings. **Rec:** (a).

**RQ-81** Conversation rules. **Rec:**
- Candidates can only reply; they cannot start a conversation.
- One conversation per (company, candidate), optionally tagged with a job.
- Messages up to 2,000 characters, no attachments.

Confirm.

**RQ-82** The default outreach text (`client/src/features/recruiter/find-candidates/components/MessageModal.jsx:11`). Options: (a) keep it as a template in the recruiter's UI language; (b) an AI draft. **Rec:** (a); the candidate can translate it on demand.

**RQ-83** Email to the candidate for each new recruiter message: immediate, or delayed and collapsed? **Rec:** email only if the message is still unread after 15 minutes, at most once per conversation per hour, in the candidate's language.

## H8. Country, i18n and other

**RQ-84** Does the recruiter's selected country filter their own Jobs, Applications and Overview? **Rec:** no; it only filters discovery and sets the formatting and currency defaults.

**RQ-85** Default language per country. **Rec:** ES → Español; FR, BE and LU → Français; all others → English. The user's own choice is stored on the User.

**RQ-86** The seed and demo data are US-based (San Francisco, New York, Austin; USD). Should the seed be re-localised to EU and UK cities and currencies? **Rec:** yes.

**RQ-87** Enum values are stored as English labels ('Full-time', 'Mid-level', 'On-site', 'Applied'). **Rec:**
- Store keys (`full_time`, `mid`, `on_site`) and translate the labels.
- Default stage names are created already translated into the company's language.
- Once created, stage names are user content and are not translated.

**RQ-88** Help and FAQ copy (`client/src/features/help/data/help.js`): translation files, or content the admin can edit in the DB? **Rec:** translation files, and remove the demo FAQs (reset demo, "prototype").

**RQ-89** Which recruiter actions are written to the admin audit log? Candidates: job publish/close, CV download, KYC upload, stage changes. **Rec:** job status changes, CV downloads and the KYC submission.

**RQ-90** Do the admin "AI & matching" policies (the active policy's signals) drive recruiter matching? **Rec:** yes if the policy defines signals; otherwise treat the policies as informational only.

---

# Part I: the 5 biggest risks

1. **The application and pipeline model must be rebuilt across three roles.**
   - Today stages are company-wide and keyed by **candidate**, not application (`client/src/features/recruiter/hiring-pipeline/data/pipeline.js:32-39`, `client/src/features/recruiter/hiring-pipeline/hooks/usePipeline.js:32,37`).
   - Candidate statuses are a separate, unconnected enum (`client/src/features/candidate/jobs/data/applications.js:49-54`).
   - Stages are custom and renameable, and "rejected" is a pseudo-stage.
   - **Why it matters:** applications, the board, the profile stage select, the Overview funnel and momentum, candidate statuses, stage-change emails and admin recruitment analytics all depend on one Application/Stage model. Getting RQ-49 to RQ-58 wrong means inconsistent statuses, and emails sent to candidates for drag-and-drop noise.

2. **Privacy, consent and legal exposure.**
   - Discovery ignores the candidate's `discoverable`, `resumeVisible` and `matchingConsent` flags today.
   - The new rules ("message any candidate", right-to-work and sponsorship filters, CV downloads) widen access.
   - The server will hold government ID documents (KYC) on its local disk, and personal data goes to OpenAI (match insights, translation, summaries).
   - Recruiter notes about candidates are personal data.
   - **Why it matters:** retention, access logging, data subject exports and anti-discrimination are undecided (RQ-11, RQ-12, RQ-31 to RQ-33, RQ-38, RQ-41, RQ-43). The EU/UK scope makes this a GDPR issue, not just a UX one.

3. **The matching numbers have no defined algorithm, and the AI cost and latency are unbounded.**
   - About ten visible numbers or lists are literals today: Recommended candidates, Applications KPI, funnel, momentum, talent cards, "N relevant", relevant talent, "N aligned skills", course suggestions, potential gaps.
   - Each needs a defined, explainable computation that is "never a score" (RQ-30, RQ-34 to RQ-36).
   - Embeddings and OpenAI narratives need caching keyed by language and content hashes, plus background recomputation without Redis.
   - **Why it matters:** without definitions, the backend will either invent rules (violating "no assumptions") or show inconsistent counts across screens.

4. **The country, currency and i18n retrofit touches stored data, not just the UI.**
   - Enum values are stored as English labels.
   - Locations are free text and mostly in the US.
   - Salaries are hard-coded to USD, and prices to £ with `'GBP'`.
   - Company-size lists conflict.
   - About 700 strings need translating, many with English-only plurals, and the search tokeniser is ASCII-only (`client/src/features/recruiter/find-candidates/utils/discovery.js:17`).
   - **Why it matters:** these need a key-based schema and a migration of the seed before any screen can be localised (RQ-4, RQ-15, RQ-16, RQ-64, RQ-65, RQ-85 to RQ-87).

5. **The new learning model and Stripe entitlements are a rewrite, not a port.**
   - Decision 4 brings mixed lessons with video on disk, view-based completion, quizzes and PDF certificates with public verification. Today there are only manual lesson toggles and a client-only "purchase" (`client/src/features/recruiter/learning/hooks/useRecruiterLearning.js:24-36`).
   - The course data lives in two catalogues that disagree (RQ-66).
   - Enrolment must come from Stripe webhooks (idempotent) instead of the demo checkout.
   - Combined with the onboarding approval gate (status-driven routing, OTP abuse limits), this is the largest amount of new server logic in the recruiter scope (RQ-64 to RQ-75).


---

# Part J: coverage

**How this was checked:**
- A `find` over the scope directories gave **202 files, 12839 lines** (the same total as before the `git mv` to `client/`).
- JS/JSX files: **read fully**, with line numbers.
- CSS modules:
  - None contains copy or data. Every one was grep-scanned (pattern list in the table).
  - The only data-bearing CSS is the avatar and stage tone classes:
    - `client/src/features/recruiter/overview/components/TalentCard.module.css:30-43`
    - `client/src/features/recruiter/jobs/components/JobTalentList.module.css:53-71`
    - `client/src/features/recruiter/hiring-pipeline/components/PipelineColumn.module.css:30-40`
  - These are cited in the report as S16, A14 and A26.
  - There are no `line-clamp` or `text-overflow` rules, so longer ES/FR strings will wrap rather than be cut off.

| File | Lines | Status | Report section |
|---|---|---|---|
| `client/src/features/auth/components/AuthIntro.jsx` | 12 | **read fully** | A1, A2 |
| `client/src/features/auth/components/AuthIntro.module.css` | 51 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A1, A2 |
| `client/src/features/auth/components/AuthSwitchPrompt.jsx` | 15 | **read fully** | A1, A2 |
| `client/src/features/auth/components/AuthSwitchPrompt.module.css` | 29 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A1, A2 |
| `client/src/features/auth/components/CreateAccountButton.jsx` | 19 | **read fully** | A2 |
| `client/src/features/auth/components/CreateAccountButton.module.css` | 7 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A2 |
| `client/src/features/auth/components/DemoNote.jsx` | 11 | **read fully** | A1 |
| `client/src/features/auth/components/DemoNote.module.css` | 27 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A1 |
| `client/src/features/auth/components/DocumentUpload.jsx` | 50 | **read fully** | A6 |
| `client/src/features/auth/components/DocumentUpload.module.css` | 90 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A6 |
| `client/src/features/auth/components/OnboardingLayout.jsx` | 141 | **read fully** | A3 |
| `client/src/features/auth/components/OnboardingLayout.module.css` | 349 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A3 |
| `client/src/features/auth/components/RecruiterAccountFields.jsx` | 71 | **read fully** | A2, A4 |
| `client/src/features/auth/components/RecruiterAccountFields.module.css` | 16 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A2, A4 |
| `client/src/features/auth/components/StepFooter.jsx` | 20 | **read fully** | A4-A7 |
| `client/src/features/auth/components/StepFooter.module.css` | 13 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A4-A7 |
| `client/src/features/auth/components/StepGroup.jsx` | 20 | **read fully** | A4-A5 |
| `client/src/features/auth/components/StepGroup.module.css` | 42 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A4-A5 |
| `client/src/features/auth/components/StepHeading.jsx` | 11 | **read fully** | A4-A8 |
| `client/src/features/auth/components/StepHeading.module.css` | 14 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A4-A8 |
| `client/src/features/auth/components/TermsConsent.jsx` | 19 | **read fully** | A2, A4 |
| `client/src/features/auth/components/TermsConsent.module.css` | 25 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A2, A4 |
| `client/src/features/auth/components/WorkspacePicker.jsx` | 57 | **read fully** | A1, A2 |
| `client/src/features/auth/components/WorkspacePicker.module.css` | 91 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A1, A2 |
| `client/src/features/auth/components/compactHint.module.css` | 5 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A2-A7 (styles) |
| `client/src/features/auth/data/hero.js` | 2 | **read fully** | A1, A2 |
| `client/src/features/auth/data/onboarding.js` | 42 | **read fully** | A3-A7 |
| `client/src/features/auth/data/workspaceChoices.js` | 14 | **read fully** | A1, A2 |
| `client/src/features/auth/pages/AccountRegistrationPage.jsx` | 63 | **read fully** | A4 |
| `client/src/features/auth/pages/AdminReviewPage.jsx` | 67 | **read fully** | A8 |
| `client/src/features/auth/pages/AdminReviewPage.module.css` | 118 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A8 |
| `client/src/features/auth/pages/CompanyInformationPage.jsx` | 131 | **read fully** | A5 |
| `client/src/features/auth/pages/KycVerificationPage.jsx` | 94 | **read fully** | A6 |
| `client/src/features/auth/pages/KycVerificationPage.module.css` | 34 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A6 |
| `client/src/features/auth/pages/OnboardingStepPage.module.css` | 40 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A4-A7 (styles) |
| `client/src/features/auth/pages/RecruiterSignUpPage.jsx` | 74 | **read fully** | A2 |
| `client/src/features/auth/pages/RecruiterSignUpPage.module.css` | 21 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A2 |
| `client/src/features/auth/pages/SignInPage.jsx` | 111 | **read fully** | A1 |
| `client/src/features/auth/pages/SignInPage.module.css` | 41 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A1 |
| `client/src/features/auth/pages/SignUpPage.jsx` | 100 | **read fully** | candidate sign-up (out of scope; read) |
| `client/src/features/auth/pages/SignUpPage.module.css` | 20 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | candidate sign-up (out of scope; read) |
| `client/src/features/auth/pages/VerifyAccountPage.jsx` | 111 | **read fully** | A7 |
| `client/src/features/auth/pages/VerifyAccountPage.module.css` | 78 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A7 |
| `client/src/features/auth/routes.jsx` | 26 | **read fully** | A1-A8 |
| `client/src/features/auth/utils/session.js` | 39 | **read fully** | A1, 0.1 |
| `client/src/features/auth/utils/useFormState.js` | 20 | **read fully** | A1-A7 |
| `client/src/features/auth/utils/useOnboarding.js` | 11 | **read fully** | A3 |
| `client/src/features/auth/utils/useOnboardingState.js` | 30 | **read fully** | A3, 0.1 |
| `client/src/features/auth/utils/validation.js` | 118 | **read fully** | A1-A7 |
| `client/src/features/help/components/FaqItem.jsx` | 33 | **read fully** | A34 |
| `client/src/features/help/components/FaqItem.module.css` | 56 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A34 |
| `client/src/features/help/components/HelpLinkCard.jsx` | 17 | **read fully** | A34 |
| `client/src/features/help/components/HelpLinkCard.module.css` | 30 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A34 |
| `client/src/features/help/data/help.js` | 60 | **read fully** | A34 |
| `client/src/features/help/pages/HelpPage.jsx` | 86 | **read fully** | A34 |
| `client/src/features/help/pages/HelpPage.module.css` | 69 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A34 |
| `client/src/features/help/routes.jsx` | 4 | **read fully** | A34 |
| `client/src/features/recruiter/applications/pages/ApplicationsPage.jsx` | 143 | **read fully** | A25 |
| `client/src/features/recruiter/applications/pages/ApplicationsPage.module.css` | 80 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A25 |
| `client/src/features/recruiter/applications/routes.jsx` | 3 | **read fully** | A25 |
| `client/src/features/recruiter/company/data/company.js` | 24 | **read fully** | A30 |
| `client/src/features/recruiter/company/pages/CompanyPage.jsx` | 155 | **read fully** | A30 |
| `client/src/features/recruiter/company/pages/CompanyPage.module.css` | 137 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A30 |
| `client/src/features/recruiter/company/routes.jsx` | 8 | **read fully** | A30 |
| `client/src/features/recruiter/find-candidates/components/CandidateAvatar.jsx` | 16 | **read fully** | A15 |
| `client/src/features/recruiter/find-candidates/components/CandidateAvatar.module.css` | 10 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A15 |
| `client/src/features/recruiter/find-candidates/components/CandidateCard.jsx` | 90 | **read fully** | A15, B2 |
| `client/src/features/recruiter/find-candidates/components/CandidateCard.module.css` | 127 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A15, B2 |
| `client/src/features/recruiter/find-candidates/components/CompareModal.jsx` | 67 | **read fully** | A15, B2 |
| `client/src/features/recruiter/find-candidates/components/CompareModal.module.css` | 54 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A15, B2 |
| `client/src/features/recruiter/find-candidates/components/DiscoveryToolbar.jsx` | 87 | **read fully** | A15 |
| `client/src/features/recruiter/find-candidates/components/DiscoveryToolbar.module.css` | 73 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A15 |
| `client/src/features/recruiter/find-candidates/components/EarlierVersionModal.jsx` | 69 | **read fully** | A21 |
| `client/src/features/recruiter/find-candidates/components/EarlierVersionModal.module.css` | 5 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A21 |
| `client/src/features/recruiter/find-candidates/components/MatchInsights.jsx` | 74 | **read fully** | A15, B2 |
| `client/src/features/recruiter/find-candidates/components/MatchInsights.module.css` | 112 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A15, B2 |
| `client/src/features/recruiter/find-candidates/components/MessageModal.jsx` | 56 | **read fully** | A16, B3 |
| `client/src/features/recruiter/find-candidates/components/ProfileSection.jsx` | 11 | **read fully** | A17-A23 |
| `client/src/features/recruiter/find-candidates/components/ProfileSection.module.css` | 9 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A17-A23 |
| `client/src/features/recruiter/find-candidates/components/ProfileSidebar.jsx` | 72 | **read fully** | A16 |
| `client/src/features/recruiter/find-candidates/components/ProfileSidebar.module.css` | 65 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A16 |
| `client/src/features/recruiter/find-candidates/components/ProfileSummary.jsx` | 47 | **read fully** | A16, B2 |
| `client/src/features/recruiter/find-candidates/components/ProfileSummary.module.css` | 73 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A16, B2 |
| `client/src/features/recruiter/find-candidates/components/ProfileTabs.jsx` | 31 | **read fully** | A16 |
| `client/src/features/recruiter/find-candidates/components/ProfileTabs.module.css` | 27 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A16 |
| `client/src/features/recruiter/find-candidates/components/ResumePreviewModal.jsx` | 59 | **read fully** | A21 |
| `client/src/features/recruiter/find-candidates/components/ResumePreviewModal.module.css` | 59 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A21 |
| `client/src/features/recruiter/find-candidates/components/SortSelect.jsx` | 19 | **read fully** | A15 |
| `client/src/features/recruiter/find-candidates/components/SortSelect.module.css` | 27 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A15 |
| `client/src/features/recruiter/find-candidates/data/candidateDetails.js` | 77 | **read fully** | A15-A21 |
| `client/src/features/recruiter/find-candidates/data/candidates.js` | 108 | **read fully** | A15-A21 |
| `client/src/features/recruiter/find-candidates/hooks/useCandidateActivity.js` | 25 | **read fully** | A22 |
| `client/src/features/recruiter/find-candidates/hooks/useCandidateNotes.js` | 15 | **read fully** | A23 |
| `client/src/features/recruiter/find-candidates/hooks/useMatchJob.js` | 20 | **read fully** | A15 |
| `client/src/features/recruiter/find-candidates/hooks/useShortlist.js` | 22 | **read fully** | A15, A24 |
| `client/src/features/recruiter/find-candidates/pages/CandidateActivityPage.jsx` | 43 | **read fully** | A22 |
| `client/src/features/recruiter/find-candidates/pages/CandidateActivityPage.module.css` | 56 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A22 |
| `client/src/features/recruiter/find-candidates/pages/CandidateEducationPage.jsx` | 29 | **read fully** | A20 |
| `client/src/features/recruiter/find-candidates/pages/CandidateEducationPage.module.css` | 31 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A20 |
| `client/src/features/recruiter/find-candidates/pages/CandidateExperiencePage.jsx` | 30 | **read fully** | A18 |
| `client/src/features/recruiter/find-candidates/pages/CandidateExperiencePage.module.css` | 33 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A18 |
| `client/src/features/recruiter/find-candidates/pages/CandidateNotesPage.jsx` | 48 | **read fully** | A23 |
| `client/src/features/recruiter/find-candidates/pages/CandidateNotesPage.module.css` | 16 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A23 |
| `client/src/features/recruiter/find-candidates/pages/CandidateOverviewPage.jsx` | 36 | **read fully** | A17 |
| `client/src/features/recruiter/find-candidates/pages/CandidateOverviewPage.module.css` | 45 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A17 |
| `client/src/features/recruiter/find-candidates/pages/CandidateProfilePage.jsx` | 117 | **read fully** | A16 |
| `client/src/features/recruiter/find-candidates/pages/CandidateProfilePage.module.css` | 35 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A16 |
| `client/src/features/recruiter/find-candidates/pages/CandidateResumePage.jsx` | 96 | **read fully** | A21 |
| `client/src/features/recruiter/find-candidates/pages/CandidateResumePage.module.css` | 97 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A21 |
| `client/src/features/recruiter/find-candidates/pages/CandidateSkillsPage.jsx` | 27 | **read fully** | A19 |
| `client/src/features/recruiter/find-candidates/pages/CandidateSkillsPage.module.css` | 31 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A19 |
| `client/src/features/recruiter/find-candidates/pages/FindCandidatesPage.jsx` | 121 | **read fully** | A15 |
| `client/src/features/recruiter/find-candidates/pages/FindCandidatesPage.module.css` | 70 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A15 |
| `client/src/features/recruiter/find-candidates/routes.jsx` | 20 | **read fully** | A15, A16 |
| `client/src/features/recruiter/find-candidates/utils/discovery.js` | 49 | **read fully** | A15 |
| `client/src/features/recruiter/find-candidates/utils/matchEvidence.js` | 28 | **read fully** | A15 |
| `client/src/features/recruiter/hiring-pipeline/components/ApplicantCard.jsx` | 53 | **read fully** | A26 |
| `client/src/features/recruiter/hiring-pipeline/components/ApplicantCard.module.css` | 68 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A26 |
| `client/src/features/recruiter/hiring-pipeline/components/ManageStagesModal.jsx` | 113 | **read fully** | A27 |
| `client/src/features/recruiter/hiring-pipeline/components/ManageStagesModal.module.css` | 83 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A27 |
| `client/src/features/recruiter/hiring-pipeline/components/PipelineColumn.jsx` | 32 | **read fully** | A26 |
| `client/src/features/recruiter/hiring-pipeline/components/PipelineColumn.module.css` | 74 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A26 |
| `client/src/features/recruiter/hiring-pipeline/components/StageSelect.jsx` | 23 | **read fully** | A26 |
| `client/src/features/recruiter/hiring-pipeline/components/StageSelect.module.css` | 48 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A26 |
| `client/src/features/recruiter/hiring-pipeline/data/pipeline.js` | 41 | **read fully** | A26 |
| `client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js` | 53 | **read fully** | A26 |
| `client/src/features/recruiter/hiring-pipeline/hooks/usePipeline.js` | 95 | **read fully** | A26 |
| `client/src/features/recruiter/hiring-pipeline/pages/HiringPipelinePage.jsx` | 102 | **read fully** | A26 |
| `client/src/features/recruiter/hiring-pipeline/pages/HiringPipelinePage.module.css` | 32 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A26 |
| `client/src/features/recruiter/hiring-pipeline/routes.jsx` | 7 | **read fully** | A26 |
| `client/src/features/recruiter/jobs/components/AiJobSummary.jsx` | 151 | **read fully** | A11 |
| `client/src/features/recruiter/jobs/components/AiJobSummary.module.css` | 200 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A11 |
| `client/src/features/recruiter/jobs/components/JobNotFound.jsx` | 20 | **read fully** | A35 |
| `client/src/features/recruiter/jobs/components/JobNotFound.module.css` | 40 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A35 |
| `client/src/features/recruiter/jobs/components/JobPosting.jsx` | 38 | **read fully** | A12, A14 |
| `client/src/features/recruiter/jobs/components/JobPosting.module.css` | 42 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A12, A14 |
| `client/src/features/recruiter/jobs/components/JobStatusBadge.jsx` | 13 | **read fully** | A10 |
| `client/src/features/recruiter/jobs/components/JobStepFields.jsx` | 174 | **read fully** | A12 |
| `client/src/features/recruiter/jobs/components/JobStepFields.module.css` | 101 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A12 |
| `client/src/features/recruiter/jobs/components/JobTalentList.jsx` | 35 | **read fully** | A14 |
| `client/src/features/recruiter/jobs/components/JobTalentList.module.css` | 97 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A14 |
| `client/src/features/recruiter/jobs/components/JobWizard.jsx` | 162 | **read fully** | A12 |
| `client/src/features/recruiter/jobs/components/JobWizard.module.css` | 169 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A12 |
| `client/src/features/recruiter/jobs/components/JobsTable.jsx` | 167 | **read fully** | A10 |
| `client/src/features/recruiter/jobs/components/JobsTable.module.css` | 137 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A10 |
| `client/src/features/recruiter/jobs/components/SkillPicker.jsx` | 98 | **read fully** | A12 |
| `client/src/features/recruiter/jobs/components/SkillPicker.module.css` | 105 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A12 |
| `client/src/features/recruiter/jobs/data/jobFields.js` | 217 | **read fully** | A12, F |
| `client/src/features/recruiter/jobs/data/jobs.js` | 99 | **read fully** | A10 |
| `client/src/features/recruiter/jobs/data/relevantTalent.js` | 10 | **read fully** | A14 |
| `client/src/features/recruiter/jobs/hooks/useJobs.js` | 45 | **read fully** | A10 |
| `client/src/features/recruiter/jobs/pages/CreateJobPage.jsx` | 100 | **read fully** | A12, A13 |
| `client/src/features/recruiter/jobs/pages/CreateJobPage.module.css` | 3 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A12, A13 |
| `client/src/features/recruiter/jobs/pages/JobDetailsPage.jsx` | 116 | **read fully** | A14 |
| `client/src/features/recruiter/jobs/pages/JobDetailsPage.module.css` | 129 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A14 |
| `client/src/features/recruiter/jobs/pages/JobsPage.jsx` | 112 | **read fully** | A10 |
| `client/src/features/recruiter/jobs/pages/JobsPage.module.css` | 44 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A10 |
| `client/src/features/recruiter/jobs/routes.jsx` | 13 | **read fully** | A10 |
| `client/src/features/recruiter/learning/components/CourseCard.jsx` | 57 | **read fully** | A28 |
| `client/src/features/recruiter/learning/components/CourseCard.module.css` | 108 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A28 |
| `client/src/features/recruiter/learning/components/LessonRow.jsx` | 33 | **read fully** | A29 |
| `client/src/features/recruiter/learning/components/LessonRow.module.css` | 76 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A29 |
| `client/src/features/recruiter/learning/components/PurchaseDialog.jsx` | 29 | **read fully** | A28 |
| `client/src/features/recruiter/learning/components/SuggestionCard.jsx` | 30 | **read fully** | A28 |
| `client/src/features/recruiter/learning/components/SuggestionCard.module.css` | 87 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A28 |
| `client/src/features/recruiter/learning/data/courses.js` | 208 | **read fully** | A28 |
| `client/src/features/recruiter/learning/hooks/useCourseCatalogue.js` | 44 | **read fully** | A28 |
| `client/src/features/recruiter/learning/hooks/useRecruiterLearning.js` | 49 | **read fully** | A28 |
| `client/src/features/recruiter/learning/pages/CourseDetailsPage.jsx` | 163 | **read fully** | A29 |
| `client/src/features/recruiter/learning/pages/CourseDetailsPage.module.css` | 261 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A29 |
| `client/src/features/recruiter/learning/pages/LearningPage.jsx` | 133 | **read fully** | A28 |
| `client/src/features/recruiter/learning/pages/LearningPage.module.css` | 131 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A28 |
| `client/src/features/recruiter/learning/routes.jsx` | 6 | **read fully** | A28 |
| `client/src/features/recruiter/overview/components/HiringFunnelCard.jsx` | 33 | **read fully** | A9 |
| `client/src/features/recruiter/overview/components/HiringFunnelCard.module.css` | 77 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A9 |
| `client/src/features/recruiter/overview/components/HiringMomentumCard.jsx` | 134 | **read fully** | A9 |
| `client/src/features/recruiter/overview/components/HiringMomentumCard.module.css` | 229 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A9 |
| `client/src/features/recruiter/overview/components/SectionHeading.jsx` | 13 | **read fully** | A9 |
| `client/src/features/recruiter/overview/components/SectionHeading.module.css` | 15 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A9 |
| `client/src/features/recruiter/overview/components/TalentCard.jsx` | 103 | **read fully** | A9 |
| `client/src/features/recruiter/overview/components/TalentCard.module.css` | 193 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A9 |
| `client/src/features/recruiter/overview/data/overview.js` | 78 | **read fully** | A9 |
| `client/src/features/recruiter/overview/pages/OverviewPage.jsx` | 134 | **read fully** | A9 |
| `client/src/features/recruiter/overview/pages/OverviewPage.module.css` | 93 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A9 |
| `client/src/features/recruiter/overview/routes.jsx` | 3 | **read fully** | A9 |
| `client/src/features/recruiter/routes.jsx` | 9 | **read fully** | A0 (route collector) |
| `client/src/features/recruiter/settings/components/SettingsCard.jsx` | 12 | **read fully** | A31-A33 |
| `client/src/features/recruiter/settings/components/SettingsCard.module.css` | 8 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A31-A33 |
| `client/src/features/recruiter/settings/components/SettingsLayout.jsx` | 29 | **read fully** | A31-A33 |
| `client/src/features/recruiter/settings/components/SettingsLayout.module.css` | 54 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A31-A33 |
| `client/src/features/recruiter/settings/data/account.js` | 9 | **read fully** | A32 |
| `client/src/features/recruiter/settings/data/notifications.js` | 18 | **read fully** | A31 |
| `client/src/features/recruiter/settings/pages/BillingPage.jsx` | 27 | **read fully** | A33 |
| `client/src/features/recruiter/settings/pages/BillingPage.module.css` | 10 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A33 |
| `client/src/features/recruiter/settings/pages/DataAccountPage.jsx` | 139 | **read fully** | A32 |
| `client/src/features/recruiter/settings/pages/DataAccountPage.module.css` | 61 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A32 |
| `client/src/features/recruiter/settings/pages/NotificationsPage.jsx` | 36 | **read fully** | A31 |
| `client/src/features/recruiter/settings/pages/NotificationsPage.module.css` | 40 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A31 |
| `client/src/features/recruiter/settings/routes.jsx` | 11 | **read fully** | A31-A33 |
| `client/src/features/recruiter/shortlists/pages/ShortlistsPage.jsx` | 143 | **read fully** | A24 |
| `client/src/features/recruiter/shortlists/pages/ShortlistsPage.module.css` | 70 | scanned (not read line-by-line): grep for content/url()/attr()/@import/::before/::after/quoted literals/line-clamp; only empty `content: ''`, one mask `url()` and colour classes | A24 |
| `client/src/features/recruiter/shortlists/routes.jsx` | 3 | **read fully** | A24 |

**Files outside the scope that were read fully because recruiter code imports them or they bridge roles** (cited above):
- `client/src/app/workspaces.js` (113 lines): read fully
- `client/src/app/router.jsx` (46 lines): read fully
- `client/src/app/App.jsx` (6 lines): read fully
- `client/src/features/candidate/jobs/data/recruiterJobs.js` (65 lines): read fully
- `client/src/features/candidate/jobs/hooks/useJobListings.js` (32 lines): read fully
- `client/src/features/candidate/jobs/hooks/useApplications.js` (47 lines): read fully
- `client/src/features/candidate/jobs/data/applications.js` (24 lines): read fully
- `client/src/features/candidate/settings/data/settings.js` (43 lines): read fully
- `client/src/features/admin/courses/hooks/useCourses.js` (25 lines): read fully
- `client/src/features/admin/courses/utils/learnerCourse.js` (18 lines): read fully
- `client/src/features/payments/components/CheckoutDialog.jsx` (155 lines): read fully
- `client/src/features/payments/hooks/usePayments.js` (43 lines): read fully
- `client/src/features/payments/utils/card.js` (59 lines): read fully
- `client/src/features/payments/data/payments.js` (45 lines): read fully
- `client/src/components/layout/WorkspacePreferences.jsx` (14 lines): read fully
- `client/src/components/layout/preferencesContext.js` (15 lines): read fully
- `client/src/components/common/StatCard.jsx` (25 lines): read fully
- `client/src/hooks/useSharedLocalStorage.js` (48 lines): read fully

**Files read in part** (only the lines relevant to recruiter behaviour):
- `client/src/components/layout/Header.jsx:115-180`
- `client/src/components/layout/GlobalSearch.jsx:1-50`
- `client/src/components/layout/ProfileMenu.jsx:1-50`
- `client/src/components/layout/Sidebar.jsx` (grep)
- `client/src/features/payments/components/PaymentsTable.jsx:1-60`
- `client/src/features/admin/courses/data/courses.js:1-30`
- `client/src/features/admin/moderation/pages/ModerationPage.jsx:50-120`
- `client/src/features/admin/moderation/data/moderation.js:28-58`
- `client/src/features/admin/shared/data/users.js:1-40`
- `client/src/features/candidate/profile/data/profile.js` (grep)
- `client/src/features/candidate/jobs/data/jobUtils.js` (grep)
- `docs/FIGMA_SCREEN_INVENTORY.md` (full)
- `IMPLEMENTATION_PLAN.md` (full)
- `docs/USER_FLOW.md` (recruiter lines, via grep)

## J2. Storage grep check

Pattern: `useLocalStorage|useSharedLocalStorage|localStorage|sessionStorage` over the scope. Each code hit is covered in the report:

| Hit (file:line) | Covered in |
|---|---|
| `client/src/features/recruiter/company/data/company.js:2` (comment) | §0.1 + A30 |
| `client/src/features/recruiter/company/pages/CompanyPage.jsx:6` (code) | §0.1 + A30 |
| `client/src/features/recruiter/company/pages/CompanyPage.jsx:31` (code) | §0.1 + A30 |
| `client/src/features/recruiter/find-candidates/hooks/useCandidateActivity.js:1` (code) | §0.1 + A22 |
| `client/src/features/recruiter/find-candidates/hooks/useCandidateActivity.js:12` (code) | §0.1 + A22 |
| `client/src/features/recruiter/find-candidates/hooks/useCandidateNotes.js:1` (code) | §0.1 + A23 |
| `client/src/features/recruiter/find-candidates/hooks/useCandidateNotes.js:9` (code) | §0.1 + A23 |
| `client/src/features/recruiter/find-candidates/hooks/useMatchJob.js:1` (code) | §0.1 + A15 |
| `client/src/features/recruiter/find-candidates/hooks/useMatchJob.js:14` (code) | §0.1 + A15 |
| `client/src/features/recruiter/find-candidates/hooks/useShortlist.js:1` (code) | §0.1 + A15, A24 |
| `client/src/features/recruiter/find-candidates/hooks/useShortlist.js:13` (code) | §0.1 + A15, A24 |
| `client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:1` (code) | §0.1 + A26 |
| `client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:17` (code) | §0.1 + A26 |
| `client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:18` (code) | §0.1 + A26 |
| `client/src/features/recruiter/hiring-pipeline/hooks/usePipeline.js:1` (code) | §0.1 + A26 |
| `client/src/features/recruiter/hiring-pipeline/hooks/usePipeline.js:26` (code) | §0.1 + A26 |
| `client/src/features/recruiter/jobs/data/jobs.js:3` (comment) | §0.1 + A10 |
| `client/src/features/recruiter/jobs/hooks/useJobs.js:1` (code) | §0.1 + A10 |
| `client/src/features/recruiter/jobs/hooks/useJobs.js:17` (code) | §0.1 + A10 |
| `client/src/features/recruiter/jobs/pages/CreateJobPage.jsx:3` (code) | §0.1 + A12, A13 |
| `client/src/features/recruiter/jobs/pages/CreateJobPage.jsx:32` (code) | §0.1 + A12, A13 |
| `client/src/features/recruiter/learning/hooks/useRecruiterLearning.js:1` (code) | §0.1 + A28 |
| `client/src/features/recruiter/learning/hooks/useRecruiterLearning.js:18` (code) | §0.1 + A28 |
| `client/src/features/recruiter/settings/data/account.js:5` (comment) | §0.1 + A32 |
| `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:6` (code) | §0.1 + A32 |
| `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:33` (code) | §0.1 + A32 |
| `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:35` (code) | §0.1 + A32 |
| `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:36` (code) | §0.1 + A32 |
| `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:45` (code) | §0.1 + A32 |
| `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:53` (code) | §0.1 + A32 |
| `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:63` (code) | §0.1 + A32 |
| `client/src/features/recruiter/settings/pages/NotificationsPage.jsx:2` (code) | §0.1 + A31 |
| `client/src/features/recruiter/settings/pages/NotificationsPage.jsx:10` (code) | §0.1 + A31 |
| `client/src/features/auth/components/OnboardingLayout.jsx:18` (comment) | §0.1 + A3 |
| `client/src/features/auth/utils/session.js:16` (code) | §0.1 + A1, 0.1 |
| `client/src/features/auth/utils/session.js:25` (code) | §0.1 + A1, 0.1 |
| `client/src/features/auth/utils/session.js:34` (code) | §0.1 + A1, 0.1 |
| `client/src/features/auth/utils/useOnboardingState.js:2` (code) | §0.1 + A3, 0.1 |
| `client/src/features/auth/utils/useOnboardingState.js:11` (code) | §0.1 + A3, 0.1 |
| `client/src/features/auth/utils/useOnboardingState.js:12` (code) | §0.1 + A3, 0.1 |

## J3. Data-folder import check

Pattern: any `import … from '…/data/…'` in the scope. Every imported data module is cited in the report:

| Importer (file:line) | Imported data module | Covered in |
|---|---|---|
| `client/src/features/recruiter/applications/pages/ApplicationsPage.jsx:11` | `@/features/recruiter/hiring-pipeline/data/pipeline.js` | A25 |
| `client/src/features/recruiter/company/pages/CompanyPage.jsx:7` | `../data/company.js` | A30 |
| `client/src/features/recruiter/find-candidates/components/DiscoveryToolbar.jsx:4` | `../data/candidates.js` | A15 |
| `client/src/features/recruiter/find-candidates/components/MatchInsights.jsx:6` | `../data/candidateDetails.js` | A15, B2 |
| `client/src/features/recruiter/find-candidates/components/ResumePreviewModal.jsx:3` | `../data/candidateDetails.js` | A21 |
| `client/src/features/recruiter/find-candidates/pages/CandidateEducationPage.jsx:6` | `../data/candidateDetails.js` | A20 |
| `client/src/features/recruiter/find-candidates/pages/CandidateExperiencePage.jsx:4` | `../data/candidateDetails.js` | A18 |
| `client/src/features/recruiter/find-candidates/pages/CandidateOverviewPage.jsx:4` | `../data/candidateDetails.js` | A17 |
| `client/src/features/recruiter/find-candidates/pages/CandidateProfilePage.jsx:6` | `@/features/recruiter/hiring-pipeline/data/pipeline.js` | A16 |
| `client/src/features/recruiter/find-candidates/pages/CandidateProfilePage.jsx:8` | `../data/candidates.js` | A16 |
| `client/src/features/recruiter/find-candidates/pages/FindCandidatesPage.jsx:6` | `../data/candidates.js` | A15 |
| `client/src/features/recruiter/hiring-pipeline/components/ManageStagesModal.jsx:4` | `../data/pipeline.js` | A27 |
| `client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:2` | `@/features/candidate/jobs/data/recruiterJobs.js` | A26 |
| `client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:4` | `@/features/candidate/profile/data/profile.js` | A26 |
| `client/src/features/recruiter/hiring-pipeline/hooks/useLiveApplicant.js:6` | `@/features/recruiter/jobs/data/jobs.js` | A26 |
| `client/src/features/recruiter/hiring-pipeline/hooks/usePipeline.js:2` | `@/features/recruiter/find-candidates/data/candidates.js` | A26 |
| `client/src/features/recruiter/hiring-pipeline/hooks/usePipeline.js:9` | `../data/pipeline.js` | A26 |
| `client/src/features/recruiter/jobs/components/AiJobSummary.jsx:6` | `../data/jobs.js` | A11 |
| `client/src/features/recruiter/jobs/components/AiJobSummary.jsx:7` | `../data/jobFields.js` | A11 |
| `client/src/features/recruiter/jobs/components/JobStatusBadge.jsx:2` | `../data/jobs.js` | A10 |
| `client/src/features/recruiter/jobs/components/JobStepFields.jsx:3` | `../data/jobs.js` | A12 |
| `client/src/features/recruiter/jobs/components/JobStepFields.jsx:4` | `../data/jobFields.js` | A12 |
| `client/src/features/recruiter/jobs/components/JobTalentList.jsx:4` | `../data/relevantTalent.js` | A14 |
| `client/src/features/recruiter/jobs/components/JobWizard.jsx:5` | `../data/jobFields.js` | A12 |
| `client/src/features/recruiter/jobs/components/SkillPicker.jsx:5` | `../data/jobFields.js` | A12 |
| `client/src/features/recruiter/jobs/hooks/useJobs.js:2` | `../data/jobs.js` | A10 |
| `client/src/features/recruiter/jobs/pages/CreateJobPage.jsx:6` | `../data/jobFields.js` | A12, A13 |
| `client/src/features/recruiter/jobs/pages/JobDetailsPage.jsx:7` | `@/features/candidate/jobs/data/recruiterJobs.js` | A14 |
| `client/src/features/recruiter/jobs/pages/JobDetailsPage.jsx:13` | `../data/jobs.js` | A14 |
| `client/src/features/recruiter/jobs/pages/JobDetailsPage.jsx:14` | `../data/jobFields.js` | A14 |
| `client/src/features/recruiter/learning/components/LessonRow.jsx:4` | `../data/courses.js` | A29 |
| `client/src/features/recruiter/learning/hooks/useCourseCatalogue.js:5` | `../data/courses.js` | A28 |
| `client/src/features/recruiter/learning/hooks/useRecruiterLearning.js:2` | `../data/courses.js` | A28 |
| `client/src/features/recruiter/learning/pages/LearningPage.jsx:12` | `../data/courses.js` | A28 |
| `client/src/features/recruiter/overview/components/HiringFunnelCard.jsx:4` | `../data/overview.js` | A9 |
| `client/src/features/recruiter/overview/components/HiringMomentumCard.jsx:5` | `../data/overview.js` | A9 |
| `client/src/features/recruiter/overview/pages/OverviewPage.jsx:16` | `../data/overview.js` | A9 |
| `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:9` | `../data/account.js` | A32 |
| `client/src/features/recruiter/settings/pages/DataAccountPage.jsx:10` | `../data/notifications.js` | A32 |
| `client/src/features/recruiter/settings/pages/NotificationsPage.jsx:5` | `../data/notifications.js` | A31 |
| `client/src/features/recruiter/shortlists/pages/ShortlistsPage.jsx:11` | `@/features/recruiter/find-candidates/data/candidates.js` | A24 |
| `client/src/features/auth/components/OnboardingLayout.jsx:7` | `../data/onboarding.js` | A3 |
| `client/src/features/auth/pages/AccountRegistrationPage.jsx:8` | `../data/onboarding.js` | A4 |
| `client/src/features/auth/pages/CompanyInformationPage.jsx:8` | `../data/onboarding.js` | A5 |
| `client/src/features/auth/pages/KycVerificationPage.jsx:8` | `../data/onboarding.js` | A6 |
| `client/src/features/auth/pages/RecruiterSignUpPage.jsx:10` | `../data/hero.js` | A2 |
| `client/src/features/auth/pages/RecruiterSignUpPage.jsx:11` | `../data/onboarding.js` | A2 |
| `client/src/features/auth/pages/RecruiterSignUpPage.jsx:12` | `../data/workspaceChoices.js` | A2 |
| `client/src/features/auth/pages/SignInPage.jsx:11` | `../data/hero.js` | A1 |
| `client/src/features/auth/pages/SignInPage.jsx:12` | `../data/workspaceChoices.js` | A1 |
| `client/src/features/auth/pages/SignUpPage.jsx:11` | `../data/workspaceChoices.js` | candidate sign-up (out of scope; read) |
| `client/src/features/auth/pages/VerifyAccountPage.jsx:8` | `../data/onboarding.js` | A7 |
| `client/src/features/auth/utils/useOnboardingState.js:3` | `../data/onboarding.js` | A3, 0.1 |
| `client/src/features/auth/utils/validation.js:5` | `../data/onboarding.js` | A1-A7 |
| `client/src/features/help/pages/HelpPage.jsx:8` | `../data/help.js` | A34 |

There is also one intra-folder data import that the pattern does not match: `client/src/features/recruiter/jobs/data/jobFields.js:7` imports `./jobs.js` (A12, Part E S18).
