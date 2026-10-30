# Backend decisions (final)

Generated from `decisions.json` on 2026-10-30. The owner accepted **every recommended answer** (210 questions, merged from the 283 questions of the four audits in `audits/`). Already-decided items are confirmed. Where an answer refers to another question, follow the reference. If this file and `BACKEND_PLAN.md` ever disagree, `BACKEND_PLAN.md` §3 wins because it includes the owner decisions OD1–OD16 taken after this set.

## Contents

1. [Accounts & sign-in](#accounts-sign-in) (11)
2. [Candidate profile & completeness](#candidate-profile-completeness) (20)
3. [Jobs](#jobs) (15)
4. [Matching & AI](#matching-ai) (22)
5. [Applications & pipeline](#applications-pipeline) (15)
6. [Messaging & notifications](#messaging-notifications) (15)
7. [Learning (courses, lessons, quiz, certificates)](#learning-courses-lessons-quiz-certificates) (16)
8. [Payments & plan](#payments-plan) (15)
9. [Country, currency, formats & languages](#country-currency-formats-languages) (15)
10. [Recruiter company & onboarding](#recruiter-company-onboarding) (9)
11. [Admin access management](#admin-access-management) (10)
12. [Admin moderation & verification](#admin-moderation-verification) (6)
13. [Admin metrics & analytics](#admin-metrics-analytics) (15)
14. [Files, privacy & GDPR](#files-privacy-gdpr) (8)
15. [Shell & UI](#shell-ui) (11)
16. [Infrastructure & dev](#infrastructure-dev) (3)
17. [Seed & demo data](#seed-demo-data) (4)

## Accounts & sign-in

### M-001 · Candidate email-verification link details

Candidates verify their email by an emailed link before first login (decided). How long is the link valid, how often can it be resent, what does the link page do, and what happens when someone signs up with an email that is already registered?

**Decision:** 24 h link, no auto sign-in. 24 h single-use link; resend at most 1/min and 5/day; link page shows 'Email verified' + Sign in; first login goes to onboarding; existing email gets the same 'check your inbox' screen (no account enumeration); an email change needs re-verification.

*Context:* Decision: 'Candidates must verify their email (emailed link) before first login' - link only, no 6-digit email code (settles CAN-Q7's sub-question). Audits differ on resend limits (SHR-Q5: 1/min and 5/day; CAN-Q7: 5/hour). Recommend 1/min and 5/day: protects the Gmail SMTP daily sending quota.

*Rejected:* Same, but auto sign-in; 48 h link, explicit duplicate error.

*Sources:* SHR-Q5, CAN-Q7

### M-002 · When recruiters enter the emailed code

Recruiters verify their work email with an emailed code (decided). Is the code required straight after sign-up, or at onboarding step 4 as today (where they can sign in before verifying)?

**Decision:** Right after sign-up. Code entered immediately after sign-up; onboarding continues only after it; step 4 handles only the phone.

*Context:* Decision: Gmail SMTP sends the 'recruiter onboarding email verification code'. Conflict: SHR-Q6 recommends recruiters verify by an emailed LINK before first login (like candidates); the decision says CODE, so options keep the code. REC-RQ-8 recommends (a): no unverified sign-ins, consistent with candidates.

*Rejected:* At onboarding step 4 (today).

*Sources:* REC-RQ-8, SHR-Q6

### M-003 · Recruiter phone verification

Recruiter onboarding verifies the phone number, and phone codes are shown on screen with no SMS (decided). Where in the flow is the code done, and what does the admin see?

**Decision:** On-screen code at step 4. Server generates a random 6-digit code per request, shows it on screen and verifies it at step 4; admin review shows 'Phone confirmed on screen (no SMS)'.

*Context:* Decision: 'Phone codes on screen' (no SMS). Conflict: ADM-Q63 recommends collecting the recruiter phone unverified (option C) or adding an SMS provider (option B); both contradict the on-screen code decision. REC-RQ-9 and SHR-Q6 recommend the on-screen code. The fixed demo code 123456 goes away either way.

*Rejected:* On-screen code when phone entered.

*Sources:* REC-RQ-9, ADM-Q63, SHR-Q6

### M-004 · Verification code rules

What rules apply to the email and phone codes (length, expiry, attempts, resend), and can one phone number be verified on more than one account?

**Decision:** 6 digits, 10 min, one account. 6-digit code, 10-minute expiry, max 5 wrong attempts, resend after 60 s (max 5/hour), a 'Resend code' link, changing email/phone resets verification, phone stored in E.164 with a country-code input, one phone per account.

*Context:* REC-RQ-10 and CAN-Q40 agree; CAN-Q40 adds 'one phone number per account'.

*Rejected:* Same, phone reusable; Owner sets other limits.

*Sources:* REC-RQ-10, CAN-Q40

### M-005 · Signing in on the wrong portal

Each account has one role. What happens when a candidate uses the recruiter sign-in page (or the reverse), and who may use the admin sign-in page?

**Decision:** Sign in and redirect. One role-agnostic login; the client routes to the account's own workspace with a friendly notice. Only admins can use the admin page, and admins only sign in there (others get the generic error).

*Context:* Decision: one role per account; candidate and recruiter sign up separately; header workspace switch removed. REC-RQ-14 and SHR-Q4 both recommend (a).

*Rejected:* Reject with a hint; One shared sign-in page.

*Sources:* REC-RQ-14, SHR-Q4

### M-006 · Password rules

What password rules apply on the client and the server?

**Decision:** Min 8, max 128, block common. Minimum 8, maximum 128 (or 72 bytes with bcrypt), no composition rules, reject the most common passwords (matches today's hint).

*Rejected:* Min 8 plus character classes; Minimum 12 characters.

*Sources:* SHR-Q3

### M-007 · Session token lifetime and revocation

The client sends a JWT Bearer token (decided). How long does it last and how can it be revoked?

**Decision:** 7-day token + tokenVersion. One ~7-day access token in localStorage; a tokenVersion on the user lets a password reset or 'sign out everywhere' invalidate it; logout is client-side.

*Context:* Decision: JWT Bearer token.

*Rejected:* 15-min token + refresh cookie; 24 h token, no revocation.

*Sources:* SHR-Q7

### M-008 · Login brute-force protection

How are repeated failed logins handled, given there is no Redis?

**Decision:** In-memory rate limit, no lockout. Per IP and per email (e.g. 5 attempts / 15 min), HTTP 429 with a translated message.

*Context:* Decision: no Docker/Redis; server runs locally.

*Rejected:* Lock account after N failures; Nothing for now.

*Sources:* SHR-Q8

### M-009 · Forgot and reset password

Forgot-password emails are decided. Which roles get it, how long is the link valid, and what does a reset do?

**Decision:** All roles, 1 h link. 'Forgot password?' on all three sign-in pages; one /forgot-password route; 1 h single-use link; neutral 'if an account exists' reply; a reset signs out all sessions, marks the email verified and links to that role's sign-in.

*Context:* Decision: Gmail SMTP sends forgot-password emails in the user's language.

*Rejected:* Same, admins excluded; Separate route per role.

*Sources:* SHR-Q9

### M-010 · Changing password or email in the app

Can signed-in users change their password or email inside the app?

**Decision:** Change password only. 'Change password' (current + new) in candidate and recruiter Data & account and in admin Settings; no email change in v1.

*Context:* Related: M-199 (admin Settings page).

*Rejected:* No in-app change; Password and email change.

*Sources:* SHR-Q10

### M-011 · Auth pages for signed-in users; session expiry

What happens when a signed-in user opens /, /sign-in or /sign-up, and where does a user land after the session expires and they sign in again?

**Decision:** Redirect home; return to page. Signed-in visitors go to their workspace; on 401 the token is cleared and the user signs in with ?next=<same-origin path>, returning there after login.

*Rejected:* Always show auth pages.

*Sources:* SHR-Q11

## Candidate profile & completeness

### M-012 · Where the candidate's name is edited

Sign-up collects the full name, but the Edit profile dialog has no name field. Where is the name stored and edited?

**Decision:** On the user, editable in profile. User.fullName from sign-up, editable in Edit profile.

*Rejected:* Separate account section only; Not editable after sign-up.

*Sources:* CAN-Q1

### M-013 · Profile photo rules and visibility

A profile photo is part of a complete profile (decided). Which formats are allowed, who sees the photo, and is it moderated?

**Decision:** Required, visible, no pre-moderation. JPG/PNG/WebP up to 5 MB, square crop, stored 400x400 + 96x96; shown in the shell and to recruiters; admins can remove it through moderation.

*Context:* Decision: complete profile includes 'profile photo'. Conflict: ADM-Q71 recommends the photo be optional; options rewritten so it is always required. Audits also disagree on visibility: ADM-Q71 prefers (b) for bias mitigation; CAN-Q2 and REC-RQ-45 assume it is visible. Recommend (a) (simpler, matches the recruiter profile summary); pick (b) if bias mitigation matters more. In every option the photo is never a matching input.

*Rejected:* Required, shown after applying; Required, admin approves first.

*Sources:* CAN-Q2, ADM-Q71

### M-014 · Candidate onboarding scope

Onboarding has 3 steps (story, preferences, plan) and nothing records completion. How should it work now that a complete profile needs many more sections?

**Decision:** Keep 3 steps, then checklist. Partial draft profile allowed; store onboardingCompletedAt; redirect to onboarding after login until done; then send the candidate to the completeness checklist.

*Rejected:* Full wizard for every section; Once after sign-up only.

*Sources:* CAN-Q6

### M-015 · How completeness is displayed

How is profile completeness shown on Overview, Improve profile, the apply gate, the promo card and My profile?

**Decision:** Checklist, equal weight. A checklist of every required item, 'x of N complete', percent = done/N; degree/institution replaced by the Education list.

*Context:* Decision: complete profile = all profile fields + work history + education + languages with level + EU/UK right to work + photo + links + live CV + phone verified + admin-approved checks. CAN-Q30 also proposed not counting salary; that part conflicts with the decision and is handled in M-017.

*Rejected:* Weighted percent.

*Sources:* CAN-Q30

### M-016 · Meaning of admin-reviewed completeness

Does 'admin-approved' completeness mean admins approve every profile section, or only the verification evidence?

**Decision:** auto %, admins approve evidence. Completeness is computed automatically; admins approve only the verification evidence and other uploaded documents.

*Context:* Decision: 'Complete profile = ... + admin-approved verification checks' and 'Candidate verification evidence reviewed/approved by admins.' ADM-Q62 recommended (a). Confirm only.

*Sources:* ADM-Q62

### M-017 · Minimum salary in the complete profile

Minimum salary is required in onboarding but optional in Edit profile. Should it be required, and should it count toward a complete profile? (Salary was not in the agreed list of required profile fields.)

**Decision:** Optional, not counted. Optional everywhere; when set it must be a valid amount (format per M-131); not part of completeness.

*Context:* Not covered by a decision: the agreed required fields were headline, location, about, years of experience, skills, qualification, institution and work preference. CAN-Q42 and CAN-Q30 recommend optional and not counted.

*Rejected:* Required, prefer-not allowed; Required everywhere, counts.

*Sources:* CAN-Q42

### M-018 · Work-history entries

How are work-history entries shaped, and how does someone with no work history (e.g. a graduate) complete the profile?

**Decision:** Month/year, opt-out, description. Month + year dates, 'I currently work here', optional description up to 1,000 chars (translatable on demand); at least 1 entry or an explicit 'No work experience yet' choice; yearsExperience stays a separate field.

*Context:* Decision lists 'structured work history' as required; the 'No work experience yet' opt-out is an exception the owner must explicitly allow. REC-RQ-46 adds the optional description (recruiter screens show a paragraph per role).

*Rejected:* Entry mandatory, no opt-out; Years computed from entries.

*Sources:* CAN-Q31, REC-RQ-46

### M-019 · Education entries

Education is required. How are entries shaped, and can someone with no formal qualification complete the profile?

**Decision:** Month/year, 'No formal qualification'. Month + year dates, 'Still studying' allowed; at least 1 entry or an explicit 'No formal qualification' choice.

*Context:* Decision lists 'structured education' as required; the opt-out needs the owner's explicit approval.

*Rejected:* Entry mandatory, no opt-out.

*Sources:* CAN-Q32

### M-020 · Languages list and levels

Which languages can a candidate list, and how are levels recorded?

**Decision:** ISO 639-1, A1-C2 + Native. All ISO 639-1 languages, names translated into the UI language; at least 1 entry; one level per language.

*Context:* Decision: 'languages with level' are part of a complete profile.

*Rejected:* EU languages plus a few.

*Sources:* CAN-Q33

### M-021 · Right-to-work model

EU/UK right to work is required (decided). Is it recorded per region (EU, UK) or per country, which entry is required, can evidence be verified, and do recruiters see it?

**Decision:** Per region, optional evidence. Entries for EU and/or UK: citizen-settled / visa-permit (with expiry) / needs sponsorship; at least one; optional evidence verified in the verification queue; shown and filterable for recruiters; nationality never used.

*Context:* Decision: 'EU/UK right to work' is part of a complete profile. Audits disagree: ADM-Q70 models it per region (EU/UK), CAN-Q34 per country. Recommend (a): it matches the decision's wording and avoids up to 28 entries.

*Rejected:* Per country, current country required; Self-declared only.

*Sources:* CAN-Q34, ADM-Q70

### M-022 · Required profile links

Which profile links are required for a complete profile?

**Decision:** LinkedIn or portfolio. At least one; LinkedIn must match linkedin.com/in/...; portfolio any https URL.

*Context:* Decision: 'links' are part of a complete profile.

*Rejected:* LinkedIn required; Both required.

*Sources:* CAN-Q35

### M-023 · Which verification checks are required

There are three admin-reviewed checks (identity, academic, employment). Which must be approved for a complete profile?

**Decision:** Identity + checks matching entries. Identity always; academic if an education entry exists; employment if a work-history entry exists.

*Context:* Decision: complete profile includes 'admin-approved verification checks' (which ones is not specified).

*Rejected:* All three; Identity only.

*Sources:* CAN-Q36

### M-024 · Candidate availability

Recruiter screens show availability ('Available in 2 weeks') as free text, but the candidate profile only has an 'open to opportunities' flag. How is availability stored?

**Decision:** Fixed list set by candidate. Available now / within 2 weeks / within 1 month / open to opportunities / not looking.

*Rejected:* Availability date.

*Sources:* REC-RQ-37

### M-025 · External certificates on profiles

How are certificates from outside the platform handled on candidate profiles?

**Decision:** Self-declared, optional verification. Optional file/URL; with a file the candidate can request verification; recruiters see 'Verified' only for reviewed ones.

*Rejected:* Always reviewed first; Self-declared only.

*Sources:* ADM-Q72

### M-026 · Where new profile sections show to recruiters

Where do the new profile items appear on the recruiter's candidate profile, and does a platform course certificate count as verified evidence of a skill?

**Decision:** Proposed layout, no skill proof. Photo, links and badges in the summary; languages and certificates on Skills; right to work on Overview and sidebar; work history on Experience; education on Education; certificates do not verify skills.

*Context:* Decision: course certificate badge is visible to recruiters. REC-RQ-45 recommends the layout and leaves the skill question open; recommend no skill verification because courses have no skill tags yet (see M-114).

*Rejected:* Same layout, certificates verify skills.

*Sources:* REC-RQ-45

### M-027 · CV upload processing

When a CV is uploaded the server extracts its text (decided, for matching). Should AI also propose a profile snapshot (role, years, skills) for the candidate to confirm?

**Decision:** AI proposes, candidate confirms. Extracted text feeds an AI snapshot the candidate reviews; the profile changes only on explicit confirmation.

*Context:* Decision: CV-based job matching via CV text extraction + embeddings; ALL AI features are paid. An AI-proposed snapshot is an AI feature, so Free candidates would get (b) unless the owner says otherwise.

*Rejected:* Snapshot from profile fields.

*Sources:* CAN-Q43

### M-028 · CV version download and delete

Can candidates download each CV version and delete individual versions?

**Decision:** Download any; delete non-live. Own versions downloadable; any version except the live one deletable.

*Rejected:* No per-version actions.

*Sources:* CAN-Q45

### M-029 · Requests for earlier CV versions

Recruiters can 'request an earlier version' of a candidate's CV. Is this a real consent flow?

**Decision:** Candidate approves each request. The candidate sees requests on the CV page (and as a notification), approves or declines; the recruiter then gets access.

*Context:* CAN-Q46 and REC-RQ-44 agree on (a); REC adds it only makes sense if CV versions are stored on the server (they will be).

*Rejected:* Admin approves; Remove the feature.

*Sources:* CAN-Q46, REC-RQ-44

### M-030 · Deleting a CV used in applications

If a candidate deletes a CV that was submitted with applications, what do recruiters keep?

**Decision:** Delete everywhere. Files deleted; recruiters see 'CV removed by the candidate'.

*Rejected:* Keep submitted copy.

*Sources:* CAN-Q47

### M-031 · Candidate-side field limits

Which length and count limits apply to candidate-side fields that have none today?

**Decision:** Proposed limits. Alert name 80, keywords 120, location 60, cover note 2,000, message 2,000, employer/title/institution/degree 100; max 10 alerts, 20 CV versions, 20 work-history and 20 education entries.

*Rejected:* Owner's own numbers.

*Sources:* CAN-Q29

## Jobs

### M-032 · Location model for jobs, profiles and alerts

Job, profile, onboarding and alert locations are free text today. How are they structured?

**Decision:** Country + city text; remote list. Country (EU 27 + UK) + free-text city; remote jobs flagged, with a list of eligible countries.

**Changed 2026-10-30 by the owner (G-1 in BACKEND_PLAN.md):** the city is no longer free text. Every city field is picked through Google Places (New) via the server proxy and stored as `{ countryCode, city, placeId }`, without coordinates. Remote jobs and their eligible-country list are unchanged.

*Context:* Decision: the country picker (EU 27 + UK + Remote) controls which jobs/candidates are shown, so every job and profile needs a country code. REC-RQ-15 and CAN-Q11 agree.

*Rejected:* Country + city from a gazetteer; Keep free text.

*Sources:* REC-RQ-15, CAN-Q11

### M-033 · Job field limits

Only minimum lengths exist on job fields today. Which limits apply?

**Decision:** Proposed limits. Title 3-120; brief 40-5,000; up to 20 responsibilities of 300; required skills 1-20, preferred up to 20, each 1-50; experience 0-50; salary integers 0-10,000,000; a skill cannot be both required and preferred.

*Rejected:* Owner's own numbers.

*Sources:* REC-RQ-17

### M-034 · Skills: free text or taxonomy

Skill suggestions are a fixed list today. Are skills free text or a managed taxonomy?

**Decision:** Free text + DB suggestions. Case-insensitive normalisation; suggestions = most-used skills per market/language; embeddings handle synonyms.

*Rejected:* Admin-managed taxonomy; ESCO taxonomy.

*Sources:* REC-RQ-18

### M-035 · New job fields for matching

Should jobs gain fields that match the new candidate profile (languages with level, right to work)?

**Decision:** Languages + visa sponsorship. 'Required languages (+ minimum level)' and 'Visa sponsorship available (yes/no)'.

*Rejected:* Languages only; Neither.

*Sources:* REC-RQ-19

### M-036 · Job perks and tagline

Job details always show the same 4 static perks and fall back to static copy for 'impact' and 'nice to have'. Should the job form gain these fields?

**Decision:** Hide empty sections only. No new fields; sections without data are hidden.

*Context:* CAN-Q17 recommends (b) unless the recruiter audit adds the fields (it does not). The static perks go either way.

*Rejected:* Add perks and tagline fields.

*Sources:* CAN-Q17

### M-037 · Editing a published job

Can a recruiter edit a job after it is published?

**Decision:** Edit live. Changes apply immediately; AI summary and embedding regenerate; no repeat job-alert emails; applicants not notified.

*Rejected:* Edits need admin moderation; Lock key fields once applied.

*Sources:* REC-RQ-20

### M-038 · Deleting jobs

A delete function exists in code but no screen uses it. Can jobs be deleted?

**Decision:** Delete drafts only. Published jobs can only be closed.

*Rejected:* Never delete, close only; Soft-delete any job.

*Sources:* REC-RQ-21

### M-039 · Validation when publishing

Publishing a draft from the Jobs table menu skips validation today. How is publishing validated?

**Decision:** Server validates every publish. Every transition to published is validated; a 422 opens the wizard at the first invalid step.

*Rejected:* Client-side only.

*Sources:* REC-RQ-23

### M-040 · Closed tab and status order

The Jobs page has no Closed tab and sorts status alphabetically. Change it?

**Decision:** Add Closed tab, fixed order. Order: published, paused, draft, closed.

*Rejected:* Keep as is.

*Sources:* REC-RQ-24

### M-041 · Job wizard draft and small UI state

Where do the unfinished job-wizard draft, the dismissed overview insight and the recruiter's selected match job live?

**Decision:** Draft on server; rest in browser. The draft becomes a server Job with status draft once step 1 is valid (Cancel keeps it); the other two stay per device in the browser.

*Context:* REC-RQ-26 and SHR-Q25 agree.

*Rejected:* All three on the server; All three in the browser.

*Sources:* REC-RQ-26, SHR-Q25

### M-042 · Company name on a job

Each job has a free-text 'Company' field defaulting to the demo company. Is it editable?

**Decision:** Always company display name. Not editable per job.

*Rejected:* Editable per job.

*Sources:* REC-RQ-29

### M-043 · Paused or closed job pages for candidates

What do candidates see when they open a paused, closed or removed job?

**Decision:** Read-only for applicants and savers. 'No longer accepting applications' for those who applied or saved it; 'no longer available' for everyone else.

*Rejected:* Always 'no longer available'.

*Sources:* CAN-Q16

### M-044 · Which jobs candidates can see

Which published jobs appear to candidates?

**Decision:** Approved recruiters, not restricted. Only published jobs of admin-approved recruiters that moderation has not restricted.

*Context:* Decision: recruiters need admin approval before recruiter tools unlock.

*Rejected:* All published jobs.

*Sources:* CAN-Q19

### M-045 · 'Premium jobs' concept

'Premium jobs locked' and 'eligible for premium job opportunities' have no data behind them. Keep the concept?

**Decision:** Drop the premium concept. Remove the copy.

*Context:* Applying already requires a complete (admin-checked) profile and the paid plan.

*Rejected:* Add a premium flag to jobs.

*Sources:* CAN-Q38

### M-046 · Admin Jobs list scope

Admin Jobs shows published jobs only, so paused (restricted) jobs disappear. Which statuses does it list?

**Decision:** All statuses + status filter. New status select.

*Rejected:* Published only.

*Sources:* ADM-Q20

## Matching & AI

### M-047 · How the match score is computed

CV-based matching uses CV text extraction + embeddings (decided). How is a candidate-job match computed and shown?

**Decision:** Blended 0-100 score. Embedding similarity (text-embedding-3-large, CV/profile vs job) blended with required-skill overlap; Strong 75+, Good 50+; weights and thresholds in the admin policy; OpenAI writes explanations only.

*Context:* Decision: OpenAI text-embedding-3-large; 'CV-based job matching via CV text extraction + embeddings'. Conflict: ADM-Q33 recommends a deterministic score with no embeddings (OpenAI for explanations only); options rewritten to use embeddings. CAN-Q13 recommends (a); REC-RQ-34 recommends (b). Recommend (a): one number reused by candidate, recruiter and admin screens.

*Rejected:* Embedding rank, skills break ties; Two separate numbers.

*Sources:* ADM-Q33, CAN-Q13, REC-RQ-34

### M-048 · What the admin matching policy controls

Do the admin 'AI & matching' policies actually drive matching for recruiters and candidates?

**Decision:** Policy drives inputs and thresholds. The active policy's signals switch inputs on/off and set thresholds; saving or activating triggers a recompute.

*Context:* Decision: 'policy suggestion' is an OpenAI admin helper. ADM-Q33 and REC-RQ-90 lean to (a).

*Rejected:* Informational only.

*Sources:* REC-RQ-90, ADM-Q33

### M-049 · Matching policy management

Policies cannot be renamed, edited, archived or versioned, every signal can be switched off, and one policy is active globally. What is needed?

**Decision:** Edit, archive, 1+ signal, versions. Edit name/description, archive drafts, require at least one signal, keep a version history referenced by match results; one global policy.

*Rejected:* Keep as designed; As (a), one policy per country.

*Sources:* ADM-Q35

### M-050 · What Free candidates see of matching

CV-based matching and match explanations are paid (decided). What do Free candidates see on job lists, and should the unbacked plan feature 'Priority review of your CV versions' be dropped?

**Decision:** Basic skill-overlap label. A non-AI overlap label for Free; the plan adds the embedding score and explanations.

*Context:* Decision: paid plan unlocks 'match explanations' and 'CV-based job matching'. CAN-Q14 recommends (b) and dropping 'Priority review of your CV versions'.

*Rejected:* Nothing match-related.

*Sources:* CAN-Q14

### M-051 · 'Relevant candidates' count

Jobs show 'N relevant' candidates. How is that number computed?

**Decision:** Embedding threshold, skill fallback. Discoverable, consenting, email-verified candidates in the job's market above a similarity threshold (fallback: 1+ required skill); cached, refreshed on job save and nightly.

*Rejected:* 1+ required skill; 50%+ of required skills.

*Sources:* REC-RQ-30

### M-052 · One definition of skill overlap

'Relevant skills', 'aligned skills' and 'matchedSkills' are counted three different ways. Use one definition?

**Decision:** Required + preferred, one label. One server function and the same label everywhere.

*Rejected:* Required skills only.

*Sources:* REC-RQ-36

### M-053 · 'Recommended jobs' definition

How are the Overview 'Recommended jobs' KPI and the 'For you' tab defined?

**Decision:** Country + Good threshold. Published jobs in the candidate's country with score at or above Good, ranked; '+N this week' = published in the last 7 days.

*Rejected:* Top N regardless of threshold.

*Sources:* CAN-Q15

### M-054 · Who appears in Find candidates

Which candidates are listed in recruiter discovery, and does the complete-profile rule apply to discovery too?

**Decision:** Verified, discoverable, consenting, complete. Email-verified, discoverable, matching consent, in the selected country, complete profile; applicants stay visible to that company through their application.

*Context:* Decision: a complete profile is required to apply; discovery is not stated.

*Rejected:* Same, incomplete profiles allowed; Everyone.

*Sources:* REC-RQ-31

### M-055 · Country filter in candidate discovery

When a recruiter picks a country in Find candidates, which candidates match?

**Decision:** Residence or right to work. Residence country, or right to work (citizen/permit) there; Remote = open-to-remote candidates in any country.

*Rejected:* Residence country only; Preferred work locations.

*Sources:* REC-RQ-33

### M-056 · New discovery filters for v1

Which new discovery filters ship in v1, and is filtering out 'needs sponsorship' acceptable under non-discrimination rules?

**Decision:** Right to work, language, verified. Plus a legal review before any sponsorship filter.

*Rejected:* All proposed filters.

*Sources:* REC-RQ-38

### M-057 · AI insight content: code vs OpenAI

On candidate AI pages and recruiter Match Insights, which parts are computed in code and which are written by OpenAI?

**Decision:** Code evidence + OpenAI narrative. Listed/missing skills, years, work mode, languages, right to work computed in code; OpenAI writes the narrative; cached per candidate + job + language (+ profile hash); recruiters never see a score; invented gap texts removed.

*Context:* Decision: OpenAI for candidate AI insights and recruiter match insights; AI answers in the user's language. CAN-Q49 and REC-RQ-35 agree.

*Rejected:* Everything from OpenAI.

*Sources:* CAN-Q49, REC-RQ-35

### M-058 · AI generation timing, caching and caps

When is AI content (job summaries, insights) generated, how is it cached, and is there a per-user daily cap?

**Decision:** First view, cached, capped. Generate on first open; cache per (entity version, language); invalidate on change; admin 'Regenerate' button; daily cap per user (e.g. 50 calls) with a friendly message.

*Context:* ADM-Q21 and CAN-Q55 agree; confirm the cap number.

*Rejected:* Generate on publish/update; Generate on every view.

*Sources:* ADM-Q21, CAN-Q55

### M-059 · Page-level 'AI job summary' buttons

Page-level buttons summarise an implicit job (first search result, latest application). Keep them?

**Decision:** Move onto each card and row. Remove the page-level button.

*Rejected:* Keep, name the job.

*Sources:* CAN-Q20

### M-060 · Job wizard 'AI analysis' step

Wizard step 7 'AI analysis' is local rules and is not in the decided OpenAI list. What should it be?

**Decision:** Server rules, named 'Quality checks'. Same rules run on the server; step renamed.

*Context:* Decision lists the OpenAI uses (job summaries, candidate insights, CV draft, admin and recruiter helpers: policy suggestion, report brief, recruiter match insights, CV-based matching); a job-quality review is not among them.

*Rejected:* OpenAI review; Rules plus optional AI.

*Sources:* REC-RQ-25

### M-061 · CV assisted draft output

What does 'Create assisted draft' produce?

**Decision:** Suggestions + revised snapshot. No new file; pending drafts can be deleted.

*Context:* Decision: CV assisted draft is a paid OpenAI feature.

*Rejected:* Full revised CV file.

*Sources:* CAN-Q44

### M-062 · Profile 'AI summary'

The profile 'AI job summary' is a template today. Should OpenAI write it?

**Decision:** OpenAI recruiter-ready summary. From profile + live CV, in the user's language, copyable (paid).

*Context:* Decision: all AI features are paid; AI answers in the user's language.

*Rejected:* Keep the template.

*Sources:* CAN-Q56

### M-063 · AI insights role picker

The AI insights role picker shows 5 fixed demo roles. Which jobs should it offer?

**Decision:** Top 10 + saved + applied. Default to the top-ranked job.

*Rejected:* Any published job (search).

*Sources:* CAN-Q48

### M-064 · 'I have this skill' on Skill gap

Ticking 'I have this skill' is stored separately and never reaches My profile. Should it add the skill to the profile?

**Decision:** Add to profile skills. Respect the 12-skill / 30-char rules; refuse at 12.

*Rejected:* Separate reviewed list.

*Sources:* CAN-Q50

### M-065 · 'Save this opportunity' list

Job match 'Save this opportunity' uses its own list. Should it use the normal saved jobs?

**Decision:** Same saved-jobs list. One SavedJob as the bookmark.

*Rejected:* Separate AI shortlist.

*Sources:* CAN-Q51

### M-066 · Skill-demand denominator

Skill demand reads 'of the 9 current demo opportunities'. What is the denominator?

**Decision:** All visible published jobs. In the candidate's country.

*Rejected:* Candidate's recommended jobs.

*Sources:* CAN-Q53

### M-067 · Explanation feedback

Where does 'Helpful / Needs review' feedback on AI explanations go?

**Decision:** Stored, aggregates for admin. Shown in admin AI & matching.

*Context:* Related: M-175 (Analytics 'matching quality' card).

*Rejected:* Stored for candidate only.

*Sources:* CAN-Q54

### M-068 · Admin matching oversight section

The oversight section is fixed to one job, 4 candidates and one evidence card. What should it show?

**Decision:** Job picker, top 4. Default newest published job; evidence for the selected candidate.

*Rejected:* Job with most applications; Remove the section.

*Sources:* ADM-Q34

## Applications & pipeline

### M-069 · Pipeline unit and stage scope

Today one company-wide board places each candidate (not each application). What is the unit, and how are stages scoped?

**Decision:** Per application, company stages. One card per application (shows the job); stages per company; 'All open roles' becomes a job filter; stage history stored.

*Context:* ADM-Q17, REC-RQ-49 and REC-RQ-50 agree.

*Rejected:* Stages per job; Per candidate, furthest stage.

*Sources:* ADM-Q17, REC-RQ-49, REC-RQ-50

### M-070 · Recruiter stages vs candidate-visible status

Recruiters have custom stages; candidates see applied / under review / interview / withdrawn. How do stages map to what the candidate sees?

**Decision:** Each stage picks a status. In Manage stages each stage gets a candidate-visible status; defaults: applied to Applied, screening/shortlisted/custom to Under review, interview to Interview; add Offer, Hired, Not selected.

*Context:* REC-RQ-52 recommends a per-stage category, CAN-Q21 a fixed mapping; (a) combines them (fixed defaults, editable for custom stages). ADM-Q17 asks for one unified stage vocabulary.

*Rejected:* Fixed mapping; Show the stage name.

*Sources:* CAN-Q21, REC-RQ-52, ADM-Q17

### M-071 · Stage select and sourced candidates

A candidate with no application gets a placement when the profile's stage select is used. How should the select work, and can sourced candidates enter the pipeline?

**Decision:** Per application; no sourcing. Hidden for non-applicants; one select per application; sourced candidates not added in v1.

*Rejected:* Allow sourced candidates.

*Sources:* REC-RQ-51

### M-072 · Stage limits

What limits apply to custom pipeline stages, and is the first stage fixed?

**Decision:** 2-12 stages, fixed 'Applied'. Names 1-24 chars, unique; removal blocked by active applications; history keeps names; first stage never removed or moved.

*Rejected:* Owner's own rules.

*Sources:* REC-RQ-58

### M-073 · Apply flow

Beyond the profile + plan gate, applying is one click with no CV choice or consent. What does applying look like?

**Decision:** Apply dialog. Choose a CV version (default live), optional cover note up to 2,000 chars, consent checkbox.

*Context:* Decision: applying requires a complete profile AND the paid plan (gate runs before this dialog).

*Rejected:* One click after one-time consent.

*Sources:* CAN-Q22

### M-074 · Re-applying after withdrawal

Can a candidate apply again to a job they withdrew from?

**Decision:** New application record. The old one stays as withdrawn.

*Rejected:* Reactivate the same record; Not allowed.

*Sources:* CAN-Q23

### M-075 · Application history and 'Next step'

Should applications keep a dated status history and a real 'Next step'?

**Decision:** Status history + Next step. Dated steps (status, date, actor); no interview scheduling yet.

*Rejected:* Current step only.

*Sources:* CAN-Q24

### M-076 · Withdrawn applications in recruiter views

Withdrawn applications vanish from recruiter views today. Should recruiters still see them?

**Decision:** Keep with filter, off the board. Withdrawn filter/badge in Applications; removed from the board.

*Rejected:* Hide entirely.

*Sources:* REC-RQ-55

### M-077 · Recruiter Applications table columns

The table shows the candidate's own title, not the job applied for, and has no applied date. Add Job and Applied columns and a job filter?

**Decision:** Add Job, Applied, job filter. Three additions.

*Rejected:* Keep as is.

*Sources:* REC-RQ-56

### M-078 · 'Candidate portal activity' section

This section on recruiter Applications is always empty. Remove it or make it a feed?

**Decision:** Remove it. Drop the section.

*Context:* REC-RQ-57 gives no recommendation. Recommend (a): the Applications table already lists recent applications, so a feed would duplicate it.

*Rejected:* 'Recent applications' feed.

*Sources:* REC-RQ-57

### M-079 · Shortlist scope

Is the shortlist per recruiter or per company, one list or several, and what happens to candidates who later turn discovery off?

**Decision:** One list per company. addedBy and createdAt stored; job tag later; candidate not notified; candidates who turned discovery off hidden with a 'no longer available' count.

*Rejected:* One list per recruiter user; Several named lists.

*Sources:* REC-RQ-40

### M-080 · Private notes on candidates

How are recruiter notes stored, who sees them, and are they in the candidate's GDPR export?

**Decision:** One note per company + candidate. updatedBy/updatedAt, up to 5,000 chars; visible to the company; export question to legal.

*Rejected:* Several timestamped notes.

*Sources:* REC-RQ-41

### M-081 · Candidate activity timeline

The Activity tab shows only your own actions on this device. Should it show candidate events and colleagues' actions?

**Decision:** Company-wide timeline. Candidate events (applied, withdrew, replied, CV request decided, CV updated) + colleagues; stored as type + params, rendered through translations.

*Rejected:* Own actions only.

*Sources:* REC-RQ-42

### M-082 · Recruiter Overview 'Applications' KPI

What does the recruiter Overview 'Applications' number count?

**Decision:** Active applications. To the company's jobs, excluding rejected and withdrawn.

*Rejected:* All-time applications; Within a period.

*Sources:* REC-RQ-60

### M-083 · Hiring momentum 'Shortlisted' series

Is the 'Shortlisted' series shortlist additions per day or moves into a stage named 'Shortlisted', and are This week / Last week the only periods?

**Decision:** Shortlist additions per day. Uses shortlist createdAt; keep the two periods.

*Context:* Timezone and week definition: see M-170.

*Rejected:* Moves into 'Shortlisted' stage.

*Sources:* REC-RQ-61

## Messaging & notifications

### M-084 · Whom a paid candidate can message

Paid candidates can start and reply to conversations; Free candidates can only read (decided). Whom can a paid candidate start a conversation with?

**Decision:** Companies they applied to. Start only with recruiters of jobs they applied to.

*Context:* Decision: paid plan unlocks 'replying to/starting messages (Free can READ recruiter messages)'. Conflict: REC-RQ-81 recommends candidates can only reply and never start; options rewritten so paid candidates can start. CAN-Q73 recommends (a).

*Rejected:* Any company with a published job.

*Sources:* CAN-Q73, REC-RQ-81

### M-085 · Which candidates a recruiter can message

Recruiters can message candidates. Does that include a candidate who is not discoverable and never applied (e.g. reached by a direct link)?

**Decision:** Applicants + discoverable only. No messaging hidden candidates.

*Context:* REC-RQ-32 and CAN-Q73 agree.

*Rejected:* Any candidate account.

*Sources:* REC-RQ-32, CAN-Q73

### M-086 · Conversation structure and limits

How are conversations organised and what can a message contain?

**Decision:** One thread per company + candidate. Optionally tagged with a job; text only, up to 2,000 chars; no attachments.

*Context:* Decision: two-way inbox, Messages sidebar item, polling ~15 s. REC-RQ-81 and CAN-Q29 both propose 2,000 chars.

*Rejected:* One thread per job + candidate; As (a), with attachments.

*Sources:* REC-RQ-81, CAN-Q29

### M-087 · Showing a candidate's Free plan to recruiters

Free candidates can read but not reply. Should a recruiter see anything about that?

**Decision:** Hide the plan entirely. Nothing shown.

*Context:* REC-RQ-47 accepts (a) or (b) but never revealing billing status; (a) is simplest.

*Rejected:* Neutral 'Awaiting reply'.

*Sources:* REC-RQ-47

### M-088 · Default outreach text

The recruiter message dialog has a default outreach text. Template or AI draft?

**Decision:** Translatable template. In the recruiter's UI language; candidate can translate on demand.

*Context:* AI outreach drafts are not in the decided OpenAI list.

*Rejected:* AI draft.

*Sources:* REC-RQ-82

### M-089 · New-message email timing

Message updates are emailed (decided). When is the email sent for a new message?

**Decision:** Only if unread after 15 min. At most once per conversation per hour, in the recipient's language.

*Context:* Decision: Gmail SMTP sends message updates in the user's language. REC-RQ-83 recommends (a), CAN-Q73 (b). Recommend (a): no email to people already reading in the app.

*Rejected:* Immediately, max once per 15 min; Every message immediately.

*Sources:* REC-RQ-83, CAN-Q73

### M-090 · Rejection email to the candidate

Application-stage updates are emailed (decided). When a recruiter rejects an application, can the recruiter suppress that email?

**Decision:** Recruiter chooses, on by default. Checkbox in the confirm dialog; templated email in the candidate's language.

*Context:* Decision: application-stage updates are emailed. REC-RQ-53 recommends (a); emailing stays the default.

*Rejected:* Always automatic.

*Sources:* REC-RQ-53

### M-091 · Stage-change email timing

Stage-change emails are decided. Are they sent on every board move or only when the candidate-visible status changes?

**Decision:** Only on status change, batched. Only when the mapped status changes; delayed ~10 min and collapsed to absorb drag-and-drop noise.

*Context:* Decision: application-stage updates emailed. REC-RQ-54 and CAN-Q21 agree.

*Rejected:* Every move, immediately.

*Sources:* REC-RQ-54, CAN-Q21

### M-092 · Emails beyond the decided list

Decided emails are: recruiter onboarding code, job alerts, application-stage and message updates, forgot password. Should admin decisions and other events also email users?

**Decision:** Add decision emails. Recruiter approved/rejected/suspended (with reason), verification approved/rejected, content restricted, certificate issued, plan renewal failed/ended; in the recipient's language.

*Context:* ADM-Q50, REC-RQ-6 and CAN-Q37 all recommend emailing approval and rejection outcomes.

*Rejected:* (a) plus more; Only the decided list.

*Sources:* ADM-Q50, REC-RQ-6, CAN-Q37

### M-093 · Header bell

The bell shows a permanent dot and links to notification settings. What should it do?

**Decision:** Remove dot, keep settings link. No feed in v1.

*Context:* Audits disagree: SHR-Q19 and ADM-Q45 (a), CAN-Q4 (b), REC-RQ-77 (c). Recommend (a): there is no design for a feed, the decided Messages badge already shows unread messages, and emails cover the other events; a feed can follow.

*Rejected:* Notification dropdown; Dot for new messages/applications.

*Sources:* SHR-Q19, CAN-Q4, REC-RQ-77, ADM-Q45

### M-094 · Counters poll and badges

Messages poll about every 15 s with an unread badge (decided). Which counts does the poll return, and which other badges exist?

**Decision:** One counters call, candidate badges. One counters request every 15 s (paused in hidden tabs) for Messages unread and candidate active Applications (and the bell if used); badges hidden at 0.

*Context:* Decision: Messages sidebar item for candidate and recruiter, polling ~15 s, unread badge.

*Rejected:* (a) + recruiter and admin badges; Separate request per badge.

*Sources:* SHR-Q22

### M-095 · Notification settings granularity

Settings have two toggles (in-app, email). What do they control?

**Decision:** Two toggles. Email toggle covers job-alert, application-update, new-application and message emails; verification, reset, decisions, certificates and payment emails always sent; in-app toggle controls the bell/dot.

*Context:* REC-RQ-76 and CAN-Q69 agree.

*Rejected:* One toggle per category.

*Sources:* REC-RQ-76, CAN-Q69

### M-096 · Job-alert delivery frequency

Alerts offer Daily/Weekly digests, but job-alert emails go out 'when a matching job is published' (decided). Which frequencies exist?

**Decision:** Instant + daily/weekly digests. Digests at 08:00 in the user's timezone.

*Context:* Decision: job-alert emails when a matching job is published.

*Rejected:* Instant only.

*Sources:* CAN-Q26

### M-097 · Which job events trigger alert emails

Do job-alert emails go out on the first publish only, or also when a job is resumed or reopened?

**Decision:** First publish only. Tracked by firstPublishedAt.

*Rejected:* Also resume and reopen.

*Sources:* REC-RQ-22

### M-098 · Job-alert matching rule

How does a new job match a saved alert?

**Decision:** Find-jobs keyword rules. Every keyword must appear in title/company/skills/location/work mode/level/industry; location substring; the candidate's country.

*Rejected:* Semantic (embedding) matching.

*Sources:* CAN-Q27

## Learning (courses, lessons, quiz, certificates)

### M-099 · Automatic lesson and course completion

Lessons complete when viewed and courses complete on a passed final quiz, so there is no manual 'Mark complete'. Confirm?

**Decision:** automatic, quiz completes. Lessons complete when viewed (video ~90%); course completes on passing the final quiz (~70%); certificate + badge; 'Mark complete' toggles removed; same for recruiters.

*Context:* Decision: 'lesson completes when viewed (video ~90%); course completes after passing a final quiz (~70%); completion -> PDF certificate with verification code + badge ... Same model for recruiter learning.' ADM-Q25 (already marked answered by its audit; its original option B badge-without-quiz is superseded) and REC-RQ-74 (confirm no manual completion). Confirm only.

*Sources:* ADM-Q25, REC-RQ-74

### M-100 · Course tier badges

Courses carry 'Included'/'Plus' tiers and a 'Learning Plus active' pill, but the plan does not include courses. Drop the tiers?

**Decision:** drop tiers, show price. Show Free or the price; remove the tiers and the pill.

*Context:* Decision: 'Courses are separate one-time purchases (not included in the plan).' This settles ADM-Q27's open point (the plan does not unlock courses). CAN-Q58 recommends (a); ADM-Q27 recommended (b). Confirm (a).

*Rejected:* Price-derived badge only.

*Sources:* ADM-Q27, CAN-Q58

### M-101 · Where the course builder lives

The lesson builder and quiz editor do not fit today's small course modal. Where do they live?

**Decision:** Full-page editor. New/edit routes with tabs Details, Lessons, Quiz, Preview (not in Figma).

*Context:* Decision: lessons authored by admin in a lesson builder.

*Rejected:* Modal + Lessons/Quiz modals; Multi-step wizard modal.

*Sources:* ADM-Q51

### M-102 · Lesson file types and size limits

Lessons are video, text, PDF-document or external link, stored on the server disk (decided). Which types and size limits apply?

**Decision:** Video 500 MB, PDF 50 MB. MP4 (H.264/AAC) or WebM, HTTP Range streaming, no transcoding; PDF only; text as sanitised rich text/Markdown up to 50,000 chars; https links only; cover image up to 5 MB.

*Context:* Decision: mixed lessons in a lesson builder; uploads on the server disk (ADM-Q23 'course media' is superseded by this). Audits disagree: ADM-Q52 video 1 GB / PDF 50 MB; REC-RQ-73 video 500 MB / PDF 20 MB; CAN-Q60 video 500 MB. Recommend video 500 MB (two audits agree, protects the disk) and PDF 50 MB (image-heavy PDFs exceed 20 MB). Also confirm: duration prefilled from video metadata and editable; total disk budget.

*Rejected:* Video 1 GB, PDF 50 MB; Video 300 MB, PDF 20 MB.

*Sources:* ADM-Q52, REC-RQ-73, CAN-Q60, ADM-Q23

### M-103 · When non-video lessons count as viewed

Video completes at ~90% (decided). When do text, PDF and link lessons count as viewed, and how is video progress trusted?

**Decision:** On open; video by server heartbeats. Text/PDF/link complete on open; video counts server-accumulated watched time from progress heartbeats (seeking does not count).

*Context:* Decision: 'lesson completes when viewed (video ~90%)'. Audits disagree: REC-RQ-69 (a), ADM-Q55 (b), CAN-Q60 (c for video). Recommend (a): the simplest literal reading of 'viewed', plus ADM's anti-seek rule for video.

*Rejected:* Text needs scroll to end; Trust client video position.

*Sources:* ADM-Q55, REC-RQ-69, CAN-Q60

### M-104 · Final quiz rules

The final quiz passes at ~70% (decided). Question types, attempts, unlocking and feedback?

**Decision:** Unlimited attempts, answers hidden. Single + multiple choice, 2-6 options, pass mark per course (default 70), unlocks after all lessons, score shown but not correct answers, options shuffled, best score kept.

*Context:* Decision: final quiz, pass ~70%. ADM-Q54 and CAN-Q61 recommend (a); REC-RQ-70 recommends (b). Recommend (a) (two audits agree); choose (b) if repeated guessing is a concern.

*Rejected:* (a) + cooldown; Max 3 attempts per 24 h.

*Sources:* ADM-Q54, REC-RQ-70, CAN-Q61

### M-105 · Certificate details and public check

Completion gives a PDF certificate with a verification code (decided). Whose name is printed, in which language, and is there a public verification page?

**Decision:** Name at issue, public page. Name, course, date, platform name, code + QR/link; PDF in the holder's language, stored as a snapshot; public /certificates/:code page (name, course, date, Valid/Revoked); admin revoke (audited); re-issue on name change; rate-limited.

*Context:* Decision: PDF certificate with verification code + badge visible to recruiters. All four audits recommend (a); route names differ (/verify/:code, /certificates/verify/:code, /certificates/:code) - recommend /certificates/:code (SHR-Q45). CAN-Q62 adds: badge hidden when the candidate is not discoverable.

*Rejected:* No public page; Regenerate PDF each download.

*Sources:* ADM-Q57, REC-RQ-71, CAN-Q62, SHR-Q45

### M-106 · Free preview lesson

Learner pages promise a free 3-minute introduction. How is it modelled?

**Decision:** Per-lesson 'free preview' flag. Any flagged lesson opens without purchase.

*Rejected:* Separate intro-video field; No free preview.

*Sources:* ADM-Q58, CAN-Q63

### M-107 · Course-level learner copy and cover

Learner pages show summary, about, tagline, 'designed for', outcomes, a cover photo and an intro. Where do these come from?

**Decision:** Admin fields + cover upload. Builder Details tab holds every learner-facing field; cover JPG/PNG/WebP up to 5 MB.

*Context:* Decision: admin authors lessons in a lesson builder (answers ADM-Q24's lesson part). ADM-Q53 and REC-RQ-66 recommend one Course collection with every learner field in the admin form; ADM suggests an optional AI assist button, which is not in the decided OpenAI list.

*Rejected:* AI-generated, admin edits; Drop from learner pages.

*Sources:* ADM-Q53, ADM-Q24, REC-RQ-66

### M-108 · Editing a published course with learners

What can change once learners are enrolled?

**Decision:** Lock lessons and quiz. Only copy and price editable once anyone is enrolled.

*Rejected:* Versioned lessons and quizzes; Edit freely, recalculate.

*Sources:* ADM-Q56

### M-109 · Unpublishing and deleting courses

What does unpublishing do, and can courses be deleted?

**Decision:** Hidden; buyers keep access; no delete. Archive only if needed.

*Rejected:* Hidden from everyone.

*Sources:* ADM-Q29

### M-110 · 'Enrolled' and 'active learner' definitions

Per-course enrolled, purchased, completions and revenue are required. How are 'enrolled' and 'active learner' defined?

**Decision:** Enrolled = added or bought. Free + paid; active = 1+ lesson done and not completed.

*Context:* Decision: completions = quiz passed = certificate issued.

*Rejected:* Enrolled = started a lesson.

*Sources:* ADM-Q30

### M-111 · Admin course stats layout

How are per-course stats shown on Admin > Courses?

**Decision:** Row stats, revenue, learners list. '{enrolled} enrolled, {purchased} purchased, {completions} completed', Revenue column (finance permission), page totals, per-course learners list.

*Rejected:* Extend row text only; Separate analytics page.

*Sources:* ADM-Q59

### M-112 · Who owns a recruiter course purchase

Does a recruiter's course purchase belong to the user or the whole company?

**Decision:** The user. Personal purchase.

*Rejected:* The company.

*Sources:* REC-RQ-68

### M-113 · Course content language

Does the admin author a course in one language or one version per language?

**Decision:** One language, translate on demand. Titles, summaries and text lessons translatable on demand; video/PDF single-language with a language tag.

*Context:* Decision: user content translatable on demand; AI translation is a paid feature for candidates.

*Rejected:* Filter courses by UI language.

*Sources:* REC-RQ-72, CAN-Q59

### M-114 · Course suggestions

Candidate AI insights and recruiter learning show static course suggestions. How are they computed?

**Decision:** Rules on real data. Candidate: courses tagged with gap skills (admin adds course skill tags); recruiter: rules from pipeline stats; labelled 'Suggested for you'.

*Context:* AI course suggestions are not in the decided OpenAI list; CAN-Q52 and REC-RQ-67 both recommend rules.

*Rejected:* OpenAI suggestions; Admin-curated flag.

*Sources:* CAN-Q52, REC-RQ-67

## Payments & plan

### M-115 · The plan's name

The plan is called 'AI Matches Plus' today and the name may change. What is it called?

**Decision:** 'Plus'. Short name already used across the UI.

*Context:* Still open by the owner. ADM-Q65 asks for the final name; CAN-Q67 notes it may change; neither recommends one. Suggest (b): the plan now unlocks applying, messaging and alerts, not just AI matches. The name is stored per language in the plan record (M-116).

*Rejected:* Keep 'AI Matches Plus'; Another name.

*Sources:* ADM-Q65, CAN-Q67

### M-116 · Where the plan catalogue lives

The plan's name, price, features and Stripe price are hard-coded. Where are they stored and who edits them?

**Decision:** DB plan record, edited via seed. Name per language, prices, interval, Stripe price ids, features, entitlements; read everywhere; changed through seed/config.

*Context:* Audits disagree: ADM-Q65 recommends (a), CAN-Q67 recommends (b). Recommend (a) for v1: no design for a Plans screen and the name changes rarely; (c) would be static data.

*Rejected:* DB + admin 'Plans' screen; Code constants.

*Sources:* ADM-Q65, CAN-Q67

### M-117 · Are recruiter AI features paid?

Are recruiter AI features (job summaries, match insights) free for approved recruiters, or behind a paid plan?

**Decision:** Free for approved recruiters. Only candidates have a plan.

*Context:* The decided plan (Stripe monthly, GBP 9 today) lists candidate unlocks; recruiter pricing is not mentioned.

*Rejected:* Recruiter paid plan.

*Sources:* SHR-Q24

### M-118 · How locked features look to Free users

Free candidates can read messages but not apply, reply, use alerts or AI (decided). How does the app show these locked features?

**Decision:** Visible with a lock chip. AI pages and Job alerts show a plan chip that opens the upgrade gate; Messages read-only with an upgrade prompt instead of the reply box; Apply opens the upgrade/complete-profile prompt.

*Context:* Decision: Free can READ recruiter messages; applying, replying/starting messages, job alerts and all AI features need the paid plan.

*Rejected:* Hide locked items; No marker, gate on click.

*Sources:* SHR-Q21

### M-119 · What a lapse does to existing activity

When the plan lapses (or the profile becomes incomplete) after applying, what happens to existing applications, job alerts and messages?

**Decision:** Keep existing, block new. Applications stay active and withdrawable; alerts paused (kept) and resume on re-subscribing; messages stay readable; AI pages lock; only new actions blocked.

*Context:* Decision makes the Job alerts page locked for Free. REC-RQ-59, CAN-Q25, CAN-Q28, SHR-Q21 and ADM-Q66 all recommend (a).

*Rejected:* Pause applications; Delete alerts on downgrade.

*Sources:* REC-RQ-59, CAN-Q25, CAN-Q28, SHR-Q21, ADM-Q66

### M-120 · Cancellation timing and failed renewals

When does access end after a cancellation or a failed renewal?

**Decision:** Period end; lock after retries. Cancel at period end; on failed renewal keep access while Stripe retries (past_due); lock when Stripe marks it unpaid/canceled.

*Context:* Audits disagree: CAN-Q64 (a), ADM-Q66 (b), SHR-Q40 (c). Recommend (a): Stripe's retry schedule acts as the grace period, with no extra timer to build.

*Rejected:* Period end; 7-day grace; Lock as soon as not active.

*Sources:* ADM-Q66, CAN-Q64, SHR-Q40

### M-121 · How candidates manage the subscription

How do candidates cancel, change their card or see invoices?

**Decision:** Stripe Customer Portal. Cancel at period end, card updates, invoices.

*Context:* Decision: Stripe test mode, hosted Checkout + webhook.

*Rejected:* In-app 'Cancel plan' button; Cancel immediately, no refund.

*Sources:* SHR-Q41, CAN-Q64

### M-122 · Payment records and statuses

Which payment rows and statuses does the app record?

**Decision:** Paid, renewals, failed renewals, refunds. A row per one-time payment and per paid invoice; failed renewals as 'failed'; Dashboard refunds reflected as 'refunded'; abandoned or declined Checkout attempts not recorded; Stripe receipt link.

*Context:* Decision: Stripe test mode, hosted Checkout + webhook. Audits disagree: ADM-Q31 recommends (b); SHR-Q40 and CAN-Q65 recommend (a); ADM-Q32 calls refunds out of scope. Recommend (a): hosted Checkout does not end the session on a decline, so declined attempts are noise; the admin 'Failed payments' stat then counts failed renewals.

*Rejected:* (a) + declined attempts; Paid only.

*Sources:* ADM-Q31, ADM-Q32, SHR-Q40, CAN-Q65

### M-123 · Admin view of subscriptions

What can admins see and do with subscriptions?

**Decision:** View only + KPIs. Renewal rows, subscription status and period in details, Plan column + filter on Candidates, Active subscribers and MRR cards.

*Rejected:* (a) + admin actions; Existing Payments page only.

*Sources:* ADM-Q67

### M-124 · Step before Stripe Checkout

Does checkout show an in-app step before redirecting to Stripe?

**Decision:** Confirm dialog, then redirect. Item, server price, currency and 'Continue to secure payment'.

*Context:* Decision: Stripe hosted Checkout.

*Rejected:* Redirect immediately.

*Sources:* SHR-Q37

### M-125 · Return from Stripe

Where does Stripe send the user back after payment?

**Decision:** Return route, confirm, go back. A per-role return page polls the session, refreshes plan/enrolments/payments, then returns to the starting page.

*Rejected:* Original page + polling.

*Sources:* SHR-Q38

### M-126 · Payment methods

Which payment methods does Stripe Checkout offer?

**Decision:** Cards, wallets and Link. Apple/Google Pay and Link shown automatically.

*Rejected:* Also SEPA, iDEAL, Bancontact.

*Sources:* SHR-Q39

### M-127 · VAT, receipts and invoices

How are VAT, receipts and invoices handled (including EU business recruiters)?

**Decision:** Test mode: Stripe receipts, no tax. Prices VAT-inclusive; Stripe emails receipts; subscription invoices Stripe-hosted; no Stripe Tax or VAT IDs until going live.

*Context:* SHR-Q42 and REC-RQ-75 agree.

*Rejected:* Stripe Tax + VAT IDs now; No receipts.

*Sources:* SHR-Q42, REC-RQ-75

### M-128 · Payment reference shown to users

Which payment reference appears in tables?

**Decision:** Own sequence + Stripe IDs. Server-generated 'LWM-000001' shown; Stripe IDs stored alongside.

*Context:* The prefix depends on the brand name (M-193).

*Rejected:* Stripe IDs only.

*Sources:* SHR-Q43

### M-129 · 'Continue with Free' for subscribers

The onboarding plan step's 'Continue with Free' silently downgrades a paid subscriber. What should it do?

**Decision:** Show 'You're on {plan}'. Continue; plan changes only through Billing.

*Rejected:* Treat it as a cancel.

*Sources:* CAN-Q66

## Country, currency, formats & languages

### M-130 · Charging currencies and per-currency prices

The country picker controls the currency of course prices, the plan and Stripe (decided). Which currencies are charged, and how is each price set?

**Decision:** Local currency per country. EUR, GBP, PLN, SEK, DKK, CZK, HUF, RON; admin enters a course price per currency; the plan has one Stripe price per currency; Remote = EUR; reports total each currency separately.

*Context:* Decision: country 'controls ... CURRENCY (salaries, course prices, plan, Stripe)'. Conflict: ADM-Q26 recommends GBP everywhere; SHR-Q30 and CAN-Q9 recommend GBP for UK and EUR for every EU country; REC-RQ-64/RQ-65 recommend GBP + EUR with EUR fallback. Each charges non-euro countries in another currency. Recommend (a): no exchange-rate data needed and Stripe supports per-currency prices. Note: SHR and REC say Bulgaria uses EUR since 1 Jan 2026, CAN-Q9 lists it as non-euro - verify.

*Rejected:* Admin sets GBP + EUR, rest derived; GBP for UK, EUR elsewhere.

*Sources:* ADM-Q26, REC-RQ-64, REC-RQ-65, SHR-Q30, CAN-Q9

### M-131 · Salary currency and period

The country picker controls salary currency (decided). In which currency is a job's salary entered and shown, and may salaries be monthly as well as yearly?

**Decision:** Local jobs local, remote in EUR. Salary entered in the job country's currency (locked); remote jobs entered in EUR; stored as integer + currency + period (year or month); no conversion needed.

*Context:* Decision: country controls currency for 'salaries'. Conflict: ADM-Q22, REC-RQ-16 and CAN-Q10 recommend always showing the job's own currency with no conversion (REC-RQ-16 lets the recruiter edit it). Rewritten options keep the shown salary in the picker currency. (a) works because the picker shows only that country's jobs; it depends on M-132 (Remote). Candidate minimum salary uses the candidate's country currency; filters compare same-currency values. REC-RQ-16 recommends allowing a monthly period.

*Rejected:* Convert to the picker currency; Job currency; Remote exception.

*Sources:* ADM-Q22, REC-RQ-16, CAN-Q10

### M-132 · What 'Remote' means

What does choosing 'Remote' in the country picker show, and which currency and formats does it use?

**Decision:** Remote-flagged items only. Jobs: remote-flagged listings from any country; candidates: open to remote; currency EUR; formats from the language's default region (en-IE / es-ES / fr-FR).

*Context:* SHR-Q28 and CAN-Q8 recommend (a) but differ on English formats (SHR en-IE, CAN en-GB); recommend en-IE (English with EUR). REC-RQ-33: in discovery, Remote = open-to-remote candidates in any country.

*Rejected:* No country filter; Remote + all EU jobs.

*Sources:* SHR-Q28, CAN-Q8, REC-RQ-33

### M-133 · Date and number locale

The country controls date and number formats (decided). Which locale is used exactly?

**Decision:** Language + country locale. E.g. en-DE, fr-BE, es-ES; Remote per M-132; browser timezone; date-only values stored without time; admins use their language (no picker).

*Context:* Decision: country controls date & number formats. SHR-Q31, CAN-Q12 and ADM-Q46 (admin locale sub-question) agree.

*Rejected:* Country's own locale; Language only.

*Sources:* SHR-Q31, CAN-Q12, ADM-Q46

### M-134 · Default language per country

The country sets the default language (decided) and only en/es/fr exist. What is the mapping?

**Decision:** ES es; FR, BE, LU fr; else en. Applies until the user picks a language; changing country never overrides an explicit choice.

*Context:* Decision: country controls default language; UI languages en/es/fr. SHR-Q29 and REC-RQ-85 agree.

*Rejected:* ES es; FR fr; else en; Never change on country switch.

*Sources:* SHR-Q29, REC-RQ-85

### M-135 · Storing language and country

Where are language and country stored, and what does an anonymous visitor get?

**Decision:** On the user; browser if anonymous. Server is the source of truth; anonymous visitors use localStorage; default language from the browser (en/es/fr, else en); sign-up gets a required country select (browser region, else Remote).

*Rejected:* Browser only; Server only.

*Sources:* SHR-Q26

### M-136 · Header country vs profile location

Is the header country the same as the candidate's profile location used for matching?

**Decision:** Separate browsing preference. Header country is its own setting; the profile keeps its location and right to work; the header defaults from the profile country at onboarding.

*Rejected:* One shared field.

*Sources:* SHR-Q27, CAN-Q11

### M-137 · Which lists the country picker filters

The picker controls which jobs/candidates are shown (decided). Does it also filter the user's own data?

**Decision:** Discovery surfaces only. Find jobs, recommendations, alert matching, Find candidates, shortlist discovery; own applications, jobs, pipeline, messages and payments never filtered.

*Context:* Decision: picker 'controls which jobs/candidates are shown'. SHR-Q33 and REC-RQ-84 agree.

*Rejected:* Every list.

*Sources:* SHR-Q33, REC-RQ-84

### M-138 · Admin country picker

Does the admin workspace get the country picker?

**Decision:** No picker; Country filter. Admin lists, Overview and Analytics get an 'All countries / {country}' filter.

*Context:* ADM-Q46 and SHR-Q32 agree.

*Rejected:* Same picker as others.

*Sources:* ADM-Q46, SHR-Q32

### M-139 · Source of the country list

Where does the country list come from, and how are names translated?

**Decision:** Seeded countries collection. ISO code, currency, default language, isRemote, order, enabled; served by the API; names via the browser's Intl display names.

*Rejected:* Collection with stored names; Client constant.

*Sources:* SHR-Q34

### M-140 · Language picker on public pages

Do sign-in/up, reset, verify-email, certificate check and legal pages get a language picker?

**Decision:** Small picker in auth layout. Not in the design today.

*Rejected:* Browser language only.

*Sources:* SHR-Q35

### M-141 · UI text in translation files

UI copy lives in en/es/fr translation files, while business data and staff-editable content live in the database. Confirm?

**Decision:** UI files, data in DB. Labels, headings, validation and empty states in files; plans, prices, countries, legal texts and certificates in the DB.

*Context:* Decision: 'UI languages en/es/fr via translation files for all UI text.' SHR-Q1 recommended (a). FAQ storage is asked in M-200, legal texts in M-191.

*Sources:* SHR-Q1

### M-142 · Stored enum keys and stage names

Enum values are stored as English labels ('Full-time', 'Applied'). Store keys instead?

**Decision:** Store keys, translate labels. E.g. full_time, mid, on_site; default stage names created in the company's language and then treated as user content.

*Rejected:* Store English labels.

*Sources:* REC-RQ-87

### M-143 · Server error messages

Does the server return error codes for the client to translate, or ready-translated messages?

**Decision:** Codes + fields, client translates. Server localises only emails, AI output and PDFs.

*Rejected:* Server translates messages.

*Sources:* SHR-Q16

### M-144 · Scope of on-demand 'Translate'

User content is translatable on demand (decided). Which texts get a 'Translate' action, and how is it cached?

**Decision:** Selected texts, cached. Job brief and responsibilities, company About, candidate about, work-history descriptions, messages; not skills or names; cached per entity + field + language + hash.

*Context:* Decision: user content translatable on demand; AI translation is a paid feature for candidates (recruiter access per M-117). REC-RQ-48 and CAN-Q74 agree.

*Rejected:* Automatic everywhere.

*Sources:* REC-RQ-48, CAN-Q74

## Recruiter company & onboarding

### M-145 · Several recruiters per company

Can a company have several recruiter users?

**Decision:** One recruiter, one company. Store a separate Company and scope every recruiter record by company so teams can follow.

*Rejected:* Several equal members; Owner + invited members with roles.

*Sources:* REC-RQ-1

### M-146 · Legal vs display company name

Onboarding asks for a legal company name; the Company page asks for a company name. One field or two?

**Decision:** Legal name + display name. Legal name verified in KYC; display name public, defaulting to the legal name.

*Rejected:* One name.

*Sources:* REC-RQ-2

### M-147 · Company fields editable after approval

After approval, which company fields can the recruiter edit?

**Decision:** Public fields only. Display name, industry, size, city, website, description.

*Rejected:* All, freely; All; verified fields re-reviewed.

*Sources:* REC-RQ-3

### M-148 · Company size buckets

Onboarding and the Company page use different company-size lists. Use one keyed list, and are the six buckets final?

**Decision:** One keyed list, six buckets. 1_10 up to 1000_plus, translated labels.

*Rejected:* Different buckets.

*Sources:* REC-RQ-4

### M-149 · Company country in onboarding

The onboarding company country is free text. Should it be a picker?

**Decision:** EU 27 + UK picker. No Remote (not valid for a legal entity); seeds the recruiter's default country, currency and language.

*Context:* Decision: countries are EU 27 + UK + Remote.

*Rejected:* Keep free text.

*Sources:* REC-RQ-13

### M-150 · Company logo

Companies show a letter on a coloured tile. Allow a logo upload?

**Decision:** Logo upload + letter fallback. PNG/JPG/SVG up to 2 MB (SVG sanitised); letter colour derived from the company id.

*Context:* Decision: uploads stored on the server disk.

*Rejected:* Initial letter only.

*Sources:* CAN-Q18

### M-151 · What recruiters see before approval

Recruiter tools unlock only after admin approval (decided). What does a signed-in recruiter see while onboarding is incomplete, submitted, rejected or suspended?

**Decision:** Onboarding or status page only. Incomplete: first open step; submitted: review status; rejected: reason + Resubmit; suspended: blocked message; only approved opens the workspace.

*Context:* Decision: 'Recruiters need admin approval before recruiter tools unlock.' REC-RQ-5 and SHR-Q6 agree on (a).

*Rejected:* Read-only workspace, tools locked.

*Sources:* REC-RQ-5, SHR-Q6

### M-152 · Resubmission after recruiter rejection

Can a rejected recruiter fix their details and resubmit?

**Decision:** Resubmit after edits. Admin's reason shown; recruiter fixes data or documents and resubmits.

*Context:* REC-RQ-6, SHR-Q6 and ADM-Q63 all recommend (a). The rejection email is asked in M-092.

*Rejected:* Rejection is final.

*Sources:* REC-RQ-6, SHR-Q6, ADM-Q63

### M-153 · Duplicate password step in onboarding

Sign-up collects the password and onboarding step 1 asks for it again. What should step 1 be?

**Decision:** Step 1 edits details only. Sign-up creates the account and returns a token; no password fields in onboarding.

*Rejected:* Keep both.

*Sources:* REC-RQ-7

## Admin access management

### M-154 · Who is listed in Access management

User access lists marketplace accounts today and its permissions describe employer-team actions. Who are its users?

**Decision:** Admin staff only. Roles gate admin pages.

*Context:* Decision: one role per account; admins seeded. ADM-Q1 says only (a) fits 'one role per account'.

*Rejected:* Recruiter company teams; All accounts with overrides.

*Sources:* ADM-Q1

### M-155 · Do admin custom roles enforce permissions?

Admins can create custom roles with permissions. Are those permissions enforced, and does the UI hide what an admin may not use?

**Decision:** Enforce on API, hide in UI. Every admin API route checks permissions; sidebar and search hide disallowed items; seeded non-revocable Owner.

*Context:* Still open by the owner. ADM-Q2 recommends (a) (retrofitting later costs more); SHR-Q15 recommends hiding nav and search if enforced.

*Rejected:* Enforce on API only; Informational in v1; Enforce on Access, Payments, Audit.

*Sources:* ADM-Q2, SHR-Q15

### M-156 · Permission catalogue

The 20 permissions include employer actions admins never perform and miss several admin areas. What list do we use?

**Decision:** Figma list + missing ids. Keep Figma copy, add missing areas, drop ids with no feature.

*Context:* New areas from the decisions need ids too (verification review, documents view, course authoring/revenue, subscriptions).

*Rejected:* New admin-page catalogue; Figma list verbatim.

*Sources:* ADM-Q3

### M-157 · Role 'access scope' and user 'department'

What do role 'Access scope' and user 'Department or scope' mean?

**Decision:** Descriptive labels only. No data restriction.

*Rejected:* Data partition; Remove both fields.

*Sources:* ADM-Q4

### M-158 · Role lifecycle

Edit and archive permissions exist but there is no Edit/Archive UI. Can roles be edited and archived?

**Decision:** Edit + archive. Edit via the prefilled create dialog; archive blocked while users are assigned.

*Rejected:* Immutable, never archived; Server now, UI later.

*Sources:* ADM-Q6

### M-159 · Creating more admin accounts

The seed creates the first admin account. How should further admin accounts be added?

**Decision:** Invite by email. An admin with the right permission invites a new admin from Access management; the invitee sets a password through an emailed link (SMTP).

*Context:* Only the first admin is decided (seeded). ADM-Q7 recommends inviting by email, which fits Access management assigning roles to several admins; SHR-Q14 recommends seed only. The sign-in copy "Production accounts require an invitation" matches (a).

*Rejected:* Seed only; Seed + server CLI command.

*Sources:* ADM-Q7, SHR-Q14

### M-160 · Lock-out protection

How do we stop admins locking everyone out of Access management?

**Decision:** Owner bypass, no self-removal. Seeded Owners bypass permissions and cannot be revoked; at least one Owner always exists; nobody removes their own role-assign right.

*Rejected:* No special rules.

*Sources:* ADM-Q8

### M-161 · Admin user detail pages

'Manage' on Candidates/Recruiters opens the access-role dialog for marketplace users. Should admins get user detail pages and extra table columns?

**Decision:** Detail pages + table columns. Candidate and recruiter detail pages (profile, verification, plan, applications, history); Candidates table adds Country, Right to work, Verification, Completeness %, Plan with filters; 'Manage' opens the page.

*Context:* Structured candidate profiles make a detail page necessary (ADM-Q5 update -> ADM-Q69).

*Rejected:* Detail page only; Columns only; Remove 'Manage' link.

*Sources:* ADM-Q5, ADM-Q69

### M-162 · What goes into the audit log

Which events are written to the admin audit log?

**Decision:** Admin + system + user events. With an actor type; all exports audited, AI generations not; recruiter job status changes, CV downloads and KYC submission included.

*Context:* ADM-Q43 and REC-RQ-89 agree.

*Rejected:* Admin actions only.

*Sources:* ADM-Q43, REC-RQ-89

### M-163 · Audit categories

The audit categories have nowhere for course, payment or job actions. Add categories?

**Decision:** Add Learning, Payments, Jobs. New filter chips.

*Rejected:* Map courses to Workspace.

*Sources:* ADM-Q44

## Admin moderation & verification

### M-164 · A moderation 'Report' button

No candidate or recruiter screen can report content today. Should users get a 'Report' button, and on what?

**Decision:** Jobs, profiles, companies, messages. Each report creates a moderation case (message reports include the thread excerpt); admins can also open cases from Jobs; admins never browse threads otherwise.

*Context:* Still open by the owner. ADM-Q39 recommends reports on job details, candidate profile and company page; ADM-Q68 recommends reporting messages (privacy: admins never browse threads).

*Rejected:* Messages only; No Report button.

*Sources:* ADM-Q39, ADM-Q68

### M-165 · Account review actions

Only recruiters need approval, so the account queue holds recruiters. Which decisions can an admin take?

**Decision:** Approve / Reject / Suspend. Reason required for reject and suspend.

*Context:* Decision: candidates are active after email verification; recruiters need admin approval - so the queue is recruiters only. The seed's pending candidate (James Chen) must change (see M-208).

*Rejected:* Approve / Suspend only; (a) + Request more info.

*Sources:* ADM-Q40

### M-166 · Candidate verification review

Admins approve candidate verification evidence (decided). Where is the queue, what decisions exist, and what does it cover?

**Decision:** Moderation tab, approve/reject. Third Moderation tab; Approve / Reject (reason required, up to 300 chars); resubmission allowed; covers identity, academic, employment, right-to-work evidence and external certificates; evidence linked to a profile entry.

*Context:* Decision: 'Candidate verification evidence reviewed/approved by admins.' ADM-Q41, ADM-Q61 and CAN-Q37 agree. Decision emails: M-092.

*Rejected:* (a) + Request more info; Review from user detail page.

*Sources:* ADM-Q41, ADM-Q61, CAN-Q37

### M-167 · Effects of 'Restrict content'

What does an admin 'Restrict' do to a job or profile, and can it be lifted?

**Decision:** Locked flag with reason. Job paused and locked (no republish until cleared), reason shown; profile hidden from discovery; 'Dismiss' lifts it; history kept; owner emailed.

*Context:* ADM-Q42 and REC-RQ-28 agree.

*Rejected:* Status paused only; Permanent, no email.

*Sources:* ADM-Q42, REC-RQ-28

### M-168 · Verification badges shown to recruiters

How are approved checks shown on recruiter candidate cards and profiles?

**Decision:** Tick per approved check. Identity, academic, employment.

*Rejected:* One overall badge; Not shown.

*Sources:* CAN-Q39

### M-169 · Verification and Learning columns

'Not started' and 'Not connected' in admin user tables have no meaning. What do the columns show?

**Decision:** Proposed mapping. Candidates: Not started / In review / n of 3 verified / Verified; recruiters: Pending / Approved / Rejected / Suspended; Learning '{n} enrolled, {m} certificates' for both.

*Rejected:* Owner's own mapping.

*Sources:* ADM-Q48

## Admin metrics & analytics

### M-170 · Timezone and week definition

Which timezone and week definition drive 'This week / Last week / Last month' and daily buckets (admin and recruiter charts)?

**Decision:** Browser timezone, ISO weeks. Client sends its timezone; weeks start Monday.

*Context:* ADM-Q9 and REC-RQ-61 agree.

*Rejected:* Fixed Europe/London; UTC.

*Sources:* ADM-Q9, REC-RQ-61

### M-171 · Analytics line view

The line view plots a 0-100 index for Mon-Sat only, and 'Last month' has no data. What should it plot?

**Decision:** Same real counts as bars. 7 days or 4-5 weeks, auto-scaled axis.

*Context:* Decision: admin dashboard numbers are real from the DB.

*Rejected:* Cumulative counts; % of period total.

*Sources:* ADM-Q10

### M-172 · 'Average role match' definition

How is the Overview 'Average role match' computed (a fixed 68% today)?

**Decision:** Mean of each job's top N. Captioned 'Across {n} published roles'.

*Rejected:* Mean over pairs above threshold; One selected job.

*Sources:* ADM-Q11

### M-173 · 'Active users' definition

What counts as an active user, and where should the card link?

**Decision:** Status active. Candidates + recruiters with status active; confirm the link target.

*Rejected:* Signed in last 30 days; Active candidates only.

*Sources:* ADM-Q12

### M-174 · 'Recent platform activity' source

What feeds the Overview 'Recent platform activity' list?

**Decision:** Latest 5 audit events. Audit log incl. system/user events (M-162).

*Rejected:* Separate event feed; Both merged.

*Sources:* ADM-Q13

### M-175 · 'Matching quality' card

The Analytics card 'Matching quality needs more than a score' shows fixed statuses. Keep it as copy or build real metrics?

**Decision:** Explanatory translatable copy. Not data.

*Context:* Decision: admin dashboard numbers are real from the DB; this card shows statuses, not numbers. If M-067 stores feedback, (b) becomes cheaper.

*Rejected:* Real metrics; Remove the card.

*Sources:* ADM-Q14

### M-176 · 'Shortlist conversion' definition

How is 'Shortlist conversion' computed (33% today)?

**Decision:** Shortlisted / applications. Share of applications shortlisted.

*Rejected:* Shortlisted / all candidates; Shortlist entries / profile views.

*Sources:* ADM-Q15

### M-177 · What the date range applies to

Does the Overview/Analytics date range apply to KPI cards and other widgets, or only to the chart?

**Decision:** Chart only; KPIs all-time. 'All time' in captions.

*Rejected:* Every widget.

*Sources:* ADM-Q16

### M-178 · Funnel counts

Should funnels (admin Recruitment funnel, recruiter Overview funnel) show current counts per stage or how many applications ever reached each stage?

**Decision:** Ever reached (stage history). Funnel = applications that ever reached each stage; data view = current stage; withdrawn excluded.

*Context:* Audits disagree: ADM-Q17 recommends (a), REC-RQ-62 (b). Recommend (a): a funnel is meant to show drop-off, and stage history is stored anyway (M-069, M-075).

*Rejected:* Current counts.

*Sources:* ADM-Q17, REC-RQ-62

### M-179 · Funnel graphic

Should the funnel shapes scale with the counts?

**Decision:** Fixed shapes, real numbers. Keep the Figma shapes.

*Rejected:* Shapes scale to counts.

*Sources:* ADM-Q18

### M-180 · 'Reviewed outreach' definition

What does 'Reviewed outreach' / 'Outreach drafts reviewed' count?

**Decision:** Count outreach entries. Each sent outreach was reviewed by the recruiter.

*Rejected:* Explicit 'reviewed' flag.

*Sources:* ADM-Q19

### M-181 · What the AI does for report briefs

OpenAI helps with the admin 'report brief' (decided). What exactly does it do?

**Decision:** Transcribe + AI summary. Voice note transcribed; AI executive summary in the admin's language added to the CSV export.

*Context:* Decision: OpenAI 'report brief' admin helper. Transcription needs an OpenAI speech model, which is not among the three decided models (gpt-5.5, gpt-5.4-mini, text-embedding-3-large) - confirm. Also confirm CSV stays the format.

*Rejected:* 'Improve brief' rewrite; Transcribe only.

*Sources:* ADM-Q36

### M-182 · Report voice note

The label says 'Record or attach'. Is a voice note attached only or also recorded in the browser?

**Decision:** Attach only. mp3/m4a/wav/webm/ogg up to 25 MB, stored on disk.

*Rejected:* Attach + record in browser.

*Sources:* ADM-Q37

### M-183 · Report re-download and period

Does 'Download again' re-serve the same file, and can the admin pick the report period?

**Decision:** Stored snapshot + period select. Identical file re-served; this week / last week / last month.

*Rejected:* Regenerate, 'this week' fixed.

*Sources:* ADM-Q38

### M-184 · Candidate 'profile views' metric

How are profile views ('18, up 12%, from verified companies') counted?

**Decision:** 30-day window. One view per approved recruiter per day; last 30 days vs previous 30.

*Rejected:* 7-day window.

*Sources:* CAN-Q72

## Files, privacy & GDPR

### M-185 · Upload safety rules

Uploads are stored on the server disk (decided). What checks and access rules apply to CVs, photos, KYC/evidence and lesson files?

**Decision:** Validate + private storage. Extension + MIME + magic bytes + size; random names outside the web root; served only through authenticated, ownership-checked endpoints; KYC/evidence PDF/JPEG/PNG up to 10 MB, replaceable only while onboarding is in progress or rejected.

*Context:* Decision: uploads stored on the server disk. CAN-Q75 and REC-RQ-11 agree.

*Rejected:* (a) + antivirus scanning; (a) with 5 or 20 MB KYC.

*Sources:* CAN-Q75, REC-RQ-11

### M-186 · Retention of KYC and evidence files

How long are identity, KYC and evidence files kept after an admin decision?

**Decision:** Delete 30 days after decision. Keep only the decision record.

*Context:* Audits disagree: ADM-Q64 and CAN-Q41 recommend 30 days after the decision; REC-RQ-12 90 days after approval; legal to confirm. Recommend (a) (two audits). ADM-Q64 also asks which admin permission opens these files (a new documents permission, see M-156).

*Rejected:* Delete 90 days after approval; Keep until account deletion.

*Sources:* ADM-Q64, REC-RQ-12, CAN-Q41

### M-187 · Privacy flags and CV access

The candidate privacy flags are enforced nowhere today. What does each flag do, and when can a recruiter open the CV file?

**Decision:** Enforce three flags. Not discoverable: hidden from search/shortlists but not from companies applied to; CV hidden: file only for companies applied to; no matching consent: out of AI matching both ways; every CV download logged and visible to the candidate.

*Context:* CAN-Q68 and REC-RQ-43 agree.

*Rejected:* CV for applicants only; CV on screen only.

*Sources:* CAN-Q68, REC-RQ-43

### M-188 · Scope of candidate 'Delete my data'

'Delete my data' becomes real with payment records kept (decided). What exactly is deleted?

**Decision:** Full erasure, payments kept. Account, profile, files, applications, alerts, messages, AI caches, enrolments and certificates deleted (verify page says revoked); Stripe subscription cancelled; payment records kept with payer name anonymised; signed out.

*Context:* Decision: 'Delete my data becomes real (payment records kept)'. CAN-Q70 recommends (a), subject to legal review.

*Rejected:* Wipe data, keep login.

*Sources:* CAN-Q70

### M-189 · Recruiter account deletion

Recruiters have no account deletion. Add it, and what happens to their jobs, applications, messages and payments?

**Decision:** Add it; close jobs, keep payments. Jobs closed, author anonymised, payments kept for accounting.

*Rejected:* No recruiter deletion.

*Sources:* REC-RQ-79

### M-190 · Data export

Export is a small CSV today. What should candidates and recruiters get?

**Decision:** ZIP of JSON + files. Candidate: JSON + CV, photo, certificates; recruiter: account, company, jobs, notes, messages, payments + a CSV summary.

*Context:* CAN-Q71 and REC-RQ-78 agree on a full export.

*Rejected:* CSV only.

*Sources:* CAN-Q71, REC-RQ-78

### M-191 · Terms and Privacy consent

The sign-up consent checkbox is demo text. How is consent recorded and where do legal texts live?

**Decision:** Required checkbox, versioned texts. Store terms version and accepted date; legal texts versioned per language in the DB at public /legal pages.

*Rejected:* Passive 'you agree' line; Links to external pages.

*Sources:* SHR-Q12

### M-192 · Self-hosting fonts

Fonts load from Google Fonts, which sends visitor IPs to Google. Self-host them?

**Decision:** Self-host. Font files in the client.

*Rejected:* Google Fonts + consent banner; Keep as is.

*Sources:* SHR-Q36

## Shell & UI

### M-193 · Brand name

The app uses 'Local WorkMan', 'Local Worksmen', 'Local Workman', 'matchpoint.' and the repo 'eujobs'. Which name is used everywhere (emails, Stripe statement, certificates), and does the English tagline 'AI Job Portal' stay in all languages?

**Decision:** 'Local WorkMan' + fixed logo. Corrected logo raster; tagline kept as part of the brand.

*Rejected:* 'Local Worksmen'; Another name.

*Sources:* SHR-Q2

### M-194 · Header 'Search anything'

Search only jumps between pages today. What should it search?

**Decision:** Page jump only. Translated, accent-insensitive page labels.

*Context:* Audits disagree: SHR-Q17 recommends (a), CAN-Q5 (b). Recommend (b) for v1: no design for grouped results and no new endpoint; server search can follow.

*Rejected:* Pages + server search; Server search only.

*Sources:* SHR-Q17, CAN-Q5

### M-195 · Profile menu and sidebar identity

What do the profile menu and sidebar identity show per role, and where does 'Profile' go?

**Decision:** Per-role details from the server. Subtitle: candidate plan, recruiter company, admin role; photo or initials; Profile goes to My profile / Company / admin Settings; email under the name.

*Rejected:* Name and email only; Keep today's labels.

*Sources:* SHR-Q18

### M-196 · Sidebar promo card

The candidate sidebar promo 'Complete your profile' always links to onboarding step 1. What should drive it?

**Decision:** Upsell, then complete profile. Free: plan upsell with the localised price; on the plan but incomplete: 'Complete your profile' to the checklist; otherwise hidden.

*Context:* SHR-Q20 recommends (a); CAN-Q3 recommends the complete-profile card, which is part of (a).

*Rejected:* Complete-profile only; Remove the card; Admin-managed promo.

*Sources:* SHR-Q20, CAN-Q3

### M-197 · Footer content

What replaces the footer note 'Interactive demo, changes saved on this device'?

**Decision:** Copyright + legal links. '(c) {year} {brand}' plus Terms, Privacy, Imprint links.

*Rejected:* Remove, no links; Version or environment.

*Sources:* SHR-Q23

### M-198 · Demo notes on sign-in pages

What replaces the demo notes on the sign-in/up pages and the admin sign-in notice?

**Decision:** Remove; restricted-admin notice. Admin notice: access restricted to authorised staff, accounts created by an administrator.

*Rejected:* Security tip or Terms links; 'Test environment' note.

*Sources:* SHR-Q13

### M-199 · Admin Settings page

Admin Settings is a placeholder (also the target of 'Profile'). What goes on it?

**Decision:** Minimal settings. Name, password change, language, email notification preferences.

*Context:* Related: M-010 (password change), M-093 (bell).

*Rejected:* Keep the placeholder.

*Sources:* ADM-Q45

### M-200 · Help FAQs

There are 6 identical FAQs for all roles and 5 contain demo text. Where do FAQs live, and are they per role?

**Decision:** DB collection per audience. Per-language text and audience list, seeded with rewritten answers, no admin editor in v1.

*Context:* Audits disagree: SHR-Q44 recommends (a), REC-RQ-88 (b); both remove the demo FAQs. Recommend (a): FAQs are per-role content, and translation files are reserved for UI text (M-141).

*Rejected:* Translation files per role; DB + admin FAQ editor.

*Sources:* SHR-Q44, REC-RQ-88

### M-201 · Overview 'Compare' checkbox

The Compare checkbox on the recruiter Overview talent card does nothing. Remove or wire it?

**Decision:** Remove it. Drop the checkbox.

*Rejected:* Carry into Find candidates compare.

*Sources:* REC-RQ-39

### M-202 · Overview greeting

Should 'Good morning, {name}' use the local time of day and the user's first name?

**Decision:** Local time + first name. Computed on the client.

*Rejected:* Fixed 'Welcome back'.

*Sources:* REC-RQ-63

### M-203 · Recruiter settings 'privacy' wording

Recruiter settings copy mentions 'privacy' but there is no Privacy tab. Fix the copy or add settings?

**Decision:** Change the copy. Remove the word.

*Rejected:* Add recruiter privacy settings.

*Sources:* REC-RQ-80

## Infrastructure & dev

### M-204 · Client URL while the server is local

While the server runs locally, which client URL do emails, Stripe return URLs and certificate links use, and can the Vercel client talk to the local API?

**Decision:** Localhost; tunnel for demos. CLIENT_URL = localhost with the Vite dev proxy; a Vercel deployment uses a public tunnel only for demos until the API is hosted; Stripe CLI forwards webhooks.

*Context:* Decision: server runs locally for now; client on Vercel later; Stripe CLI available.

*Rejected:* Vercel URL for everything; Host the API now.

*Sources:* SHR-Q46

### M-205 · IDs and one Job collection

Job ids are slugs plus timestamps and candidates reach them through a demo prefix bridge. Switch to database ids?

**Decision:** MongoDB ids, one Job collection. Read by both roles; drop slug ids and the prefix bridge.

*Context:* Decision: MongoDB Atlas db 'eujobs'.

*Rejected:* Keep slug ids.

*Sources:* REC-RQ-27

### M-206 · Pagination of admin tables

Admin tables have no pagination (except audit). Add server pagination?

**Decision:** Server pagination on 4 tables. Users, Applications, Payments, Audit; others return all rows.

*Rejected:* Return every row.

*Sources:* ADM-Q47

## Seed & demo data

### M-207 · Course price reconciliation

Admin and learner catalogues disagree on most course prices (and one title and category). Which values win in the seed?

**Decision:** Learner catalogue values. They match the seed payments (e.g. Alex paid £49 for a course).

*Context:* Audits disagree: ADM-Q28 and REC-RQ-66 pick learner values; CAN-Q57 picks admin values. Recommend (a): two audits agree and seed payments already match it. Prices per currency follow M-130.

*Rejected:* Admin values.

*Sources:* ADM-Q28, CAN-Q57, REC-RQ-66

### M-208 · Seed vs Figma numbers

Computed numbers won't reproduce the Figma values, and recruitment/oversight show 5 people with no accounts. How is the seed built?

**Decision:** Coherent seed, computed numbers. Seed coherent entities; create the people shown as seeded candidates; make the pending account a recruiter applicant.

*Context:* Decision: 'Seed loads today's demo data + demo accounts'; admin dashboard numbers are real from the DB.

*Rejected:* Seed extras to match Figma.

*Sources:* ADM-Q49

### M-209 · Seed lessons and quizzes

The 12 existing courses need real lessons and quizzes for the builder. How are they seeded?

**Decision:** Text lessons + 5-question quiz. Written once and committed with the seed.

*Rejected:* Lesson titles only, as drafts; Generated by OpenAI at seed time.

*Sources:* ADM-Q60

### M-210 · Re-localise the US-based seed

Seed jobs and people are US-based (San Francisco, USD), which the EU 27 + UK + Remote picker would never show. Re-localise them?

**Decision:** Move to EU/UK cities and currencies. Same demo content, European locations.

*Context:* Decision: country picker EU 27 + UK + Remote; seed loads today's demo data (otherwise unchanged).

*Rejected:* Keep US data.

*Sources:* REC-RQ-86
