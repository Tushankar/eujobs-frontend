# Local WorkMan: backend build plan

This file is the single build guide for the Node.js backend of **Local WorkMan** (EU AI job portal) and for the client changes that go with it. A fresh Claude Code session builds the system from this file, one phase at a time. The owner reads along.

**Precedence when sources disagree:** settled facts (§1) and this plan, then `docs/backend/DECISIONS.md` (its own header says this plan's §3 wins), then the audits in `docs/backend/audits/`. The audits give per-screen detail (file:line of every static item). Where an audit proposal conflicts with a decision, the decision wins.

**Citation key**

| Tag | Meaning | Where to read it |
|---|---|---|
| M-001 … M-210 | final decisions (the owner accepted every recommendation) | `docs/backend/DECISIONS.md` |
| OD1 … OD16 | owner decisions taken after the 210 (all recommended defaults accepted) | Appendix C |
| C1 … C26 | contradictions, with the adopted resolution | Appendix A |
| U1 … U44 | under-specified items, with the adopted default | Appendix B |
| P1 … P17 | prep checklist | §7 |
| S | settled fact (binding; listed in §1) | §1 |
| OQ-n | question the owner answered on 2026-10-30 (now a settled rule) | "Open questions" below |
| A: file §x | audit reference | `docs/backend/audits/<file>.md` |

---

## 0. Start here

### 0.1 Reading order

1. This §0 and **Open questions for the owner** (right after §0; all answered, kept as the record).
2. `CLAUDE.md` (working rules; they apply to every step).
3. §1 (environment), §2 (architecture) and §3 (product rules) of this file.
4. The section of the phase you are building in §6, plus the §4 (data model) and §5 (API) rows it touches.
5. For per-screen detail, the audit sections listed for that phase in Appendix D (each static item with file:line, storage call sites, copy to replace).
6. `docs/CONVENTIONS.md` and `docs/DESIGN_SYSTEM.md` for client structure and styling. Three conventions change with the backend: data comes from the API through RTK Query (not `useLocalStorage`), copy lives in i18n files (English copy still follows Figma), and the "no backend / saved on this device" wording goes away.
7. `DECISIONS.md` for the full text of any cited M-id. `IMPLEMENTATION_PLAN.md` is frontend history only; do not follow it for this work.

### 0.2 Working rules for the build session

- **CLAUDE.md first.** Before each step, state a short plan with a verify check per item. Write the minimum code that solves the step. Make surgical changes and match the existing style.
- **No silent assumptions.** Anything not covered by this plan, `DECISIONS.md` or the audit detail is asked with **AskUserQuestion** (batch the questions, recommended option first). Append each answer under "Owner answers" at the end of the Open questions section, so later phases see it.
- **Nothing static.** Every number, list, name, date, price and label comes from the database, is computed, or is a translation key. Enum labels are i18n keys. Validation limits come from the server (`GET /api/v1/meta/config`). Each phase deletes the mock `data/` files, hooks and `useLocalStorage`/`useSharedLocalStorage` call sites that it replaces.
- **Plain JavaScript only** (ES modules, `.js`/`.jsx`). No TypeScript, no Docker, no Redis, no queue services (S).
- **Secrets.** Never print, log, echo, paste or commit any `.env` value or key prefix. Refer to variable names only. Test output must not contain tokens or keys.
- **Git.** Do not commit or push unless the owner asks.
- **Verify in a real browser.** Every phase ends with its API tests and its browser verification (§6), run in the local Chrome through the e2e harness at 1440 px and 375 px where UI changed. Report results honestly: pass or fail per scenario, with screenshot paths. Never end a phase with "not tested". If a check cannot run, stop and ask.
- **Stop at every phase boundary.** Report what was built, the decisions implemented, test results and any open item. Wait for the owner before starting the next phase.
- **Keep the app green.** At every phase end: `npm run lint` and `npm run build` in `client/`, `npm test` and `npm run lint` in `server/`, and the full route sweep (`node e2e/run.js sweep`).
- **New screens without Figma** (U44) are built from existing components and `docs/DESIGN_SYSTEM.md`, then checked in a real browser (OD16).

### 0.3 Per-phase protocol

1. **Start.** Re-read the phase. Check its prep items (§7). Every open question is answered (see below). Ask the owner only about something this plan does not cover. Write the step plan with a verify check per step.
2. **Build, in this order:** server (model → schemas → service → routes → API tests), then client (API slice → screens → delete the replaced mocks), then the `seed:demo` additions, then the e2e scenarios.
3. **End.** Run `npm test` (server), `npm run lint && npm run build` (client), `node e2e/run.js phase-N` and `node e2e/run.js sweep`. Report and stop.

---

## Open questions for the owner (all answered 2026-10-30)

These came up while writing this plan. The owner accepted the recommended option for every item on 2026-10-30. The rules are applied in §3–§6 and cited as OQ-n. The questions stay here as the record.

**OQ-1. Moderation outcomes for company and message reports** (Phase 10; M-164, M-167)
M-164 lets users report jobs, profiles, companies and messages. M-167 defines "Restrict" only for a job (paused + locked) and a profile (hidden from discovery).
- **(a) Chosen.** Company and message cases offer **Dismiss** only. To act, the admin uses decided account actions: Suspend the recruiter through Account review (M-165), or Restrict the candidate's profile (M-167). The thread excerpt is the reported message plus up to 5 earlier messages of that thread.
- (b) Not chosen: new effects (restricting a company pauses all its jobs; restricting a message hides it).

**OQ-2. Lifting a recruiter suspension** (Phase 4; M-165, M-151)
- **(a) Chosen.** A suspended recruiter is listed in Account review with an **Approve** action (reactivation, permission `users.deactivate` plus `moderation.manage`). The "approved" email is sent (M-092).
- (b), (c) Not chosen: suspension is final; reactivation from the detail page.

**OQ-3. Course suggestion rules** (Phase 8; M-114)
- **Candidates, (a) chosen.** Gap skills = required skills missing from the profile across the candidate's saved jobs, applied jobs and the first 10 jobs of the For-you list (M-053, U8 for Free). Published candidate courses not yet enrolled are ranked by how many gap skills their skill tags match; courses that match none are not suggested.
- **Recruiters, (a) chosen.** The admin tags each recruiter course with one pipeline category (OD5). Suggest up to 3 published recruiter courses the recruiter has not enrolled in, whose category holds the most active applications in the company's pipeline. Reason: "{n} active applications at {stage}". Courses whose category holds no active applications are not suggested.

**OQ-4. Seed identities, applicant history and salary rates** (Phases 3–5; M-208, M-210, OD8, OD9, U42)
1. **(a) Chosen.** Two accounts named James Chen:
   - the candidate from the recruiter mock data (`@example.com`);
   - the recruiter applicant, which is the admin row's demo account (`+james` plus-alias), with a company and KYC files, status `pending_review`.
2. **(a) Chosen.**
   - Every seeded applicant has a complete profile with approved checks.
   - Applicants other than Emma Wilson get one historical Plus payment row (`source: seed`, no receipt link, dated before their first application) and no active subscription, which is the M-119 lapsed state.
3. **(a) Chosen.** Seed salaries are converted from the USD mock values at 1 USD = 0.75 GBP = 0.87 EUR = 3.75 PLN = 9.6 SEK, then rounded to 1,000 (U42).

**OQ-5. Admin metric definitions** (Phase 10; M-208, A: admin §1.1, §1.20). Chosen definitions:
- Overview "Applications": all applications except withdrawn.
- Overview "Companies registered" and Analytics "Company registrations": every company created at onboarding step 2, any status.
- Analytics "Recruiter accounts": every recruiter user.
- Overview "Verification checks in review": candidate verification submissions in review only (recruiter KYC is counted in "Pending user reviews").

**OQ-6. Small interpretations** (all adopted as recommended)
- a. "Open to remote" in discovery (M-055, M-132) = profile work preference `remote`.
- b. Admin format locale (M-133) = the language's default region, as for Remote (M-132): en-IE, es-ES, fr-FR.
- c. Email cap (OD9): over-cap non-critical emails are not sent and are logged `skipped_cap`. The CV-request email (U19) counts as non-critical.
- d. Server-built CSV files (admin exports, report snapshots under M-183, the recruiter export summary under M-190) use the requester's language for headers and labels, with a UTF-8 BOM.
- e. The U33 "undo window" = choosing a stage again in that application's stage select; within 10 minutes no email goes out.
- f. "Verified" (discovery filter M-056, admin column state M-169, the Overview KPI) = every check M-023 requires for that candidate is approved. While partial, the column shows "n of 3 verified".
- g. The U5 location mismatch caps the score at 49. It applies when either of these is true:
  - the candidate's profile country is not the job's country (on-site or hybrid), or is not in a remote job's non-empty eligible list;
  - the candidate's work preference differs from the job's.
- h. Recruiter sign-up with an already-registered email returns 409 `EMAIL_TAKEN`; the screen offers sign-in and reset links.
- i. A remote job's eligible-countries list is optional; empty means all EU 27 + UK. It is shown as a badge on cards and details, and as an "Eligible in" filter inside the Remote view.
- j. The admin permission catalogue in §3.13 is adopted as written.
- k. Recruiter deletion also deletes the company's notes, shortlist and activity timeline. The company record keeps its display name and logo for past applications and threads.

### Owner answers

| Question | Answer | Date |
|---|---|---|
| OQ-1 | (a) Dismiss only for company and message cases; excerpt = reported message + up to 5 earlier | 2026-10-30 |
| OQ-2 | (a) Approve (reactivate) a suspended recruiter from Account review | 2026-10-30 |
| OQ-3 candidates | (a) gap skills from saved + applied + first 10 For-you jobs | 2026-10-30 |
| OQ-3 recruiters | (a) course pipeline category; top 3 by active applications | 2026-10-30 |
| OQ-4.1 | (a) two James Chen accounts (candidate; recruiter applicant) | 2026-10-30 |
| OQ-4.2 | (a) complete applicants; one historical Plus seed payment each (Emma active) | 2026-10-30 |
| OQ-4.3 | (a) 1 USD = 0.75 GBP = 0.87 EUR = 3.75 PLN = 9.6 SEK, rounded to 1,000 | 2026-10-30 |
| OQ-5 | all recommended definitions | 2026-10-30 |
| OQ-6 a–k | all as recommended | 2026-10-30 |
| P1-Q1 permission groups | keep the 5 Figma groups; new ids appended: `dashboard.view` → Finance & reporting, `jobs.view` → Recruitment, `documents.view`, `learning.view`, `ai.view`, `ai.manage` → Governance | 2026-10-30 |
| P1-Q2 Owner name | the seeded Owner admin is named "Workspace admin" | 2026-10-30 |
| P1-Q3 demo cities | Alex, Emma and Sarah (Acme Studio) in London (GB); James's applicant company in Dublin (IE) | 2026-10-30 |
| P1-D1 recruiter sign-up fields | `jobTitle` (≤ 100) is stored on the recruiter's user; the phone is collected at recruiter sign-up and stored in E.164, unverified until onboarding step 4 (A: recruiter A2, Part C). `libphonenumber-js` is therefore installed in Phase 1. | 2026-10-30 |
| P1-D2 unexpected errors | `INTERNAL_ERROR` (500) is the code for unexpected failures, alongside the §2.3 codes | 2026-10-30 |
| P1-D3 reset on an unverified account | a password reset marks the email verified and advances the status: candidate `unverified` → `active`, recruiter `unverified` → `onboarding`. Invited admins get no reset email; they use their invite link. | 2026-10-30 |
| P1-D4 seed behaviour | `seed:demo` keeps `emaillogs` and `jobruns`, so re-seeding never resets the Gmail cap. `seed:catalog` creates the three system roles only when missing, so admin edits to them survive a re-seed. | 2026-10-30 |
| P1-D5 plan feature text | the Free and Plus feature lists in en/es/fr in `server/seed/data/catalog.js`, derived from §3.3 | 2026-10-30 |
| P1-D6 deferred items | built in the phase that first uses them: `requireApprovedRecruiter` (Phase 4), `requireEntitlement` (Phase 5), `/_test/ai/fail-next` (Phase 9), admin invite routes (Phase 10), `/meta/countries` (Phase 2) | 2026-10-30 |
| G-1 location autocomplete (decided after the plan; changes M-032) | Every city field uses Google Places (New) through a **backend proxy only** (`places` module, §2.16), replacing free text: candidate profile and onboarding location, recruiter job location, company city, job alert location and the discovery filters. `GOOGLE_PLACES_API_KEY` (in `server/.env`, verified) never reaches the browser; it is the Housbe server key, so it shares Housbe's Google billing and quota and can be swapped for an own key by changing the setting. Endpoints: autocomplete and place details, with a per-user rate limit, a small cache and one Google session token per typing session. Stored as `{ countryCode, city, placeId }` only, never coordinates. Google accepts at most 15 region codes, so the proxy asks Google for cities and keeps only EU 27 + UK on the server. Google's `languageCode` = the user's UI language (en/es/fr). The header country picker stays the seeded 29-country list (not Google). Google Translation is not enabled and not used; content translation stays on OpenAI (M-144). First needed in Phase 3 (browser check: type a few letters, pick a city, see it saved; API test with Google stubbed). The draft Privacy text says typed place searches are sent to Google. | 2026-10-30 |
| P2-Q1 recruiter sweep before approval | until Phase 4 approves Sarah, the e2e sweep sets her `active` in `eujobs_test` through `/_test/db` just before visiting the recruiter workspace; James (`onboarding`) covers the onboarding pages. Seed and product rules are unchanged. | 2026-10-30 |
| P3-Q1 Places search area | every autocomplete call sends one fixed Europe rectangle as Google's `locationRestriction` (lat 27.5 to 71, lng −31.5 to 35), and the server still keeps only EU 27 + UK. The box covers Cyprus, Malta, the Canary Islands, Madeira and the Azores (none excluded). No user location is sent or stored. Live check (P18): "Las Palmas", "Funchal", "Limassol" and "Valletta" each return results in en/es/fr. | 2026-10-30 |
| P3-Q2 Spanish part of P3-13 | the UI part runs in English; the Spanish part runs in the signed-in browser page: a Spanish user's city request returns Spanish names ("Lond" → "Londres"). The Phase 11 Spanish sweep covers the Spanish screen. | 2026-10-30 |
| P3-Q3 AI-only UI before Phase 9 | the My profile "Ai Job Summary" button and its template code are removed, and the CV page's Compare buttons and panel are hidden, until Phase 9 adds both with the real AI (M-062, M-027) | 2026-10-30 |
| P3-D1 Places country (P18 result) | a suggestion's country = the last part of Google's secondary text matched against the EU 27 + UK names in the request language (`Intl.DisplayNames`, plus Google's "UK" in English); without secondary text the main text is used (Luxembourg). Live: 84 of 84 cities matched in en/es/fr. Place details confirm the ISO code before anything is saved. | 2026-10-30 |
| P3-D2 onboarding preferences | work preference and city required, salary optional. At completion the header country = the profile country, and the language follows it unless explicit (M-134). | 2026-10-30 |
| P3-D3 external certificates | name and issuer required, ≤ 100 each; issued month required, expiry month optional; an https URL and/or a file (PDF/JPEG/PNG ≤ 10 MB) optional; at most 20 | 2026-10-30 |
| P3-D4 right to work | one entry per region (EU, UK), so at most 2; the expiry date is required for `visa_permit` | 2026-10-30 |
| P3-D5 languages | unique codes, at most 20 | 2026-10-30 |
| P3-D6 minimum salary | whole number 1–100,000,000 in the currency of the profile city's country, period `year` or `month`; another currency is refused | 2026-10-30 |
| P3-D7 CV versions | "No readable text" when fewer than 50 non-space characters are extracted. Deleted versions leave the list and do not count toward the 20; version numbers are never reused. | 2026-10-30 |
| P3-D8 evidence submissions | a new submission for an entry only when its last one was rejected or reset (U27). The admin queue lists the oldest first, default filter "In review". | 2026-10-30 |
| P3-D9 Edit profile dialog | holds full name, headline, city, about, years, skills, work preference, availability and minimum salary; availability defaults to `open_to_opportunities` | 2026-10-30 |
| P3-D10 mocks still in use | mock exports still imported by Find jobs (Phase 4), the recruiter applicant view (Phase 6) and Data & account (Phase 12) stay until those phases. The Data & account "Delete resume reference" row is removed now (CV versions live on the server; M-028 forbids deleting the live CV). | 2026-10-30 |
| P3-D11 seeded people | Alex, Emma and Sofia in London; Oliver in Berlin; James Chen (candidate) in Amsterdam; Daniel in Paris; Aisha in Stockholm. The 6 recruiter-mock candidates are complete; Alex stays incomplete. Right to work `citizen_settled` in their region (Sofia also EU). English plus the local language. Portfolio links on `<name>.example.com` (no LinkedIn URLs that could be real people). Verified phones from Ofcom's fictional London range +44 20 7946 0xxx (the +44 7700 900xxx mobile range was planned, but libphonenumber rejects it, so M-004 normalisation would fail). Generated sample evidence files. Alex's $120k → £90,000 a year (OQ-4). | 2026-10-30 |
| P3-D12 seed photos | generated 400×400 initials images in the Figma avatar colours (the client assets hold no candidate photos) | 2026-10-30 |
| P3-D13 fixture packages | `e2e/fixtures/make.js` builds the files with the server's test helpers (`server/test/helpers/fixtures.js`: pdfkit, sharp, archiver from the server's packages), so the API tests and the browser checks use the same builders and nothing extra is installed in `e2e/` (the accepted plan was to install the three packages in `e2e/`) | 2026-10-30 |
| P3-C1 builder call: translations shipped early | onboarding, the completeness checklist cards, the city field, the privacy settings and the new shared `errors`/`validation`/`common` keys ship in en/es/fr, because P2-01 (French) and P2-11 (Spanish) open those screens with the missing-key check. The new `cv`, `profile`, `verification` and `moderation` namespaces stay English until Phase 11. Awaiting owner review. | 2026-10-30 |
| P3-C2 builder call: Phase 2 checks adjusted | P2-12 expects Emma's seeded photo in the header (initials are checked on the Owner). P2-19 checks only namespaces that have an es/fr file and lists the English-only ones: a temporary exception, removed in Phase 11 (task 5). Awaiting owner review. | 2026-10-30 |
| P3-C3 builder call: signed URL lifetime | the expiry is rounded down to 5-minute steps, so a URL is valid 10 to 15 minutes (U39 said 15) and repeated `/me` answers give the same avatar URL; a new URL on every `/me` reloaded the image and left a request hanging (P2-11 flake). Awaiting owner review. | 2026-10-30 |
| P3-C4 builder call: file serving robustness | a request the browser cancels (`ECONNABORTED`) is ignored by `GET /files/:id`; a file still locked by a download (Windows `EBUSY`) is logged and left on disk instead of failing the delete. Awaiting owner review. | 2026-10-30 |
| P3-C5 builder call: seed institutions | the recruiter mocks name no institutions, so the seed uses University of the Arts London (Emma), Berlin University of the Arts (Oliver), Parsons School of Design (James Chen), Royal College of Art (Sofia), ArtCenter College of Design (Daniel), University College London (Aisha); Alex keeps California College of the Arts from his mock. Roles start in January, education runs September to June of the mock years. Awaiting owner review. | 2026-10-30 |
| P3-C6 builder call: U27 details | deleting a profile entry also withdraws its evidence still in review; a changed full name resets the identity check (identity is linked to the account name, §3.2); re-saving an entry unchanged resets nothing. A reset is stored as `resetAt` on the submission (field added to §4.2's `verificationsubmissions`); reset submissions leave the "In review" queue. Awaiting owner review. | 2026-10-30 |
| P3-C7 builder call: CV rules | a new upload becomes the live version (the CV page's behaviour before the backend); extracted text is capped at 100,000 characters; a file that passes the type checks but cannot be parsed counts as "No readable text". The Compare component was deleted rather than hidden (P3-Q3); Phase 9 rebuilds it. Download-log rows are written now (one per view; Range requests after byte 0 are not logged); `GET /candidate/cv/downloads` and its screen come with Phase 4 (P4-13). Awaiting owner review. | 2026-10-30 |
| P3-C8 builder call: endpoints beyond §5 | `PUT`/`DELETE /candidate/profile/certificates/:id/file` (attach or remove a certificate file), `GET /admin/moderation/verification/:id` (submission detail), `PUT /candidate/onboarding/preferences` as the only step endpoint (the story step uses the CV upload). `GET /candidate/verification` returns each check's accepted `evidenceTypes`, so the client holds no mapping. `GET /plans` uses the session when one is sent (a bad token counts as anonymous); currency = the `currency` query, else the header country's currency, else EUR. Awaiting owner review. | 2026-10-30 |
| P3-C9 builder call: field and flow details | certificate verification uses the certificate's own file (no upload); replacing or removing that file resets its check. A phone number becomes unverified as soon as a code is requested for a different number (M-004); the phone form takes one of the 28 countries plus the number (no calling-code list). The "No work experience yet" / "No formal qualification" opt-outs are allowed only while the list is empty, and adding an entry clears them. LinkedIn links may use a country subdomain (`uk.linkedin.com/in/…`); links and URLs are at most 300 characters (new limit `profile.url`). Photos are stored as WebP. A declared MIME of `application/octet-stream` is accepted when extension and magic bytes agree. An unchanged city keeps its stored name without a Google call. Completeness stores `{ done, total, complete, missing }`; the item list is computed per request. Awaiting owner review. | 2026-10-30 |
| P3-C10 builder call: onboarding plan step | "Continue with Free" no longer writes a local Free plan (that silently downgraded subscribers, M-129); after the demo Plus checkout, onboarding is completed and the page opens `/candidate/ai-insights`. Awaiting owner review. | 2026-10-30 |
| P3-C11 builder call: seed files | `seed:demo` deletes every purpose folder under the upload root before recreating files (the `_test` folder is not a purpose folder, so development seeding never touches it). Awaiting owner review. | 2026-10-30 |
| P4-Q1 later-phase actions on Phase 4 screens | hidden until built (as P3-Q3): Apply (Phase 6), recruiter "Start a conversation" (Phase 7), the stage select on the recruiter's candidate profile (Phase 6), the recruiter AI job summary and match narrative (Phase 9), and the recruiter Overview Applications KPI, momentum chart and funnel (Phase 6). The local rule-based AI summary template is deleted. | 2026-10-30 |
| P4-Q2 suspending an active recruiter | Account review gets a status filter: Pending review (default, oldest first), Active, Suspended, Rejected. Actions: pending → Approve, Reject or Suspend; active → Suspend; suspended → Approve (OQ-2); rejected → none until resubmitted. | 2026-10-30 |
| P4-Q3 company field limits | legal and display name 2–120; industry 2–80; website ≤ 300, `https://` added when missing, the host must contain a dot (one rule for onboarding and the Company page); business email ≤ 254; business address 5–300; registration details optional ≤ 200; description optional at onboarding, 20–3,000 and required on the Company page | 2026-10-30 |
| P4-Q4 Find jobs salary filter | "Minimum salary per year" in the view currency (U25): keeps jobs whose annualised maximum (the minimum when no maximum is set) is at least the value; jobs without a salary are left out while the filter is set | 2026-10-30 |
| P4-D1 onboarding step 1 | edits full name, job title and phone; the email is read-only (no email change in v1, C21). It always counts done, because sign-up filled it. A changed phone is unverified (M-004). | 2026-10-30 |
| P4-D2 onboarding step state | derived: company done when the company exists; KYC done when identity and registration files exist; phone done when verified. Submit needs all three. | 2026-10-30 |
| P4-D3 resubmission | a rejected recruiter can reopen every step, edit, then Resubmit from the review page (M-152) | 2026-10-30 |
| P4-D4 account decisions | reasons ≤ 300 (the moderation limit); Approve's reason optional. KYC files get `deleteAfter` = decision + 30 days (M-186), replaced by a later decision. | 2026-10-30 |
| P4-D5 skill suggestions | the most-used required and preferred skills of published jobs in the company country, prefix-matched on the typed text, top 12; all countries when fewer (M-034) | 2026-10-30 |
| P4-D6 wizard fields | required languages (≤ 10, unique codes, minimum level) on the Experience step; visa sponsorship and the Remote eligible countries on Location & work; the company is shown read-only on step 1 (M-042) | 2026-10-30 |
| P4-D7 wizard draft | saved on the server at the first valid step-1 Continue, then on every Continue; a draft checks formats only, publishing checks everything (M-039, M-041) | 2026-10-30 |
| P4-D8 job salary | optional; when set, the period is required (default `year`) | 2026-10-30 |
| P4-D9 "N relevant" fallback | on-site and hybrid jobs: the M-054 population living in the job country or with right to work there; remote jobs: work preference `remote`; at least 1 required skill. Stored on job save and by the 03:00 `relevance-nightly` slot (U7). | 2026-10-30 |
| P4-D10 discovery "Recommended" sort | skill overlap with the chosen match job (default: the newest published job); without one, the most recently updated profiles first | 2026-10-30 |
| P4-D11 recruiter access to a candidate profile | open when the candidate is listable in some country (email verified, discoverable, consenting, complete, not restricted) or applied to the company; otherwise 404 | 2026-10-30 |
| P4-D12 CV requests | one pending request per company and candidate; approval shares exactly one version; the Resume tab lists the shared versions; the candidate's CV page lists pending requests and the download log | 2026-10-30 |
| P4-D13 "CV updated" activity | recorded for the companies that shortlisted, noted or requested that candidate | 2026-10-30 |
| P4-D14 mocks and translations | mock files still imported by unmigrated screens (admin Jobs, Overview and content moderation; the pipeline; candidate Applications) stay until their phase (as P3-D10). The new jobs, discovery and company namespaces stay English until Phase 11; the onboarding screens (the `auth` namespace) ship in en/es/fr. | 2026-10-30 |
| P4-C1 builder call: seeded companies | Acme Studio (Sarah) plus one approved company for each other company in the mock jobs, each with an invented `@example.com` recruiter; the 12 mock jobs at OQ-4 rates in the U42 cities; James Chen's pending applicant company is "Chen Talent Partners Ltd" in Dublin with generated KYC files. Dublin and Lisbon were added to the seed time zones. Awaiting owner review. | 2026-11-02 |
| P4-C2 builder call: seeded activity | Acme's shortlist holds Oliver Park and James Chen (candidate); Alex has 2 saved jobs; Emma has 18 profile views in the last 30 days and 16 in the 30 before (for the Overview trend). Sarah's Find candidates and Shortlists default to the United Kingdom view, where the picker rule (Q33) leaves out Oliver (Berlin) and James Chen (Amsterdam): her Shortlists page in that view is empty until she switches the country to Germany or the Netherlands (they are not counted as "no longer available", which covers only candidates who stopped being listable). Awaiting owner review. | 2026-11-02 |
| P4-C3 builder call: endpoints beyond §5 | `GET /admin/moderation/accounts/:userId` (account detail with the allowed actions); the account list answers its status counts, so the Moderation tabs use them. `/recruiter/overview/momentum` is not built (P4-Q1). Awaiting owner review. | 2026-11-02 |
| P4-C4 builder call: shared fixes | `Modal` reads `onClose` through a ref so typing in a dialog no longer moves the focus (the salary filter kept 1 character); `PillBadge` forwards `data-*` attributes; requesting a recruiter phone code no longer refetches the onboarding state (a stale answer overwrote "verified"); phone verification recomputes completeness only for candidates. Awaiting owner review. | 2026-11-02 |
| P4-C5 builder call: client leftovers | `features/recruiter/company/data/company.js` stays (still imported by `useJobListings` for the Phase 6 pages, as P4-D14). The candidate Overview AI insight card and AI status line were removed with the other AI surfaces (P4-Q1). The job status enum order is now published, paused, draft, closed (the tab order). Awaiting owner review. | 2026-11-02 |
| P4-C6 builder call: field error keys | the CV request reason and the account decision reason use their own error keys (generic "This field is required.") instead of `reason`, whose text "Give a reason for the rejection." belongs to the verification review. Email templates skip empty body lines (a CV request without details). Awaiting owner review. | 2026-11-02 |
| P4-Q5 English-only namespaces in P2-11 | temporary exception until Phase 11 (as P3-C2): P2-11 ignores missing Spanish keys in namespaces that have no Spanish file (the candidate Overview now uses `findJobs`, P4-D14), and the 375 px overflow line while those raw keys show. Spanish users see the Overview in English, as before Phase 4. | 2026-11-02 |
| P4-C7 builder call: earlier-phase checks adjusted | P3-08 allows the 403 of the Account review counts (the Moderation page loads them, refused like the verification queue). P3-06 clears the code field by keyboard (a re-render restored a value cleared through the DOM, so two codes were typed into it). `npm run mail:test` knows `recruiter_approved`, `recruiter_rejected`, `recruiter_suspended` and `cv_request`. Awaiting owner review. | 2026-11-02 |
| P5-Q1 admin Payments page before Phase 10 | the sample rows move into `features/admin/payments/data` as a plain array in the new row shape (no localStorage, no recording), used only by the admin Payments page until Phase 10 (as P3-D10, P4-D14) | 2026-11-02 |
| P5-Q2 course buying before Phase 8 | the buy action on paid courses is hidden on the candidate and recruiter Learning pages until Phase 8 (as P4-Q1); free courses still add locally. The server course checkout path is built and API-tested now and wired to the screens in Phase 8. | 2026-11-02 |
| P5-Q3 Stripe customers of tests and e2e | every Stripe customer the app creates carries `metadata.db` and `metadata.userId`; `seed:demo` deletes all customers of its own database (and their test clocks), because it wipes all users of that database. Seed customers also carry `metadata.seed=true` (P5-10). | 2026-11-02 |
| P5-Q5 subscription currency on the promo card | a current subscriber's price shows in the subscription's own currency on Billing (C14). The promo card shows a price only to Free users, in the header country's currency, which Checkout also charges. P5-07's last check: Emma switches her country to Poland, Billing still shows £9 and the promo stays hidden. | 2026-11-02 |
| P5-C1 builder call: Checkout payment methods | the pinned API version `2026-10-28.endive` (the SDK default, §2.10) rejects `payment_method_types` on Checkout ("no longer supported"). Sessions send `allowed_payment_method_types: ['card', 'link']` instead; Stripe then reports `payment_method_types: ['card', 'link']` on the session, so C13 and U40 hold (API test and P5-01). Apple and Google Pay appear as wallets of the card option. Awaiting owner review. | 2026-11-02 |
| P5-C2 builder call: webhook forwarding and handling | Stripe CLI 1.55.3 needs an event selection, so `npm run stripe:listen` and the e2e harness pass `--all-snapshot`; the server ignores types it does not handle. Each handler fetches the object again by id with the pinned API version, so event order and the account's event API version do not matter. Objects whose user is not in this database (the development and test databases share the sandbox) are ignored. The CLI's announced signing secret is hidden in its output and in `stripe.log`. Awaiting owner review. | 2026-11-02 |
| P5-C3 builder call: payment row rules | one row per invoice: a renewal that fails and is later paid on retry becomes `paid`; `renewal_failed` is sent once per invoice (first failure); `plan_ended` is sent whenever paid turns into Free (cancel, unpaid or "leave past due"); a charge counts as `refunded` only when fully refunded; a failed row stores Stripe's failure code (e.g. `card_declined`), never its English message. Unique indexes on `stripe.invoiceId` and `stripe.checkoutSessionId` (§4.2 listed them as plain indexes). `subscriptions` also stores `amountMinor` and `startedAt` (Billing; late events of an older subscription never overwrite a newer one). Awaiting owner review. | 2026-11-02 |
| P5-C4 builder call: endpoints beyond §5 | `GET /candidate/subscription` (the Billing card: status, period, cancel flag, amount in the subscription currency). `POST /payments/checkout-sessions` takes `from`, a path inside the buyer's own workspace; Stripe returns to `/{role}/checkout/return?session_id=…&from=…`, and a cancelled Checkout goes straight back to `from`. `GET /payments/checkout-sessions/:id` answers `fulfilled` once the webhook has applied the purchase. The Portal opens for any candidate with a subscription record (also after it ended, for invoices). Awaiting owner review. | 2026-11-02 |
| P5-C5 builder call: seed and Stripe catalogue | the Product, the 8 Prices and the Portal configuration are shared by `eujobs` and `eujobs_test` (one sandbox): `seed:catalog` finds them by lookup key and `metadata.app = localworkman` and creates only what is missing (a changed amount gets a new Price that takes over the lookup key). The Portal configuration has customer-detail edits off (P6 did not list them). Seed course rows keep the mock's day offsets before 2 Nov 2026; the 5 historical Plus months (OQ-4.2) are dated 40 days before the seed run, so Phase 6 must date the seeded applications after that; references follow the payment dates and `seed:demo` restarts the sequence. Course and Enrollment models hold only the purchase fields until Phase 8. Awaiting owner review. | 2026-11-02 |
| P5-C6 builder call: client details | PlusGate became `RequirePlan` (route `handle.entitlement`), used by AI insights and Job alerts. One upgrade dialog per candidate workspace (a small Redux slice) opens on any 402 `PLAN_REQUIRED`, from the promo card and from Billing. The candidate return page is reachable during onboarding (the plan step pays there, then onboarding completes and AI insights open, P3-C10). The new `billing` namespace ships in en/es/fr now, like the new `shell` and `onboarding` keys: the upgrade dialog sits in the shell of every candidate page, so P2-01 (French) and P2-14 (Spanish) request its keys (as P3-C1). The Learning notice about the demo checkout became "Buying courses opens soon." and the admin "Subscriptions" caption reads "Paid Plus plans". `CheckoutDialog` keeps the stable-`onClose` focus fix. Awaiting owner review. | 2026-11-02 |
| P5-C7 builder call: earlier-phase checks adjusted | P2-12 now expects Emma's subtitle "Plus" (she is the seeded Plus subscriber, §3.20). The e2e page checks ignore Stripe's own pages and requests (hosted Checkout and Portal are other origins). Awaiting owner review. | 2026-11-02 |
| P5-Q4 Emma's Plus payment row | built from her real first invoice: `source: seed`, the seed date, the hosted-invoice link and the invoice id (a webhook for that invoice adds nothing). The mock's 12 Oct Emma Plus row is dropped; the mock course rows stay `source: seed` rows without links. | 2026-11-02 |
| P6-Q1 Alex's seeded applications | none. Alex (Free, incomplete) stays the gate demo account; only the six pipeline applicants get applications. | 2026-11-02 |
| P6-Q2 new-applications email timing (OD14) | the first application nobody has been told about opens a 1-hour window; the email goes out when it ends, counting every application since the last email; the next email is at least 1 hour after the previous one. | 2026-11-02 |
| P6-C1 builder call: endpoints beyond §5 | `GET /recruiter/overview/funnel` and `GET /recruiter/overview/momentum?tz=&period=this_week\|last_week`. `GET /recruiter/applications` lists active applications unless `status=not_selected\|withdrawn`, and answers `counts { active, not_selected, withdrawn }` for the job filter. `GET /recruiter/pipeline` answers each stage's `activeCount` and the `limits`. Candidate job cards and details carry `application { id, status }`; the recruiter profile carries the company's `applications`; the recruiter CV answer carries `applied` (the CV sent with each application). Awaiting owner review. | 2026-11-02 |
| P6-C2 builder call: application rules | "Active" = not withdrawn and not not-selected (KPI, counters, board, stage removal). A not-selected candidate cannot re-apply to the same job (the §4.2 index excludes only withdrawn). The gate order is plan (route) → completeness → job → consent → CV version; a missing consent answers `consent: required`. Withdraw is refused only for an already withdrawn application (the UI hides it for not selected). Rejecting a not-selected application again answers 409; undo is choosing any stage. A history step is stored per move; the candidate sees a step only when the status changes. Awaiting owner review. | 2026-11-02 |
| P6-C3 builder call: email details | A rejection without "Email the candidate" sends nothing and leaves the last told status unchanged, so a later checked rejection is emailed. An email skipped by the toggle counts as told. Withdrawing drops a pending status email. The new-applications email goes to the company's active recruiter and does not count withdrawn applications. New fields: `applications.rejectNotify`, `applications.recruiterNotified`, `jobs.applicantsEmailedAt`; the scheduler passes the tick time to task handlers. Awaiting owner review. | 2026-11-02 |
| P6-C4 builder call: Manage stages | "Applied" can be renamed but keeps its category and place; other stages may take any of the 6 categories; the dot colour follows the category. Each row edits name and candidate status; changes save at once. Errors: 13th stage / below 2 → `stages: too_many / too_few`; stage with active applications → `IN_USE { count }`; first stage → `CONFLICT`. Awaiting owner review. | 2026-11-02 |
| P6-C5 builder call: recruiter access to applicants | any application to the company (also withdrawn) opens the profile, notes, activity and shortlist (P4-D11). The Resume tab lists the CV sent with each application whatever `resumeVisible` says (the candidate consented when applying, M-073); a deleted one reads "CV removed by the candidate" (M-030). Activity texts name the job and stage. Awaiting owner review. | 2026-11-02 |
| P6-C6 builder call: momentum | the "Applications" series counts applications received each day, whatever happened to them since; the chart scale fits the busiest day. Awaiting owner review. | 2026-11-02 |
| P6-C7 builder call: seeded applications | Emma → Senior Product Designer (12 days ago, Screening), James Chen → Product Designer, Growth (10, Shortlisted), Oliver → Senior UX Designer (9, Interview), Sofia → Senior Product Designer (6), Aisha → Product Designer, Growth (3), Daniel → Senior UX Designer (2); each move one day apart, by Sarah, with activity events; no tasks pending. Emma's application predates her live subscription, which Stripe starts at seed time (the 40-day rule holds for the other five). Awaiting owner review. | 2026-11-02 |
| P6-C8 builder call: client | The new `applications` namespace is English until Phase 11 (as P4-D14); the consent message ships in en/es/fr in `validation`. The mock AI job summary dialog and button are deleted with the mock job data that fed them (as P3-C7; Phase 9 rebuilds them). The admin Applications sample rows moved into the admin feature (as P5-Q1). `useJobListings`, the candidate job mocks and the recruiter `company.js` mock are deleted (no callers left). The badge is hidden at 0; the counters poll stops while the tab is hidden. Awaiting owner review. | 2026-11-02 |
| P6-C9 builder call: e2e setup | Gate-ready candidates are built through the API (profile, entries, photo, CV, phone code) with a real Plus subscription through Stripe; only the three approved checks are written to the test database. P6-08 re-subscribes Daniel so an application lands today; P6-09 cancels Emma's real subscription, so later Phase 6 scenarios do not use Emma. Awaiting owner review. | 2026-11-02 |
| P7-Q1 Free reader in P7-01 and P7-06 | Alex is incomplete (P6-Q1), so he is neither discoverable nor an applicant and M-085 forbids messaging him. These scenarios use a complete, discoverable London candidate on Free, built through the API by the e2e (`completeCandidate` with `plus: false`, no Stripe). Alex's seed is unchanged. | 2026-11-02 |
| P7-Q2 Job alerts for a Free candidate with alerts (M-119) | any candidate can read their own alerts (`GET /candidate/job-alerts` is not plan-gated). A Free candidate with alerts sees the list, every card marked "Paused", and a notice that alerts are paused while on Free, with Upgrade. Create, edit, pause and resume answer 402; Delete stays allowed. A Free candidate without alerts sees the usual gate. The sidebar chip stays. | 2026-11-02 |
| P7-Q3 seeded threads | Two Acme threads in English, dated days ago (no email scheduled), each with `outreach` activity. Sarah → Emma about Senior Product Designer: Emma replied, and her reply is unread by Sarah (recruiter badge 1). Sarah → Oliver about Senior UX Designer: unread by Oliver (Free, read-only). | 2026-11-02 |
| P7-Q4 seeded alerts | Emma owns both `alerts.js` alerts, with no city: "Remote product design roles" (daily, country Remote) and "Senior design roles in fintech" (weekly, country GB). | 2026-11-02 |
| P7-C1 builder call: conversation endpoints | `POST /conversations` takes `candidateId` (recruiter, optional `jobId` of the own company) or `jobId` (candidate, the job decides the company); a second start for the same pair adds to the existing thread (M-086). `POST …/read` answers 204. `GET /conversations` lists threads with `counterpart { id, name, imageUrl, headline }`, `job`, `lastMessagePreview` (140 characters) and the own side's `unread`; `GET …/messages` answers the thread and every message, oldest first. Nothing about the plan is in any recruiter answer (M-087). Awaiting owner review. | 2026-11-02 |
| P7-C2 builder call: messaging rules | "Applied to" (M-084) = any application to the company, in any status (as P6-C5). A recruiter may start with an applicant (any status) or a candidate listable in some country (the P4-D11 rule, which is also when the profile opens); a restricted profile counts as neither. `outreach` activity is recorded only when a recruiter's start creates the thread (M-180); `message_reply` once per candidate answer after a recruiter message. Opening a thread marks the other side's messages read. The recruiter side of a thread is the company: its active recruiter gets the email and every recruiter of the company would see the count. Awaiting owner review. | 2026-11-02 |
| P7-C3 builder call: new-message email | one pending `email.message` task per thread and recipient side, due at the later of "oldest unread message + 15 min" and "last email to that side + 60 min"; at the due time it re-checks the oldest unread message and waits again if needed, and sends nothing once everything is read. A send skipped by the toggle or the cap still counts as the side's last email. Awaiting owner review. | 2026-11-02 |
| P7-C4 builder call: alert rules | The alert keeps the UI language of its creation for the translated labels (only that language's labels match, as Find jobs). Country is fixed at creation; editing keeps it; a Remote alert takes no city (`placeId: invalid`), and a city in another country answers `placeId: other_country`. Instant alerts skip a job that is no longer visible when the tick runs; a candidate with two matching alerts gets one email per alert. A job is sent at most once per alert, instant or digest (`alertmatches`); deleting an alert deletes its matches. Digest slots use `User.timezone`, UTC when unknown. `lastDigestAt` moves at every evaluated slot, also when nothing matched; a paused alert (by the candidate or the plan) is not evaluated, so its first digest after resuming lists the jobs since its last digest. Awaiting owner review. | 2026-11-02 |
| P7-C5 builder call: server details | The scheduler gained `tickJobs` (checks run on every tick with the tick time) for the digests. The email layout shows `params.items` as a list (the alert jobs: "Title · Company · City", "Remote" in the recipient's language for remote jobs). The four new emails ship in en/es/fr; `npm run mail:test` knows them. Awaiting owner review. | 2026-11-02 |
| P7-C6 builder call: client | The new `messages` and `jobAlerts` namespaces ship in en/es/fr (the M-088 template must be in the recruiter's language, and the shell opens in French and Spanish in P2-01 and P2-14), with `shell:nav.messages` and the new `validation` field keys. "Messages" sits after Applications in both sidebars. The counters query moved to `app/counters.js` (both roles poll it). `PlanGate` was split out of `RequirePlan`; the Job alerts route is no longer wrapped, as the page shows the gate itself (P7-Q2). The recruiter's Message button is on the profile sidebar; the candidate's "Message the company" is in the application activity dialog (which closes first, so dialogs never stack) and on job details after applying; both open the existing thread instead when there is one. Open threads and the inbox poll every 15 s like the counters, paused in hidden tabs. `alerts.js` and `useJobAlerts` are deleted. Awaiting owner review. | 2026-11-02 |
| P7-C7 builder call: earlier-phase checks adjusted | P2-10 clears the code field by keyboard (the P3-06 race: a re-render restored the wrong code and the 6-character limit dropped the right one; it failed once at 375 px in the Phase 7 baseline). P4-17 hides a complete Free candidate built through the API, because since Phase 6 every seeded complete candidate has applied to Acme and an applicant's profile stays open (P6-C5); it failed in the baseline. Awaiting owner review. | 2026-11-02 |
| P7-A1 owner change at Phase 7 approval (to the start rule of P7-C2; the owner called it "P7-C1") | A withdrawn application does **not** count as "applied to a company" for **starting** a conversation, on **both sides**: a candidate needs an application to the company in any other status; a recruiter needs an application that is not withdrawn, or a candidate listable now. Existing threads stay open both ways (also `POST /conversations` adding to one). A withdrawn-only applicant's profile still opens (P6-C5); its answer carries `canStartConversation: false`, so the recruiter sees no Message button, and the candidate's "Message the company" is hidden on a withdrawn application. | 2026-11-03 |
| P7-A2 owner change at Phase 7 approval (to the digest rule of P7-C4; the owner called it "P7-C3") | Every daily and weekly digest lists only jobs still open (as before), **at most 20, the newest**; when more match, the email says "These are the 20 newest. See all {total} jobs:" with a link to Find jobs with the alert's keywords (`/candidate/jobs?q=…`; Find jobs now reads `q`). Only the listed jobs are recorded as sent. This covers the first digest after a resumed plan, an alert the candidate resumed, and large weekly digests (owner chose "every digest"). Limit `jobAlert.digestItems` = 20. | 2026-11-03 |
| P8-Q1 Phase 8 split (owner) | **8a:** data model; admin builder (Details, Lessons, Quiz authoring, Preview, uploads with progress, publish rules, lock, unpublish); admin list without the M-111 stats; learner catalogue, course details and lesson viewer (lessons open and stream; no progress recording); free enrol and purchase; seed of the 12 courses, quizzes and enrollments; mock deletion. Scenarios P8-01, 02, 03, 04, 08. **8b:** heartbeats and completion, quiz taking, certificates (P9 server fonts, PDF, public page, revoke, re-issue, email), Certificates & badges on My profile, admin stats and learners list, recruiter stats, OQ-3 suggestions. Scenarios P8-05, 06, 07, 09, 10, 11, 12. Each half ends with `npm test`, client lint and build, its scenarios and the sweep, then a report to the owner. | 2026-11-03 |
| P8-Q2 seeded recruiter course categories (OQ-3) | one per stage: Talent Strategy & Workforce Planning → `applied`; Hiring Technology & Product Talent → `screening`; Fair Hiring & Inclusive Selection → `shortlisted`; Structured Interviewing & Better Evidence → `interview`; Employer Brand & Candidate Experience → `offer`; Recruiting Leadership & Team Coaching → `hired` | 2026-11-03 |
| P8-Q3 certificate fonts (P9, server part) | Inter only: `Inter-Regular.ttf`, `Inter-SemiBold.ttf` and `Inter-Bold.ttf` from the official rsms/inter v4.1 release, with its OFL licence (`Inter-OFL.txt`), in `server/assets/fonts`. Manrope was tried from the official google/fonts repository, but it exists there only as a variable font, and fontkit (pdfkit's font library) crashes when it subsets a variable font's bold instance, so the certificate uses Inter Bold for its headings. Inter renders Latin Extended (checked: "Łukasz Żółć", "Ştefan Ţară", "Dvořák", "Ærø", "Ğüç"). | 2026-11-03 |
| P8-Q4 QR code package | `qrcode` (1.5.4) installed in `server/` for the certificate QR (§2.14). The 3 moderate `npm audit` findings predate it (`archiver` → `readdir-glob` → `minimatch`; the only fix is a breaking downgrade of archiver) and are left as they are. | 2026-11-03 |
| P8-C1 builder call: course limits and publish rules | Limits (`LIMITS.course`, served by `/meta/config`): title 3–80 and category 2–40 (the old modal's maxima, A: admin §9.1), summary 20–300, about / lead 20–1,000, tagline ≤ 120, designed for ≤ 200, outcomes 1–6 of ≤ 200, skill tags 1–10 of ≤ 50, lessons ≤ 60, lesson title 3–120, link ≤ 2,048 (audit), duration 1 s – 600 min, a price 1 – 99,999,999 minor units, pass mark 1–100. Publishing needs: category, level, summary, cover, outcomes, skill tags, `about` (candidate) or `lead`, tagline, designed for and pipeline category (recruiter); all 8 prices or Free (U24); at least one lesson, each complete (video: file and duration; PDF: file; text: Markdown; link: URL); at least one quiz question. A published course must stay publishable after every edit (as live jobs, M-037). A refused publish answers 422 with every problem and `params.tab` (`details`, `lessons` or `quiz`), and the builder shows the list "Before you can publish" while the course is not published. Unpublished → published runs the same checks; unpublishing is allowed only from published; a course never returns to draft. Awaiting owner review. | 2026-11-03 |
| P8-C2 builder call: seed courses | Each seed course has 3 lessons (U42) titled with the first three lesson titles of its mock; their texts (407–484 words) and the 5 questions each were written once and committed in `server/seed/data/courseContent/` (M-209). A text lesson's duration is its reading time at 200 words a minute, rounded up to a minute. Courses are dated published 60 days before the seed run. The three seed course payments now carry their course id, and each gives one `seed` enrollment dated at the payment (Alex and Sarah with lesson 1 done the next day; Emma none), which locks those three courses. Recruiter "Fair Hiring & Inclusive Selection" keeps the learner title (M-207). Awaiting owner review. | 2026-11-03 |
| P8-C3 builder call: endpoints beyond §5 | `GET /admin/courses/:id` (the builder: every field, signed file URLs, `currencies`, `locked`, `problems`); `GET /admin/courses?audience=` answers `stats { total, published, paid, activeLearners }` for the page cards; lessons are `POST /admin/courses/:id/lessons`, `PATCH`/`DELETE …/lessons/:lessonId`, `PUT …/lessons/order { lessonIds }`; `PUT …/quiz { passMark, questions[{ text, type, options[{ text }], correct: [option indexes] }] }` replaces the quiz (option ids are regenerated, which is safe because the quiz locks at the first enrollment); `PATCH …/status { published \| unpublished }`. `POST /admin/uploads?purpose=` takes the purpose in the query so the size limit applies before the body is read. Learner side: `GET /courses/:id` answers `curriculum` (each lesson `done`, `open` or `locked`), `included` counts per lesson type plus quiz questions, and the own `enrollment`; the catalogue also lists unpublished courses the user is enrolled in (M-109: buyers keep access); `GET /learning/courses/:id/lessons/:lessonId` answers the content with `previousId` and `nextId`. Free enrolment in a paid course answers 403. Awaiting owner review. | 2026-11-03 |
| P8-C4 builder call: files | Lesson videos and PDFs are streamed by multer to `UPLOAD_DIR/_incoming` (never held in memory), checked by their first bytes, then moved into the purpose folder; a refused or oversized upload leaves nothing. Covers are re-encoded with sharp. Video URLs live 6 hours (U39), other course files 10–15 minutes. Replacing or deleting a lesson's file deletes the old one. Lesson order is the order of the `lessons` array (no separate `order` field). Awaiting owner review. | 2026-11-03 |
| P8-C5 builder call: client | New namespaces `learning` and `courses` stay English until Phase 11 (as P4-D14). Until 8b, the candidate "Suggested for you" section, the "Skills to explore" card and the recruiter suggestions are hidden (as P4-Q1); the "Learning Plus active" and "Learning profile active" pills and the prototype notes are removed (M-100). The free-preview card appears only when a course has a preview lesson. Durations use `Intl.DurationFormat` (`format.duration`). Lessons reorder by drag or by Move up / Move down buttons; the builder reads a video's duration in the browser (a recorded WebM has none in its header, so the builder seeks to its end) and the field stays editable. The "Recruiter learning" access caption is one i18n text ("One-time course access" or "Free course access"). Find jobs reads `?q=` (P7-A2). Awaiting owner review. | 2026-11-03 |
| P8-C7 builder call: certificates | The code is `LWM-XXXX-XXXX` from 32 unambiguous characters (no 0, O, 1, I), drawn again on the rare collision. The PDF is A4 landscape with the Inter fonts (P8-Q3): the brand, "Certificate of completion", the holder's name, the course title as authored, the date in the holder's language and region (OQ-6b) and time zone, the code, the check link and a vector QR code, and a note that certificates do not verify workplace skills; its chrome is `certificate.*` in `server/i18n` (en/es/fr). A name change (PATCH `/me`, the candidate profile, the recruiter account step) re-issues every valid certificate under the same code, in the holder's current language, and deletes the old PDF. A revoke needs a reason (1–300 characters, as moderation) and only a valid certificate can be revoked; audit type `learning.certificate_revoked`. The public check answers a tombstone (C18) with its code and status only. `certificate_issued` links to the course page, with the public check as the second link. Endpoints beyond §5: `GET /courses/:id` also answers the own `certificate` and `enrollment.quizBestScore`. Awaiting owner review. | 2026-11-03 |
| P8-C8 builder call: completion and quiz | The client sends a heartbeat when a video starts, pauses, seeks, changes speed or ends, and every 15 s while it plays (the interval comes from `/meta/config`). The server credits `min(min(Δwall, 15 s) × min(rate, 2), Δposition)` when the position moved forward by no more than `Δwall × min(rate, 2) + 2 s` (timer jitter), caps the credit at the duration and completes at 90 %. Only enrolled learners are tracked (a preview visitor is not). A link lesson completes when "Open the resource" is clicked; text and PDF lessons when shown. A quiz question counts only when exactly its correct options are chosen (single and multiple choice); the score is the share of questions right, rounded. Before every lesson is complete, an attempt answers 409 `LOCKED` (`reason: lessons`). Every attempt is stored; the first pass sets the completion and issues the certificate, later passes issue nothing. Options are reshuffled on every request (questions keep their order). Awaiting owner review. | 2026-11-03 |
| P8-C9 builder call: stats and suggestions | Purchased = paid course payment rows; revenue = their amounts per currency (refunds excluded), largest first, at most 3 lines then "+n more" (U34). An admin without `finance.view` gets no revenue field at all, per row or in total. The page totals sit under the table: "Page totals: … enrolled, … purchased, … completed · revenue …". The learners list (`/admin/courses/:id/learners`, `learning.view`) shows learner, source, enrolment date, lessons done, best score and certificate, with Revoke (`learning.manage`). Candidate gap skills come from every application status; they are ordered by how many of those jobs ask for them; course tags match by key. Recruiter suggestions count applications that are not withdrawn or not selected; ties go by course title; the reason names the stage category. The candidate's "Suggested for you" is always shown, with a short text when there is nothing to suggest; the mock's "Review gap evidence" link to AI insights is gone until Phase 9. Awaiting owner review. | 2026-11-03 |
| P8-C10 builder call: client | The public check `/certificates/:code` uses the legal pages' public layout with the language picker; its `certificates` namespace ships in en/es/fr. The quiz page is `/…/learning/:courseId/quiz` for both roles; the course pages show a final-quiz card (locked, open with the best score, or the certificate). "Certificates & badges" sits under the external certificates on My profile; the recruiter sees course certificates on the candidate's Skills tab. New `learning`, `courses`, `profile` and `discovery` texts are English until Phase 11. Awaiting owner review. | 2026-11-03 |
| P9-Q1 Phase 9 split (owner) | **9a, matching:** the `openai` client, cache, daily cap and `AI_UNAVAILABLE`; embeddings with their triggers and backfill; policies and versions with the default v1; scores, `matchresults` and relevance (replacing the Phase 4 fallback); score display for every role (Plus cards and For you, recruiter Recommended sort, talent cards and KPI, admin %); the admin AI & matching page (policies, Suggest, oversight, AI status); consent exclusion. Scenarios P9-02 … 05, P9-13 and the score half of P9-01. **9b, generated text:** match explanations and narratives, job summaries, the insights pages with the learning plan (P9-Q2), CV AI with the Compare panel, the profile Ai Job Summary button, Translate, explanation feedback and its admin aggregate, the cap and failure messages. Scenarios P9-01 and P9-06 … 12. Each half ends with `npm test`, client lint and build, its scenarios and the sweep, then a report to the owner. | 2026-11-03 |
| P9-Q2 learning plan (owner; built in 9b) | The Skill gap and Improve profile "learning plan" card stays and moves to the server: the candidate's plan is a list of skill names on the profile (same limits as profile skills) with add and remove endpoints, replacing `lwm.ai-insights.learning-plan`. Learning's "Suggested for you" (OQ-3, P8-C9) ranks courses by the gap skills **plus** the learning-plan skills. The Phase 9 browser checks add a skill to the plan, remove one, reload, and see that it persists. | 2026-11-03 |
| P9-Q3 confirming the CV snapshot (owner) | Confirm (M-027) sets the headline to the snapshot role and the years of experience to the snapshot years, and adds the snapshot skills that are not yet on the profile, up to the 12-skill limit (existing skills are kept). The confirm dialog lists exactly what will change. | 2026-11-03 |
| P9-Q4 location-only policy (owner) | A policy needs **skills or experience** on (location only caps a mismatch, so it cannot score alone). Saving or creating a policy with only location on answers 422 (`signals: skills_or_experience`) and nothing is saved; the screen says "Turn on skills or experience". An API test and a browser check (in P9-05) cover it. | 2026-11-03 |
| P9-Q5 admin Jobs list in 9b (owner) | 9b adds a minimal real list: `GET /admin/jobs` (`jobs.view`), the admin Jobs table on it, and the AI summary with Regenerate on real jobs. An API test refuses the list without `jobs.view`; a browser check opens a real job's AI summary, regenerates it and sees the text change. The 9b handoff records exactly what Phase 10 task 3 still adds, so Phase 10 extends this list. The `useJobs` mock is deleted only if nothing else imports it (the report says whether it was). | 2026-11-03 |
| P9-Q6 French step of P9-01 (owner) | As P4-Q5: in P9-01's French step only, missing keys in namespaces that have no French file are ignored (and the 375 px overflow they cause); the narrative itself must be French. Removed in Phase 11 with the other exceptions. | 2026-11-03 |
| P9-C1 builder call: the AI client | `lib/ai.js` uses the Responses API with a strict JSON schema and reasoning effort `low`; the answer language is named in English from `Intl.DisplayNames` (no server i18n key). API tests get a stub through `setAiClient` (installed for every test file by `test/setup.js`, as Places); the e2e server runs `NODE_ENV=test` with the real OpenAI, so §2.9's "stub in test mode" is done by injection and no new variable was added. The stub names its own models (`stub-*`) and the model is part of every embedding hash and cache key, because API tests and the e2e share `eujobs_test` (the first e2e run reused the seed test's stub vectors until this was fixed). The cap reserves one generation atomically before the call and gives it back when the call fails. `AppConfig('ai')` keeps the last successful and failed call for the AI status. Limits `ai` and `matching` are in `config/limits.js`. Awaiting owner review. | 2026-11-03 |
| P9-C2 builder call: embeddings | Texts per U6 (the job level and language names in English). Candidates are embedded with matching consent and some profile text; jobs once out of draft (published, paused or closed). The source hash covers model and text; a stored vector with the same hash is reused, so `seed:demo` calls OpenAI only for new texts (it keeps the embeddings until the backfill, then deletes the orphans). Batches of 16 texts. Consent off (or an empty profile) deletes the vector and the results on the next tick. A job recompute also embeds candidates whose text is new, so nobody waits for the nightly run. Awaiting owner review. | 2026-11-03 |
| P9-C3 builder call: recompute | One `matching.recompute` task per candidate, job or "all", due at once, so a change reaches the scores on the next tick (within 60 s in development). Triggers: every profile save (also a new live CV), the consent switch, a job edit or status change (not drafts), saving the active policy and activating one. A job save still stores its count at once from the current scores. `relevance-nightly` is a full recompute. A result below Good stores no label. Awaiting owner review. | 2026-11-03 |
| P9-C4 builder call: policies | Name 3–60, unique ignoring case (`name: taken`); description 20–500 (A: admin §1.19). Every signal save is a new version, drafts too; weights and thresholds are the U5 defaults (the screen has no editor for them). Only a draft can be activated (the previous active one becomes a draft) or archived; an archived policy is read-only (409). Audit types `policy.created`, `updated`, `saved`, `activated`, `archived` (category Policy). `seed:demo` resets the policies to the default v1, as it removes custom admin roles, so every e2e run starts the same. Endpoints: `GET/POST /admin/matching/policies`, `PATCH …/:id`, `PUT …/:id/signals`, `POST …/:id/activate`, `POST …/:id/archive`, `POST /admin/matching/policies/suggest { name, description }` → `{ description }` (≤ 500), `GET /admin/matching/oversight?jobId&candidateId`, `GET /admin/ai/status`. Awaiting owner review. | 2026-11-03 |
| P9-C5 builder call: display | Plus candidates with matching consent get `match { score, label }` on job cards and details ("93% · Strong match"; a score below Good reads "41% match"); Free and consent-off candidates get `match: null`. Recommended sort and For you: scored jobs by score, then overlap, then recency; pairs without a score follow U8. `GET /candidate/overview` answers `recommended.byScore`, and the KPI caption then reads "Good match or better for your profile". Recruiters: Recommended = score, then overlap, then last update; relevant talent, the KPI and talent cards use score ≥ Good. Talent cards now also leave out applicants (§3.8, A9; the Phase 4 code left out only shortlisted ones). Oversight: the top 4 of the job's market population that have a score (any label), with code evidence (M-057); the narrative comes with 9b. The recruiter job page says "N relevant profiles". Awaiting owner review. | 2026-11-03 |
| P9-C6 builder call: admin AI & matching client | The page runs on the API: edit name and description, signals, Make active, Archive draft, the version history, Improve description (OpenAI), the oversight job picker with selectable cards and code evidence, and the AI status (models, last successful and failed call). The local audit records are gone (the server audits). New `aiMatching` namespace, English until Phase 11. Every policy write updates the cached list at once, and the new policy and notice travel in the navigation state (leaving `/policies/new` remounts the page), so the editor never shows another policy. `StatusBadge` forwards `data-*`. Awaiting owner review. | 2026-11-03 |
| P9-C7 builder call: e2e | Emma's seeded profile prefers remote work, so OQ-6g caps every UK on-site or hybrid job at 49 for her; P9-01 and P9-02 use her Remote view (restored afterwards). The relevance check reads the population of the job's own market (Remote for a remote job). P9-05 activates the default policy again at its end. Real OpenAI in 9a: the seed's new texts, the edited brief in P9-04, the P9-13 candidate and one Improve description call. Awaiting owner review. | 2026-11-03 |
| P9-C8 builder call: earlier-phase checks adjusted | P4-11 (the Free overlap label) now uses Alex: it used Emma, who is the seeded Plus subscriber and sees scores since Phase 9. Awaiting owner review. | 2026-11-03 |
| P9-C9 builder call: the P4-06 timeout (owner asked for the cause after 9a) | The one-off failure at 375 px ("Timed out after waiting 30000ms") came from `page.waitForNetworkIdle()` after the SVG logo upload: that message is Puppeteer's network-idle timeout (a `waitForFunction` says "Waiting failed"), and the failure screenshot already showed the new SVG, so the upload had finished. Ruled out: a hidden background page (instrumented: the recruiter page stays visible and `requestAnimationFrame` runs at ~60/s). Not reproduced in 7 instrumented runs (6 alone, 1 in a full Phase 4 run), so the request that stayed open is unknown; a network-idle wait waits for every request of the page (the 15 s counters poll, signed image loads), so one slow request anywhere fails it. Fix: the scenario waits for the upload's own `POST /recruiter/company/logo` response (registered before choosing the file) instead of network idle. The temporary diagnostics were in commit `14e66e7` and are removed. Awaiting owner review. | 2026-11-03 |
| P9-C10 builder call: AI texts (9b) | Every prompt and JSON schema is in `modules/ai/ai.prompts.js`; the instructions forbid inventing facts and using protected characteristics. A text is cached by its prompt, model and facts (profile facts with the live CV text, job facts, code evidence) and the reader's language, so any change to a fact makes a new entry and nothing is invalidated by hand. Each insights page answers its code evidence at once and the AI narrative separately (`GET /candidate/insights/narrative?section=&jobId=`), so a failure or the daily limit never hides the evidence. The recruiter's Match insights narrative counts toward the recruiter's own cap (OD13 covers every user except admins). Awaiting owner review. | 2026-11-03 |
| P9-C11 builder call: endpoints beyond §5 (9b) | `GET /candidate/insights/narrative`; `DELETE /candidate/profile/skills/:skill` (the Undo of "I have this skill"); `PUT` and `DELETE /candidate/learning-plan/:skill` (P9-Q2; removing also works on Free); `GET /admin/jobs` (P9-Q5); `GET /admin/jobs/:id/ai-summary` and `POST …/regenerate` (`jobs.view`); `GET /admin/matching/feedback` (`ai.view`); `POST /candidate/cv/drafts { versionId }`. Answers gained: CV versions carry `snapshot`, `pendingSnapshot` and `drafts`; the recruiter's work history carries entry ids (for Translate); `GET /learning/suggestions` carries `planSkills`; `GET /candidate/overview` carries `recommended.byScore`. Awaiting owner review. | 2026-11-03 |
| P9-C12 builder call: Translate scope | Candidate job details: brief, responsibilities and the company About; the recruiter's candidate profile: About and each work description; Messages: each message from the other side; Learning: the candidate course About and every text lesson (translated as Markdown and sanitised again on the server). The recruiter course page's lead sits in the page title and has no Translate. A text already in the reader's language comes back unchanged. Admins have no Translate. Awaiting owner review. | 2026-11-03 |
| P9-C13 builder call: CV AI | A Plus upload with readable text asks for its snapshot proposal at once; a proposal is cached per CV text (asking again for the same file costs nothing); drafts are never cached. A version without readable text answers 422 `version: no_text`; confirming without a proposal answers 409. Deleting a draft also works on Free. Compare shows a version's confirmed snapshot, else its proposal (marked "Proposal"). Awaiting owner review. | 2026-11-03 |
| P9-C14 builder call: Free and error states | Every AI action uses one button that, for a candidate without Plus, keeps its label with a lock and opens the upgrade dialog without a request (M-118); the AI insights pages keep the Phase 5 plan gate. Every AI text shows one state component: "Writing with AI…", the limit message with its reset time (429), "The AI service didn't answer…" with Try again (503, also a timeout), or the Plus prompt (402). Awaiting owner review. | 2026-11-03 |
| P9-C15 builder call: the Overview AI teaser | The candidate Overview insight card removed under P4-Q1 is back for Plus: the profile skill that most open roles of the market list, and how many of them (computed, no OpenAI call), linking to AI insights; dismissing it stays in the browser (§2.15). Free candidates do not see it. Awaiting owner review. | 2026-11-03 |
| P8-C6 builder call: e2e | P11 part 3 is made by `e2e/fixtures/make.js`: a ~30 s MP4 (H.264/AAC) and WebM recorded by this Chrome's MediaRecorder at 250 kbit/s (about 0.7 MB each, nothing downloaded), a sparse 501 MB file with an MP4 header, a 51 MB PDF, and a cover JPG; the 6 MB cover test reuses `photo-6mb.png`. P8-01 drags through dispatched DragEvents (Chrome's real drag is not available headless) and waits for the publish response before moving on. P7-04 and P7-05 gained the P7-A1 checks. Awaiting owner review. | 2026-11-03 |
| P10-Q1 Phase 10 split (owner) | **10a:** access management (roles, user access, invites with `/admin/set-password`, Owner and lock-out rules, sidebar/search/actions per `me.permissions`, the 403 page, the permission matrix API test), Users (tables, detail pages, audited CSV export), Payments admin, Audit logs (with the new job-status, CV-download and KYC events), and the network-idle fix carried from Phase 9 (P10-Q2). Scenarios P10-01 … 04, 08, 09. **10b:** content moderation with the Report buttons, Jobs (extending the 9b list), Applications and Recruitment, Overview and Analytics, Reports with the voice note, `seed:demo` additions, and the remaining mock deletions (including `useJobs`). Scenarios P10-05, 06, 07, 10, 11. Each half ends with `npm test`, client lint and build, its scenarios and the sweep, then a report; the Phase 10 report with test totals comes after 10b. | 2026-11-03 |
| P10-Q2 network-idle waits (owner; carried from P9-C9) | Every `page.waitForNetworkIdle()` in `e2e/` (19 calls in 16 files, including `signIn` in `lib/flows.js`) is replaced by a wait on the specific response or element the step needs. `page.goto(…, { waitUntil: 'networkidle0' })` stays. Afterwards `phase-4` and `phase-9` run again, plus the Phase 2, 3 and 6 scenarios whose files changed. | 2026-11-03 |
| P10-Q3 voice note fixture (P11 part 4) | `e2e/fixtures/make.js` generates one short English MP3 once with the OpenAI speech API into `C:/eujobs-data/fixtures` (reused when present); its known sentence lets P10-07 check the transcript. | 2026-11-03 |
| P10-Q4 drafts in admin Jobs (task 3) | Drafts are listed (M-046 "all statuses"): the status filter offers All, Published, Paused, Draft and Closed. Draft rows offer no AI summary and no "Open case", because nobody but the recruiter sees a draft. | 2026-11-03 |
| P10-Q5 seeded payment rows in admin Payments | Every row of `payments` is listed. `source: seed` rows carry a "Seeded" badge, and a Source filter offers All, Stripe and Seeded. Totals count both kinds, as the Overview and Billing do. | 2026-11-03 |
| P10-Q6 a payment's country (M-138) | The payer's country: a candidate's profile location country, a recruiter's company country. A payer without one is counted only under "All countries". | 2026-11-03 |
| P10-Q7 Payments cards | Four cards: Collected (paid rows, refunds excluded, per currency, at most 3 lines then "+n more", U34), Active subscribers, MRR per currency, Failed renewals. They are all-time ("All time" captions, as M-177) and follow only the country filter, not search, status, type or source. | 2026-11-03 |
| P10-Q8 verified company badge for candidates (owner, after 10a) | A "Verified company" tick (lucide `BadgeCheck`, accessible label "Verified company") follows the company name wherever candidates see it: job cards (Find jobs, For you, Saved), the job details header and the company section on job details. The server decides it: `company.verified` on the candidate job card and details is true only while the company has `verifiedAt` and its recruiter's status is `active`, so a suspension removes it (the job also leaves Find jobs and For you under M-044; a saved job keeps its card and details, without the tick). The client never shows a tick on its own. The text moved from `company:verified` (English only) to `common:verifiedCompany` in en/es/fr ("Verified company", "Empresa verificada", "Entreprise vérifiée"), and the recruiter Company page uses the same key. The tick is joined to the name's last word, so a wrapping name never leaves it alone on a line at 375 px. API test in `jobs.test.js`, browser check P10-12 (1440 and 375 px). Other candidate screens that name the company (AI insights cards, Applications) are unchanged. | 2026-11-04 |
| P10-Q9 live checkout after the key roll (owner) | Seeded Alex (Free, `+alex`) pays on the dev stack (`npm run dev`, `npm run stripe:listen`, Vite on 5173, database `eujobs`) with 4242. Done 2026-11-04: 13 webhook events, all answered 200; Alex is Plus; LWM-000010 (£9, Paid, receipt link) shows in his Billing and in admin Payments. The `seed:demo` run at the end of 10b sets him back to Free and deletes the Stripe customer (P5-Q3). | 2026-11-04 |
| P10-Q10 content case priority | Computed from the case's reports, never stored: "High priority" when any report's reason is `scam_or_fraud` or `discriminatory`, otherwise "Standard priority". | 2026-11-04 |
| P10-Q11 what a report's period covers (M-183) | Marketplace summary: each Overview and Analytics metric with an "In period" and an "All time" column; pure states (Active users, Published jobs, Verified candidate profiles, Pending user reviews, Verification checks in review, Average role match) have only the all-time value. Skills demand: required skills of jobs first published in the period. Platform activity: the chart's buckets (days for a week, ISO weeks clipped to the month for last month). | 2026-11-04 |
| P10-Q12 lifting a restriction (M-167) | Dismissing a restricted case removes the lock; a job stays paused and the recruiter republishes when ready. A new decision-class email `content_restriction_lifted` (en/es/fr, same class as `content_restricted`) tells the owner, for a job and for a profile, as `content_restricted` does when restricting. | 2026-11-04 |
| P10-Q13 admin Recruitment "Candidate movement" | One row per non-withdrawn application: the candidate with the job title and company, the current stage category, whether the candidate is on that company's shortlist, and whether that company started a conversation with them. All rows (M-206), newest first; a stage card or funnel step filters it. | 2026-11-04 |
| P10-Q14 admin Applications controls | Pagination (M-206), the audited export, the country filter (the job's country, M-138), a status select (All and every candidate-facing status) and a search in candidate, job and company. | 2026-11-04 |
| P10-Q15 admin Jobs extras (task 3) | Besides the status filter, pagination and "Open case" (P10-Q4), the country filter (`job.country`, Remote included) and an `adminJobs` namespace (English until Phase 11) as task 3 lists. | 2026-11-04 |
| P10-C1 builder call: roles and access (10a) | Role name 2–40 and unique ignoring case (`name: taken`), description ≤ 240, scope required (one of the four `roleScope` keys), at least 1 permission (duplicates dropped); the name field has no `maxLength`, so a 41st character shows the error. Duplicate names the copy "Name (copy)", then "Name (copy 2)", …. System roles can be edited, and archived when unused, like custom roles; an archived role is read-only (409 `CONFLICT`) and cannot be assigned (`roleId: invalid`). The admin department label is ≤ 60 characters (`LIMITS.adminRole.department`). Lock-out answers 409 `OWNER_PROTECTED` with `params.reason`: `owner` (any change to an Owner) or `own_roles_assign` (removing your own `roles.assign` by an access change, a revoke, or an edit of the role you hold). Revoking clears role, grants and removals and keeps the department. The Owner's row has no action. An admin lands on the first page their permissions open (the Overview needs `dashboard.view`; without any page, Settings); /admin without the Overview redirects there, and any other page without its permission shows the 403 page. A change to roles or access refetches `/me`, so the shell updates at once. Awaiting owner review. | 2026-11-03 |
| P10-C2 builder call: invites (10a) | `POST /admin/invitations { email, fullName, roleId, department }` creates an `invited` admin (never an Owner) and emails `admin_invite` (critical, en/es/fr) in the inviting admin's language, which the new account keeps. Inviting an address that is still only invited sends a fresh link and deletes the earlier ones (an old link answers `TOKEN_INVALID`); any other registered address is `EMAIL_TAKEN`. An invited admin cannot sign in or request a reset. `/admin/set-password` checks the link (`GET /auth/invite/:token` → name and email), sets the password once (`POST /auth/invite/accept`, the password rules of M-006), marks the email verified, then links to the admin sign-in (no automatic sign-in, as after a reset). Audit `access.admin_invited` and `access.invite_accepted`. A new admin has not accepted the Terms yet, so the existing U22 dialog asks on the first page. Awaiting owner review. | 2026-11-03 |
| P10-C3 builder call: Candidates and Recruiters (10a) | `GET /admin/users?role=candidate\|recruiter` (role required), 20 a page (at most 100), newest first; search in name, email and company. Candidate filters: status, country (profile location), verification (`not_started`, `in_review`, `partial`, `verified`), plan, right to work (`eu`, `uk`, `none` = no valid entry); recruiter filters: state (Pending = unverified, onboarding or pending review; Approved = active; Rejected; Suspended) and country (company). M-169: a candidate whose only submissions were rejected reads "Not started"; "n of 3" counts approved identity, academic and employment checks. Completeness % = done ÷ total of the stored checklist. The detail page (`GET /admin/users/:id`, candidates and recruiters only; an admin id is 404) shows the account, then profile, privacy, verification submissions, right to work, plan and subscription, applications and learning (candidates) or company, KYC documents, review history, job and application counts and learning (recruiters), then the latest 20 audit events where the account (or its company) is actor or target. Files open only with `documents.view`. The Overview's Active users link (U10) works through `?status=active`. Awaiting owner review. | 2026-11-03 |
| P10-C4 builder call: audit events (10a) | New events: `jobs.status_changed` (recruiter, Jobs) on every status change; `jobs.cv_downloaded` (recruiter, Jobs) when a company user opens a candidate's CV (logged once per view like the download log); `payments.payment_recorded` (the payer for a course purchase or the first Plus invoice, the system for a paid renewal), `payments.renewal_failed` and `payments.payment_refunded` (system), all in Payments; every export `reports.<table>_exported` with the row count (Reports, admin). "KYC submission" (M-162) is the existing `moderation.account_submitted` / `_resubmitted` event when a recruiter submits the KYC step; single file uploads are not audited. The audit search looks in the actor's name and the event's text parameters. The event sentences are in the client `audit` namespace and, for the CSV export, in the server dictionaries (`audit.*`, en/es/fr). Awaiting owner review. | 2026-11-03 |
| P10-C5 builder call: CSV exports (10a) | `lib/csv.js`: UTF-8 BOM, CRLF rows, RFC 4180 quoting; text starting with `=`, `+`, `-`, `@`, tab or CR gets a leading apostrophe (spreadsheet formula injection). Dates are ISO 8601 UTC; money is the decimal of the major unit with the currency in its own column. File names `<table>-YYYY-MM-DD.csv`. Every export takes the table's current filters and contains all matching rows (not only the current page), needs the page's view permission plus `reports.export`, and is audited. Headers and labels follow the admin's language (OQ-6d; server `csv.*` and `labels.*` keys). Awaiting owner review. | 2026-11-03 |
| P10-C6 builder call: admin Payments (10a) | `GET /admin/payments` (search in reference, payer and item; status, payer role, type, source, payer country; 20 a page), `/:id` (the row, its Stripe ids and, for a plan payment, the payer's subscription status, period, renewal and retry state), `/stats?country=` (P10-Q7) and `/export`; all `finance.view`. Active subscribers = subscriptions that are paid by U38 (active, trialing, or past due while Stripe retries); MRR = their monthly amounts per currency. Failure codes are shown as labels ("Card declined"), unknown codes as the code. The client enum label for `paymentSource.seed` is now "Seeded" (P10-Q5; es and fr keep their wording until Phase 11). Seen on a Stripe Test Clock only: a failed renewal row is dated with Stripe's charge time, which for a declined charge is the real time, so it can read earlier than the paid renewal before it (unchanged Phase 5 behaviour; live charges have one clock). Awaiting owner review. | 2026-11-03 |
| P10-C7 builder call: client (10a) | New namespaces `access`, `adminUsers`, `adminPayments` and `audit` are English until Phase 11 (as P4-D14); the 403 page (`shell:forbidden`), the set-password page (`auth:invite`, `shell:titles.setPassword`) and the pagination (`common:pagination`) ship in en/es/fr, because those namespaces already do. New shared pieces: `components/common/Pagination.jsx`, `lib/download.js` (server files with the session), `lib/useUrlFilters.js` (filters in the URL; the search text is also kept on the page, so fast typing loses nothing, and two quick changes never undo each other), `app/permissions.js` (`can`, the page of a path, the admin landing page). Deleted: `access-management/data/accessData.js`, `hooks/useAccess.js`, `utils/validateRole.js`, `payments/data/payments.js`. Kept until 10b, because Moderation, Reports and the Overview still import them: `audit-logs/hooks/useAuditLog.js`, `audit-logs/data/auditEvents.js`, `audit-logs/utils/formatDate.js`, `shared/data/users.js`, `utils/downloadCsv.js`, `recruiter/jobs/hooks/useJobs.js`. Awaiting owner review. | 2026-11-03 |
| P10-C8 builder call: permission matrix (10a) | `routes/v1.js` exports `ADMIN_MOUNTS`, the admin routers in mount order; `requirePermission` carries its `permission`. `test/admin.matrix.test.js` reads every admin route from that table (a nested router or a path other than `:params` fails the test) and asserts that each one needs a permission, then runs one test per permission: an admin holding every other permission gets `PERMISSION_DENIED { permission }` on each route that needs it, and an admin holding exactly a route's permissions gets past the gate with no 500. `users.deactivate` guards no route (it is checked inside the account decisions, tested in `companies.test.js`). `dashboard.view`, `reports.view` and `candidates.view` are marked todo until their 10b routes exist. Awaiting owner review. | 2026-11-03 |
| P10-C9 builder call: e2e (10a) | `lib/flows.js` gained `responseTo(page, urlParts, method)` (a wait on one request, created before the action) and `waitForSettled(page)` (the loading fallback gone and a page heading shown); `signInWithForm` waits for the login response and the landing page. `lib/admins.js` makes roles and invited admins through the real API (the invite link, the password, the Terms) and re-reads exports from Node, because puppeteer reads response bodies through Chrome, which drops the BOM. The sweep gained `/admin/set-password`, `/admin/candidates/:emma`, `/admin/recruiters/:sarah` and `/admin/access-management/users/invite` (the old mock path `/users/sarah-miller` is gone). P10-04 adds 21 bare candidate accounts for a second page and deletes them at the end; P10-09 puts one candidate on a Stripe Test Clock (a paid renewal, then a failed one with card 0341) and refunds another candidate's EUR payment, once for both viewports. Awaiting owner review. | 2026-11-03 |
| P10-C10 builder call: content cases (10b) | `modules/moderation`. `POST /reports { targetType, targetId, reason, details ≤ 500 }`: candidates report jobs (any status but draft), companies and messages; approved recruiters report candidate profiles and messages; a message must come from the other side of one of the reporter's own threads (otherwise 404). One open case per target: a later report by someone else joins it; the same reporter again is 409 `CONFLICT { reason: already_reported }`. At most 10 reports in a rolling 24 hours per user (429 `RATE_LIMITED { reason: reports_per_day, limit }`). The case keeps the target's name as it was (`targetName`) and the account emailed about decisions (the job's company owner, the candidate). Decisions: an open case → Dismiss (reason optional, no email) or, for jobs and profiles, Restrict (reason required, ≤ 300); a restricted case → Dismiss only, which lifts (P10-Q12); a dismissed case is final and a new report opens a new case. Restrict on a published job pauses it (a paused or closed job keeps its status) and locks it; on a profile it sets `restricted` and, when the admin ticks "Also remove the profile photo", removes the photo through the profile service, so completeness and matching follow (M-013). The emails name the job or "your profile" in the owner's language (`email.moderationSummary`). Audit: `moderation.content_reported` (user), `case_opened`, `content_dismissed`, `content_restricted`, `content_lifted` (admin). Awaiting owner review. | 2026-11-04 |
| P10-C11 builder call: admin Jobs (10b) | `GET /admin/jobs` takes `status`, `country` (a code or `REMOTE`, on `job.country`), `q` (title and company) and the page; 20 a page; newest published first, drafts last. A job whose company no longer exists is left out. Each row carries `openCaseId`. "Open case" (`POST /admin/jobs/:id/case { reason, details }`, `jobs.view` + `moderation.manage`) names a report reason like a reporter; it answers 201 with a new case or 200 with the job's open case, and 409 for a draft. The row then offers "View case". The AI summary link keeps the list's filters. A Country column was added. Awaiting owner review. | 2026-11-04 |
| P10-C12 builder call: admin numbers (10b) | `admin.metrics.js`. A number shown on another admin page is computed by that page's query (Candidates, Recruiters, Payments, Jobs, the verification queue), so they agree. Country scope: candidates by profile country, recruiters and companies by company country, jobs by `job.country` (Remote included), applications by their job's country, enrollments and certificates by the learner's country, shortlist and outreach by the company's country. Course badges = valid certificates (as the Users "Learning" column). Average role match = the mean, over published jobs that have scores, of each job's top-5 mean; "Across {n} published roles" counts every published job in scope. Chart: registrations = candidate and recruiter accounts created; applications counted on the day they were sent, whatever became of them (as the recruiter momentum chart); last month = the calendar month in ISO-week buckets clipped to it. The KPI cards link to their pages with the country kept (Active users → Candidates `?status=active`, U10: that page lists candidates only, while the KPI counts candidates and recruiters); a card whose page the admin may not open is not a link. The Analytics "Matching quality" card stays copy (M-175); its "Relevance feedback" status now says "Collected", because the M-067 feedback exists since Phase 9. Awaiting owner review. | 2026-11-04 |
| P10-C13 builder call: Recruitment (10b) | `GET /admin/recruitment` (`candidates.view`, country filter). Cards: Published roles, Applications (not withdrawn), Shortlisted (entries, as the Overview's "Shortlist activity"), Reviewed outreach (recruiter-started conversations). The movement row's stage badge shows the company's own stage name; the category decides the filter. "Role activity" lists the 5 newest published roles ("Manage" opens Jobs filtered to Published); "Application coverage" the 5 newest applications. Awaiting owner review. | 2026-11-04 |
| P10-C14 builder call: Reports (10b) | `modules/reports`. `POST /admin/reports` (multipart: `type`, `period`, `brief` ≤ 500, `tz`, optional `file`) needs `reports.view` + `reports.export` (§3.18's gate); the history `GET /admin/reports` needs `reports.view` and lists every admin's reports; `GET /admin/reports/:id/download` needs both and is sent with `Cache-Control: no-store`. The voice note (mp3, m4a, wav, webm, ogg ≤ 25 MB; browsers' MIME aliases accepted) is stored as `report_voice` and transcribed with `OPENAI_TRANSCRIBE_MODEL`, then `whisper-1`; the summary uses the main model (OD7), at most 120 words, told that an empty "In period" cell is a state, not zero. If either AI step fails the answer is 503 `AI_UNAVAILABLE` and nothing is stored. CSV (U23): "Executive summary", the summary, "Brief", one cell with the brief and "Voice note transcript: …", a blank row, then a title row "{type} · {period} (dates)" and the table; headers and labels in the admin's language; file name `<type>-YYYY-MM-DD.csv`. Reports always cover all countries; the period's dates are in the admin's time zone. Audit `reports.report_generated` and `reports.report_downloaded`. Awaiting owner review. | 2026-11-04 |
| P10-C15 builder call: Applications page (10b) | `GET /admin/applications[/export]` (`candidates.view`; export also `reports.export`, audited `reports.applications_exported`). Columns: Candidate (a link to the detail page with `users.view`), Role, Company, Job country, Applied, Status (the candidate-facing status, U33). Awaiting owner review. | 2026-11-04 |
| P10-C16 builder call: `seed:demo` (10b) | The moderation mock's two items become open cases: Emma Wilson reports "Product Designer, Growth" (`discriminatory`, High priority) and Sarah Miller reports Alex Morgan's profile (`misleading`), two days before the seed run. The audit mock becomes real events: `workspace.initialized`, `policy.activated` (the default policy) and `moderation.account_approved` (Sarah) 45 days back, `moderation.account_submitted` (James Chen, now the recruiter applicant) 5 days back, and the two `content_reported` events. Roles: the three system roles come from `seed:catalog` (10a); no custom roles are seeded. `seed:demo` also wipes cases and report snapshots. Awaiting owner review. | 2026-11-04 |
| P10-C17 builder call: client (10b) | The Report button and dialog texts are `common:report` in en/es/fr (they are on candidate pages that ship es and fr). New namespaces `adminJobs`, `adminApplications`, `adminRecruitment`, `adminOverview` and `adminReports` are English until Phase 11; `moderation` and `audit` gained English keys. The admin Overview and Analytics charts share `useActivity` and scale their axes to the data (`overview/chartScale.js`). Deleted: `analytics/data/analytics.js`, `applications/data/applications.js`, `moderation/data/moderation.js`, `moderation/hooks/useModerationDecisions.js`, `moderation/utils/jobReviewItem.js`, `moderation/components/ReviewDetails.jsx`, `overview/data/overview.js`, `recruitment/data/recruitment.js`, `reports/data/reports.js`, `audit-logs/hooks/useAuditLog.js`, `audit-logs/data/auditEvents.js`, `audit-logs/utils/formatDate.js`, `shared/data/users.js`, `recruiter/jobs/hooks/useJobs.js`, `recruiter/jobs/data/jobs.js`. The account-review constants moved to `moderation/tones.js`. Kept: `utils/downloadCsv.js`, still used by the candidate's profile export in Settings until Phase 12 replaces it with the GDPR export. Awaiting owner review. | 2026-11-04 |
| P10-C18 builder call: voice-note fixture (10b) | `e2e/fixtures/make.js` makes `voice-note.mp3` once with OpenAI `gpt-4o-mini-tts` (voice `alloy`) saying "Please focus this report on interviews and on roles that receive few applications."; P10-07 checks the transcript for "interview" and "applications". The key is read from `server/.env` into memory only. Awaiting owner review. | 2026-11-04 |
| P11-Q1 sharing the repo (owner) | The owner pauses the other agent (Codex) for Phase 11. It had edited client files and run e2e (`zz-tmp-empty-roles`) on `eujobs_test` while the first full server suite ran, so that run does not count; the suite is rerun once it has stopped, and Phase 11 builds on its current edits. | 2026-11-04 |
| P11-Q5 other agents keep working (owner) | The other agent was not paused (client edits until 14:42; e2e runs at 14:31 and 14:38 overlapped the second full server suite, which was then cut off by a session restart), and a second Claude session (`ai-job-41`) works in the repo too. Owner: they keep working; Phase 11 works around them. Before and after each test or e2e run the builder checks for their e2e stack (ports 5100/5174) and reports every run that overlapped. | 2026-11-04 |
| P11-Q2 CV request wording (owner) | The server's fuller reasons everywhere (screens, emails, CSV), in en, es and fr: "Verify employment history", "Review an earlier role-specific CV", "Compliance or audit check", "Other recruitment purpose". The thing is called "CV request" everywhere (activity, timeline, email subject and heading). P4-13 expects the new texts. | 2026-11-04 |
| P11-Q3 what "no English" covers (owner) | UI text only: every UI string, enum label, error, email, PDF and CSV text is in es and fr. Database content stays in the language it was written in (seeded jobs, company About, course lessons and quizzes per M-113, messages, stage names per M-142), with the on-demand Translate (M-144). The English-leftover check compares rendered text with the en i18n values only. | 2026-11-04 |
| P11-Q4 task 8 (owner) | Skipped; Sarah's default country is unchanged and the option stays recorded for later. | 2026-11-04 |
| P11-Q6 seeded system roles (owner) | The three seeded system roles (Manager, Accounts Head, Staff) read in the admin's language while their name and description are the seeded ones: the server's `roleText` (admin.access.js) uses the `roles.*` server dictionary keys for the role list, the staff access list, `/me` and the invite email. Once an admin changes the text it reads as written; a permissions-only edit through the dialog (prefilled with the translated text) keeps the seeded text. A duplicate copies the text as it reads, with "(copy)" in the admin's language ("copia", "copie"). Custom roles stay as written. API test in `admin.access.test.js`, browser check P11-06. | 2026-11-04 |
| P11-C1 builder call: sidebar labels | Task 3 asked for an ellipsis on Sidebar labels; the owner asked for no cut-off text, and es/fr labels ("Por qué te lo recomienda la IA", "Processus de recrutement") are longer than the sidebar. Labels now wrap onto a second line (a two-line clamp is only a last resort); P11-03 checks that no label is cut. | 2026-11-04 |
| P11-C2 builder call: how the translations were made | U43 (the build session writes all copy in en/es/fr): four parallel sub-agents of this session, each on a set of namespaces, from one brief and glossary (Spanish tú, French vous, France/Spain usage; "Local WorkMan", "AI Job Portal" and "Plus" untranslated; the terms already used in the es/fr files of Phases 2–10). The builder then aligned the terms: fr shortlist = "short-list" (screening stays "présélection"), es default stage "Preseleccionados" (as the stage label; `companies.test.js` updated), fr snapshot = "aperçu", "Ai Job Summary" = "Resumen con IA" / "Synthèse IA", es skill gap = "Habilidades que faltan" (as the page title). | 2026-11-04 |
| P11-C3 builder call: the missing-key check | `client/scripts/check-i18n.js` runs first in `npm run build` (and as `npm run check:i18n`): every en namespace has an es and fr file with every key, the plural forms the language needs (es and fr: `_one`, `_many`, `_other`; `_many` is used for exact millions), the same `{{placeholders}}` and `<tags>`, non-empty values, and no key en does not have. Any gap fails the build. The server side is `foundation.test.js` (every en key, the same placeholders, every email type rendered and translated in every language, a client message for every server error code in en/es/fr). | 2026-11-04 |
| P11-C4 builder call: Data & account pages | The candidate and recruiter Data & account pages are still the device-only demo pages that Phase 12 replaces, but they show on es/fr screens, so their texts and both Settings layouts moved to `account.layout` / `account.data` keys now. The CSV they download (device-only mock data and its field labels) stays as it is until Phase 12 rewrites the export. Two orphan mock files that nothing imports (`recruiter/find-candidates/data/candidates.js`, `recruiter/jobs/data/jobFields.js`) are left for Phase 12 task 4/5. | 2026-11-04 |
| P11-C5 builder call: accent-insensitive server filters | Task 2: the admin text filters (Candidates/Recruiters, Applications, Audit, Jobs, Payments) used `toLowerCase` only; they now compare with `searchText` (lib/skills.js, already used by Find jobs and discovery). API test in `admin.lists.test.js`; P11-05 checks it in the browser. | 2026-11-04 |
| P11-C6 builder call: mail samples | The `mail:test` sample parameters moved to `server/scripts/mailSamples.js` (`mailSample(type, language, origin)`), shared by `mail:test` and P11-04, which renders every email type in es and fr. | 2026-11-04 |
| P11-C7 builder call: layout and leftover checks | `e2e/lib/i18nChecks.js`. Layout (P11-01, P11-03 and the English sweep): text past its own box; text clipped by an ancestor that hides overflow without scrolling (scroll containers are fine); text cut vertically; a translated label truncated by an ellipsis or a line clamp (user data may be truncated: listed as notes); text over text (visible parts only, at least 40 % of the line height); a native select whose chosen option does not fit. With a modal open only the dialog is checked. English leftover: rendered text, `aria-label`, `placeholder`, `title`, `alt` or the document title equal to a static en value of more than 3 words that the language translates differently. | 2026-11-04 |
| P11-C8 builder call: layout fixes beyond task 3 | Found by the check in es/fr: `SectionTitle` actions wrap under the title (admin Overview and Analytics chart cards); role-card actions wrap (Access management); the admin user-detail stats wrap at 375 px; admin filter selects size to their longest option (Candidates, Recruiters, Applications, Jobs, Payments, the Overview country filter); the course card button grows for a long label; the Manage stages status selects fit "En cours d’examen (présélection)"; a long email breaks in the course learners table. | 2026-11-04 |
| P11-C9 builder call: P9-08 | Regenerate is checked by a new generation (the POST answers 200, the AI last-success time moves, the cached summary row is rewritten after the click), not by different wording, since OpenAI may return the same text. | 2026-11-04 |
| P11-C10 builder call: sweep in any language | `e2e/lib/sweep.js` holds the sweep (the English `sweep` scenario and P11-01 call it); the 404 panel carries `data-not-found` so the sweep recognises it in every language. | 2026-11-04 |
| P11-C11 builder call: the e2e `fill` helper | It cleared a field with `value = ''`, which React does not see, so a re-render could put the old text back before typing (P10-02 created "mAnAgErOps desk …"). It now clears through the native value setter and an input event. P10-01, P10-02, P11-05 and P2-01 passed with it. | 2026-11-04 |
| P11-C12 builder call: enum labels | The restored P2-19 found `enums:emailType.content_restriction_lifted` missing in en, es and fr (added in 10b on the server only); the label is added, and `foundation.test.js` now checks that every server enum key has a client label in en, es and fr, so this is caught without a browser. | 2026-11-04 |
| P11b-Q1 notification events (owner; supersedes M-093/OD6) | Every notification opens the exact item it is about. **Candidate:** application status changed (screening, interview, offer, hired, not selected) → that application; new message → that conversation; CV request from a company → CV page requests; verification approved/rejected → Verification page; new job matching a job alert (Plus only) → job details; payment paid / renewal failed / plan ended → Billing; course purchased, certificate issued → that course / certificate; profile restricted / restriction lifted → profile. **Recruiter:** account approved / rejected / suspended → review page or Overview; new application on your job → that application; candidate withdrew → that application; new message → that conversation; CV request approved/declined → that candidate's profile; job restricted / lifted → that job; payment paid / failed → Billing; certificate issued → certificate. **Admin**, only admins whose permission covers the event (the Owner gets all): recruiter submitted or resubmitted for review → that Account review item; candidate verification submitted → that verification item; new content report → that moderation case; renewal payment failed → that payment; invited admin joined → Access management. | 2026-11-04 |
| P11b-Q2 notifications on screen (owner) | The header bell shows the unread count and a dropdown of the latest 10; clicking one opens the exact section and marks it read. "See all" opens a Notifications page per role with All/Unread and "Mark all as read". Each sidebar item shows the count of its unread notifications, cleared when they are opened; the unread-messages and active-applications badges keep working. Refresh through the existing 15-second `/me/counters` poll; no websockets, no Redis. | 2026-11-04 |
| P11b-Q3 email switches (owner) | Settings → Notifications for all three roles (admins in admin Settings): one email on/off switch per category. In-app notifications always show. Security and account-decision emails (password reset, invite, approved/rejected/suspended, verification decision, renewal failed, plan ended) always send and cannot be switched off. | 2026-11-04 |
| P11b-Q4 admin emails (owner) | Sent at once, only to admins whose permission covers the event; each admin can switch categories off; they count toward the daily non-critical cap and never go to reserved domains. Rules for the phase: store the type and parameters, never the finished text (rendered in the reader's current language, en/es/fr, check-i18n passes); reuse the existing email throttles; an item that is gone or no longer accessible shows "no longer available", never a crash or the 403 page; a notification is only visible to its own user, and admins never see events outside their permissions. | 2026-11-04 |
| P11b-Q5 retention (owner) | 90 days: a notification older than 90 days is deleted (TTL index), read or not. | 2026-11-04 |
| P11b-Q6 grouping (owner) | Collapse while unread: one unread notification per conversation, updated to the latest message with a count; status changes of one application replace its unread notification with the latest status. Once read, the next event starts a new one. New applications stay one per application; a job matching several alerts gives one notification. | 2026-11-04 |
| P11b-Q7 new emails (owner) | Only the five admin events get new emails. Candidate withdrew, CV request approved/declined, payment paid and course purchased are in-app only. | 2026-11-04 |
| P11b-Q8 status timing (owner) | The in-app "application status changed" notification is created by the same delayed task as the email (10 minutes after the last move, U33), so an undone move never shows. Other events appear at once. | 2026-11-04 |
| P11b-Q9 item pages (owner) | The URL opens the item in place: `/candidate/applications/:id` opens that application's activity dialog; `/recruiter/applications/:id` shows the list filtered to its job with the row highlighted and scrolled into view; `/admin/payments/:id` opens the payment details dialog. Closing returns to the list. | 2026-11-04 |
| P11b-Q10 sidebar badges (owner) | Messages keeps only its unread-messages badge (reading the conversation clears both). Candidate Applications keeps its neutral active count and gets a separate accent count of unread application notifications. Other items show only the notification count. Opening the exact item from anywhere (bell, Notifications page or the page itself) marks its notifications read; visiting the section list does not. | 2026-11-04 |
| P11b-Q11 payments (owner) | No duplicates: a candidate's course purchase → only "course purchased" (opens the course); candidate "payment paid" = Plus invoices (first and renewals) → Billing. A recruiter's course purchase → "payment paid" → Billing. Recruiter "payment failed" is not built: recruiters only buy courses, and a declined card stays inside Stripe Checkout, so no failed recruiter payment is ever recorded. | 2026-11-04 |
| P11b-Q12 categories and admin permissions (owner) | Email categories: candidate = Applications (status + rejection), Messages, CV requests, Job alerts; recruiter = New applications, Messages; admin = Account reviews, Verification, Content reports, Failed renewals, Admin joined. Default on; the former single email toggle is copied into every category. Admin events go to admins holding the permission of the page they open: `moderation.manage` (account review, verification, content reports), `finance.view` (failed renewal), `roles.view` (admin joined). | 2026-11-04 |
| P11b-Q13 seed (owner) | `seed:demo` creates one notification per seeded event that is still waiting, dated like the event: Sarah's unread messages from Emma and Oliver, the two open moderation cases and James Chen's pending account review for admins with `moderation.manage`. | 2026-11-04 |
| P11b-Q14 rejected or suspended recruiters (owner) | Their notification is stored (it opens the review page) and shows in the bell once the account is active again; the always-on email and the review page's reason tell them now. No bell on the onboarding layout. | 2026-11-04 |
| P11b-Q15 job-alert timing (owner) | One in-app notification per matching job at the job's first publish, whatever the alert's frequency; the email keeps its frequency. | 2026-11-04 |
| P11b-C1 builder call: status changes not told | A rejection saved without "notify the candidate" creates no in-app notification either: the in-app status notification follows the email task's "told" rule (`lastEmailedStatus`, U33), and the email category switch does not affect it. | 2026-11-04 |
| P11b-C2 builder call: which reports notify | Only user reports (`POST /reports`) notify admins; a case an admin opens from Jobs ("Open case") does not, since an admin made it. A later report on an open case updates its unread notification (count + 1) and sends another email. | 2026-11-04 |
| P11b-C3 builder call: recipients | Company events go to the company's active recruiter (as the existing emails); `cv_request_decided` goes to the recruiter who asked (the company's recruiter if that account is gone); `admin_joined` leaves out the new admin. Job alerts notify only candidates whose plan has `job_alerts` (M-119). | 2026-11-04 |
| P11b-C4 builder call: certificate target | `certificate_issued` opens the course page, which shows the certificate and its download (the email's main link), not the public verification page. | 2026-11-04 |
| P11b-C5 builder call: sidebar sections | Types count on these items: candidate Applications, Messages (not shown, Q10), CV & versions, Verification, Job alerts, Learning, My profile; recruiter Overview, Jobs, Find candidates, Applications, Messages (not shown), Learning; admin Moderation, Payments, Access management. Billing types (payment paid, renewal failed, plan ended) count only in the bell, since Billing is not a sidebar item. | 2026-11-04 |
| P11b-C6 builder call: item URLs | The workspace layout remounts a page when its path changes, so `/candidate/applications/:id` and `/admin/payments/:id` only seed the dialog; opening another row keeps local state, and closing a linked dialog returns to the list URL (P6-06 found that a URL-driven dialog lost the withdraw confirmation). `/recruiter/applications/:id` reads the row from the new `GET /recruiter/applications/:id` and sets the job (and Withdrawn/Not selected) filter in the query string. | 2026-11-04 |
| P11b-C7 builder call: read rules | Opening a notification marks it read even when its item is gone. Opening an item marks its notifications read once, when it opens and the counters are known; one that arrives while the page stays open stays unread (P11b-02 found the earlier "whenever unread" rule marking a new withdrawal read). Pages that do this: application dialog/row, job details (both roles), course page (both roles), candidate profile (recruiter), CV & versions, Verification, Billing (both roles), My profile, recruiter Overview, the admin account, verification and content dialogs, the payment dialog, the admin access page; reading a thread does it on the server. | 2026-11-04 |
| P11b-C8 builder call: counters and roles | `/me/counters` now answers admins (`{ notifications }`); recruiters still need an approved account for it. The bell lists `LIMITS.notifications.latest` (10) from `/meta/config`; the page 20 a page. | 2026-11-04 |
| P11b-C9 builder call: client details | New `notifications` namespace and enum labels `emailCategory`, `notificationType` and the five `emailType` admin keys in en/es/fr (check-i18n passes; `foundation.test.js` counts updated). Removed orphaned keys `shell:notifications`, `account:notifications.email/.candidate/.recruiter`. The Data & account demo CSV's "Email alerts" reads On when any switch is on (Phase 12 rewrites that export). `DataTable` gained `getRowProps`. On phones the dropdown spans the header (the header's backdrop filter makes it the popover's containing block; the Dropdown's min-width is reset). | 2026-11-04 |
| P11b-C10 builder call: tests | Every API test file now clears `notifications` before each test (`useTestDb`). e2e scenarios are `p11b-01` … `p11b-05` (run by name; `phase-11` selects `p11-` only) with `e2e/lib/notifications.js`. A verification reviewer needs `documents.view` as well as `moderation.manage` to open the evidence (P10 rule), so the e2e moderator roles hold both. P2-12, P2-15, P2-16 and P6-10 were updated for OD6's reversal. | 2026-11-04 |
| P12-Q0 test lock (owner, Phase 12 step 0) | Parallel sessions must not break each other's tests: `npm test` and `node e2e/run.js` take a lock before they start (a file under `C:/eujobs-data` with the session, the process id and the start time); a second run waits or exits naming the holder; a lock left by a dead process is cleared. Keep the single `eujobs_test` database (the Atlas cluster is shared); ask before proposing separate databases. Documented in the README and the memory file. | 2026-11-05 |
| P12-Q1 full regression (owner) | `node e2e/run.js all`: one command and one results table; `eujobs_test` is reseeded at the start of each phase group (the state each phase was verified on); the API, Vite and stripe listen stay up for the whole run. | 2026-11-05 |
| P12-Q2 erased candidate's threads (owner) | The conversation stays in the recruiter's inbox as "Deleted user"; all its messages are deleted and replies are disabled. | 2026-11-05 |
| P12-Q3 names in others' records (owner) | Erasure replaces the person's name with "Deleted user" in other users' notifications about their items (the rows stay; opening says "This item is no longer available."), and likewise in audit entries and moderation reports. | 2026-11-05 |
| P12-Q4 recruiter export files (owner) | The recruiter's ZIP also holds their own KYC documents (until retention deletes them) and the company logo. | 2026-11-05 |
| P12-Q5 recruiter deletion: views and CV requests (owner) | The company's profile views and CV requests (pending or decided) are deleted with its notes, shortlist and activity (OQ-6k). | 2026-11-05 |
| P12-Q6 remaining client `data/` files (owner) | The static audit flags every client `data/` file except three UI-config files named in the script with the reason: `auth/data/onboarding.js` (onboarding step routes), `auth/data/workspaceChoices.js` (portal tiles), `help/data/help.js` (Help link destinations). | 2026-11-05 |
| P12-Q7 audit entry for erasure (owner) | One audit entry per erasure or recruiter deletion ("A candidate/recruiter deleted their account"), actor "Deleted user", with no name or email. | 2026-11-05 |
| P11c-Q1 recruiter plan name (owner; supersedes M-117) | "Recruiter Plus" in en, es and fr (not translated). It is shown on recruiter Billing, the upgrade dialog, admin Payments and the admin recruiter detail page. | 2026-11-05 |
| P11c-Q2 price (owner) | £49 a month, the approved £49 row: GBP 49 · EUR 57 · PLN 245 · SEK 629 · DKK 429 · CZK 1,399 · HUF 21,990 · RON 289. Charged monthly in the company country's currency, through Stripe Checkout, the Customer Portal and the webhooks exactly like candidate Plus, reusing that code. `seed:catalog` creates the plan record and the Stripe prices. | 2026-11-05 |
| P11c-Q3 Free recruiter (owner) | A free approved recruiter can keep 1 job active (published), see and manage the applicants to their jobs (stages, reject, notes on applicants), and reply in conversations a candidate started (widened by P11c-Q14). | 2026-11-05 |
| P11c-Q4 Recruiter Plus only (owner) | Unlimited active jobs; Find candidates (search, profiles, shortlist, notes, Compare candidates on Find candidates and Shortlists); starting new conversations and CV requests; AI tools (job AI summaries, AI match ranking of applicants and candidates, Translate). | 2026-11-05 |
| P11c-Q5 locks (owner) | As for candidate Plus: the server refuses with the entitlement error (402 `PLAN_REQUIRED { entitlement }`); on screen each locked button (Compare included) keeps its label, shows a lock and opens the upgrade dialog without sending the request. Publishing a 2nd job on Free shows the upgrade dialog. | 2026-11-05 |
| P11c-Q6 plan end (owner) | When the plan ends (cancelled, or the final payment failure) with more than 1 active job, the most recently published job stays live and the others are paused (not deleted); they can be republished after subscribing again. Applications and conversations stay visible. | 2026-11-05 |
| P11c-Q7 emails and notifications (owner) | Recruiters also get payment paid, renewal failed and plan ended: in-app, plus the always-on decision emails (renewal failed, plan ended) in en/es/fr, following §3.21 and P11b-Q11 with no duplicates. | 2026-11-05 |
| P11c-Q8 admin (owner) | Admin Payments, its cards (active subscribers, MRR per currency, failed renewals), the Overview and the recruiter detail page include recruiter subscriptions, split by role where the page shows plan data. | 2026-11-05 |
| P11c-Q9 parallel session (owner) | The Phase 12 session was stopped for 11c. Its uncommitted Phase 12 edits stay in the working tree; 11c is built on top of them. | 2026-11-05 |
| P11c-Q10 Find candidates on Free (owner) | Find candidates lists only the people who applied to the company's jobs (their profiles stay open). Search, filters, sort, Shortlist and Compare keep their labels, show a lock and open the upgrade dialog. Shortlists shows the upgrade gate. | 2026-11-05 |
| P11c-Q11 seed (owner) | Sarah (Acme Studio, London) is on Recruiter Plus, as Emma is on Plus: a real Stripe test subscription in GBP, her first invoice stored as a seed payment row; her 3 jobs stay live. The other 9 seeded recruiters are Free with their 1 job. | 2026-11-05 |
| P11c-Q12 recruiters over the limit at release (owner) | A one-time step at server start applies the P11c-Q6 rule to every recruiter without Recruiter Plus who has more than 1 published job: the most recently published stays live, the others are paused. | 2026-11-05 |
| P11c-Q13 proration (owner) | None. Cancelling takes effect at the end of the paid month with no partial refund (as M-121); resubscribing starts a new full month on that day; there is no plan switching (P6). | 2026-11-05 |
| P11c-Q14 existing conversations (owner) | A Free recruiter can reply in every existing conversation, whoever started it; only starting a new conversation needs Recruiter Plus. | 2026-11-05 |
| P11c-Q15 talent lists on Free (owner) | Counts stay (Overview "Recommended candidates", the Jobs table's relevant count). The lists that show people beyond the applicants (Overview "Talent worth meeting", a job's "Relevant talent") are replaced by a short upgrade prompt with a locked "See candidates" button; the Jobs table's "N relevant" link becomes a locked button. | 2026-11-05 |
| P11c-Q16 AI ranking (owner) | Lock what exists, build nothing new: Recruiter Plus = the Match insights narrative (applicants and others), the AI-score order of Recommended and the relevant-talent lists, job AI summaries and Translate. Applicant lists stay sorted by date applied. | 2026-11-05 |
| P11c-Q17 admin Recruiters list (owner) | A Plan column and a Plan filter on admin Users → Recruiters, as on Candidates (M-123), plus the subscription on the recruiter detail page. | 2026-11-05 |
| P11c-Q18 plan-end text (owner) | The recruiter's plan_ended email and notification name the paused jobs: "{job} stays live; {n} other jobs were paused. Subscribe again to republish them." (shorter when nothing was paused); en/es/fr; the link opens Jobs. | 2026-11-05 |
| P11c-Q19 entry points (owner) | Recruiter Billing gets the plan card (Free upsell with the price; or status, renewal date and Manage subscription). Every lock opens the upgrade dialog. The profile menu shows "Free" or "Recruiter Plus" under the name. No onboarding plan step for recruiters. | 2026-11-05 |
| P11c-Q20 admin Overview (owner) | The Overview gets an "Active subscribers" counter in marketplace health: the total and "n candidates · m recruiters", the same count as the Payments card (and in the Overview CSV export). Recruiter payments also appear in Recent activity. | 2026-11-05 |

_(Answers to any new question asked during the build are appended to this table.)_

---

## 1. Current state & environment

### 1.1 Repository

Repo `Tushankar/eujobs-frontend`, branch `main`. Phase 0 (restructure into `client/` and `server/`) is done and committed.

| Path | State |
|---|---|
| `client/` | React 19 + Vite 8 app (JavaScript, CSS Modules, react-router 7). Every screen still runs on mock data in `localStorage`. Lint, build and the 69-route sweep were green at the end of the planning session. Vercel will serve it later with Root Directory = `client` (S). |
| `server/` | Only `.env`, which is gitignored. No code yet. |
| `docs/` | `CONVENTIONS.md`, `DESIGN_SYSTEM.md`, `FIGMA_SCREEN_INVENTORY.md`, `USER_FLOW.md`, `BACKEND_PLAN.md` (this file), `backend/` (`DECISIONS.md`, `decisions.json`, `blocker-review.md`, `audits/{candidate,recruiter,admin,shared}.md`) |
| root | `CLAUDE.md`, `README.md`, `IMPLEMENTATION_PLAN.md`, `.gitignore` (ignores `.env`, `.env.*` except `.env.example`, and `server/uploads/`) |

Paths in the audits are relative to `client/` (shared audit) or start with `client/src/` (other audits).

### 1.2 Verified services

| Service | What was verified | When | Used for |
|---|---|---|---|
| MongoDB Atlas, the stuti cluster (`cluster0.6bhj96m`) | Reachable; `seed:catalog`, `seed:demo` and the 68 Phase 1 server tests pass on it. The cluster is shared with about 20 other projects and has about 194 MB used (P13 settled). | 2026-10-30 (replaced the planning-session cluster) | `MONGODB_URI`, database `eujobs`. Tests use database `eujobs_test` on the same cluster. **Only ever touch `eujobs` and `eujobs_test`, and keep seed and test data small.** |
| Stripe sandbox `acct_1QxYbXLUXYC1nS7o` (US, default USD), test mode | Checkout in EUR, GBP, PLN, SEK, DKK, CZK, HUF and RON. Subscription in PLN, then cancel and re-subscribe the same Customer in EUR. `adaptive_pricing[enabled]=false` accepted. No Customer Portal configuration exists yet. | 2026-10-30 | Hosted Checkout + webhook (S); the Stripe CLI forwards webhooks using the secret key (§2.10), so no CLI browser login is ever needed |
| OpenAI | `gpt-5.5`, `gpt-5.4-mini`, `text-embedding-3-large` (3072 dims), `gpt-4o-mini-transcribe` with `whisper-1` as fallback; a real transcription test passed | planning session | OD7 is resolved (P4 done) |
| Gmail SMTP | Sends mail (personal Gmail, about 500 recipients per day) | planning session | All email (S) |
| Uploads folder | `C:/eujobs-data/uploads` exists outside OneDrive | P2 | `UPLOAD_DIR` (C17) |
| Google Places (New) | The owner verified `GOOGLE_PLACES_API_KEY` (the Housbe server key: shared billing and quota). Google Translation is not enabled on it. The first call through the proxy is P18. | 2026-10-30 | City autocomplete and place details through the server proxy only (G-1, §2.16) |

### 1.3 Environment variables (`server/.env`)

Names only. Never print values. Node's `--env-file` loads them; variables already present in the environment win over the file, which the e2e harness uses for test overrides.

| Name | Meaning | First used |
|---|---|---|
| `NODE_ENV` | `development` or `test`. `test` switches to database `eujobs_test`, captured mail, uploads under `UPLOAD_DIR/_test`, the `/_test` routes, and no automatic scheduler timer. | Phase 1 |
| `PORT` | API port (5000 in development; the e2e harness overrides it with 5100) | 1 |
| `CLIENT_ORIGIN` | `http://localhost:5173`. CORS origin and the base of every link in emails, Stripe return URLs and the certificate QR (M-204). The e2e harness overrides it with `http://localhost:5174`. | 1 |
| `MONGODB_URI` | Atlas connection string of the shared stuti cluster (`cluster0.6bhj96m`, §1.2). The code selects the database by name (`eujobs`, or `eujobs_test` in test mode) and never touches any other database. | 1 |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | HS256 signing key; token lifetime (7d, M-007) | 1 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Gmail SMTP transport and sender | 1 |
| `SEED_PASSWORD` | Password of every seeded account. It must pass the password rules (M-006, U2); the seed refuses to run otherwise. | 1 |
| `SEED_ADMIN_EMAIL` | Inbox of the seeded Owner admin. Demo candidate and recruiter accounts use plus-aliases of it (S, OD9). | 1 |
| `UPLOAD_DIR` | Root folder for uploaded and generated files, outside OneDrive (C17) | 3 |
| `FILE_URL_SECRET` | HMAC key for signed file URLs (U39) | 3 |
| `STRIPE_SECRET_KEY` | Stripe test-mode key | 5 |
| `STRIPE_WEBHOOK_SECRET` | Must equal the signing secret printed by `stripe listen` (P8) | 5 |
| `OPENAI_API_KEY` | OpenAI key | 9 (Phase 10 for transcription) |
| `OPENAI_MODEL` | `gpt-5.5` (U4 "large" features) | 9 |
| `OPENAI_FAST_MODEL` | `gpt-5.4-mini` (U4 "fast" features) | 9 |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-large`, 3072 dims | 9 |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe`; the code falls back to `whisper-1` (OD7) | 10 |
| `GOOGLE_PLACES_API_KEY` | Google Places (New) server key, used only by the `places` proxy (G-1, §2.16); it never goes to the browser. It is the Housbe server key, so it shares Housbe's Google billing and quota; swapping it for an own key means changing only this setting. Added by the owner on 2026-10-30, so `server/.env` now holds 23 variables. | 3 |

Do not add new server variables without asking the owner. The client dev server reads one non-secret variable, `VITE_API_PROXY` (the proxy target; default `http://localhost:5000`), which the e2e harness sets.

### 1.4 Tools on this machine

Node 24.19, npm 11, Git, Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`, Stripe CLI 1.55.3 (always run with `--api-key` taken from `server/.env` by a script, never typed or printed, so the 90-day CLI login does not matter; P8), cloudflared 2026.8.2 (not needed for the build, P17).

**ffmpeg is not installed.** There is no transcoding (M-102). Video duration is read in the browser (D8). Media fixtures are generated or downloaded (P11).

### 1.5 Stripe sandbox facts

- Test mode only; prices are VAT-inclusive; no Stripe Tax (M-127).
- Stripe does not email receipts for test-mode payments. Use the stored receipt or hosted-invoice link instead, and do not test for receipt emails (C12).
- All 8 currencies use two-decimal minor units in Stripe, HUF included, and every planned price is above Stripe's minimums (D2).
- There is no Customer Portal configuration yet. Phase 5 creates one through the API (P6).
- The failed-payment retry settings (Dashboard only) are **optional** (P7). Lapse handling works from subscription and invoice webhooks whatever the final retry action is (§2.10).
- `stripe listen --api-key <key> --forward-to …` forwards webhooks to localhost (M-204, P8). The key is read from `server/.env` by `npm run stripe:listen`. No CLI browser login is needed.

### 1.6 Remaining prep and the phase that does it

| Prep | Phase | Prep | Phase |
|---|---|---|---|
| P5 (rest: end-to-end paid Checkout per currency) | 5 | P11 test fixtures | 3, 4, 8, 10 |
| P6 Customer Portal configuration | 5 | P12 plus-alias demo accounts | 1 (seed derives them) |
| P7 failed-payment settings (owner, Dashboard) | optional; not a prerequisite | P13 Atlas headroom check | done (§1.2): shared cluster, keep data small; Phase 9 embeddings included |
| P8 `stripe listen --api-key` signing-secret check | 5 | P14 logo file | not needed (OD11) |
| P9 fonts | 2 (client), 8 (server PDFs) | P15 Imprint identity | before go-live (§8) |
| P10 common-password list | 1 | P16 npm packages | per phase (§2.14) |
| P18 Google Places proxy check | 3 | | |
| P17 cloudflared | not needed now (§8) | P1–P4 | done |

---

## 2. Architecture

### 2.1 Server layout

```
server/
  package.json          "type": "module"; scripts in §2.2
  server.js             connects the DB, starts HTTP, starts the scheduler (not when NODE_ENV=test)
  app.js                builds and exports the Express app without listening (imported by tests)
  config/
    env.js              reads and validates process.env with zod; exports `config`; never logs values
    enums.js            the key catalogue (§4.1), the only place enum keys are defined
    limits.js           every field, size and count limit (M-031, M-033, U26, M-102, …)
  lib/
    db.js               mongoose connect; dbName = eujobs | eujobs_test; syncIndexes at start
    errors.js           AppError + the stable error codes (§2.3)
    validate.js         zod middleware → VALIDATION_FAILED with field keys
    audit.js            audit writer (M-162)
    mailer.js           send pipeline (§2.8); mail/templates.js renders from i18n
    i18n.js             server dictionaries (§2.11)
    files.js            storage paths, type checks, signed URLs (§2.6)
    images.js           sharp helpers;  pdfText.js  pdfjs-dist + mammoth;  pdf.js  certificate PDF
    markdown.js         marked + DOMPurify;  svg.js  DOMPurify SVG profile
    money.js  locale.js  time.js (luxon)  phone.js (libphonenumber-js)
    ai.js               OpenAI client, cache, daily cap, embeddings, transcription (§2.9)
    stripe.js           Stripe client and helpers (§2.10)
  middleware/           auth.js  permissions.js  entitlements.js  rateLimit.js  upload.js  error.js
  modules/<name>/       <name>.model.js  <name>.schemas.js  <name>.service.js  <name>.routes.js
  routes/v1.js          mounts every module router under /api/v1, plus /_test when NODE_ENV=test
  jobs/scheduler.js     60-second tick (OD10);  jobs/tasks/<type>.js  one handler per task type
  i18n/en.json es.json fr.json   server texts: emails, certificate PDF, CSV labels, AI language names
  seed/catalog.js  seed/demo.js  seed/data/   (U41)
  assets/fonts/         Inter and Manrope TTF with Latin Extended (P9)
  data/common-passwords.txt                   (P10)
  test/setup.js  test/helpers/  test/<module>.test.js
```

| Module | Owns |
|---|---|
| `auth` | register (candidate, recruiter), login, email link and code, forgot/reset, admin invite acceptance |
| `users` | `/me`, preferences, password change, notification toggle, legal acceptance, counters |
| `meta` | countries, languages, config (limits and enums), plans list, legal texts, FAQs |
| `places` | Google Places (New) proxy: city autocomplete and place details, per-user rate limit, cache, session tokens (G-1, §2.16) |
| `files` | the signed file endpoint and the File model |
| `candidates` | profile, sections, photo, onboarding, privacy, completeness, overview |
| `cv` | CV versions, extraction, earlier-version requests, download log |
| `verification` | phone code, evidence submissions, admin verification queue |
| `companies` | company, logo, recruiter onboarding steps, KYC, account review |
| `jobs` | jobs, wizard drafts, quality checks, saved jobs, skill suggestions |
| `discovery` | recruiter candidate search, profile view, shortlist, notes, activity, profile views |
| `applications` | applications, pipeline stages, status emails |
| `messaging` | conversations, messages |
| `alerts` | job alerts, alert matching and digests |
| `payments` | plans, checkout, webhook, subscriptions, payments, portal |
| `learning` | courses (admin builder and learner views), enrollments, progress, quiz, certificates |
| `matching` | embeddings, policies and versions, scores, relevance |
| `ai` | AI summaries, insights narratives, CV AI, translations |
| `admin` | access management, user tables and details, metrics, reports, audit log, admin payments |
| `moderation` | user reports, cases, decisions |
| `privacy` | export, erasure, retention sweep |

### 2.2 Runtime and scripts

Express 5: rejected promises reach the error handler, so no async wrapper package is needed. Express 5 path syntax applies (named wildcards). Node's `--env-file` replaces `dotenv`.

| Script (`server/package.json`) | Command |
|---|---|
| `dev` | `node --watch --env-file=.env server.js` |
| `start` | `node --env-file=.env server.js` |
| `test` | `node --env-file=.env --import ./test/setup.js --test --test-concurrency=1 "test/**/*.test.js"` (`setup.js` sets `NODE_ENV=test` before any import) |
| `seed:catalog` | `node --env-file=.env seed/catalog.js` |
| `seed:demo` | `node --env-file=.env seed/demo.js` |
| `mail:test` | `node --env-file=.env scripts/mailTest.js <type> <to>`, development only: one live email for the owner to confirm (§2.13) |
| `lint` | `oxlint` |
| `stripe:listen` | `node --env-file=.env scripts/stripeListen.js` spawns `stripe listen --api-key <STRIPE_SECRET_KEY> --forward-to http://localhost:<PORT>/api/v1/stripe/webhook`. The key goes straight from `process.env` into the child process and is never printed. Added in Phase 5. |
| `stripe:check-secret` | `node --env-file=.env scripts/stripeCheckSecret.js` runs `stripe listen --api-key <key> --print-secret`, captures the output in memory, compares it with `STRIPE_WEBHOOK_SECRET` and prints only `match` or `mismatch` (P8). Added in Phase 5. |

Local run: `cd server && npm run dev`; `cd client && npm run dev` (Vite proxies `/api` to the server, M-204); from Phase 5 also `cd server && npm run stripe:listen`.

### 2.3 API conventions

- Base path `/api/v1`, JSON only. Auth header `Authorization: Bearer <jwt>` (S).
- **Lists:** `{ items, total, page, pageSize }`. Server pagination (`page`, `pageSize`) on the four admin tables of M-206 (Users, Applications, Payments, Audit); other lists return all rows.
- **Errors:** `{ "error": { "code": "VALIDATION_FAILED", "fields": { "title": "too_short" }, "params": { "min": 3 } } }`. Codes are stable UPPER_SNAKE keys, and field messages are keys such as `required`, `too_short`, `too_long`, `invalid` and `not_allowed`. The client translates both (M-143). The server never sends English sentences.
- **Money:** `{ amountMinor, currency }`: integer minor units plus an ISO 4217 code (U24). **Salary:** `{ min, max, currency, period }`: integer major units, period `year` or `month` (M-131, U26).
- **Dates:** ISO 8601 UTC strings. Month precision (work history, education) is stored as `YYYY-MM`; date-only values (permit expiry) as `YYYY-MM-DD` (M-133).
- **IDs:** MongoDB ObjectIds (M-205). **Enums:** keys from §4.1 (M-142).
- **Country scope:** discovery endpoints read the signed-in user's `pickerCountry` on the server (M-135, M-137). Admin lists take an optional `country` query (M-138). Chart endpoints take `tz` (IANA) from the browser (M-170).

| Code | HTTP | When |
|---|---|---|
| `AUTH_REQUIRED` | 401 | No token, an invalid or expired token, or a tokenVersion mismatch. The client clears the token and goes to sign-in with `?next` (M-011). |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password; also a non-admin on the admin portal and an admin on another portal (M-005) |
| `EMAIL_UNVERIFIED` | 403 | Candidate login before the link is opened (M-001); recruiter endpoints before the email code, except code verify, code resend and `/me` (U37) |
| `ACCOUNT_SUSPENDED` | 403 | Suspended recruiter (M-165) |
| `RECRUITER_NOT_APPROVED` | 403 | Recruiter workspace endpoint while not approved; payload `{ status, step }` (M-151) |
| `FORBIDDEN` | 403 | Wrong role, or not the owner of the resource |
| `PERMISSION_DENIED` | 403 | Admin without the route's permission; payload `{ permission }` (M-155) |
| `PLAN_REQUIRED` | 402 | Candidate without the entitlement; payload `{ entitlement }` (M-118) |
| `PROFILE_INCOMPLETE` | 403 | Apply with an incomplete profile; payload `{ missing: [itemKey] }` |
| `NOT_FOUND` | 404 | Missing, or not visible to this user |
| `JOB_NOT_ACCEPTING` | 410 | Apply to a paused, closed, restricted or invisible job (M-043, M-044) |
| `TOKEN_INVALID` / `TOKEN_EXPIRED` / `TOKEN_USED` | 400 / 410 / 409 | Email-link tokens (M-001, M-009, U21) |
| `CODE_INVALID` / `CODE_EXPIRED` / `CODE_LOCKED` | 422 / 410 / 429 | Email and phone codes; payload `{ attemptsLeft }` (M-004) |
| `EMAIL_TAKEN` | 409 | Recruiter sign-up with a registered email (OQ-6h) |
| `CONFLICT` | 409 | Duplicate (already applied, already enrolled, …) |
| `IN_USE` | 409 | Stage with active applications (M-072); role with assigned users (M-158) |
| `LOCKED` | 409 | Restricted job republish (M-167); course lessons or quiz after enrollment (M-108); KYC replacement after submit (M-185) |
| `OWNER_PROTECTED` | 409 | Lock-out rules (M-160) |
| `VALIDATION_FAILED` | 422 | zod or business validation; `fields`; job publish adds `step` (M-039) |
| `FILE_TYPE_NOT_ALLOWED` / `FILE_TOO_LARGE` | 422 / 413 | Upload rules (M-185) |
| `RATE_LIMITED` | 429 | Payload `{ retryAfter }` in seconds (M-008, U1) |
| `AI_DAILY_LIMIT` | 429 | Payload `{ resetAt }` (OD13) |
| `AI_UNAVAILABLE` | 503 | The OpenAI call failed |
| `PAYMENT_PROVIDER_ERROR` | 502 | A Stripe call failed |
| `PLACES_UNAVAILABLE` | 503 | A Google Places call failed (G-1); city fields show a retry message |

### 2.4 Validation

One zod schema file per module (`<name>.schemas.js`). The middleware `validate({ body, query, params })` maps zod issues to field keys. Business rules that need the database (uniqueness, state transitions) live in the service and throw `AppError`. Every limit lives in `config/limits.js`. `GET /api/v1/meta/config` serves the limits and the enum keys, so client forms never hard-code them. Client validators return `{ key, params }` and are translated in the field component (A: shared §4.7).

### 2.5 Auth and sessions

- **Passwords (M-006, U2):** 8 to 128 characters and at most 72 bytes; not in the top-10,000 list (P10); not equal to the email local part (case-insensitive); no composition rules. `bcryptjs` cost 12.
- **JWT (M-007):** HS256 with `JWT_SECRET`; lifetime `JWT_EXPIRES_IN` (7d); claims `{ sub, role, tv }`. Every request loads the user and checks `tv === tokenVersion` and the status. Admin effective permissions are computed per request from the database (A: admin §4.3).
- **tokenVersion** increases on password reset (M-009) and on suspension (M-165). A password change does not sign out other sessions; no decision asks for it. Logout is client-side (M-007).
- **Email links (M-001, M-009, U21):** 32 random bytes, stored as a SHA-256 hash, single use. Lifetimes: email verification 24 h, reset 1 h, admin invite 72 h. Verification resend at most 1 per minute and 5 per day per email (M-001); the "already registered" email shares those limits (U36).
- **Codes (M-002, M-003, M-004):** 6 random digits, stored hashed; 10-minute expiry; 5 wrong attempts lock the code; resend after 60 s, at most 5 per hour. The recruiter email code is emailed. The phone code is returned in the API response and shown on screen (no SMS).
- **Login (M-005):** one endpoint with `portal: candidate | recruiter | admin`. A candidate/recruiter mismatch signs in and the client goes to the account's own workspace with a notice. The admin portal accepts only admins, and admins sign in only there; otherwise `INVALID_CREDENTIALS`.
- **Rate limits (M-008, U1):** in memory (`express-rate-limit`), no lockout.

| Limit | Key | Value |
|---|---|---|
| Failed logins | email | 5 per 15 min |
| Logins | IP | 20 per 15 min |
| Forgot password | email | 5 per hour |
| Sign-up | IP | 10 per hour |
| Certificate verification page | IP | 30 per minute (U17) |

- **Middleware:** `requireAuth`, `requireRole(role)`, `requireVerifiedEmail` (recruiters, U37), `requireApprovedRecruiter` (M-151), `requirePermission(id)` (M-155, Owner bypass M-160), `requireEntitlement(key)` (U38).

### 2.6 Files and signed URLs

- **Storage (M-185, C17):** root `UPLOAD_DIR` (development) or `UPLOAD_DIR/_test` (test); one subfolder per purpose; random 32-hex file names; never under the client or a web root. A `File` record holds owner, purpose, path, original name, MIME, size, sha256 and `deleteAfter`.
- **Checks (M-185):** extension, declared MIME, magic bytes (`file-type`) and size (multer `limits.fileSize`). Images are re-encoded with sharp, which strips metadata.

| Purpose | Types | Max | Notes |
|---|---|---|---|
| Profile photo | JPG, PNG, WebP | 5 MB | square cover crop; stored 400×400 and 96×96 (M-013) |
| CV | PDF, DOCX | 10 MB | max 20 versions (M-031, U18) |
| Verification evidence, KYC, external certificate file | PDF, JPEG, PNG | 10 MB | KYC replaceable only while onboarding is in progress or rejected (M-185) |
| Company logo | PNG, JPG, SVG | 2 MB | SVG sanitised with DOMPurify's SVG profile (M-150) |
| Course cover | JPG, PNG, WebP | 5 MB | M-107 |
| Lesson video | MP4 (H.264/AAC), WebM | 500 MB | Range streaming, no transcoding (M-102). The server checks the container; the admin page reads duration and playability in the browser. Upload on localhost only (C26). |
| Lesson document | PDF | 50 MB | M-102 |
| Report voice note | mp3, m4a, wav, webm, ogg | 25 MB | M-182 |
| Generated | certificate PDF, report CSV, export ZIP | — | written by the server |

- **Signed URLs (U39, C16):** `GET /api/v1/files/:fileId?u=<userId>&exp=<unix>&sig=<hex>`, where `sig` = HMAC-SHA256(`FILE_URL_SECRET`, `<path>|<userId>|<exp>`). URLs are valid 15 minutes for images, PDFs and CVs, and 6 hours for video. DTOs contain them only after the ownership or visibility check. The endpoint checks the signature and expiry, then streams with `res.sendFile` (Range support for video and PDF, D8), `Cache-Control: private`, and `inline` or `attachment` disposition.
- **Download log (M-187):** when a CV file is served to someone other than its owner, a log row is written; the candidate sees the list.
- **Admin access:** KYC, evidence, right-to-work, certificate and voice-note files need `documents.view`.

### 2.7 Scheduler (OD10)

- In process: `setInterval(tick, 60_000)`, plus one tick at startup, which catches up on anything missed while the server was off.
- `ScheduledTask { type, key, dueAt, payload, status: pending|running|done|failed, attempts, lastError, lockedAt }`. Each tick claims due tasks atomically (`findOneAndUpdate` pending → running). A unique `key` while pending makes collapse and dedupe trivial. A failed task is retried on the next tick up to 3 attempts, then marked `failed` and logged.
- Daily slots use `JobRun { name, lastRunAt }`: `relevance-nightly` at 03:00 server time, run at startup if the last run is over 24 h old (U7); `retention-sweep` at 03:00 (U32). Digests are evaluated each tick per user time zone (U12).
- Task types: `email.message` (U13), `email.stage` (M-091, U13, U33), `email.new-applications` (OD14), `alerts.instant` (M-097), `matching.recompute` (M-048, M-051).
- Test mode starts no timer. `POST /api/v1/_test/scheduler/tick { now }` runs one tick as of `now`.

### 2.8 Mailer (OD9, M-092, M-095, U43)

- nodemailer over Gmail SMTP (`SMTP_*`), sender `MAIL_FROM`. Templates live in `server/i18n/<lang>.json` (subject, text and HTML through one shared layout) and are rendered in the recipient's language. Links are built from `CLIENT_ORIGIN`.
- `sendEmail({ type, to, userId, language, params })` runs these checks in order:
  1. Reserved domains (`example.com/.org/.net`, `.test`, `.invalid`, `.localhost`): log only, status `suppressed_reserved`.
  2. Non-critical type and the user's email toggle is off: `skipped_toggle`.
  3. Non-critical and 400 non-critical sends already in the rolling 24 h: `skipped_cap` (OQ-6c).
  4. Otherwise send: `sent` or `failed`.
- **Classes** (full list in §3.17):
  - **Critical, always sent:** verify link, already registered, recruiter code, password reset, admin invite.
  - **Decision, always sent and never capped (M-095):** recruiter approved/rejected/suspended, verification approved/rejected, content restricted, certificate issued, renewal failed, plan ended.
  - **Non-critical (email toggle and cap):** alerts (instant, daily, weekly), application status, rejection, new message, new applications, CV request.
- `EmailLog { type, class, userId, to, language, status, error, createdAt }` stores no body. In test mode the transport is an in-memory capture readable through `/_test/mail`.

### 2.9 AI service

- `openai` SDK. Models come from the environment and follow U4:

| Model variable | Features |
|---|---|
| `OPENAI_FAST_MODEL` | job summaries, match explanations, insight narratives, translations, profile AI summary |
| `OPENAI_MODEL` | CV snapshot proposal, CV assisted draft, policy suggestion, report-brief summary |
| `OPENAI_EMBEDDING_MODEL` | embeddings |
| `OPENAI_TRANSCRIBE_MODEL` | voice-note transcription; falls back to `whisper-1` (OD7) |

- `generate({ kind, userId, language, cacheKey, model, input })`:
  1. Look up `AiCache` by (kind, key, language).
  2. On a miss, check the daily cap: 50 generations per user per UTC day, admins exempt (OD13). Cache hits, embeddings and admin "Regenerate" are not counted (U3).
  3. Call OpenAI, store the result, increment `AiUsage`.
  The prompt asks for the answer in the user's language (S, M-057, M-062, M-181).
- Errors become `AI_UNAVAILABLE`. Code-computed evidence still renders without the AI part.
- Embeddings (U6): input truncated to about 8,000 tokens (estimate 4 characters per token; no tokenizer package), full 3072 dims, stored as a Float32 `Buffer`, cosine computed in Node.
- In test mode `lib/ai.js` uses a deterministic stub, so API tests never call OpenAI. The browser e2e of Phase 9 and Phase 10 uses the real API.

### 2.10 Stripe service (U40, M-120 … M-128)

- `stripe` SDK with `STRIPE_SECRET_KEY`. Pin `apiVersion` to the SDK default at install time.
- `seed:catalog` (from Phase 5) creates idempotently: one Product "Plus"; 8 Prices with `lookup_key` `plus_monthly_<cur>` (OD1 amounts × 100); and the Customer Portal configuration (P6: cancel at period end, payment-method update, invoice history, plan switching off). Their ids are stored in `AppConfig('stripe')`.
- **Checkout sessions** always send `currency`, `payment_method_types: ['card','link']`, `locale` (en/es/fr), `adaptive_pricing: { enabled: false }`, `client_reference_id` (user id), `metadata { kind, itemId, userId }`, a `success_url` to the role's return route with `{CHECKOUT_SESSION_ID}`, and a `cancel_url` back to the starting page. The plan uses the Price for the currency; courses use inline `price_data`.
- **Customers:** one per user, on `User.stripeCustomerId`. If Stripe ever refuses a currency on an existing Customer, use one Customer per currency (U40).
- **Webhook** `POST /api/v1/stripe/webhook`: raw body, mounted before `express.json`, signature checked with `STRIPE_WEBHOOK_SECRET`. Insert `StripeEvent { eventId }` first; a duplicate key returns 200 and does nothing. Events handled: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created|updated|deleted`, `charge.refunded`. If a handler throws, delete the marker and return 500, so Stripe retries.
- **Entitlement from webhooks (U38, M-120).** No Dashboard setting is needed; any final retry action leads to a correct state.
  - `Subscription.status` mirrors Stripe from `customer.subscription.created|updated|deleted`.
  - `Subscription.retrying` is set from `invoice.payment_failed` (`next_payment_attempt` not null) and cleared by `invoice.paid`.
  - Paid = status `active` or `trialing`, or `past_due` while `retrying` is true ("keep access while Stripe retries", M-120).
  - Free = `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, or `past_due` with no further attempt.
  - So the final action may be "cancel", "mark unpaid" or "leave past due" (P7 is optional).
- **Webhook forwarding (P8).** `npm run stripe:listen` (development) and the e2e harness both spawn `stripe listen --api-key …` with the key from the environment. No CLI browser login is needed. If `npm run stripe:check-secret` prints `mismatch`, stop and ask the owner to update `STRIPE_WEBHOOK_SECRET` in `server/.env` (never paste the value into chat or logs).
- **Seed objects (OD8):** customers and subscriptions created by `seed:demo` carry `metadata.seed=true` and `metadata.db=<dbName>`. Re-seeding deletes only those for the same database.
- **Tests:** API tests sign payloads with `stripe.webhooks.generateTestHeaderString` (no network). Renewals and failures use Test Clocks and card `4000 0000 0000 0341`, advanced through the whole retry schedule. The e2e completes real hosted Checkouts.

### 2.11 Server i18n

`server/i18n/{en,es,fr}.json` hold email templates, certificate PDF text, CSV labels (OQ-6d) and language names for AI prompts. The recipient's `User.language` decides; the sign-up language decides for the sign-up emails. Everything else is a code that the client translates (M-143). A test asserts that es and fr have every en key.

### 2.12 Security

- `helmet`; `cors` with origin `CLIENT_ORIGIN`; `express.json` limit 1 MB; no stack traces in responses; logs never contain env values, tokens or codes.
- `app.set('trust proxy', 'loopback')`. The rate-limit key uses `CF-Connecting-IP` when the request arrives through a local cloudflared tunnel (C26).
- The `/_test` router is mounted only when `NODE_ENV=test`.

### 2.13 Testing architecture

**API tests** (`server/test`, `node:test` + `supertest`):
- They import `app.js` directly and use database `eujobs_test`.
- Each file resets the collections it uses. Mail is captured, OpenAI is stubbed, and Stripe webhooks use signed test payloads.
- Rate limits are tested with `X-Forwarded-For` (trust proxy loopback).

**e2e harness** (repo root `e2e/`, its own `package.json` with `puppeteer-core`):
- `node e2e/run.js <phase-N | sweep | scenario-name>` does the following:
  1. Seeds `eujobs_test` (`seed:catalog`, then `seed:demo`, with `NODE_ENV=test`).
  2. Starts the server with `NODE_ENV=test`, `PORT=5100`, `CLIENT_ORIGIN=http://localhost:5174`.
  3. Starts Vite on port 5174 with `VITE_API_PROXY=http://localhost:5100`.
  4. From Phase 5, starts `stripe listen --api-key <key from the environment> --forward-to http://localhost:5100/api/v1/stripe/webhook`. The key is never printed.
  5. Launches the local Chrome and runs the scenarios at 1440×900 and 375×812.
- Every page fails the scenario on: console errors, unexpected 4xx/5xx responses, i18n missing-key reports, and horizontal overflow at 375 px.
- Screenshots go to `e2e/artifacts/<run>/` (add it to `.gitignore`). The run prints a PASS/FAIL table and exits non-zero on any failure.
- Scenarios live in `e2e/scenarios/pNN-*.js`, each exporting `{ name, viewports, run(ctx) }`. `e2e/routes.js` lists every route per role (the 69 current routes plus each new screen as it is added); the `sweep` target visits all of them.

**`/_test` routes** (test mode only):

| Route | Purpose |
|---|---|
| `POST /_test/reset` | clear the rate-limit stores and the mail capture |
| `GET /_test/mail?to=&type=` | captured messages, including links and codes |
| `POST /_test/scheduler/tick { now }` | run one scheduler tick as of `now` |
| `POST /_test/db { collection, op, filter, update }` | shift dates, read counts, create test-only admins |
| `POST /_test/ai/fail-next` | make the next OpenAI call fail |

**Live checks** (cannot be automated): each new email type is sent once with `npm run mail:test` in development to a plus-alias of `SEED_ADMIN_EMAIL`. The owner confirms it arrived; if the session has a Gmail connector, it may confirm instead. Hosted Checkout and OpenAI are exercised for real by the e2e.

### 2.14 Packages (P16 resolved)

| Package | Where | Phase | Why |
|---|---|---|---|
| express (5), mongoose, zod, jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit, nodemailer, luxon | server | 1 | core, auth, mail, time zones (U12) |
| multer, file-type, sharp, pdfjs-dist, mammoth, pdfkit, libphonenumber-js, iso-639-1, archiver | server | 3 | uploads, CV text, seed CV PDFs, phone, languages, DOCX fixtures and (Phase 12) exports |
| dompurify, jsdom, marked | server | 4 (SVG), 8 (Markdown) | one sanitizer |
| stripe | server | 5 | payments |
| qrcode | server | 8 | certificate QR |
| openai | server | 9 | AI |
| supertest, oxlint | server (dev) | 1 | tests, lint |
| @reduxjs/toolkit, react-redux, i18next, react-i18next, @fontsource/inter, @fontsource/manrope | client | 2 | data layer, i18n, self-hosted fonts (M-192) |
| puppeteer-core | `e2e/` | 1 | browser verification with the local Chrome |

Resolved duplicates and dropped packages:
- **One HTML sanitizer: `dompurify` (with `jsdom` on the server).** It has a vetted SVG profile that M-150 needs and also sanitises the Markdown HTML of M-102. `sanitize-html` is not used.
- **One PDF text extractor: `pdfjs-dist`** (legacy build in Node). It is maintained, ESM, and used directly. `pdf-parse` (an old wrapper of the same engine) is not used.
- **No `dotenv`:** Node's `--env-file`.
- **No `node-cron`:** the 60-second scheduler plus `luxon`.
- **No TanStack Query** (S), **no `@stripe/stripe-js`** (hosted Checkout is a redirect), **no language-detector package** (`navigator.language`), **no `uuid`** (`crypto`).
- **No client Markdown library:** the course builder preview calls the server renderer.

Install each package in the phase that first needs it. Record exact versions in the lock files.

### 2.15 Client architecture

- **Store:** `client/src/app/store.js` (`configureStore` with the API reducer and a `session` slice). `main.jsx` wraps the app in `<Provider>` and initialises i18n.
- **API:** `client/src/app/api.js`:
  - `createApi` with `fetchBaseQuery({ baseUrl: (import.meta.env.VITE_API_URL ?? '') + '/api/v1', prepareHeaders })` adds the Bearer token.
  - `baseQueryWithReauth`: on `AUTH_REQUIRED` it clears the token, resets the API state and goes to the role's sign-in with `?next=<same-origin path>` (M-011).
  - `tagTypes` cover every entity.
  - Each feature group injects its endpoints in `features/<role>/<group>/api.js` (`api.injectEndpoints`). Every storage-hook call site listed in A: shared §11.2 (53 sites), A: recruiter §0.1, A: candidate §31a and A: admin §10.2 is replaced by these hooks.
- **Session:** the token is stored under `lwm-auth-token`. It must not start with `lwm.` while legacy key-wiping code exists (A: shared §4.6). `useMe()` reads `GET /me`. Anonymous language and country use `lwm-pref-language` and `lwm-pref-country` (M-135). A `storage` event signs other tabs out.
- **Router:** the workspace loader awaits `getMe` and applies the §3.1 state machine. The public routes come from `features/auth/routes.jsx` plus new `features/public/routes.jsx` (legal pages, certificate page). Workspace routes stay auto-collected (CONVENTIONS).
- **Browser storage allowed after migration:** the auth token; anonymous language and country; the candidate's dismissed overview insight; the recruiter's selected match job (M-041). Nothing else.
- **i18n:**
  - `i18next` + `react-i18next`; resources in `src/i18n/locales/{en,es,fr}/<namespace>.json`.
  - Namespaces: `common`, `shell`, `auth`, `errors` (one key per §2.3 code), `validation`, `enums` (one key per §4.1 key), and one per feature group.
  - en is bundled; es and fr are loaded on demand.
  - `<html lang>` and `document.title` (route `handle.titleKey`) follow the language.
  - Missing keys are reported as console errors in development and test, which the e2e treats as failures.
  - Plurals use i18next plural keys (A: shared §12.12); line breaks in headings use `<Trans>`.
- **Formatting** (`src/lib/format.js`, rules in §3.11):
  - `formatMoney(amountMinor, currency)` shows 0 decimals for whole amounts (U24).
  - Also: `formatSalary`, `formatDate`, `formatDateTime`, `formatMonth` (`YYYY-MM`), `formatRelative` (`Intl.RelativeTimeFormat`), `formatNumber`, weekday labels.
  - Country and language names come from `Intl.DisplayNames`; sorting uses `localeCompare` with the UI locale.
  - `StatCard` takes a number plus a formatter, which fixes the `useCountUp` decimal-comma bug (A: shared §3).
- **Plan gates:** `usePlan()` reads `me.plan` and `me.entitlements`. `RequirePlan` (route layout, generalised `PlusGate`) and `PlanGate` (inline) gate the UI. A global `PLAN_REQUIRED` handler opens the upgrade dialog (A: shared §8.3).
- **Mock removal:** each phase deletes the `data/` files, hooks and storage call sites it replaces. `useSharedLocalStorage.js` and `utils/downloadCsv.js` are deleted when their last caller goes (Phase 12 at the latest).

### 2.16 Places proxy (G-1)

- **Server only.** Google Places (New) is called by the `places` module with `fetch` (no SDK). `GOOGLE_PLACES_API_KEY` never reaches the browser, a response, a log or an error.
- **Autocomplete:** `GET /places/autocomplete?input=&sessionToken=` (input 2–60 characters). The proxy asks Google for cities with `languageCode` = the user's UI language (en/es/fr) and the client's session token, and keeps only EU 27 + UK results. It returns `{ items: [{ placeId, city, secondary }] }`.
- **Details:** `GET /places/:placeId?sessionToken=` → `{ placeId, city, countryCode }`. A place outside EU 27 + UK → 422 `VALIDATION_FAILED` (`placeId: not_allowed`). The same token ends the typing session, so Google bills it as one session.
- **Session token:** the client creates one (`crypto.randomUUID()`) when a city field gets focus and drops it after a pick.
- **Region filter.** Google accepts at most 15 region codes, so none are sent and the server filters. Each autocomplete call sends one fixed Europe rectangle as `locationRestriction` (lat 27.5 to 71, lng −31.5 to 35; it covers Cyprus, Malta, the Canary Islands, Madeira and the Azores), so Europe fills the 5 suggestions (P3-Q1). Suggestions carry no ISO country code: the last part of the secondary text is matched against the EU 27 + UK names in the request language, plus Google's "UK" in English, and the main text is used when there is no secondary text (P3-D1, verified by P18). Place details always confirm the country before anything is saved.
- **Saving a city.** Forms send a `placeId` only. The service resolves it through details (cached) and stores `{ countryCode, city, placeId }`, never coordinates. The city name is kept in the language it was picked in; filters and matching compare `placeId`.
- **Rate limit per user** (in memory): autocomplete 60 per minute, details 30 per minute → `RATE_LIMITED`.
- **Cache** (in memory, small): autocomplete by (lower-cased input, language) for 10 minutes; details by (placeId, language) for 24 hours; at most 1,000 entries each, oldest out first.
- **Errors and tests.** A failed Google call → 503 `PLACES_UNAVAILABLE`. API tests inject a fake Places client, so they never call Google; the Phase 3 browser check uses the real proxy.
- **Not Google.** The header country picker stays the seeded 29-country list (M-139). Translation stays on OpenAI (M-144); Google Translation is not enabled and not used.

---

## 3. Product rules

The behaviour spec. Each rule cites its source. Where `DECISIONS.md` and this section differ, this section wins: it includes OD1–OD16, the C resolutions and the U defaults.

### 3.1 Accounts, sign-in and the state machine

One role per account: `candidate`, `recruiter` or `admin` (S). Candidates and recruiters sign up separately; the header workspace switch is removed (S). The first admin is seeded as Owner (S); further admins are invited (M-159).

**Candidate**

| State (`User.status`) | Entered by | Sign-in result | Lands on |
|---|---|---|---|
| `unverified` | `POST /auth/candidate/register` (no token, M-001) | 403 `EMAIL_UNVERIFIED`; the alert offers Resend | `/sign-up/check-email` right after sign-up |
| `active`, onboarding not done | opening the verification link | token | `/candidate/onboarding/story` until `onboardingCompletedAt` is set (M-001, M-014) |
| `active`, onboarding done | onboarding plan step completed | token | `?next` or `/candidate` |

**Recruiter**

| State | Entered by | Sign-in result | Lands on |
|---|---|---|---|
| `unverified` | `POST /auth/recruiter/register` returns a token and emails a code (U37) | token | `/recruiter/onboarding/email-code` (M-002) |
| `onboarding` | correct email code | token | first incomplete step (M-151): company → KYC → verify (phone) |
| `pending_review` | submit after the phone code (M-003) | token | `/recruiter/onboarding/review`: under review |
| `rejected` | admin Reject with a reason (M-165) | token | review page with the reason and Resubmit; the recruiter edits data or documents, then resubmits (M-152) |
| `active` | admin Approve (M-165) | token | `?next` or `/recruiter` |
| `suspended` | admin Suspend with a reason; tokenVersion +1 | token | review page with the blocked message (M-151). Lifted by an admin Approve in Account review, which sets the status to `active` and sends the approved email (OQ-2). |

Every recruiter workspace endpoint returns `RECRUITER_NOT_APPROVED` unless the status is `active`. Onboarding endpoints are open from `onboarding` onward. Before the email code, everything except code verify, code resend and `/me` returns `EMAIL_UNVERIFIED` (U37).

**Admin**

| State | Entered by | Lands on |
|---|---|---|
| `invited` | invite email: 72 h, single use, role chosen at invite (U21) | `/admin/set-password?token=`, then `/admin/sign-in` |
| `active` | password set, or the seeded Owner | `?next` or `/admin` |

**Rules**

- **Login (M-005).** One role-agnostic login. A candidate on the recruiter page (or the reverse) is signed in and sent to their own workspace with a friendly notice. Only admins can use the admin page, and admins sign in only there. Anyone else gets `INVALID_CREDENTIALS`.
- **Duplicate candidate sign-up (M-001, U36).** Same check-email screen. The existing account gets a "You already have an account" email with sign-in and reset links, under the same 1-per-minute and 5-per-day limits. Duplicate recruiter sign-up returns 409 `EMAIL_TAKEN`; the form shows sign-in and reset links (OQ-6h). U37 issues a token at sign-up, so a neutral screen is not possible for recruiters.
- **Verification link (M-001).** 24 h, single use. Resend at most 1 per minute and 5 per day. The page shows "Email verified" and Sign in; there is no auto sign-in. No email change in v1, so the M-001/M-004 re-verification on email change is not built (M-010, C21).
- **Recruiter email code (M-002, M-004).** Entered right after sign-up; onboarding continues only after it. Step 4 handles only the phone.
- **Forgot/reset (M-009).** "Forgot password?" on all three sign-in pages and one `/forgot-password` route. The link lasts 1 h and is single use; the reply is neutral ("if an account exists"). A reset signs out all sessions, marks the email verified and links to that role's sign-in.
- **Change password (M-010).** Current + new, in candidate and recruiter Data & account and in admin Settings.
- **Sessions (M-007, M-011).** 7-day token in localStorage; logout is client-side. On 401 the token is cleared and the user signs in again with `?next=<same-origin path>`. Signed-in visitors on `/`, `/sign-in` or `/sign-up` go to their workspace.
- **Consent (M-191, U22).** The sign-up checkbox is required and stores the Terms and Privacy versions plus the acceptance date. A new version shows a blocking re-accept dialog at the next sign-in.
- **Time zone (U12).** The browser's IANA time zone is saved on the user at each sign-in.
- **Language and country (M-135).** Stored on the user (§3.11).

### 3.2 Candidate profile and completeness

| Field | Rule | Source |
|---|---|---|
| Full name | on `User.fullName`, from sign-up, editable in Edit profile, ≤ 100 | M-012, A: recruiter Part C |
| Headline | required, ≤ 60 | A: candidate §26 |
| Location | a city picked through the Places proxy, stored as `{ countryCode, city, placeId }` (EU 27 + UK; no coordinates) | M-032 as changed by G-1 |
| About | 20–600 | A: candidate §26 |
| Years of experience | integer 0–50, separate from work history | M-018 |
| Skills | 1–12, each ≤ 30, unique case-insensitive | M-064, A: candidate §26 |
| Work preference | `remote`, `hybrid` or `on_site` | A: candidate §26 |
| Availability | `available_now`, `within_2_weeks`, `within_1_month`, `open_to_opportunities`, `not_looking` | M-024 |
| Minimum salary | optional; when set it must be a valid amount in the profile country's currency with a period; not counted in completeness | M-017, M-131 |
| Work history | ≤ 20 entries: title and employer ≤ 100, start `YYYY-MM`, end or "I currently work here", description ≤ 1,000 (translatable on demand); or "No work experience yet" | M-018, M-031 |
| Education | ≤ 20 entries: institution and degree ≤ 100, start, end or "Still studying"; or "No formal qualification" | M-019, M-031 |
| Languages | ISO 639-1 code + one level (A1–C2, Native); at least 1; names translated into the UI language | M-020 |
| Right to work | entries for EU and/or UK: citizen/settled, visa/permit (with expiry date) or needs sponsorship; at least 1; optional evidence goes to the verification queue; nationality never used | M-021 |
| Links | at least one of LinkedIn (must match `linkedin.com/in/…`) or portfolio (any https URL) | M-022 |
| Photo | required; JPG/PNG/WebP ≤ 5 MB; square; stored 400×400 + 96×96; shown in the shell and to recruiters; no pre-moderation; admins can remove it through moderation; never a matching input | M-013 |
| External certificates | optional file or URL; with a file the candidate can request verification; recruiters see "Verified" only for reviewed ones | M-025 |
| Privacy | `discoverable` (default on), `resumeVisible` (default off), `matchingConsent` (default on) | M-187, A: candidate S54 |
| Email notifications | ~~one toggle, default on; there is no in-app toggle~~ superseded (P11b-Q3, Q12): one email switch per category, default on; in-app notifications are always on | M-095, ~~OD6~~ P11b |

**Completeness checklist.** One server function returns `{ complete, done, total, percent, items: [{ key, done, route }] }`. It is embedded in `/me` and used by the apply gate, discovery (M-054), the promo card (M-196), the admin columns (M-161) and every checklist UI (M-015; ordering item 12).

| # | Item key | Done when | Source |
|---|---|---|---|
| 1 | `basics` | full name, headline, location (country + city), about, years, at least 1 skill and work preference all set | M-015, M-017 (salary excluded) |
| 2 | `work_history` | at least 1 entry, or "No work experience yet" | M-018 |
| 3 | `education` | at least 1 entry, or "No formal qualification" | M-019 |
| 4 | `languages` | at least 1 language with a level | M-020 |
| 5 | `right_to_work` | at least 1 EU or UK entry | M-021 |
| 6 | `photo` | photo uploaded | M-013 |
| 7 | `links` | at least 1 valid link | M-022 |
| 8 | `live_cv` | a live CV version exists | S |
| 9 | `phone` | phone verified with the on-screen code | M-003, M-004 |
| 10 | `check_identity` | identity check approved | M-023 |
| 11 | `check_academic` | counted only when an education entry exists; academic check approved | M-023 |
| 12 | `check_employment` | counted only when a work-history entry exists; employment check approved | M-023 |

- N is 10 to 12 and percent = done / N, with every item weighted equally (M-015). Admins approve only the evidence; completeness itself is automatic (M-016).
- Checks are per category, and one approved item per category is enough. Editing or deleting the entry linked to an approved item resets that category. An expired permit shows "Permit expired" and counts as no right to work in filters; completeness is unaffected (U27).

**Onboarding (M-014).** Three steps: story (CV upload), preferences (work preference, location, optional salary), plan (M-129). A partial draft profile is allowed, and `onboardingCompletedAt` is stored at the end. After that the candidate is sent to the checklist. The header country defaults to the profile country at onboarding (M-136).

**CV (M-027 … M-031, U18).**
- PDF or DOCX ≤ 10 MB, at most 20 versions. Text is extracted on upload. A PDF without a text layer is stored and flagged "No readable text", and matching then uses profile text.
- The AI snapshot proposal is paid; the profile changes only on explicit confirmation. Free gets extraction only.
- The assisted draft is paid: suggestions plus a revised snapshot, no new file; pending drafts can be deleted (M-061).
- Any own version can be downloaded, and any version except the live one can be deleted (M-028).
- Deleting a CV used in applications deletes the file everywhere; recruiters see "CV removed by the candidate" (M-030).

**Earlier-version requests (M-029, U19).**
- A recruiter requests with a reason (`verify_employment`, `earlier_role_cv`, `compliance`, `other`) and details ≤ 1,000.
- The candidate gets an email (under the email toggle) and sees a pending list on the CV page.
- Approving means choosing which version to share (A: recruiter RQ-44); the recruiter can then open it, and the download is logged. Declining shares nothing.

**Verification (M-016, M-023, M-166, M-168).**
- **Categories:** identity, academic, employment, right to work, external certificate.
- **Evidence types:**
  - identity: `passport`, `driving_licence`, `national_id`;
  - academic: `degree_certificate`, `diploma`, `transcript`;
  - employment: `employment_letter`, `contract_page`, `verified_reference` (A: candidate S34).
  Right-to-work and certificate submissions have no type select; the file is linked to the entry.
- **Linking:** each submission is linked to a profile entry (identity → the account name; academic → an education entry; employment → a work entry; right to work → its entry; certificate → its entry).
- **Statuses:** `in_review` → `approved` or `rejected` (reason ≤ 300). Resubmission is allowed. Self-approval is removed.
- **What recruiters see:** a tick per approved identity, academic and employment check (M-168).

**Phone (M-003, M-004, OD3).** E.164 with a country-code input. The code is shown on screen. One phone may be used by several accounts.

### 3.3 Plan, entitlements and lapse

- **Plans.** Free, and **Plus** (M-115) at £9 a month with the OD1 prices per currency (§3.10). The plan record lives in the database and is edited through the seed, with name and features per language, prices, interval, Stripe price ids and entitlements (M-116). ~~Only candidates have a plan; recruiter AI is free for approved recruiters (M-117).~~ Superseded by Phase 11c (P11c-Q1 … Q19): approved recruiters have Free and **Recruiter Plus** (§3.22).
- **Entitlement keys:** `apply`, `message_send` (start and reply), `job_alerts`, `ai` (score and explanations, AI summaries, insights pages, CV snapshot, assisted draft, profile summary, translation) (S, M-118).
- **Paid** when the Stripe status is `active` or `trialing`, or `past_due` while Stripe still retries (the last failed invoice has a next payment attempt). **Free** for `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, or `past_due` with no further attempt (U38, refined by M-120 "keep access while Stripe retries"). This works whatever final retry action the Dashboard uses, so no Dashboard setting is a prerequisite (§2.10).
- **Cancel and failure (M-120, M-121).** Cancellation takes effect at period end through the Stripe Customer Portal. During a failed renewal, access stays while Stripe retries (`past_due`) and locks when Stripe marks the subscription unpaid or canceled.
- **Not gated:** browsing, searching and saving jobs; profile, CV and verification; course purchases; reading messages (S).
- **Lapse (M-119).** Applications stay active and withdrawable. Alerts are kept but paused, and resume on re-subscribing. Messages stay readable. AI pages lock. Only new actions are blocked.
- **Locked UI (M-118).** AI pages and Job alerts show a plan chip that opens the upgrade gate. Messages are read-only with an upgrade prompt in place of the composer. Apply opens the gate with the missing items and the upgrade.
- **Free match display (M-050).** A non-AI overlap label (M-052). Plus adds the score and explanations.
- **Onboarding plan step (M-129).** A subscriber sees "You're on Plus" and continues; the plan changes only through Billing.
- **Promo card (M-196).** Free: plan upsell with the price. Plus but incomplete: "Complete your profile" to the checklist. Otherwise hidden. A subscriber's price is shown in the subscription's own currency (C14).
- **Recruiters** never see a candidate's plan (M-087).

### 3.4 Applications and pipeline

- **Apply gate.** The server checks the `apply` entitlement (`PLAN_REQUIRED`), completeness (`PROFILE_INCOMPLETE` with `missing`) and that the job accepts applications (`JOB_NOT_ACCEPTING`), in one request (S).
- **Apply dialog (M-073).** CV version (default: live), optional cover note ≤ 2,000, required consent checkbox (stored with a timestamp).
- **Records.** One active application per candidate and job. Re-applying after a withdrawal creates a new record, and the old one stays withdrawn (M-074). Status history keeps dated steps `{ status, at, actor }`, plus a "Next step" text per status; there is no interview scheduling (M-075).
- **Candidate statuses:** `applied`, `under_review`, `interview`, `offer`, `hired`, `not_selected`, `withdrawn` (M-070, U33).
- **Pipeline (M-069, M-072, OD5).**
  - One card per application, showing the job. Stages belong to the company, and stage history is stored.
  - Each stage has one of 6 fixed categories: `applied`, `screening`, `shortlisted`, `interview`, `offer`, `hired`.
  - The first stage, "Applied" (category `applied`), is never removed or moved.
  - 2 to 12 stages; names 1–24 characters, unique case-insensitive.
  - A stage cannot be removed while it holds active applications. History keeps old names.
  - A new custom stage defaults to `screening` (M-070: custom → Under review).
- **Default stages,** created when the company is approved: Applied, Screening, Shortlisted, Interview, Offer, Hired, with the matching categories. Names are created in the company's language and then treated as user content (M-142; A: recruiter Part C).
- **Status from category (OD5):** `applied` → Applied; `screening` and `shortlisted` → Under review; `interview` → Interview; `offer` → Offer; `hired` → Hired.
- **Reject (M-090, U33).** The status becomes `not_selected` and the card leaves the board; a "Not selected" filter shows it. The confirm dialog has "Email the candidate", checked by default. The email waits the M-091 10 minutes, which is also the undo window. Undo = choose a stage again in the application's stage select; if the mapped status then equals the last emailed status, nothing is sent (OQ-6e).
- **Withdrawn (M-076).** Kept with a filter and badge in Applications, removed from the board.
- **Stage select (M-071).** One per application, hidden for non-applicants. Sourced candidates are not added in v1.
- **Applications table (M-077, M-078).** Job and Applied columns plus a job filter. "All open roles" on the board becomes a job filter (M-069). The "Candidate portal activity" section is removed.
- **Emails.**
  - Status change (M-091, U13): scheduled 10 min after the last move and sent only if the mapped status differs from the last emailed status.
  - New applications to the recruiter (OD14): at most one email per job per hour ("{n} new applications for {job}"), under the email toggle.
- **Activity timeline (M-081).** Company-wide; stored as type + params and rendered through translations. Events: applied, withdrew, replied, CV request decided, CV updated, plus colleagues' actions.
- **Recruiter Overview.**
  - Applications = active applications to the company's jobs, excluding not selected and withdrawn (M-082).
  - The "Shortlisted" series = shortlist additions per day; periods This week and Last week (M-083). Weeks start Monday in the browser time zone (M-170).

### 3.5 Messaging, counters and the bell

- **Threads (M-086).** One per company + candidate, optionally tagged with a job; text only, ≤ 2,000, no attachments. Polling about every 15 s with an unread badge (S).
- **Candidates (M-084).** A paid candidate can start a conversation only with recruiters of jobs they applied to, and reply in any thread. Free candidates read only.
- **Recruiters (M-085, U28).** Approved recruiters can message applicants and discoverable candidates only. After a candidate hides, existing threads stay open for both sides, but no new thread can start.
- **Plan (M-087).** Never shown to recruiters.
- **Default outreach text (M-088).** A translatable template in the recruiter's UI language; the candidate can translate it on demand.
- **New-message email (M-089, U13).** Sent when a message is unread for 15 min and no email went out for that conversation in the last 60 min. In the recipient's language; under the toggle and the cap.
- **Counters (M-094).** One `GET /me/counters` every 15 s, paused in hidden tabs. Candidates: unread messages and active applications (not withdrawn, not `not_selected`, as in M-082). Recruiters: unread messages. Badges are hidden at 0.
- ~~**Bell (M-093, OD6).** No dot and no feed; the bell links to notification settings.~~ **Superseded 2026-11-04 by Phase 11b (P11b-Q1 … Q15):** in-app notifications for all three roles, a bell with the unread count and a dropdown of the latest 10, a Notifications page per role, per-section sidebar counts, and one email switch per category (see §3.21).
- **Translate** per message (M-144; paid for candidates, free for recruiters). **Report** a message (M-164).
- **Outreach (M-180).** Each recruiter-started conversation counts as "reviewed outreach".

### 3.6 Job alerts

- Plan-gated (S). At most 10 alerts; name ≤ 80, keywords ≤ 120 (M-031). The location is optional: a city picked through the Places proxy inside the alert's country, stored as `{ countryCode, city, placeId }` (G-1).
- **Frequencies (M-096, U12).** Instant, daily at 08:00, weekly on Monday at 08:00, in `User.timezone`. A digest lists jobs first published since the last digest. Empty digests are not sent; missed slots go out at the next tick.
- **Trigger (M-097).** First publish only (`firstPublishedAt`). Resume, reopen and edit do not trigger (M-037).
- **Matching (M-098, U35).**
  - Every keyword must appear in the job's title, company, skills, city, work mode, level or industry. Labels are also matched in the alert's language.
  - A city alert matches jobs with the same `placeId` (G-1); without a city, the whole alert country matches.
  - The alert stores the picker country when it is created (Remote allowed) and matches only that country.
- **Lapse (M-119).** Paused while Free; resumes on re-subscribing.

### 3.7 Jobs

- **Fields and limits (M-033, M-035, U26).**
  - Title 3–120; brief 40–5,000; up to 20 responsibilities of ≤ 300.
  - Required skills 1–20, preferred skills up to 20, each 1–50; a skill cannot be both required and preferred.
  - Experience 0–50 years. Required languages with a minimum level. Visa sponsorship yes/no.
  - Salary min and max are integers 0–100,000,000, with max ≥ min.
- **Enums (M-142).**
  - Employment type: `full_time`, `part_time`, `contract`, `internship`.
  - Level: `junior`, `mid`, `senior`, `lead`.
  - Work preference: `remote`, `hybrid`, `on_site`.
- **Location (M-032 as changed by G-1, OD2, OQ-6i).** On-site and hybrid jobs have a city picked through the Places proxy, stored as `{ countryCode, city, placeId }`; its country (EU 27 + UK) is the job's country. Remote jobs have country `REMOTE` and an optional list of eligible countries; empty means all EU 27 + UK. The list shows as a badge on cards and details, and as an "Eligible in" filter inside the Remote view.
- **Salary currency (M-131).** Locked to the job country's currency; remote jobs use EUR. Stored as integer + currency + period (`year` or `month`).
- **Skills (M-034).** Free text, normalised case-insensitively. Suggestions are the most-used skills per market and language.
- **Wizard (M-041, M-060, M-039).**
  - The draft becomes a server job with status `draft` once step 1 is valid; Cancel keeps it.
  - Step 7 is renamed "Quality checks" and runs the same rules on the server.
  - Every transition to published is validated on the server; a 422 opens the wizard at the first invalid step.
- **Statuses (M-040, M-038, M-037).**
  - Tab order: published, paused, draft, closed (a Closed tab is added).
  - Only drafts can be deleted.
  - Edits are live: the AI summary and embedding regenerate, no repeat alert emails go out, and applicants are not notified.
- **Company name (M-042).** Always the company's display name; not editable per job.
- **Visibility (M-044).** Candidates see only published jobs of approved recruiters that moderation has not restricted.
- **Paused, closed or removed jobs (M-043).** Applicants and savers see "No longer accepting applications"; everyone else sees "no longer available".
- **Restricted (M-167).** Paused and locked; the reason is shown; no republish until cleared.
- **Dropped.** No perks or tagline fields; empty sections are hidden (M-036). The premium concept and its copy are removed (M-045).
- **Admin Jobs (M-046).** Lists all statuses with a status filter.

### 3.8 Discovery and matching

- **Find jobs (M-137, OD2, U25).**
  - Uses the header country. The Remote view lists remote-flagged jobs only; a country view lists on-site and hybrid jobs located there.
  - The salary filter is in the view's currency, with monthly salary × 12. Candidate minimum salary is compared only within the same currency.
  - Keyword rules are those of §3.6. An optional city filter (picked through the Places proxy) keeps jobs with the same `placeId` (G-1).
- **Find candidates (M-054, M-055, OQ-6a).**
  - Lists email-verified, discoverable, matching-consenting, complete candidates in the selected country.
  - "In the country" means the residence country, or a right to work there (citizen/settled or a valid permit, for the EU or UK region). Remote means open-to-remote candidates (profile work preference `remote`) in any country (OQ-6a).
  - Applicants stay visible to that company through their application (M-054, M-187).
- **Discovery filters (M-056, OD4, OQ-6f).**
  - "Has right to work in {country}" (citizen/settled or a valid permit; legal review before go-live).
  - Language with a minimum level.
  - Verified: every check M-023 requires for that candidate is approved (OQ-6f).
  - Availability (M-024).
  - City (optional): picked through the Places proxy; keeps candidates whose profile city has the same `placeId` (G-1).
- **Shortlist (M-079).** One list per company with `addedBy` and `createdAt`; the candidate is not notified. Candidates who turned discovery off are hidden, with a "no longer available" count.
- **Notes (M-080).** One per company + candidate, ≤ 5,000, with `updatedBy` and `updatedAt`, visible to the company.
- **Profile views (M-184).** One view per approved recruiter per day. The candidate sees the last 30 days compared with the previous 30.
- **Skill overlap (M-052).** One server function (required + preferred skills) and the same label everywhere.
- **Score (M-047, U5).**
  - `sim = clamp((cos − 0.20) / (0.60 − 0.20), 0, 1)`; `skill = matched required / required`; `score = round(100 × (0.6·sim + 0.4·skill))`.
  - The "experience" signal controls `sim` and "skills" controls `skill`; the weights are renormalised when one is off.
  - "Location" on: a mismatch caps the score at 49 (OQ-6g). A mismatch is either of these:
    - the candidate's profile country is not the job's country (on-site or hybrid), or is not in a remote job's non-empty eligible list;
    - the candidate's work preference differs from the job's.
  - Labels: Strong ≥ 75, Good ≥ 50. Weights and thresholds are stored per policy version. OpenAI writes explanations only.
- **Embeddings (U6).**
  - Candidate text: headline + about + skills + work history + education + live-CV text.
  - Job text: title + brief + responsibilities + skills + level + languages.
  - Every candidate with matching consent is embedded, Free included; only the display is gated.
- **Who sees the score (C6, M-057, M-050, M-068).** Paid candidates see the score, label and explanations. Free candidates see the overlap label only. Recruiters see ranking and evidence, never a number or a percentage. Admins see %.
- **Relevant count (M-051, U7, C7).** Candidates in the M-054 + M-055 population with a score ≥ Good. It is cached, refreshed on job save and nightly at 03:00 server time, and caught up at startup if more than 24 h have passed. The fallback when no embedding exists: at least 1 required skill.
- **Recommended jobs (M-053, U8, C11).** For Plus: published jobs in the picker country with a score ≥ Good, ranked. "+N this week" = published in the last 7 days. For Free: jobs sharing at least 1 required skill, ranked by overlap, then recency.
- **Recruiter recommendations.** The "Recommended candidates" KPI = distinct candidates relevant to at least one published job (A: recruiter RQ-34). "Talent worth meeting" = the top 3 such candidates who are neither shortlisted nor applied (A: recruiter A9).
- **Policy (M-048, M-049).** One global active policy. Signals: skills, experience, location; at least one must be on. Name and description are editable, drafts can be archived, and a version history is referenced by match results. Saving or activating triggers a recompute.
- **Exclusions (M-187, M-013, M-021).** Candidates without matching consent are left out of AI matching in both directions. Photo and nationality are never inputs.

### 3.9 Learning

- **Courses (M-113).** One collection with audience `candidate` or `recruiter`, authored in one language. Video and PDF lessons are single-language with a language tag. Titles, summaries and text lessons are translatable on demand.
- **Builder (M-101, M-102, M-106, M-107, U16).**
  - Full-page editor with tabs Details, Lessons, Quiz, Preview.
  - Lesson types: video (MP4 H.264/AAC or WebM ≤ 500 MB), text (Markdown ≤ 50,000 characters, sanitised; textarea plus preview), document (PDF ≤ 50 MB), link (https only).
  - Duration is read in the browser at upload and stays editable. Any lesson can be flagged as a free preview.
  - The Details tab holds every learner-facing field: summary, about (candidate) or lead (recruiter), tagline, designed for, outcomes, cover ≤ 5 MB.
  - Courses carry skill tags (M-114). There is no global disk cap.
- **Prices (U24, M-130, M-100).** A course needs all 8 currency prices, or Free, to publish. Prices are integer minor units. Cards show "Free" or the price; tiers and the "Learning Plus" pill are removed. Courses are one-time purchases, not part of the plan (S).
- **Editing after enrollment (M-108).** Once anyone is enrolled, lessons and the quiz are locked; copy and prices stay editable.
- **Unpublishing (M-109).** The course is hidden, buyers keep access, and courses are never deleted.
- **Completion (M-099, M-103, U15).**
  - Text, PDF and link lessons complete on open.
  - Video: the client sends a heartbeat every 15 s. The server credits `min(Δwall, 15 s) × min(rate, 2)` only when the position advanced without a seek, and completes the lesson at credited ≥ 90% of the duration.
  - The course completes when the final quiz is passed. There is no manual "Mark complete". Recruiters use the same model.
- **Quiz (M-104).**
  - Single- and multiple-choice questions, 2–6 options; pass mark per course (default 70).
  - Unlocks after all lessons. The score is shown but not the correct answers. Options are shuffled. Attempts are unlimited and the best score is kept.
  - Validation limits: 1–50 questions, question text 5–500, option text 1–200 (A: admin §9.1).
- **Certificates (M-105, U17, C18).**
  - The PDF shows the holder's name at issue, the course, the date, the platform name, and the code with a QR code and link to `/certificates/:code`.
  - The PDF chrome is in the holder's language; the course title stays as authored. The PDF is stored as a snapshot.
  - The public page shows name, course, date and Valid / Revoked / No longer valid, and is rate-limited.
  - An admin revoke is audited. A name change re-issues the PDF with the same code.
- **Badge (C24, M-026).** Shown wherever the profile is visible to the viewer. Certificates do not verify skills.
- **Definitions (M-110).** Enrolled = added (free) or bought. Active learner = at least 1 lesson done and not completed. Completions = quiz passed = certificate issued.
- **Admin stats (M-111).** Row text "{enrolled} enrolled, {purchased} purchased, {completions} completed"; a Revenue column per currency (needs `finance.view`); page totals; a learners list per course.
- **Recruiter purchases (M-112).** Belong to the user.
- **Suggestions (M-114, OQ-3).** Rule-based, labelled "Suggested for you", shown to Free and Plus alike.
  - Candidates: gap skills = required skills missing from the profile across saved jobs, applied jobs and the first 10 For-you jobs. Published candidate courses not yet enrolled are ranked by how many gap skills their tags match; courses matching none are not shown.
  - Recruiters: each recruiter course carries one pipeline category (OD5), set in the builder. Up to 3 published recruiter courses not yet enrolled are ranked by the company's active applications in that category, with the reason "{n} active applications at {stage}"; a category with 0 active applications is not suggested.

### 3.10 Payments and currencies

- **Currencies (M-130, C14).**
  - EUR, GBP, PLN, SEK, DKK, CZK, HUF, RON. The header country sets the currency; Remote = EUR.
  - In test mode any country's currency may be used for a purchase.
  - Billing and the promo card show a subscriber's own subscription currency.
- **Reports (M-130, C15, U34).** Money is totalled per currency and never summed across currencies. Money cards show one line per currency, largest first, at most 3, then "+n more".
- **OD1 price table (verbatim):**
  - Plan: GBP 9 · EUR 10 · PLN 45 · SEK 119 · DKK 79 · CZK 259 · HUF 3,990 · RON 55
  - £19 course: EUR 22 · PLN 95 · SEK 249 · DKK 169 · CZK 549 · HUF 8,490 · RON 115
  - £29 course: EUR 34 · PLN 145 · SEK 369 · DKK 249 · CZK 829 · HUF 12,990 · RON 169
  - £39 course: EUR 45 · PLN 195 · SEK 499 · DKK 339 · CZK 1,099 · HUF 17,490 · RON 229
  - £49 course: EUR 57 · PLN 245 · SEK 629 · DKK 429 · CZK 1,399 · HUF 21,990 · RON 289
- **Flow.**
  - A confirm dialog shows the item, the server price, the currency and "Continue to secure payment" (M-124).
  - Then the Stripe hosted Checkout (S), with card and Link only; Apple/Google Pay appear inside the card option (M-126, C13). Locale en/es/fr; Adaptive Pricing off (U40).
  - A per-role return page polls the session, refreshes plan, enrolments and payments, then returns to the starting page (M-125).
- **Portal (M-121).** The Stripe Customer Portal handles cancellation at period end, card updates and invoices.
- **Payment rows (M-122, C12).**
  - One row per one-time payment and per paid invoice. Failed renewals are recorded as `failed`; Dashboard refunds become `refunded`.
  - Abandoned or declined Checkout attempts are not recorded.
  - The Stripe receipt or hosted-invoice link is stored.
- **Reference (M-128).** A server sequence `LWM-000001`, with the Stripe ids stored alongside.
- **Tax (M-127).** Prices are VAT-inclusive. No Stripe Tax and no VAT ids in test mode.
- **Admin (M-123).** View only: renewal rows, subscription status and period in the details, a Plan column and filter on Candidates, and Active subscribers and MRR cards.

### 3.11 Country, language and formats

- **Countries (M-139, D16).** A seeded collection of 29 rows (EU 27 + `GB` + `REMOTE`) with ISO code, currency, default language, `isRemote`, order and `enabled`. 21 countries use EUR, including BG since 2026. CZ, DK, HU, PL, RO and SE use their own currencies, GB uses GBP, and Remote uses EUR. Names come from `Intl.DisplayNames`. The picker sorts by translated name with Remote last. It is not Google: only city fields use the Places proxy (G-1).
- **Default language (M-134).** ES → es; FR, BE, LU → fr; every other country → en. It applies until the user picks a language (`languageExplicit`); changing the country never overrides an explicit choice.
- **Storage (M-135).**
  - The server is the source of truth; anonymous visitors use localStorage.
  - The default language comes from the browser (en/es/fr, else en).
  - Sign-up requires a country select, defaulting to the browser region if it is listed, else Remote.
- **Header country vs profile (M-136).** The header country is a browsing preference. It is separate from the profile location and defaults from the profile country at onboarding.
- **What the picker filters (M-137).** Discovery surfaces only: Find jobs, recommendations, alert matching, Find candidates, shortlist discovery. Never the user's own applications, jobs, pipeline, messages or payments.
- **Admins (M-138).** No picker. Admin lists, Overview and Analytics get an "All countries / {country}" filter.
- **Format locale (M-133, M-132).**
  - `<language>-<country>`, e.g. en-DE, fr-BE, es-ES.
  - Remote and admins: en-IE, es-ES, fr-FR by language (M-132, OQ-6b).
  - Dates use the browser time zone, and date-only values are stored without a time.
- **Text (M-141, M-142, M-143).** UI text lives in translation files; business data and staff content live in the database. Enums are stored as keys. The server sends codes, and localises only emails, AI output and PDFs. Server-built CSV files are of the same kind: headers and labels in the requester's language, with a UTF-8 BOM (OQ-6d).
- **Translate (M-144).** On-demand Translate exists for job brief and responsibilities, company About, candidate about, work-history descriptions and messages (not skills or names). It is cached per entity + field + language + hash. Paid for candidates, free for recruiters. It uses OpenAI only; Google Translation is not enabled and not used (G-1).
- **Public pages (M-140).** A small language picker in the auth layout, on every public page.

### 3.12 Recruiter onboarding and company

- **Company (M-145).** One recruiter per company. Company is a separate record, and every recruiter-owned record carries `companyId`.
- **Names (M-146, M-147).** The legal name is verified in KYC; the display name is public and defaults to the legal name. After approval only these fields are editable: display name, industry, size, city, website, description.
- **Size (M-148).** Keys `1_10`, `11_50`, `51_200`, `201_500`, `501_1000`, `1000_plus`, with translated labels.
- **Country and city (M-149, G-1).** The company city is picked through the Places proxy and stored as `{ countryCode, city, placeId }`; its country (EU 27 + UK, no Remote) is the company country. At step 2 the company country sets the recruiter's header country (and so the currency) and the default language, unless the language was chosen explicitly. The business address stays free text for KYC.
- **Logo (M-150).** PNG/JPG/SVG ≤ 2 MB, SVG sanitised. Without a logo, a letter tile whose colour is derived from the company id.
- **Steps.**
  1. Sign-up, then the email code.
  2. Step 1: account details, edit only, no password fields (M-153).
  3. Step 2: company.
  4. Step 3: KYC. Identity and registration documents are required, authorization is optional; PDF/JPEG/PNG ≤ 10 MB; replaceable only while in progress or rejected (M-185).
  5. Step 4: phone, with the on-screen code (M-003). Then submit.
  6. Step 5: review status page.
- **Before approval (M-151).** Recruiters see only onboarding or status pages.
- **Admin review (M-165, M-003).**
  - Approve / Reject / Suspend; a reason is required for reject and suspend.
  - The dialog shows the applicant, the company record, email verified, "Phone confirmed on screen (no SMS)", the KYC files (`documents.view`), the submitted date and earlier decisions.
  - Approve sets the status to `active`, creates the default stages and sends the "approved" email.
  - Reject sends the reason by email, and resubmission is allowed (M-152).
  - Suspend increases tokenVersion and sends an email. The jobs disappear from candidates through the M-044 visibility rule.

### 3.13 Admin access and permissions

- **Who is listed (M-154).** Access management lists admin staff only; roles gate admin pages.
- **Enforcement (M-155).** Every admin API route checks its permission. The sidebar, global search and page actions hide what the admin may not use. A 403 page shows on direct URLs.
- **Owner (M-160, U21).** The `isOwner` flag is set only by the seed. Owners bypass permissions and cannot be revoked; at least one Owner always exists. Nobody can remove their own `roles.assign`. Invited admins are never Owner.
- **Invites (M-159, U21).** An admin with `users.add` invites by email. The link lasts 72 h and is single use; the role is chosen at invite.
- **Roles (M-157, M-158).** Name 2–40, unique case-insensitive; description ≤ 240; at least 1 permission (A: admin §2.2). "Access scope" and user "department" are descriptive labels only. Edit uses the prefilled create dialog; archiving is blocked while users are assigned.
- **Effective permissions** = role permissions ∪ granted − removed (A: admin §2.2).

**Permission catalogue** (adopted, OQ-6j; derived from M-156 "Figma list + missing ids, drop ids with no feature" and A: admin §4.2, §4.4):

| Id | Guards |
|---|---|
| `dashboard.view` (new) | Overview |
| `users.view` | Candidates and Recruiters lists, detail pages (M-161) |
| `users.add` | Invite an admin (M-159) |
| `users.deactivate` | Suspend decision (M-165) and Approve of a suspended recruiter (OQ-2) |
| `roles.view` | Roles and User access tabs |
| `roles.create` | Create and duplicate a role |
| `roles.edit` | Edit a role (M-158) |
| `roles.archive` | Archive a role (M-158) |
| `roles.assign` | Save or revoke a user's access |
| `candidates.view` | Applications page, Recruitment page |
| `jobs.view` (new) | Jobs list, job AI summary and its Regenerate |
| `moderation.manage` | Moderation tabs (content, accounts, verification) and their decisions |
| `documents.view` (new) | Open KYC, evidence, right-to-work and certificate files, and voice notes |
| `learning.view` (new) | Courses list, stats, learners |
| `learning.manage` | Course builder, uploads, publish, certificate revoke |
| `finance.view` | Payments, subscription details and KPIs, Revenue column |
| `reports.view` | Analytics, report history |
| `reports.export` | Generate reports and every CSV export (with the page's view permission) |
| `audit.view` | Audit logs; Overview "Recent platform activity" |
| `ai.view` (new) | AI & matching page, oversight, feedback aggregates, AI status |
| `ai.manage` (new) | Create, edit, archive and activate policies; policy suggestion |

Dropped, because no feature uses them: `users.edit`, `jobs.manage`, `pipeline.manage`, `company.edit`, `finance.approve`. Admin Settings (own name, password, language) needs no permission. The seeded roles Manager, Accounts Head and Staff keep their Figma permission lists minus the dropped ids. The seed's "Sarah Miller → Manager" assignment is removed (M-154).

### 3.14 Moderation and verification

- **Reports (M-164, U20).**
  - A Report button on job details, candidate profiles, company sections and messages.
  - Reasons: `spam`, `scam_or_fraud`, `discriminatory`, `offensive`, `misleading`, `other`; details ≤ 500.
  - At most 10 reports per user per day, and one open case per reporter and target.
  - A message report stores an excerpt: the reported message plus up to 5 earlier messages of that thread (OQ-1). Admins never browse threads otherwise. Admins can also open cases from Jobs.
- **Content decisions (M-167).**
  - Dismiss or Restrict, with a reason. Restrict on a job pauses and locks it. Restrict on a profile hides it from discovery, and an admin can remove the photo (M-013).
  - Dismiss lifts the restriction. History is kept and the owner is emailed.
  - Company and message cases offer Dismiss only. To act, the admin suspends the recruiter through Account review (M-165) or restricts the candidate's profile (OQ-1).
- **Account review.** See §3.12.
- **Candidate verification (M-166).**
  - A third Moderation tab. Approve, or Reject with a required reason ≤ 300; resubmission allowed.
  - Covers identity, academic, employment, right-to-work evidence and external certificates. Each submission is linked to a profile entry. Decision emails follow M-092.
- **Admin table columns (M-169).**
  - Candidates' verification: Not started (no submission) / In review (submissions in review, none approved) / n of 3 verified (1–2 categories approved and not all required ones) / Verified (every M-023-required check approved) (OQ-6f).
  - Recruiters' status: Pending (unverified, onboarding, pending review) / Approved / Rejected / Suspended.
  - Learning, for both: "{n} enrolled, {m} certificates".

### 3.15 Metrics

All numbers are computed from the database (S, M-208). The date range applies to charts only; KPIs are all-time and say "All time" (M-177). Weeks start Monday in the browser time zone (M-170). The admin country filter applies (M-138).

| Screen · metric | Definition | Source |
|---|---|---|
| Admin Overview · Candidate registrations | count of candidate users | A: admin §1.1 |
| · Active users | candidates and recruiters with status `active`; links to `/admin/candidates?status=active` | M-173, U10 |
| · Published jobs | jobs with status published | A: admin §1.1 |
| · Applications | all applications except withdrawn | OQ-5 |
| · Verified candidate profiles | candidates in the "Verified" state | OQ-6f |
| · Course enrollments | enrollments (enrolled = added or bought) | M-110 |
| · Course badges earned | certificates issued and not revoked | M-110 |
| · Average role match | mean, over published jobs, of each job's top 5 scores; caption "Across {n} published roles" | M-172, U9 |
| · Platform activity | registrations and applications per day (week) or per week (month), real counts in bar and line views | M-170, M-171 |
| · Companies registered | companies created at onboarding step 2, any status | OQ-5 |
| · Course purchases | paid course payments | A: admin §1.1 |
| · Verification checks in review | candidate verification submissions in review (KYC counts under Pending user reviews) | OQ-5 |
| · Shortlist activity | shortlist entries | A: admin §1.1 |
| · Outreach drafts reviewed | recruiter-started conversations | M-180 |
| · Pending user reviews | recruiters with status `pending_review` | A: admin §1.1 |
| · Most demanded skills | top 6 normalised required skills of published jobs | A: admin §1.1 |
| · Recent platform activity | latest 5 audit events (admin, system and user) | M-174 |
| Analytics · Shortlist conversion | applications whose candidate is on that company's shortlist ÷ non-withdrawn applications, all-time | M-176, U11 |
| · Recruiter accounts | every recruiter user | OQ-5 |
| · Company registrations | companies created at onboarding step 2, any status | OQ-5 |
| · Reviewed outreach | as above | M-180 |
| · Matching quality card | explanatory translatable copy, not data | M-175 |
| Recruitment · stage counts | applications per category at their current stage | M-178, OD5 |
| · Funnel | applications that ever reached each category; withdrawn excluded; fixed Figma shapes with real numbers | M-178, M-179, OD5 |
| Recruiter Overview | open positions; Recommended (§3.8); Applications (M-082); Shortlisted (entries); funnel over the company's own stages, ever reached; momentum (M-083) | M-178, OD5 |
| Candidate Overview | Recommended jobs + "+N this week" (M-053); profile views over 30 days (M-184) | — |
| Payments | Active subscribers; MRR per currency (U34); failed payments = failed renewals | M-122, M-123 |
| AI & matching | explanation feedback aggregates (helpful / needs review) | M-067 |

### 3.16 Files, privacy, retention and GDPR

- **Uploads and access.** Upload safety (M-185, §2.6); signed URLs (U39); video uploads on localhost only (C26).
- **Privacy flags (M-187).**
  - Not discoverable: hidden from search and shortlists, but not from companies the candidate applied to.
  - CV hidden: the file is available only to companies the candidate applied to.
  - No matching consent: out of AI matching in both directions.
  - Every CV download is logged and visible to the candidate.
- **Retention (M-186, U32, C18).** Identity, KYC and evidence files are deleted 30 days after the decision; only the decision record is kept. A daily sweep runs at 03:00. Certificate files are exempt.
- **Candidate "Delete my data" (M-188 + OD15).** Confirm dialog with the current password (A: recruiter Part D #10). It deletes:
  - the account, profile, files, applications, alerts and AI caches;
  - enrolments, saved jobs, shortlist entries and recruiter notes about the candidate;
  - profile views, CV requests and download logs;
  - verification evidence and decisions.
  It also changes or keeps:
  - Messages are deleted for both sides; the company sees "Deleted user".
  - Audit and moderation entries are kept, with the actor or author shown as "Deleted user".
  - The Stripe subscription is cancelled immediately (no refund) and the Stripe Customer is deleted.
  - Payment records are kept with the payer name anonymised.
  - Certificates become a tombstone `{ code, status: no_longer_valid }`, and the public page says "No longer valid".
  - The user is signed out.
- **Recruiter deletion (M-189 + OD15, OQ-6k).** Jobs are closed. The company display name is kept for past applications and threads. Personal data and KYC files are deleted. The company's notes, shortlist and activity timeline are deleted (OQ-6k). Payments are kept, with the author anonymised.
- **Export (M-190, OD15).** A ZIP of JSON plus files.
  - Candidate: data, CV files, photo, certificates. Recruiter notes are excluded.
  - Recruiter: account, company, jobs, notes, messages, payments, plus a CSV summary.
- **Legal (M-191, OD12).** Legal texts are versioned per language in the database and served on public `/legal/:doc` pages (terms, privacy, imprint). They are seeded as clearly marked drafts, version `2026-11-draft`; the Imprint is a marked placeholder (S).
- **Fonts (M-192).** Self-hosted; the Google Fonts link is removed.

### 3.17 Emails

All emails are in the recipient's language (S). Classes are defined in §2.8.

| Type | To | Trigger | Class | Source |
|---|---|---|---|---|
| `verify_email` | candidate | sign-up, resend | critical | M-001 |
| `already_registered` | existing account | duplicate candidate sign-up | critical | U36 |
| `recruiter_email_code` | recruiter | sign-up, resend | critical | M-002, M-004 |
| `password_reset` | any role | forgot password | critical | M-009 |
| `admin_invite` | invitee | invite | critical | M-159, U21 |
| `recruiter_approved` / `_rejected` / `_suspended` | recruiter | account decision (rejected and suspended include the reason) | decision | M-092, M-165 |
| `verification_approved` / `_rejected` | candidate | evidence decision | decision | M-092, M-166 |
| `content_restricted` | job or profile owner | Restrict | decision | M-092, M-167 |
| `content_restriction_lifted` | job or profile owner | Dismiss of a restricted case | decision | M-167, P10-Q12 |
| `certificate_issued` | learner | quiz passed | decision | M-092, M-105 |
| `renewal_failed` | candidate, recruiter (P11c-Q7) | `invoice.payment_failed` on a renewal | decision | M-092, M-120 |
| `plan_ended` | candidate, recruiter (P11c-Q7, Q18: names the paused jobs) | subscription canceled or unpaid | decision | M-092, M-120 |
| `alert_instant` | candidate | first publish of a matching job | non-critical | M-096, M-097 |
| `alert_daily` / `alert_weekly` | candidate | 08:00 / Monday 08:00 in the user's time zone | non-critical | U12 |
| `application_status` | candidate | mapped status changed, 10 min after the last move | non-critical | M-091, U13 |
| `application_rejected` | candidate | reject with the box checked, after 10 min | non-critical | M-090, U33 |
| `new_message` | candidate or recruiter | unread for 15 min, at most once per conversation per 60 min | non-critical | M-089, U13 |
| `new_applications` | recruiter | at most one per job per hour | non-critical | OD14 |
| `cv_request` | candidate | earlier-version request | non-critical (OQ-6c) | U19 |

No other emails exist. ~~Admins receive only invite and reset emails (OD6).~~ Superseded by Phase 11b (P11b-Q4, Q7, Q12): admins also receive the five admin event emails (`admin_account_review`, `admin_verification_submitted`, `admin_content_report`, `admin_renewal_failed`, `admin_joined`), non-critical, sent at once to admins whose permission covers the event, under their category switch and the cap. Non-critical candidate and recruiter emails follow the category switch of their type (§3.21).

### 3.18 AI features and limits

| Feature | Who | Gate | Model | Cached per | Source |
|---|---|---|---|---|---|
| Match score + label | Plus candidates see it; admins see %; recruiters see ranking only | `ai` for display (recruiter ranking: Recruiter Plus `ai`, P11c-Q16) | embeddings | job + candidate + policy version | M-047 … M-053, U5–U7, C6 |
| Match explanation / insight narrative | Plus candidate; recruiter (narrative + evidence, no score) | `ai` (both roles; recruiters through Recruiter Plus, P11c-Q4) | FAST | candidate + job + language + profile hash | M-057 |
| Job AI summary (on each card and row; no page-level button) | Plus candidate, Recruiter Plus, admin (with Regenerate) | `ai` (both roles) / `jobs.view` | FAST | job version + language | M-058, M-059 |
| AI insights pages (overview, skill gap, improve profile, job match, why recommended) | Plus candidate | `ai` | FAST + code evidence | as above | M-057, M-063 … M-067 |
| CV snapshot proposal | Plus candidate | `ai` | MODEL | CV version | M-027, U18 |
| CV assisted draft | Plus candidate | `ai` | MODEL | stored as a pending draft | M-061 |
| Profile AI summary (recruiter-ready, copyable) | Plus candidate | `ai` | FAST | profile hash + live CV + language | M-062 |
| Translate | Plus candidate; Recruiter Plus | `ai` (both roles) | FAST | entity + field + language + hash | M-144, M-088, M-113 |
| Policy suggestion | admin | `ai.manage` | MODEL | not cached | M-048, U4 |
| Report brief: transcription + executive summary | admin | `reports.export` | TRANSCRIBE + MODEL | per report | M-181, OD7 |
| Embeddings | system | matching consent | EMBEDDING | source hash | U6 |

- **Code, not AI:** listed and missing skills, years, work mode, languages and right to work are computed in code, and invented gap texts are removed (M-057). Job "Quality checks" use server rules (M-060). Course suggestions use rules (M-114). The outreach text is a template (M-088).
- **Timing (M-058).** Generated on first open, cached per entity version and language, invalidated on change, with an admin Regenerate button.
- **Cap (OD13, U3).** 50 generations per user per UTC day, with a friendly message when reached. Not counted: cache hits, embeddings, admin Regenerate. Admins are exempt.
- **Role picker (M-063).** Top 10 + saved + applied jobs; defaults to the top-ranked job.
- **"I have this skill" (M-064).** Adds the skill to the profile, within the 12-skill and 30-character rules; refused at 12.
- **"Save this opportunity" (M-065).** Uses the normal saved-jobs list.
- **Skill demand (M-066).** The denominator is all visible published jobs in the candidate's picker country.
- **Feedback (M-067).** "Helpful / Needs review" is stored and aggregated for the admin.
- **Admin oversight (M-068).** A job picker defaulting to the newest published job; the top 4 candidates; evidence for the selected candidate.

### 3.19 Shell and UI rules

- **Brand (M-193, OD11).** "Local WorkMan" everywhere, with the "AI Job Portal" tagline kept in all languages. Logo: the existing "AI" mark cropped from `logo.png`, with "Local WorkMan" and "AI Job Portal" rendered as live text in Manrope.
- **Search (M-194).** "Search anything" jumps between pages only. Labels are translated and matched accent-insensitively. The shortcut label shows Ctrl K on non-Mac systems (A: shared §2).
- **Profile menu and sidebar identity (M-195).** The subtitle shows the candidate's plan, the recruiter's company or the admin's role (Owner for owners). Photo or initials, with the email under the name. "Profile" goes to My profile, Company or admin Settings.
- **Footer (M-197).** "© {current year} Local WorkMan" plus Terms, Privacy and Imprint links. The demo footer note goes away.
- **Sign-in pages (M-198).** Demo notes are removed. The admin page shows a restricted-access notice: authorised staff only, accounts created by an administrator.
- **Admin Settings (M-199, ~~OD6~~).** Name, password change, language, and (Phase 11b, P11b-Q3) the email switches of the admin's notification categories.
- **Help (M-200).** FAQs come from a database collection per audience, with per-language text seeded with rewritten answers. No admin editor.
- **Removals and small changes (M-201, M-202, M-203).** Remove the recruiter Overview "Compare" checkbox. The greeting uses local time of day and the first name, computed on the client. Remove the word "privacy" from the recruiter settings copy.
- ~~**Bell (M-093, OD6).** No dot; it links to notification settings.~~ Superseded by Phase 11b: the bell shows the unread count and the latest 10 (§3.21).
- **Demo leftovers (S).** The workspace switch is removed. "Reset demo" is removed and "Delete my data" becomes real.

### 3.20 Seed data

- **Two scripts (U41).**
  - `seed:catalog` is an idempotent upsert of: countries; plans with prices, plus (Phase 5) the Stripe Product, Prices and Portal configuration; permissions and the three Figma roles; FAQs; legal drafts; and (Phase 9) the default matching policy v1.
  - `seed:demo` wipes the demo data and recreates it, including the Stripe seed objects for the same database (OD8).
- **Content (M-208, M-210, M-207, M-209, U42).**
  - Today's client mock data becomes coherent server entities: computed numbers, not Figma numbers.
  - The people shown in recruitment and oversight become seeded candidates. The pending account becomes a recruiter applicant. James Chen exists twice: the candidate (`@example.com`) and the recruiter applicant demo account (OQ-4).
  - Locations move to London, Manchester, Dublin, Berlin, Munich, Paris, Lyon, Madrid, Barcelona, Amsterdam, Warsaw, Lisbon and Stockholm. Each is stored as `{ countryCode, city, placeId }` with its real Google place id, looked up once through the proxy and kept in `seed/data`, so the seed never calls Google (G-1). Salaries are converted once at 1 USD = 0.75 GBP = 0.87 EUR = 3.75 PLN = 9.6 SEK, rounded to 1,000 (OQ-4).
  - Courses use the learner catalogue values, with 3 English Markdown lessons (300–600 words) and 5 single-choice questions each; prices follow OD1.
- **Accounts** (S, OD9; every password = `SEED_PASSWORD`):

| Account | Role and state | Email |
|---|---|---|
| Owner admin | admin, `isOwner` | `SEED_ADMIN_EMAIL` |
| Alex Morgan | candidate, Free, profile as in today's mock (so incomplete), owns one course | plus-alias `<local>+alex@<domain>` |
| Emma Wilson | candidate, Plus: a real Stripe test subscription (`pm_card_visa`, OD8) | `+emma` |
| Sarah Miller | recruiter at Acme Studio, approved | `+sarah` |
| James Chen | recruiter applicant with company + KYC files, `pending_review` (OQ-4) | `+james` |
| Every other seeded person | as in the mock data, made coherent | `@example.com`: never mailed, only logged (OD9) |

  The aliases are derived from `SEED_ADMIN_EMAIL` when the seed runs; no address is hard-coded. These four accounts are the "demo marketplace accounts" of today's admin data (A: admin §1.3, `users.js`).
- **Payments (OD8, M-122).** Today's paid mock payments become rows with `source: seed` and no receipt link. The mock's declined Checkout attempts are dropped, because M-122 does not record declines.
- **Coherence.** Seeded applicants passed the apply gate: each has a complete profile with approved checks. Applicants other than Emma have one historical Plus payment (`source: seed`, no receipt link, dated before their first application) and no active subscription, which is the M-119 lapsed state (OQ-4). Seeded enrollments match their seed payments. Seeded jobs belong to approved companies, one recruiter per company (M-145).

### 3.21 Notifications (Phase 11b; supersedes M-093, OD6)

Owner answers P11b-Q1 … Q15.

- **Store, not text.** A notification stores its type, parameters, target (`{ kind, id }`), sidebar section and, for admin types, the permission; never finished text. The client renders it in the reader's current language (`notifications` namespace, enum labels for statuses, reasons and checks).
- **Events (P11b-Q1).** Every notification opens the exact item:

  | Role | Type | Opens |
  |---|---|---|
  | Candidate | `application_status` (after the 10-minute window, Q8) | `/candidate/applications/:id` (the activity dialog, Q9) |
  | Candidate, recruiter | `message` (one unread per conversation, with the count, Q6) | the conversation |
  | Candidate | `cv_request` | CV & versions |
  | Candidate | `verification_decided` | Verification |
  | Candidate (Plus) | `job_alert` (at the first publish, whatever the frequency, one per job, Q15) | job details |
  | Candidate | `payment_paid` (Plus invoices), `renewal_failed`, `plan_ended` | Billing |
  | Candidate | `course_purchased` (Q11), `certificate_issued` | the course page (which shows the certificate) |
  | Candidate | `content_restricted`, `content_lifted` (profile) | My profile |
  | Recruiter | `account_decided` (approved → Overview; rejected/suspended → review page, seen once active again, Q14) | Overview / review |
  | Recruiter | `application_new`, `application_withdrawn` | `/recruiter/applications/:id` (filtered to its job, row highlighted, Q9) |
  | Recruiter | `cv_request_decided` (to the recruiter who asked) | the candidate's profile |
  | Recruiter | `content_restricted`, `content_lifted` (job) | the job |
  | Recruiter | `payment_paid` (course purchases; no "payment failed", Q11), `certificate_issued` | Billing / the course page |
  | Admin (`moderation.manage`) | `admin_account_review` (submitted or resubmitted), `admin_verification_submitted`, `admin_content_report` (user reports; one unread per case with the count) | the Account review, verification or case item |
  | Admin (`finance.view`) | `admin_renewal_failed` | `/admin/payments/:id` (the details dialog, Q9) |
  | Admin (`roles.view`) | `admin_joined` (not to the new admin) | the admin's access page |

- **Grouping (Q6).** While unread, a repeat of the same conversation, application status or case updates the notification (latest parameters and time, count + 1); once read, the next event starts a new one.
- **Reading (Q2, Q10).** The bell shows the unread count and the latest 10 (`LIMITS.notifications.latest`); "See all" opens Notifications (All/Unread, Mark all as read, 20 a page). Opening a notification marks it read; opening the item from anywhere (its page, the thread) marks its notifications read too, once, when it opens (one that arrives while the page stays open stays unread until the item is opened again). Each sidebar item shows its unread count in the bell's colour; Messages keeps only the unread-messages badge and the candidate's Applications keeps its active count beside it. Counts come with `/me/counters` (15 s poll, now for admins too).
- **Availability (Q4).** `POST /notifications/:id/open` checks that the item exists and is open to the reader (the candidate job rule of M-043, the recruiter's own company, an admin's current permission) and answers `{ available, path }`; otherwise the row says "This item is no longer available.". Direct item URLs (`/candidate/applications/:id`, `/recruiter/applications/:id`, `/admin/payments/:id`) say the same for a missing item.
- **Visibility (Q4).** A notification is read only by its user; an admin sees an admin type only while holding its permission (checked when listing, counting and opening).
- **Email switches (Q3, Q12).** `users.emailOff` lists the switched-off categories (all on by default): candidate Applications, Messages, CV requests, Job alerts; recruiter New applications, Messages; admin Account reviews, Verification, Content reports, Failed renewals, Admin joined. The former single toggle was copied into every category at startup. Critical and decision emails have no switch (certificate issued and content restricted/lifted stay decision emails). In-app notifications always show.
- **Admin emails (Q4, Q7).** The five admin types email at once, in each admin's language, as non-critical mail (their switch, the daily cap, never to reserved domains). No other new emails.
- **Retention (Q5).** A TTL index deletes a notification 90 days after its latest event.

### 3.22 Recruiter plan (Phase 11c; supersedes M-117)

Owner answers P11c-Q1 … Q19.

- **Plan (Q1, Q2).** Plan record `recruiter_plus` (`role: recruiter`), named "Recruiter Plus" in every language, £49 a month with the £49 row of §3.10, created with its own Stripe Product and 8 Prices by `seed:catalog`. Charged in the currency of the company's country (Remote = EUR). Checkout, the Portal (same configuration: cancel at period end, no plan switching, no proration, Q13), the webhooks, the `LWM-` rows and the entitlement rule (U38) are the candidate code, keyed by role. `me.plan` / `me.entitlements` now come for recruiters too (`free` without a paid subscription).
- **Entitlements (Q3, Q4).** `recruiter_plus` holds `jobs_unlimited`, `discovery`, `outreach`, `ai`. A Free approved recruiter keeps: 1 published job, applicants and the pipeline (stages, reject, notes on applicants, their profiles, CVs and activity), replying in every existing conversation (Q14), the Overview counts, courses, Billing.
- **Server locks (Q5).** 402 `PLAN_REQUIRED { entitlement }`:
  - `jobs_unlimited`: publishing (create, edit or status change to `published`) while another job of the company is published;
  - `discovery`: Find candidates with any search, filter, sort other than the default or `jobId` (the plain list answers the company's applicants only, Q10); a profile, CV, activity or note of a candidate who never applied to the company; the shortlist (list, add, remove); Overview talent; a job's relevant talent;
  - `outreach`: starting a conversation; CV requests;
  - `ai`: job AI summaries, the match narrative, Translate. The AI-score order of Recommended is used only with `ai`; Free gets the skill-overlap order (Q16).
- **Screens (Q5, Q10, Q15, Q19).** Each locked button keeps its label, shows a lock and opens the upgrade dialog (the Recruiter Plus confirm step) without sending the request: Find candidates search, filters, sort, Shortlist, Compare; profile Shortlist, Message (only when no conversation exists), CV request, Match insights, Translate; the job AI summary; Publish when a job is already live; the Jobs table's "N relevant" link; the talent lists' "See candidates". Shortlists shows the upgrade gate and its sidebar item a plan chip. Recruiter Billing has the plan card; the profile menu shows the plan.
- **Plan end (Q6, Q12, Q18).** When the subscription turns Free, every published job except the most recently published is paused; they are republished by hand after subscribing again. Applications, conversations, notes and the shortlist are kept. The same rule runs once at server start for every recruiter without Recruiter Plus who has more than 1 published job. The recruiter's `plan_ended` email and notification name the job that stays live and the number paused, and open Jobs.
- **Emails and notifications (Q7).** Recruiters get `payment_paid` (Recruiter Plus invoices and course purchases, one per payment), `renewal_failed` and `plan_ended` (in-app → Billing / Jobs, plus the always-on decision emails in en/es/fr). Admins with `finance.view` get `admin_renewal_failed` for recruiter renewals too. P11b-Q11's "no recruiter payment failed" is replaced by this.
- **Admin (Q8, Q17).** Payments rows, details and filters cover recruiter subscriptions; the cards split active subscribers and MRR per currency by role and count failed renewals of both; the Overview gets an Active subscribers counter split by role (P11c-Q20); Users → Recruiters has a Plan column and filter; the recruiter detail page shows the subscription.

---

## 4. Data model

MongoDB database `eujobs` (`eujobs_test` for tests). Every collection has `createdAt` and `updatedAt`. Enums are stored as keys (M-142). The references below are ObjectIds. A **place** is `{ countryCode, city, placeId }` from the Places proxy, never with coordinates (G-1).

### 4.1 Key catalogue (`config/enums.js`, served by `GET /meta/config`)

This catalogue must exist before any schema (ordering item 2). The client has one `enums` i18n key per value.

| Enum | Keys | Source |
|---|---|---|
| role | `candidate`, `recruiter`, `admin` | S |
| userStatus | `unverified`, `onboarding`, `pending_review`, `active`, `rejected`, `suspended`, `invited` | §3.1 |
| language | `en`, `es`, `fr` | S |
| workPreference | `remote`, `hybrid`, `on_site` | M-142 |
| employmentType | `full_time`, `part_time`, `contract`, `internship` | M-142 |
| jobLevel | `junior`, `mid`, `senior`, `lead` | M-142 |
| jobStatus | `draft`, `published`, `paused`, `closed` | M-040 |
| salaryPeriod | `year`, `month` | M-131 |
| companySize | `1_10`, `11_50`, `51_200`, `201_500`, `501_1000`, `1000_plus` | M-148 |
| availability | `available_now`, `within_2_weeks`, `within_1_month`, `open_to_opportunities`, `not_looking` | M-024 |
| languageLevel | `a1`, `a2`, `b1`, `b2`, `c1`, `c2`, `native` | M-020 |
| rtwRegion · rtwStatus | `eu`, `uk` · `citizen_settled`, `visa_permit`, `needs_sponsorship` | M-021 |
| verificationCategory | `identity`, `academic`, `employment`, `right_to_work`, `certificate` | M-166 |
| evidenceType | `passport`, `driving_licence`, `national_id`, `degree_certificate`, `diploma`, `transcript`, `employment_letter`, `contract_page`, `verified_reference` | A: candidate S34 |
| verificationStatus | `in_review`, `approved`, `rejected` | M-166 |
| kycDocType | `identity`, `registration`, `authorization` | §3.12 |
| applicationStatus | `applied`, `under_review`, `interview`, `offer`, `hired`, `not_selected`, `withdrawn` | M-070, U33 |
| stageCategory | `applied`, `screening`, `shortlisted`, `interview`, `offer`, `hired` | OD5 |
| stageTone | `neutral`, `primary`, `success` | A: recruiter Part C |
| alertFrequency | `instant`, `daily`, `weekly` | M-096 |
| cvRequestReason · cvRequestStatus | `verify_employment`, `earlier_role_cv`, `compliance`, `other` · `pending`, `approved`, `declined` | M-029 |
| activityType | `applied`, `withdrawn`, `stage_changed`, `rejected`, `shortlisted`, `unshortlisted`, `note_updated`, `outreach`, `message_reply`, `cv_request`, `cv_request_decided`, `cv_updated`, `cv_download` | M-081 |
| planKey · entitlement | `free`, `plus` · `apply`, `message_send`, `job_alerts`, `ai` | M-115, §3.3 |
| paymentKind · paymentStatus · paymentSource | `course`, `subscription` · `paid`, `failed`, `refunded` · `stripe`, `seed` | M-122, OD8 |
| courseAudience · courseLevel · courseStatus | `candidate`, `recruiter` · `foundation`, `intermediate`, `advanced` · `draft`, `published`, `unpublished` | M-109 |
| lessonType · questionType | `video`, `text`, `document`, `link` · `single`, `multiple` | M-102, M-104 |
| certificateStatus | `valid`, `revoked`, `no_longer_valid` | M-105, C18 |
| reportTargetType · reportReason · caseStatus | `job`, `candidate_profile`, `company`, `message` · `spam`, `scam_or_fraud`, `discriminatory`, `offensive`, `misleading`, `other` · `open`, `dismissed`, `restricted` | M-164, U20 |
| accountDecision | `approved`, `rejected`, `suspended` | M-165 |
| auditCategory · actorType | `workspace`, `policy`, `moderation`, `reports`, `access`, `learning`, `payments`, `jobs` · `admin`, `user`, `system` | M-162, M-163 |
| roleScope · roleStatus | `organization`, `department`, `finance_department`, `team` · `active`, `archived` | M-157, M-158 |
| policySignal · policyStatus | `skills`, `experience`, `location` · `draft`, `active`, `archived` | M-049 |
| matchLabel | `strong`, `good` (none below Good) | M-047 |
| aiKind | `job_summary`, `match_explanation`, `insights`, `translation`, `profile_summary`, `cv_snapshot`, `cv_draft`, `policy_suggestion`, `report_summary` | §3.18 |
| emailType · emailClass · emailStatus | the 22 types of §3.17 · `critical`, `decision`, `non_critical` · `sent`, `failed`, `suppressed_reserved`, `skipped_toggle`, `skipped_cap` | §2.8 |
| filePurpose | `photo`, `cv`, `evidence`, `kyc`, `certificate_file`, `company_logo`, `course_cover`, `lesson_video`, `lesson_document`, `report_voice`, `certificate_pdf`, `report_csv`, `export_zip` | M-185 |
| reportType · reportPeriod | `marketplace_summary`, `skills_demand`, `platform_activity` · `this_week`, `last_week`, `last_month` | M-183 |
| legalDoc · faqAudience | `terms`, `privacy`, `imprint` · `candidate`, `recruiter`, `admin` | M-191, M-200 |
| taskType | `email.message`, `email.stage`, `email.new-applications`, `alerts.instant`, `matching.recompute` | §2.7 |

### 4.2 Collections

**Accounts and platform**

| Collection | Key fields | Indexes | Drives |
|---|---|---|---|
| `users` | `role`, `email` (trimmed, lowercased), `passwordHash`, `fullName`, `status`, `isOwner`, `emailVerifiedAt`, `phone { e164, verifiedAt }`, `language`, `languageExplicit`, `pickerCountry`, `timezone`, `tokenVersion`, `legal { termsVersion, privacyVersion, acceptedAt }`, ~~`notifyEmail` (default true)~~ `emailOff[]` (switched-off email categories, P11b-Q12), `privacy { discoverable, resumeVisible, matchingConsent }` (candidates), `onboardingCompletedAt` (candidates), `companyId` (recruiters), `adminAccess { roleId, department, granted[], removed[] }` (admins), `stripeCustomerId`, `lastLoginAt` | unique `email`; `{ role, status }` | M-001 … M-014, M-095, M-133 … M-136, M-145, M-154 … M-160, M-187, U12, U21, U37, OD3 (phone not unique), OD6 |
| `emailtokens` | `userId`, `purpose` (`verify_email`, `reset_password`, `admin_invite`), `tokenHash`, `expiresAt`, `usedAt` | unique `tokenHash`; TTL on `expiresAt` + 7 days | M-001, M-009, U21 |
| `verificationcodes` | `userId`, `channel` (`email`, `phone`), `target`, `codeHash`, `expiresAt`, `attempts`, `sentAt`, `consumedAt` | TTL; `{ userId, channel }` | M-002 … M-004 |
| `countries` | `code` (ISO2 or `REMOTE`), `currency`, `defaultLanguage`, `isRemote`, `order`, `enabled` | unique `code` | M-139, M-130, M-134 |
| `plans` | `key`, `name { en, es, fr }`, `features { en, es, fr }[]`, `interval: month`, `prices [{ currency, amountMinor, stripePriceId }]`, `entitlements[]` | unique `key` | M-115, M-116, OD1 |
| `appconfigs` | `key` (`stripe`), `value { productId, portalConfigurationId }` | unique `key` | U40, P6 |
| `permissions` | `id`, `group`, `order` (labels are i18n keys) | unique `id` | M-156 |
| `adminroles` | `name`, `nameLower`, `description`, `scope`, `permissions[]`, `status`, `system`, `createdBy` | unique `nameLower` | M-157, M-158 |
| `legaldocuments` | `doc`, `version`, `language`, `title`, `bodyMarkdown`, `bodyHtml`, `isDraft`, `publishedAt` | unique `{ doc, version, language }` | M-191, OD12 |
| `faqs` | `audiences[]`, `order`, `question { en, es, fr }`, `answer { en, es, fr }` | `{ audiences, order }` | M-200 |
| `files` | `ownerId`, `purpose`, `path`, `originalName`, `mime`, `size`, `sha256`, `deleteAfter` | `{ ownerId, purpose }`, `deleteAfter` | M-185, M-186, U39 |
| `fileaccesslogs` | `fileId`, `ownerId`, `accessorId`, `companyId`, `at` | `{ ownerId, at }` | M-187 |
| `emaillogs` | `type`, `class`, `userId`, `to`, `language`, `status`, `error` | `{ class, createdAt }` (cap) | OD9 |
| `scheduledtasks` | `type`, `key`, `dueAt`, `payload`, `status`, `attempts`, `lastError`, `lockedAt` | `{ status, dueAt }`; unique `key` where `status: pending` | OD10 |
| `jobruns` | `name`, `lastRunAt` | unique `name` | OD10, U7, U32 |
| `auditevents` | `type` (i18n key), `category`, `actor { type, id, name }`, `target { type, id }`, `params`, `at` | `{ at: -1 }`, `{ category, at }` | M-162, M-163, M-174 |

**Candidate**

| Collection | Key fields | Indexes | Drives |
|---|---|---|---|
| `candidateprofiles` | `userId`, `headline`, `location` (place, G-1), `about`, `yearsExperience`, `skills [{ name, key }]`, `workPreference`, `availability`, `salaryMin { amount, currency, period }`, `workHistory [{ _id, title, employer, start, end, current, description }]`, `noWorkExperience`, `education [{ _id, institution, degree, start, end, stillStudying }]`, `noFormalQualification`, `languages [{ code, level }]`, `rightToWork [{ _id, region, status, permitExpiresOn }]`, `links { linkedin, portfolio }`, `photo { fileId, smallFileId }`, `certificates [{ _id, name, issuer, issuedOn, expiresOn, url, fileId }]`, `liveCvVersionId`, `completeness { done, total, complete, missing[] }` (recomputed on every change), `restricted { reason, by, at, caseId }` | unique `userId`; `{ 'location.countryCode' }` | M-012 … M-026, M-167, U27 |
| `cvversions` | `userId`, `number`, `fileId` (null after delete), `originalName`, `mime`, `size`, `extractedText`, `noReadableText`, `snapshot { role, years, skills[] }`, `pendingSnapshot`, `drafts [{ _id, suggestions, revisedSnapshot, createdAt }]` | `{ userId, number }` | M-027 … M-031, M-061, U18 |
| `cvaccessrequests` | `companyId`, `candidateId`, `requestedBy`, `reason`, `details`, `status`, `cvVersionId` (chosen on approval), `decidedAt` | `{ candidateId, status }` | M-029, U19 |
| `verificationsubmissions` | `userId`, `category`, `evidenceType`, `fileId` (null after retention), `entryId`, `status`, `submittedAt`, `reviewedBy`, `reviewedAt`, `reason`, `previousSubmissionId` | `{ status, submittedAt }`, `{ userId, category }` | M-166, M-186, U27 |
| `savedjobs` | `candidateId`, `jobId` | unique pair | M-065 |
| `jobalerts` | `candidateId`, `name`, `keywords`, `location` (place or null, G-1), `country`, `language`, `frequency`, `active`, `lastDigestAt` | `{ frequency, active }` | M-096 … M-098, U35 |
| `alertmatches` | `alertId`, `jobId`, `mode` (`instant`, `digest`), `sentAt` | unique `{ alertId, jobId }` | M-097, U12 |
| `explanationfeedback` | `candidateId`, `jobId`, `value` (`helpful`, `needs_review`) | unique pair | M-067 |

**Recruiter, jobs and hiring**

| Collection | Key fields | Indexes | Drives |
|---|---|---|---|
| `companies` | `ownerUserId`, `legalName`, `displayName`, `website`, `businessEmail`, `industry`, `size`, `location` (place, G-1; its `countryCode` is the company country), `businessAddress`, `registrationDetails`, `description`, `logoFileId`, `verifiedAt`, `reviewHistory [{ decision, reason, by, at }]`, `onboardingSteps[]`, `submittedAt` | `ownerUserId` | M-145 … M-153, M-165 |
| `kycdocuments` | `companyId`, `userId`, `type`, `fileId` (null after retention), `uploadedAt` | `companyId` | M-185, M-186 |
| `jobs` | `companyId`, `createdBy`, `title`, `brief`, `responsibilities[]`, `requiredSkills[]`, `preferredSkills[]`, `experienceYears`, `level`, `employmentType`, `workPreference`, `country` (ISO2 or `REMOTE`), `location` (place for on-site and hybrid jobs, null for remote; G-1), `remoteCountries[]`, `salary { min, max, currency, period }`, `requiredLanguages [{ code, minLevel }]`, `visaSponsorship`, `status`, `firstPublishedAt`, `publishedAt`, `closedAt`, `restricted { reason, by, at, caseId }`, `relevantCount`, `relevantComputedAt`, `contentHash` | `{ status, country }`, `{ companyId, status }` | M-032 … M-046, M-051, M-097, M-131, M-167, M-205, OD2 |
| `applications` | `candidateId`, `jobId`, `companyId`, `status`, `stageId`, `cvVersionId`, `coverNote`, `consentAt`, `appliedAt`, `withdrawnAt`, `notSelectedAt`, `history [{ status, stageId, stageName, category, at, actorId, actorType }]`, `lastEmailedStatus`, `cvRemoved` | unique `{ candidateId, jobId }` where status is not `withdrawn`; `{ companyId, status }` | M-069 … M-078, M-030, U33 |
| `pipelinestages` | `companyId`, `name`, `nameKey`, `category`, `order`, `isEntry`, `tone` | unique `{ companyId, nameKey }` | M-069 … M-072, OD5 |
| `shortlistentries` | `companyId`, `candidateId`, `addedBy` | unique pair | M-079, M-083 |
| `candidatenotes` | `companyId`, `candidateId`, `text`, `updatedBy` | unique pair | M-080 |
| `recruiteractivities` | `companyId`, `candidateId`, `actorId` (null = candidate or system), `type`, `params`, `at` | `{ companyId, candidateId, at }` | M-081, M-180 |
| `profileviews` | `candidateId`, `recruiterId`, `companyId`, `day` (YYYY-MM-DD, UTC), `at` | unique `{ candidateId, recruiterId, day }` | M-184 |
| `conversations` | `companyId`, `candidateId`, `jobId`, `startedBy` (`recruiter`, `candidate`), `lastMessageAt`, `lastMessagePreview`, `unread { candidate, recruiter }`, `lastEmailAt { candidate, recruiter }` | unique pair | M-084 … M-089 |
| `messages` | `conversationId`, `senderId`, `senderRole`, `body`, `readAt` | `{ conversationId, createdAt }` | M-086 |

**Payments and learning**

| Collection | Key fields | Indexes | Drives |
|---|---|---|---|
| `subscriptions` | `userId`, `planKey`, `status`, `retrying`, `currency`, `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `source` | unique `userId`; `stripeSubscriptionId` | M-119 … M-121, U38 |
| `payments` | `reference`, `userId` (null after erasure), `payerRole`, `payerName`, `kind`, `itemId`, `itemName`, `amountMinor`, `currency`, `status`, `failureReason`, `method { type, brand, last4 }`, `receiptUrl`, `periodStart`, `periodEnd`, `stripe { checkoutSessionId, paymentIntentId, invoiceId, subscriptionId, chargeId }`, `source`, `paidAt` | unique `reference`; `{ userId, paidAt }`; `stripe.invoiceId`, `stripe.paymentIntentId` | M-122, M-128, OD8 |
| `counters` | `_id` (`paymentReference`), `seq` | — | M-128 |
| `stripeevents` | `eventId`, `type`, `processedAt` | unique `eventId` | ordering item 11 |
| `courses` | `audience`, `language`, `title`, `category`, `level`, `summary`, `about`, `lead`, `tagline`, `designedFor`, `outcomes[]`, `coverFileId`, `skillTags[]`, `pipelineCategory` (recruiter courses, OQ-3), `isFree`, `prices [{ currency, amountMinor }]`, `status`, `lessons [{ _id, order, title, type, videoFileId, durationSec, textMarkdown, textHtml, documentFileId, url, isPreview, contentLanguage }]`, `quiz { passMark, questions [{ _id, text, type, options [{ _id, text }], correctOptionIds[] }] }`, `lockedAt`, `publishedAt`, `createdBy`, `updatedBy` | `{ audience, status }` | M-099 … M-114, U24 |
| `enrollments` | `userId`, `courseId`, `source` (`free`, `purchase`, `seed`), `paymentId`, `enrolledAt`, `lessons [{ lessonId, creditedSec, lastPositionSec, lastHeartbeatAt, completedAt }]`, `quizBestScore`, `quizPassedAt`, `completedAt`, `certificateId` | unique `{ userId, courseId }` | M-103, M-110, U15 |
| `quizattempts` | `userId`, `courseId`, `answers`, `scorePercent`, `passed`, `submittedAt` | `{ userId, courseId }` | M-104 |
| `certificates` | `code`, `userId` (null for a tombstone), `courseId`, `holderName`, `courseTitle`, `language`, `issuedAt`, `pdfFileId`, `status`, `revokedAt`, `revokedBy`, `revokeReason` | unique `code` | M-105, U17, C18 |

**Matching, AI, admin**

| Collection | Key fields | Indexes | Drives |
|---|---|---|---|
| `embeddings` | `ownerType` (`candidate`, `job`), `ownerId`, `model`, `dims`, `vector` (Float32 Buffer, about 12 KB), `sourceHash` | unique `{ ownerType, ownerId }` | U6, D25 |
| `matchingpolicies` | `name`, `description`, `status`, `signals { skills, experience, location }`, `weights { sim: 0.6, skill: 0.4 }`, `thresholds { strong: 75, good: 50 }`, `version`, `createdBy` | unique `status` where `status: active` | M-047 … M-049, U5 |
| `matchingpolicyversions` | `policyId`, `version`, `signals`, `weights`, `thresholds` | unique `{ policyId, version }` | M-049 |
| `matchresults` | `jobId`, `candidateId`, `policyVersionId`, `score`, `label`, `sim`, `skillShare`, `locationCapped`, `matchedSkills[]`, `missingSkills[]`, `computedAt` | unique `{ jobId, candidateId }`; `{ jobId, score: -1 }` | M-047, M-051, M-172 |
| `aicaches` | `kind`, `key` (hash of inputs + entity version), `language`, `output`, `model` | unique `{ kind, key, language }` | M-057, M-058, M-144 |
| `aiusages` | `userId`, `day` (UTC YYYY-MM-DD), `count` | unique pair | OD13 |
| `moderationcases` | `targetType`, `targetId`, `reports [{ reporterId, reason, details, at }]`, `excerpt [{ senderRole, body, at }]`, `status`, `decision { action, reason, by, at }`, `history[]`, `openedBy` (`user`, `admin`) | `{ status, createdAt }`; `{ targetType, targetId }` | M-164, M-167, U20, OQ-1 |
| `reportexports` | `type`, `period`, `language`, `brief`, `voiceFileId`, `transcript`, `aiSummary`, `csvFileId`, `filename`, `createdBy`, `generatedAt` | `generatedAt` | M-181 … M-183, U23 |
| `notifications` | `userId`, `type`, `params`, `target { kind, id }`, `section`, `permission` (admin types), `groupKey`, `count`, `at`, `readAt` | `{ userId, at: -1 }`; `{ userId, readAt, section }`; `{ userId, groupKey, readAt }`; TTL on `at` (90 days) | §3.21, P11b |

### 4.3 Unique indexes and TTL (ordering item 16)

Created at startup with `syncIndexes`, before any data. These are the unique indexes of §4.2:

- `users.email`, `certificates.code`, `payments.reference` (with `counters`), `stripeevents.eventId`. There is no phone uniqueness (OD3).
- Pairs and triples: `savedjobs`, `shortlistentries`, `candidatenotes`, `conversations`, `profileviews`, `enrollments`, `aicaches`, `aiusages`, `matchresults`, `embeddings`.
- `applications` (partial), `emailtokens.tokenHash`, `countries.code`, `plans.key`, `permissions.id`, `adminroles.nameLower`, `matchingpolicies` active (partial), `jobruns.name`, `scheduledtasks.key` (partial), `legaldocuments`.

TTL indexes on `emailtokens`, `verificationcodes` and `notifications` (90 days after `at`, P11b-Q5).

---

## 5. API outline

All paths are under `/api/v1`. **Who:**
- **Pub** = public.
- **Any** = any signed-in user.
- **C** = candidate; **C+x** = candidate with entitlement x (§3.3).
- **R** = recruiter with a verified email (U37); **R✓** = approved recruiter.
- **A:perm** = admin with that permission (Owner bypass).

**Auth and me**

| Method + path | Who | Purpose |
|---|---|---|
| POST `/auth/candidate/register` | Pub | create a candidate and email the verification link; duplicates get the same reply (M-001, U36) |
| POST `/auth/recruiter/register` | Pub | create a recruiter, return a token, email the code; duplicate → `EMAIL_TAKEN` (U37, OQ-6h) |
| POST `/auth/login` | Pub | `{ email, password, portal }` → `{ token, me }` (M-005) |
| POST `/auth/verify-email` · POST `/auth/verify-email/resend` | Pub | open the link; resend (202 always) (M-001) |
| POST `/auth/email-code/verify` · POST `/auth/email-code/resend` | recruiter (unverified) | recruiter email code (M-002, M-004) |
| POST `/auth/forgot-password` · POST `/auth/reset-password` | Pub | neutral 202; reset returns `{ role }` (M-009) |
| GET `/auth/invite/:token` · POST `/auth/invite/accept` | Pub | check the invite; set the password (U21) |
| GET `/me` · PATCH `/me` | Any | profile of the session (role, status, plan, entitlements, completeness, company, permissions, legal flags); `{ fullName, language, pickerCountry, timezone }` |
| POST `/me/password` · POST `/me/legal/accept` · PATCH `/me/notifications` | Any | M-010, M-191/U22; notifications: `{ emailSwitches: { category: bool } }` for every role (P11b-Q3, Q12) |
| GET `/me/counters` | C, R✓, A | unread messages, active applications (M-094); `notifications { unread, sections }` (P11b-Q2) |
| GET `/notifications?filter=all\|unread&page&pageSize` · POST `/notifications/:id/open` · POST `/notifications/read-all` · POST `/notifications/seen { kind, id }` | Any (own only) | list, open (`{ available, path }`), mark all read, mark an opened item's notifications read (§3.21) |
| GET `/recruiter/applications/:id` | R✓ | one own row, any status (P11b-Q9) |
| GET `/me/payments` | C, R✓ | own payments with receipt links (M-122) |
| GET `/me/export` · DELETE `/me` | C, R | ZIP export (M-190); erasure with the password (M-188, M-189) |

**Meta and public**

| Method + path | Who | Purpose |
|---|---|---|
| GET `/health` | Pub | `{ status, db }` |
| GET `/meta/countries` · `/meta/languages` · `/meta/config` | Pub | 29 countries; ISO 639-1 codes; limits and enums |
| GET `/places/autocomplete?input&sessionToken` · GET `/places/:placeId?sessionToken` | Any (recruiters once the email code is done) | city suggestions in the UI language, EU 27 + UK only; resolve one city to `{ countryCode, city, placeId }` (G-1, §2.16) |
| GET `/plans` | Pub | plans with the price in the requested or user currency (M-116) |
| GET `/legal/:doc` | Pub | current version in the requested language (M-191) |
| GET `/help/faqs` | Any | FAQs for the role, in the user's language (M-200) |
| GET `/public/certificates/:code` | Pub (30/min/IP) | certificate status (M-105) |
| GET `/files/:fileId` | signed URL | stream a file with Range support (U39) |
| POST `/stripe/webhook` | Stripe signature | webhook (§2.10) |

**Candidate**

| Method + path | Who | Purpose |
|---|---|---|
| GET/PUT `/candidate/profile` | C | core fields |
| POST/PATCH/DELETE `/candidate/profile/work-history[/:id]` · PUT `…/work-history/none` | C | M-018 |
| POST/PATCH/DELETE `/candidate/profile/education[/:id]` · PUT `…/education/none` | C | M-019 |
| PUT `/candidate/profile/languages` · `/right-to-work` · `/links` | C | M-020 … M-022 |
| POST/DELETE `/candidate/profile/photo` | C | M-013 |
| POST/PATCH/DELETE `/candidate/profile/certificates[/:id]` | C | M-025 |
| GET `/candidate/profile/completeness` | C | §3.2 (M-015, M-016) |
| PUT `/candidate/onboarding/:step` · POST `/candidate/onboarding/complete` | C | M-014 |
| GET/PATCH `/candidate/settings/privacy` | C | M-187 |
| GET `/candidate/overview` | C | KPIs, profile views (M-053, M-184) |
| GET `/candidate/cv` · POST `/candidate/cv/versions` | C | list; upload (U18) |
| POST `/candidate/cv/versions/:id/live` · GET `…/:id/download` · DELETE `…/:id` | C | M-028 |
| POST `/candidate/cv/versions/:id/snapshot` · POST `…/snapshot/confirm` | C+ai | M-027 |
| POST `/candidate/cv/drafts` · DELETE `/candidate/cv/drafts/:id` | C+ai | M-061 |
| GET `/candidate/cv/requests` · POST `/candidate/cv/requests/:id/decision` | C | M-029 |
| GET `/candidate/cv/downloads` | C | download log (M-187) |
| GET `/candidate/verification` | C | phone and check states |
| POST `/candidate/verification/phone/code` · POST `…/phone/confirm` | C | M-003, M-004 |
| POST `/candidate/verification/submissions` | C | evidence upload (M-166) |
| GET `/jobs` · GET `/jobs/:id` · GET `/jobs/recommended` | C | search (picker country); details; For you (M-053) |
| GET `/candidate/saved-jobs` · PUT/DELETE `/candidate/saved-jobs/:jobId` | C | M-065 |
| GET `/candidate/applications[/:id]` | C | list and history |
| POST `/candidate/applications` | C+apply (+ complete) | apply (§3.4) |
| POST `/candidate/applications/:id/withdraw` | C | M-074 |
| GET/POST `/candidate/job-alerts` · PATCH/DELETE `…/:id` | C+job_alerts | §3.6 |
| GET `/candidate/insights/overview` · `/roles` · `/skill-gap` · `/improve-profile` · `/job-match` · `/why-recommended` | C+ai | M-057, M-063, M-066 |
| PUT `/candidate/insights/feedback/:jobId` · POST `/candidate/profile/skills` | C+ai | M-067, M-064 |
| POST `/candidate/profile/ai-summary` | C+ai | M-062 |

**Shared signed-in features**

| Method + path | Who | Purpose |
|---|---|---|
| POST `/jobs/:id/ai-summary` | C+ai, R✓ | job AI summary (M-058, M-059) |
| POST `/translate` | C+ai, R✓ | `{ entity, id, field, language }` (M-144) |
| GET `/conversations` · POST `/conversations` | C, R✓ (start: R✓, or C+message_send to an applied company) | M-084, M-085 |
| GET `/conversations/:id/messages` · POST `…/messages` · POST `…/read` | C (send: C+message_send), R✓ | M-086 |
| POST `/reports` | C, R✓ | report content (M-164, U20) |
| GET `/courses` · GET `/courses/:id` | C, R✓ | catalogue by audience, prices in the user currency |
| POST `/learning/enrollments` · GET `/learning/enrollments` | C, R✓ | free enrol; own progress |
| GET `/learning/courses/:id/lessons/:lessonId` | C, R✓ (enrolled, or preview) | lesson content and signed media URL (M-106) |
| POST `/learning/lessons/:lessonId/progress` | C, R✓ | heartbeat or open (U15) |
| GET `/learning/courses/:id/quiz` · POST `…/quiz/attempts` | C, R✓ | M-104 |
| GET `/learning/certificates` · GET `/learning/certificates/:id/pdf` | C, R✓ | M-105 |
| GET `/learning/suggestions` | C, R✓ | M-114, OQ-3 |
| GET `/payments/quote` · POST `/payments/checkout-sessions` · GET `/payments/checkout-sessions/:id` | C (plan), C or R✓ (course) | M-124, M-125, U40 |
| POST `/payments/portal-session` | C (subscriber) | M-121 |

**Recruiter**

| Method + path | Who | Purpose |
|---|---|---|
| GET `/recruiter/onboarding` · PUT `…/account` · PUT `…/company` | R | M-151, M-153, M-149 |
| POST/DELETE `/recruiter/onboarding/documents[/:id]` | R | KYC (M-185) |
| POST `/recruiter/onboarding/phone/code` · POST `…/phone/confirm` · POST `…/submit` | R | M-003 |
| GET/PATCH `/recruiter/company` · POST/DELETE `/recruiter/company/logo` | R✓ | M-147, M-150 |
| GET `/recruiter/overview` · `/overview/momentum` · `/overview/talent` | R✓ | §3.15 |
| GET/POST `/recruiter/jobs` · GET/PUT `/recruiter/jobs/:id` | R✓ | list with status counts; draft create; edit |
| PATCH `/recruiter/jobs/:id/status` · DELETE `/recruiter/jobs/:id` | R✓ | transitions with publish validation (M-039); drafts only (M-038) |
| POST `/recruiter/jobs/quality-checks` | R✓ | M-060 |
| GET `/recruiter/jobs/:id/relevant-talent` · GET `/skills/suggestions` | R✓ | M-051; M-034 |
| GET `/recruiter/candidates` · GET `/recruiter/candidates/:id` | R✓ | discovery (M-054 … M-056); profile, which records a view (M-184) |
| GET `/recruiter/candidates/:id/match` | R✓ | evidence + narrative, no score (M-057) |
| GET `/recruiter/candidates/:id/cv` · POST `…/cv-requests` | R✓ | signed URL when allowed (M-187); request (M-029) |
| GET `…/activity` · GET/PUT `…/note` | R✓ | M-081, M-080 |
| GET `/recruiter/shortlist` · PUT/DELETE `/recruiter/shortlist/:candidateId` | R✓ | M-079 |
| GET `/recruiter/applications` | R✓ | filters: job, stage, status (M-076, M-077) |
| PATCH `/recruiter/applications/:id/stage` · POST `…/reject` | R✓ | move; reject `{ notify }` (M-090) |
| GET `/recruiter/pipeline` · POST/PATCH/DELETE `/recruiter/pipeline/stages[/:id]` · PUT `…/stages/order` | R✓ | M-069, M-072, OD5 |

**Admin** (every route needs `role=admin` plus the permission shown)

| Method + path | Permission | Purpose |
|---|---|---|
| GET `/admin/overview` · `/admin/activity` | `dashboard.view` | KPIs and chart (§3.15) |
| GET `/admin/overview/export` | `dashboard.view` + `reports.export` | CSV |
| GET `/admin/users` · GET `/admin/users/:id` · GET `/admin/users/export` | `users.view` (+ `reports.export`) | tables and detail pages (M-161, M-206) |
| GET `/admin/jobs` · GET/POST `/admin/jobs/:id/ai-summary[/regenerate]` | `jobs.view` | M-046, M-058 |
| GET `/admin/applications[/export]` · GET `/admin/recruitment/*` | `candidates.view` | M-206, M-178 |
| GET `/admin/permissions` · GET `/admin/roles` | `roles.view` | M-156 |
| POST `/admin/roles` · POST `/admin/roles/:id/duplicate` | `roles.create` | M-158 |
| PATCH `/admin/roles/:id` · POST `/admin/roles/:id/archive` | `roles.edit` / `roles.archive` | M-158 |
| GET `/admin/access/users` · PUT/DELETE `/admin/access/users/:id` | `roles.view` / `roles.assign` | M-154, M-160 |
| POST `/admin/invitations` | `users.add` | M-159 |
| GET `/admin/courses[/stats]` · GET `/admin/courses/:id/learners` | `learning.view` | M-111 |
| POST/PATCH `/admin/courses[/:id]` · lessons, order, quiz, status · POST `/admin/uploads` · POST `/admin/markdown/preview` · POST `/admin/certificates/:id/revoke` | `learning.manage` | M-101 … M-109, M-105 |
| GET `/admin/payments[/:id]` · `/admin/payments/stats` · `/admin/payments/export` | `finance.view` (+ `reports.export`) | M-122, M-123 |
| GET/POST/PATCH `/admin/matching/policies…` · `/activate` · `/archive` · `/suggest` | `ai.view` / `ai.manage` | M-048, M-049 |
| GET `/admin/matching/oversight` · `/feedback` · `/admin/ai/status` | `ai.view` | M-068, M-067 |
| GET `/admin/analytics` | `reports.view` | §3.15 |
| GET/POST `/admin/reports` · GET `/admin/reports/:id/download` | `reports.view` / `reports.export` | M-181 … M-183 |
| GET `/admin/moderation/summary` · `/content` · `/accounts` · `/verification` | `moderation.manage` | queues |
| POST `/admin/moderation/content/:id/decision` · `/accounts/:userId/decision` · `/verification/:id/decision` | `moderation.manage` (suspend and reactivate: + `users.deactivate`) | M-165 … M-167, OQ-1, OQ-2 |
| GET `/admin/audit-events[/export]` | `audit.view` (+ `reports.export`) | M-162, M-206 |
| GET `/admin/files/:fileId` | `documents.view` | sensitive files (signed URL; M-186, OQ-6 j) |

**Test only** (`NODE_ENV=test`): `POST /_test/reset`, `GET /_test/mail`, `POST /_test/scheduler/tick`, `POST /_test/db`, `POST /_test/ai/fail-next` (§2.13).

---

## 6. Build phases

The order follows the blocker review §4:
- the key catalogue, countries and money format, User and Company, the email layer, the scheduler, permissions and audit come first;
- payments and entitlements come before any plan gate;
- application history comes before KPIs.

Each phase lists its scope, tasks (with a verify check), decisions, prep, done criteria, browser verification and API tests.

**How to read the browser checks.** Viewports: **D** = 1440×900, **M** = 375×812. Every scenario also fails on console errors, unexpected 4xx/5xx responses, missing i18n keys and horizontal overflow at 375 px (§2.13). "Captured mail" means `/_test/mail`. "Tick at T" means `/_test/scheduler/tick { now: T }`.

**Interim rule.** Screens not yet migrated keep their mock data until their phase. A migrated screen reads only server data. Phase 12 proves nothing static remains.

### Phase 0: Restructure (done)

`client/` and `server/` exist; Vercel uses Root Directory `client`; lint, build and the 69-route sweep were green (S). Nothing to do. Phase 1 recreates the route sweep inside `e2e/`.

### Phase 1: Server foundation, auth API, mail, scheduler, seed skeleton, test harness

**Scope.** Everything server-side that every feature needs, plus the Vite proxy and the e2e harness. No new screens.

**Decisions.**
- Accounts: M-001 … M-011 (server side), M-191 (storage), U1, U2, U12, U36, U37, OD3, OD6 (no in-app toggle field).
- Platform: M-139, M-141 … M-143, M-155, M-156, M-160 (infrastructure), M-162 (writer), M-204, M-205.
- Email and scheduler: OD9, OD10, OQ-6c.
- Seed: U41, OQ-6j.
- Ordering items 2, 3, 5, 7, 8, 14, 15, 16.

**Prep.** P10 (download the top-10k list into `server/data/common-passwords.txt`), P12 (aliases derived by the seed), P13 (report `db.stats()`; the owner confirms tier, headroom and IP access in Atlas).

**Tasks**

1. `server/package.json`, scripts (§2.2), Phase 1 packages (§2.14). Verify: `npm ls` is clean and `node -v` is 24.x.
2. `config/env.js` validates all 22 variable names and derives the database name and the upload root. Verify: a missing variable makes startup fail with that name only (no values printed).
3. `lib/db.js` with `syncIndexes`; `GET /api/v1/health`. Verify: health returns `{ status: 'ok', db: 'up' }`.
4. Conventions: `errors.js` (all §2.3 codes), `validate.js`, error middleware, JSON 404. Verify: API tests.
5. `config/enums.js` (all of §4.1), `config/limits.js`, `GET /meta/config`. Verify: a test asserts every §4.1 enum is present.
6. Models: `users`, `emailtokens`, `verificationcodes`, `countries`, `plans`, `appconfigs`, `permissions`, `adminroles`, `auditevents`, `emaillogs`, `scheduledtasks`, `jobruns`, `legaldocuments`, `faqs`. Verify: indexes exist (§4.3).
7. Auth module:
   - candidate and recruiter register, login with `portal`, verify link and resend, email code verify and resend, forgot and reset;
   - `GET/PATCH /me`, password change, legal accept, notification toggle;
   - middleware (§2.5), password rules, rate limits.
   Verify: API tests below.
8. Mailer (§2.8) with en/es/fr templates `verify_email`, `already_registered`, `recruiter_email_code`, `password_reset`; reserved-domain suppression; cap; toggle; test capture; `npm run mail:test`. Verify: one live `verify_email` to a plus-alias, confirmed by the owner.
9. Scheduler (§2.7) with `scheduledtasks` and `jobruns`, and the startup catch-up. Verify: API tests with tick(now).
10. `lib/audit.js` (actor types, i18n type keys). Permission catalogue (§3.13) and `requirePermission` with the Owner bypass. `GET /admin/permissions` is the first admin route. Verify: an admin without `roles.view` gets `PERMISSION_DENIED`; the Owner passes.
11. `seed:catalog`: 29 countries, the Free and Plus plans with OD1 prices (Stripe ids come in Phase 5), permissions, the three Figma roles remapped (§3.13).
12. `seed:demo`: wipe, then create the Owner (`SEED_ADMIN_EMAIL`, `isOwner`) and the demo accounts Alex and Emma (candidates, email verified, onboarding done), Sarah (recruiter, status `onboarding`) and James (recruiter applicant, status `onboarding`). Plus-aliases `+alex`, `+emma`, `+sarah`, `+james`; `SEED_PASSWORD` is checked against the password rules. Later phases complete these accounts. Verify: running it twice gives the same result.
13. `client/vite.config.js`: proxy `/api` to `process.env.VITE_API_PROXY ?? 'http://localhost:5000'`. Verify: health through port 5173.
14. Test harness:
    - `server/test` (setup, helpers, `/_test` router);
    - `e2e/` (`package.json` with puppeteer-core, `run.js`, `lib/`, `routes.js` with today's 69 routes, the `sweep` scenario that signs in through today's demo session);
    - `e2e/artifacts/` added to `.gitignore`.
    Verify: `node e2e/run.js sweep` passes against the unchanged client.

**Done when.** All API tests pass. `seed:catalog` is idempotent and `seed:demo` recreates. The owner confirmed the live email. The harness boots both servers and the baseline sweep is green. Lint passes.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P1-01 | Harness boot | D | Server on 5100 (test DB) and Vite on 5174 start. Chrome opens `http://localhost:5174/api/v1/health` and gets `{ status: 'ok', db: 'up' }` through the proxy. |
| P1-02 | Baseline sweep | D, M | All 69 current routes render for the three roles with no console errors and no 375 px overflow, the same as the planning-session result. |
| P1-03 | API contract from the browser | D | In page context, `fetch('/api/v1/me')` with no token → 401 `AUTH_REQUIRED` JSON. With a token from `POST /auth/login` (seeded Emma, portal candidate) → 200 with `role: candidate`, `status: active`. |

**API tests** (`auth`, `users`, `mailer`, `scheduler`, `permissions`, `seed`)

- **Candidate register:** 201 without a token. The verification email is captured in the sign-up language (en, es, fr each tested). A duplicate gets the same 201 plus `already_registered`. Resend is limited to 1/min and 5/day.
- **Candidate login:** unverified → `EMAIL_UNVERIFIED`. After the link → token. Reusing the link → `TOKEN_USED`. An expired link (date shifted) → `TOKEN_EXPIRED`.
- **Portals (M-005):** a candidate on the recruiter portal → 200 with role `candidate`. An admin on the candidate portal and a candidate on the admin portal → `INVALID_CREDENTIALS`.
- **Recruiter register:** returns a token; a recruiter endpoint → `EMAIL_UNVERIFIED`; `/me` → 200. Code: 5 wrong → `CODE_LOCKED`; expired → `CODE_EXPIRED`; resend before 60 s → `RATE_LIMITED`; correct → status `onboarding`. Duplicate → `EMAIL_TAKEN`.
- **Passwords:** 7 characters, a list password, the email local part, and more than 72 bytes each → `VALIDATION_FAILED` with field keys.
- **Rate limits (U1):** per email and per IP (`X-Forwarded-For`), forgot password, sign-up → `RATE_LIMITED` with `retryAfter`.
- **Forgot and reset:** an unknown email → 202 and no mail. A reset bumps tokenVersion (the old token gets 401), sets `emailVerifiedAt` and returns the role.
- **Change password:** a wrong current password → validation error; success → the new password works.
- **`PATCH /me`:** language, `pickerCountry` (must exist), timezone, `languageExplicit`.
- **Mailer:**
  - every reserved domain → `suppressed_reserved`;
  - the 401st non-critical send in 24 h → `skipped_cap`, while a critical send still goes out;
  - toggle off → `skipped_toggle`.
- **Scheduler:** a due task runs exactly once (two parallel ticks); a failed task is retried up to 3 times; startup catch-up works.
- **Permissions:** the Owner bypass; `PERMISSION_DENIED` without the permission.
- **Seeds:** `seed:catalog` twice leaves stable counts (29 countries, 2 plans, 21 permissions, 3 roles). `seed:demo` creates the Owner and the 4 demo accounts with plus-aliases, and no demo account is on `example.com`.

### Phase 2: Client data layer, i18n, auth screens and state machine, shell

**Scope.** RTK Query, session, router guards, i18n infrastructure, formatting, every public and auth screen, and the shell identity. The shell, auth, legal and help screens ship in en/es/fr (proving the pipeline). Other screens get en keys as their phase migrates them; es/fr for those come in Phase 11.

**Decisions.**
- Accounts: M-001, M-002, M-005 … M-007, M-009 … M-011, M-191, U22, U36, U37, OQ-6h.
- Shell: M-093, M-192, M-193/OD11, M-194, M-195, M-197, M-198, M-199/OD6, M-200, C4.
- Locale: M-133 … M-135, M-139 … M-141, M-143, OQ-6b; U43 (shell and auth copy, FAQs, legal drafts).

**Prep.** P9, client part: `@fontsource/inter` and `@fontsource/manrope` with the weights in `DESIGN_SYSTEM.md`.

**Tasks**

1. Install the client packages; import the fonts; remove the Google Fonts link from `client/index.html` (M-192). Verify: no request to `fonts.googleapis.com`.
2. `store.js`, `api.js` (base query, reauth, tags), token store, `session` slice, `<Provider>`. Verify: `getMe` works after login.
3. i18n: init, namespaces, `errors` (every §2.3 code), `validation`, `enums` (every §4.1 key) in en/es/fr; `<html lang>`; `document.title` via `handle.titleKey`. Verify: switching language changes both.
4. `lib/format.js` and locale derivation (§3.11 with OQ-6b); `StatCard` takes a number plus a formatter. Verify: unit checks in the e2e (en-DE, fr-BE, en-IE samples).
5. Router: async workspace loader on `getMe`; the §3.1 redirects; `?next` (same-origin only); signed-in redirect away from public auth pages. Verify: P2 scenarios.
6. Screens:
   - sign-in × 3 (Forgot link; wrong-portal notice; admin restricted notice; no `DemoNote`);
   - candidate sign-up (country select, terms checkbox linking to `/legal/*`, password rules);
   - `/sign-up/check-email` (Resend with a cooldown), `/verify-email` (verifying, success, expired with Resend, used), `/forgot-password`, `/reset-password`;
   - recruiter sign-up, then `/recruiter/onboarding/email-code` (new, M-002);
   - `/legal/:doc`, the re-accept dialog (U22), a language picker on every public page (M-140).
   Recruiter onboarding steps 1–5 stay mock until Phase 4; the loader already routes by status.
7. Shell:
   - identity from `/me` (M-195): name, email, subtitle (candidate plan, recruiter company, admin role or "Owner"), initials avatar;
   - remove the workspace switch; bell without a dot (M-093);
   - country picker from `/meta/countries`, as a scrollable list with Remote last; language picker with endonyms; both call `PATCH /me` (anonymous visitors use localStorage);
   - footer (M-197); logo (OD11: crop the "AI" mark from `logo.png` into a new asset, plus live text in Manrope); Ctrl K on non-Mac;
   - sidebar items keyed by `item.to`; global search translated and accent-insensitive (M-194); sign-out (clear token, reset the API state, sync other tabs).
8. Help page from `GET /help/faqs`. `seed:catalog` adds FAQs per audience in en/es/fr (rewritten, no demo text) and the legal drafts (OD12: Terms, Privacy and an Imprint placeholder, version `2026-11-draft`, marked as drafts).
9. Settings: "Change password" in candidate and recruiter Data & account; admin Settings page (name, password, language; M-199, OD6). The notification pages keep only the email toggle (OD6).
10. Delete: `features/auth/utils/session.js`, `DemoNote`, the `preferencesContext` LOCATIONS and LANGUAGES, the localStorage preferences, the demo hero copy. Add the new public routes to `e2e/routes.js`. The sweep now signs in through the API with seeded accounts.

**Done when.** Every auth flow works in Chrome for all roles. The shell, auth, legal and help screens work in en/es/fr. No `lwm-session` key remains. Lint, build and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P2-01 | Candidate sign-up | D, M | Chrome language fr-FR: the form defaults to French, country France. Submit → check-email shows the address. Captured mail is in French with a link. Open it → "Email verified" + Sign in. Sign in → `/candidate/onboarding/story`. |
| P2-02 | Unverified sign-in | D | Sign in before verifying → inline alert with Resend. A second Resend within 60 s → rate-limit message with the wait time. |
| P2-03 | Duplicate sign-up | D | An existing email → same check-email screen; captured `already_registered`. |
| P2-04 | Used and expired links | D | A used link → "already used" with Sign in. Expiry shifted via `/_test/db` → expired state with an email field and Resend. |
| P2-05 | Wrong portal | D | Emma on `/recruiter/sign-in` → lands on `/candidate` with the notice. Emma on `/admin/sign-in` → generic error. The Owner on `/sign-in` → generic error. |
| P2-06 | Admin sign-in | D, M | The Owner signs in on `/admin/sign-in` → `/admin`. The restricted notice and the Forgot link are shown; no demo note. |
| P2-07 | Forgot and reset | D, M | A neutral confirmation for both an unknown and a known email. The captured link opens `/reset-password`. Common and short passwords show translated errors. Success links to that role's sign-in. A second tab with the old session gets 401 and goes to sign-in with `?next`. |
| P2-08 | `?next` | D | Signed out, open `/candidate/settings/billing` → `/sign-in?next=…`; after sign-in it lands there. `?next=https://evil.example` is ignored. |
| P2-09 | Signed-in redirect | D | `/`, `/sign-in` and `/sign-up` while signed in → own workspace. |
| P2-10 | Recruiter sign-up and code | D, M | `/recruiter/sign-up` → code screen. A wrong code shows attempts left; 5 wrong → locked message; Resend enabled after 60 s; correct → onboarding. Opening `/recruiter` redirects back to onboarding. A duplicate email shows `EMAIL_TAKEN` with sign-in and reset links. |
| P2-11 | Language and country | D, M | Switch to Español → shell and auth texts in Spanish, `<html lang="es">`, kept after reload (server). Switch the country to Poland → kept. Anonymous: the public-page picker keeps its choice in localStorage. |
| P2-12 | Shell identity | D, M | Emma: name, email, "Free" subtitle, photo (seeded since Phase 3; initials before). Owner: "Owner", initials. No workspace switch. The bell has no dot and opens notification settings. Footer "© {current year} Local WorkMan" with three legal links. The country list scrolls at 375 px. |
| P2-13 | Legal and re-accept | D, M | `/legal/terms` shows the draft banner and switches language. Terms version bumped via `/_test/db` → the next sign-in shows a blocking dialog; Accept continues. |
| P2-14 | Help | D | FAQs differ per role and follow the language; search ignores accents. |
| P2-15 | Change password | D | Wrong current password → error. Success → the new password works at next sign-in. Admin Settings saves the name and language. |
| P2-16 | Notification settings | D | Only the email toggle is present, and it persists. |
| P2-17 | Fonts and logo | D | No Google Fonts request. The logo shows the AI mark plus live "Local WorkMan" and "AI Job Portal" text. |
| P2-18 | Sweep | D, M | All routes, all roles, signed in through the API, en. |

**API tests.** `/meta/countries` (29 rows, BG = EUR, Remote = EUR); `/legal/:doc` per language; `/help/faqs` per audience; `/me` DTO per role; `PATCH /me/notifications`; legal accept with versions.

### Phase 3: Candidate profile, completeness, uploads, CV, verification

**Scope.** The complete-profile model and every editor; onboarding; files and signed URLs; CV versions with extraction; phone and evidence verification; the admin verification queue; privacy settings. The CV AI actions arrive in Phase 9; until then they are hidden, and the rule-based fake draft is deleted. The CV Compare panel and the profile "Ai Job Summary" are hidden too, and the summary template is deleted (P3-Q3).

**Decisions.**
- Profile: M-012 … M-026, M-027 (extraction part), M-028, M-030, M-031, M-032 (profile location), M-136.
- Verification and files: M-166, M-168 (data), M-185, M-187 (flags stored), U18, U27, U39.
- Other: OD3, OQ-4, C16, C17, C21.
- Places: G-1 (§2.16), first used here.

**Prep.** P18 (first live call through the Places proxy). P11, part 1. Fixtures live outside the repo in `C:/eujobs-data/fixtures`, generated by `e2e/fixtures/make.js`:
- a text PDF (pdfkit) and an image-only PDF (pdfkit with an embedded image);
- a DOCX (minimal OOXML zipped with archiver);
- JPG, PNG and WebP photos and an ID-like image (sharp);
- a 6 MB image and an 11 MB PDF;
- an `.exe` renamed to `.jpg`.

**Tasks**

1. Places (G-1, §2.16): `config/env.js` validates `GOOGLE_PLACES_API_KEY`; the `places` module with an injectable Google client, the per-user rate limit, the cache and the EU 27 + UK filter; the client city field (debounced autocomplete, one session token per typing session, details on pick). Verify: P18, the places API tests, P3-13.
2. Phase 3 packages. `lib/files.js`, the `files` and `fileaccesslogs` models, upload middleware per purpose, and `GET /files/:id`. Verify: tests for tampered signature, expiry, Range.
3. `candidateprofiles`, the section endpoints and the completeness service (§3.2), embedded in `/me`; the U27 reset rules. Verify: unit tests over every item combination.
4. Onboarding (M-014):
   - story: CV upload creates version 1;
   - preferences: work preference, city through the Places city field (G-1), optional salary in the country currency;
   - plan: plan cards from `/plans`; "Continue with Free". The Plus button keeps today's demo checkout until Phase 5 replaces it.
   `onboardingCompletedAt` is set; the header country takes the profile country (M-136).
5. My profile: section cards (the location through the Places city field) with editors (OD16) for basics, full name, availability, work history (with the opt-out), education (with the opt-out), languages (codes from `/meta/languages`, names via `Intl.DisplayNames`), right to work, links, photo (square crop on the server), external certificates. A completeness checklist panel; the Overview strength card from the server.
6. CV page:
   - upload (types and sizes; at most 20), extraction (pdfjs-dist, mammoth), "No readable text" flag;
   - live selection, download via a signed URL, delete non-live versions;
   - the Compare buttons and panel are hidden until Phase 9 (P3-Q3).
   Remove `cv/utils/cvVersions.js` and its fake draft.
7. Verification page:
   - phone (country-code input, on-screen code, M-004 rules);
   - checks with evidence types, statuses and reasons, and resubmission;
   - right-to-work and certificate verification requests linked to their entries;
   - the self-approve button is removed.
8. Admin: Moderation tab "Candidate verification" (list, detail with file preview through `documents.view`, Approve or Reject with a reason ≤ 300); the emails `verification_approved` and `verification_rejected`; audit events; the "Credential reviews" stat becomes a real count.
9. Privacy settings stored (M-187). The shell avatar shows the photo through a signed URL.
10. `seed:demo`:
   - Alex's profile from `profile.js` (incomplete by design);
   - seeded candidates from the recruiter `candidates.js` and `candidateDetails.js` as structured profiles. Applicants are complete with approved checks and a verified phone (OQ-4).
   - photos copied from client assets; CV PDFs generated with text;
   - two James Chen accounts (OQ-4): the candidate here, the recruiter applicant in Phase 4.
11. Delete: the candidate profile, CV, verification, onboarding and privacy-settings mock data and hooks.

**Done when.** In Chrome, a candidate reaches "Complete" (with admin approvals). The completeness shown always equals the server's. Uploads reject wrong types and sizes. Signed URLs expire. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P3-01 | Onboarding | D, M | A new verified candidate: story (upload a text PDF) → preferences (Remote, Poland, Warsaw, 12,000 PLN/month) → plan → Continue with Free → Overview. The header country is Poland. The next sign-in goes to `/candidate`. |
| P3-02 | Completeness walk | D | The checklist shows "x of N". Each section editor raises "x" after save. Adding a work and an education entry changes N from 10 to 12. The "No work experience yet" opt-out marks the item done and removes the employment check from N. |
| P3-03 | Field validation | D, M | Headline 61, about 19, a 13th skill, a duplicate skill with different case, a non-`linkedin.com/in` URL, an `http://` portfolio, end before start → translated messages. The same payloads via the API → 422. |
| P3-04 | Photo | D, M | A 4 MB PNG → the avatar appears in the sidebar, header and profile menu. 6 MB → size error. GIF → type error. `.exe` renamed `.jpg` → type error. |
| P3-05 | CV | D | Text PDF → version 1 live. Image-only PDF → "No readable text" badge. DOCX accepted. 11 MB → error. A 21st version → error. Download opens the file. A tampered signature → 403. The live version cannot be deleted; a non-live one can. |
| P3-06 | Phone | D, M | A Polish national number → normalised to E.164. The code shows on screen. 5 wrong → locked. Resend disabled for 60 s. Correct → "Verified". The same number on a second account also verifies (OD3). |
| P3-07 | Evidence flow | D, M | Submit identity (passport JPG) → In review. The Owner opens the verification tab and sees the preview, the candidate and the linked claim. Reject with a reason → the candidate sees Rejected + reason, and the captured email is in the candidate's language. Resubmit → Approve → Identity ticked, checklist item done, approval email. |
| P3-08 | Permission denial | D | A test-only admin without `moderation.manage` (created via `/_test/db`) → the verification API gives `PERMISSION_DENIED` and the page shows the translated no-permission state. Without `documents.view` the preview is refused. |
| P3-09 | Complete profile | D | After all items and approvals: checklist "Complete", 100% on the Overview card and My profile. |
| P3-10 | U27 reset | D | Editing the education entry linked to an approved academic check → the check resets and the profile is incomplete again. |
| P3-11 | Expired permit | D | A visa/permit with a past expiry date → "Permit expired"; completeness unchanged. |
| P3-12 | Privacy | D | The three privacy flags persist after reload. |
| P3-13 | City field (G-1) | D, M | In My profile, type a few letters of a city → suggestions from the proxy in the UI language, EU 27 + UK only (no request to Google from the browser) → pick one → saved as `{ countryCode, city, placeId }` and shown after reload. "Las Palmas", "Funchal", "Limassol" and "Valletta" each show suggestions (P3-Q1). Spanish (P3-Q2): in the signed-in page, a Spanish user's city request returns Spanish names ("Lond" → "Londres"). |

**API tests.** Places with Google stubbed (G-1): only EU 27 + UK suggestions (the P3-D1 country rule); `languageCode`, the session token and the Europe rectangle passed through; a cache hit makes no second Google call; the per-user rate limit; details outside EU 27 + UK → `not_allowed`; a Google failure → `PLACES_UNAVAILABLE`; saving a location stores the resolved place and never coordinates. Completeness (every item, N 10–12, opt-outs, U27); section CRUD validation and limits; files (type, magic bytes, size, signature, expiry, ownership, Range, download log); CV (extraction for each fixture, 20 max, live and delete rules); phone (all M-004 rules); submissions and decisions (permissions, reasons, emails, audit); `/me` completeness.

#### Phase 3 handoff (2026-10-30, built, awaiting owner review, uncommitted)

**Built.**
- Server modules `places` (Google proxy, §2.16, P3-Q1, P3-D1), `files` (storage, type checks, signed URLs, `GET /files/:id`, `GET /admin/files/:id`), `candidates` (profile sections, photo, certificates, onboarding, privacy, completeness in `/me`, U27 resets), `cv`, `verification` (phone code, evidence, admin queue and decisions, `verification_approved`/`_rejected` emails in en/es/fr, audit), plus `GET /meta/languages` and `GET /plans`.
- Seed: Alex incomplete and the 6 recruiter-mock candidates complete, with generated CVs, initials photos, verified phones and approved sample evidence; place ids in `server/seed/data/places.js`.
- Client: `CityField`, the three onboarding steps, My profile with its editors and checklist, the Overview strength and verification cards, CV & versions, Verification, Privacy, the shell photo and the admin Moderation tab "Candidate verification". The replaced mocks were deleted except the exports still imported by Find jobs (Phase 4), the recruiter applicant view (Phase 6) and Data & account (Phase 12) (P3-D10).
- e2e: `e2e/fixtures/make.js` (P11 part 1, run automatically), `e2e/lib/candidates.js`, scenarios P3-01 … P3-13, the route `/admin/moderation/verification` in the sweep.

**Calls the plan did not specify:** owner answers P3-Q1 … Q3 and P3-D1 … D13 (P3-D11 and P3-D13 were changed while building), and builder calls P3-C1 … P3-C11 in the Owner answers table, all awaiting review.

**Results and exact commands** (run from the repo root unless noted; never run the server tests and the e2e at the same time: both use `eujobs_test` and `UPLOAD_DIR/_test`):

| Command | Result |
|---|---|
| `cd server && npm test` | 133 of 133 |
| `cd server && npm run lint` | clean |
| `cd client && npm run lint && npm run build` | clean, built |
| `node e2e/run.js phase-2` | 27 of 27 |
| `node e2e/run.js phase-3` | 19 of 19 |
| `node e2e/run.js sweep` | D and M pass |
| `node e2e/run.js p03-13-city-field` (any single scenario by file name) | pass |
| `cd server && npm run mail:test -- verification_approved +alex` and `… verification_rejected +alex` | sent; the owner has not yet confirmed arrival |

P18 was checked against the dev server (`cd server && npm start`, then a one-off script that signed in as the Owner and called `/places/autocomplete` in en/es/fr plus `/places/:placeId`; the script was not kept). All results were EU 27 + UK, names were in the user's language, the four island and Mediterranean cities were found, and place details returned `{ countryCode, city, placeId }`.

**Flaky or watch.**
- P2-11 failed intermittently on a hanging avatar request until P3-C3; a run that crosses a 5-minute step mid-scenario can still change the avatar URL once.
- A test file that left a custom admin role behind made the `seed:catalog` count test fail in the full run; test-created roles are now deleted. The earlier one-off `permissions.test.js` failure may have the same cause.
- P2-10 (D) takes about 66 s because it waits out the 60 s resend cooldown (unchanged).

**Open.**
- The owner confirms the two live verification emails.
- The development database `eujobs` still holds the Phase 2 seed. Run `cd server && npm run seed:catalog && npm run seed:demo` to see Phase 3 data in the dev app; this wipes and recreates the demo data and files.
- `GET /candidate/cv/downloads` and its screen: Phase 4.
- The CV snapshot, the Compare panel and the profile AI summary: Phase 9 (P3-Q3).
- es/fr for the `cv`, `profile`, `verification` and `moderation` namespaces, and restoring P2-19's full check: Phase 11.
- The Google Maps Platform terms check (§8): before go-live.

### Phase 4: Recruiter onboarding, company, approval, jobs, discovery

**Scope.** Recruiter onboarding and admin account review; the company page; jobs end-to-end; candidate job browsing; recruiter candidate discovery.

Surfaces that depend on the match score use the non-AI path until Phase 9: the M-051 fallback (at least 1 required skill) for "N relevant" and the Recommended KPI, the U8 rule for For you, and the M-052 overlap for sorting and talent cards. Phase 9 swaps in the score.

**Decisions.**
- Onboarding and company: M-145 … M-153, M-165, OQ-2.
- Jobs: M-032 (as changed by G-1) … M-046, M-131, M-205, OD2, U26, OQ-6i, G-1.
- Browsing: M-050, M-051 (fallback), M-052, M-053 (U8 for now), M-059 (removal), M-132, M-137, U8, U25.
- Discovery: M-024, M-026, M-029, M-054 … M-056, M-079 … M-081, M-167 (publish lock), M-184, M-187, M-201, M-202, OD4, U7 (population), U19, U28, OQ-6a, OQ-6f.
- Contradictions: C3, C7, C9, C10, C24.

**Prep.** P11, part 2: KYC PDF and PNG; an SVG containing `<script>` and an `onload` attribute.

**Tasks**

1. `companies` and `kycdocuments`. Onboarding endpoints and screens:
   - step 1: details only;
   - step 2: company, with the city from the Places city field (G-1); its EU 27 + UK country sets the picker country and the default language unless explicit;
   - step 3: KYC uploads, locked after submit;
   - step 4: on-screen phone code, then submit;
   - step 5: status page for pending, rejected (reason + Resubmit) and suspended.
   Delete `useOnboardingState` and the onboarding mock data.
2. Admin Account review on the server:
   - list pending recruiters (oldest first) and suspended ones (OQ-2);
   - detail per §3.12;
   - Approve, Reject or Suspend with a reason, and Approve on a suspended account;
   - effects: status, tokenVersion, default stages on first approval, emails, audit.
3. Company page (M-147) and logo (dompurify + jsdom for SVG; a letter tile coloured from the id).
4. Jobs: model, service and endpoints:
   - wizard server draft after step 1, quality-check rules, publish validation with `step`;
   - statuses, the Closed tab and order; delete drafts only; edit live;
   - the job city from the Places city field for on-site and hybrid jobs (G-1); skill suggestions; salary currency locked by country (EUR for Remote) with the period; languages and sponsorship; Remote eligible countries (OQ-6i);
   - `firstPublishedAt`; the restricted lock respected.
   Recruiter Jobs list and details: "N relevant" via the fallback.
5. Candidate browsing:
   - Find jobs: visibility (M-044), picker and Remote view (OD2), filters including salary (U25) and the optional city (Places city field, G-1), keyword rules, sort, pagination, eligible-country badge and filter;
   - job details: hide empty sections, the M-043 states, no static perks or premium copy;
   - saved jobs; the Free overlap label (M-052) for every candidate; Overview "Recommended jobs" and For you via U8;
   - remove the page-level AI summary buttons (per-card buttons come in Phase 9).
6. Recruiter discovery:
   - Find candidates: population, country rule, Remote = work preference `remote`, filters (has right to work in country, language + level, Verified, availability, optional city through the Places city field, G-1), overlap sort;
   - candidate profile tabs (M-026 layout, privacy, ticks per check, certificate badge, records profile views);
   - shortlist, notes, activity (events available now);
   - Resume tab (live CV only when `resumeVisible` or the candidate applied; downloads logged; earlier-version requests with reason and details);
   - candidate side: pending requests on the CV page, approve by choosing a version, or decline; `cv_request` email;
   - compare modal rows (A: recruiter B2);
   - Overview: open positions, shortlisted, recommended (fallback), talent cards (fallback), greeting (M-202); the Compare checkbox removed (M-201).
7. Candidate Overview profile-views KPI (M-184).
8. `seed:demo`:
   - Acme Studio approved for Sarah, with default stages;
   - one approved company with a seeded `@example.com` recruiter for each other company in the mock jobs;
   - the jobs, moved to the U42 cities with OQ-4 rates;
   - James Chen the recruiter applicant (pending, company, generated KYC files);
   - shortlists, notes, activities and profile views from the mocks.
9. Delete: recruiter jobs, company, find-candidates, shortlist, notes and activity mocks and hooks; candidate `jobs.js`, `recruiterJobs.js`, the `jobUtils` search code, and the saved-jobs hook.

**Done when.** A recruiter goes from sign-up to an approved workspace in Chrome. Jobs publish with server validation. Candidates browse by country and Remote. Recruiters discover only allowed candidates. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P4-01 | Onboarding | D, M | A verified recruiter: step 2 with country Germany (the picker becomes Germany; an explicit language is kept) → step 3 identity PDF + registration PNG → step 4 code on screen → submit → "Under review". `/recruiter` redirects to the status page. The API returns `RECRUITER_NOT_APPROVED`. The footer buttons wrap at 375 px. |
| P4-02 | KYC rules | D | 11 MB → error; `.txt` → error. After submit, replacing a document is disabled, and the API returns `LOCKED`. |
| P4-03 | Approve | D, M | The Owner's Account review shows the applicant, the company, "Phone confirmed on screen (no SMS)" and KYC previews → Approve → captured approved email → the recruiter signs in and sees the workspace. The 6 default stages exist (API). |
| P4-04 | Reject and resubmit | D | Reject with a reason → the status page shows it with Resubmit; the reason email is captured. Edit the company, resubmit → pending again. |
| P4-05 | Suspend and reactivate | D | Suspend Sarah with a reason → her session gets 401, and signing in shows the blocked page. Her jobs vanish from candidate Find jobs. Email captured. Approve from Account review → active again, jobs visible again, approved email. |
| P4-06 | Company page | D, M | Edit display name, industry, size, city, website and description; the legal name is read-only. A PNG logo appears on the jobs and candidate cards. An SVG with `<script>` → the served file contains no script or `on*` attribute. 3 MB → error. No logo → a letter tile with the same colour after reload. |
| P4-07 | Job wizard | D, M | A job in Poland: salary currency PLN locked, period month. The draft exists after step 1 and survives a reload. Publishing an invalid draft from the table menu opens the wizard at the first invalid step. A skill in both lists → error. Salary 100,000,001 → error. The quality checks list real rule results. Published job shown in the Published tab. Tab order published, paused, draft, closed. |
| P4-08 | Remote job | D | Remote with eligible PL and DE → country Remote, EUR. It is listed only in the candidate's Remote view, with the "Eligible in" badge. The "Eligible in: Poland" filter keeps it. The Poland view does not list it. |
| P4-09 | Edit live and delete | D | Editing a published title shows the new title to candidates. Delete is offered only on drafts. |
| P4-10 | Find jobs | D, M | Germany: only German on-site and hybrid jobs of approved, unrestricted companies. Remote shows EUR. The salary filter works in the view currency (a monthly job counted ×12). Keyword search follows the rules. A saved job persists. A paused job opened by a saver → "No longer accepting applications"; by others → "no longer available". en + Germany shows en-DE formats. |
| P4-11 | Free label | D | Cards show the overlap label and never a percentage. For you lists jobs sharing at least 1 required skill, ordered by overlap, then recency. |
| P4-12 | Find candidates | D, M | Germany: only email-verified, discoverable, consenting, complete candidates living in DE or with a valid EU right to work. Remote: candidates with work preference `remote`. The right-to-work, language ≥ B2 and Verified filters behave per §3.8. An incomplete or hidden candidate is never listed. |
| P4-13 | Candidate profile and CV request | D | The tabs show the photo, links, ticks, languages, right to work, history, education and certificates. With `resumeVisible` off there is no file; request an earlier version → captured `cv_request` email and a pending item on the candidate's CV page → approve with version 1 → the recruiter opens it → the candidate's download log shows the entry. The activity timeline shows request, decision and download. |
| P4-14 | Shortlist and notes | D | Bookmark → the Shortlists page lists the candidate. The candidate turns discovery off → hidden, with "1 no longer available". A note of 5,001 characters → error; a saved note shows `updatedBy` and the time. |
| P4-15 | Profile views | D | A recruiter opens the same candidate twice in a day → the candidate's Overview profile views rise by 1. |
| P4-16 | Recruiter Overview | D, M | Open positions and Shortlisted equal the database. No Compare checkbox. The greeting uses the local time of day and the first name. |
| P4-17 | Denials | D | An unapproved recruiter's API calls → 403. A hidden candidate's profile URL → 404. A candidate opening a draft job URL → 404. |

**API tests.** Onboarding state machine; KYC rules; account decisions (all transitions, reactivation, emails, audit, tokenVersion); company edit rules; every job limit, currency locking, Remote rules, status transitions, 422 with `step`, the restricted lock, delete rules; the visibility query; Find-jobs filters (OD2, U25); saved jobs; discovery population (each exclusion), country rule, filters including permit expiry; CV visibility and the request flow; shortlist, notes, activity, profile-view dedupe; skill suggestions.

#### Phase 4 handoff (2026-11-02, built, awaiting owner review)

**Built.**
- Server modules `companies` (onboarding, KYC, company page and logo with SVG sanitising, admin Account review with the P4-Q2 status filter, approved/rejected/suspended emails in en/es/fr, default stages, audit), `jobs` (recruiter CRUD, wizard drafts, publish validation with `step`, quality checks, skill suggestions, statuses, the restricted lock, "N relevant" via the fallback and the `relevance-nightly` slot; candidate search, details, For you and saved jobs), `discovery` (population, filters, profile with views, CV access and requests with the `cv_request` email, activity, notes, shortlist, recruiter Overview and talent), `cv` requests and downloads, `GET /candidate/overview`; `requireApprovedRecruiter` (`RECRUITER_NOT_APPROVED`, `ACCOUNT_SUSPENDED`).
- Seed: Acme Studio and the mock companies with invented recruiters, 12 jobs, James Chen's pending application, shortlist, saved jobs and profile views (P4-C1, P4-C2).
- Client: recruiter onboarding, admin Account review, Company page, job wizard, Jobs list and details, Find candidates, candidate profile tabs, Shortlists, recruiter Overview, candidate Find jobs, job details, Overview and the CV page requests and download log. The replaced mocks and hooks were deleted except those listed in P4-D14 and P4-C5.
- e2e: fixtures part 2, `e2e/lib/recruiters.js`, scenarios P4-01 … P4-17, the routes `/recruiter/jobs/:job[/edit]`, the candidate profile tabs and `/admin/moderation/accounts` in the sweep.

**Calls the plan did not specify:** owner answers P4-Q1 … Q5 and P4-D1 … D14, and builder calls P4-C1 … P4-C7 in the Owner answers table, all awaiting review. The builder calls in short:
- P4-C1 seeded companies: Acme plus one approved company per mock-job company, each with an invented `@example.com` recruiter; James Chen's applicant company in Dublin; Dublin and Lisbon time zones.
- P4-C2 seeded activity: Acme's shortlist (Oliver, James Chen), Alex's 2 saved jobs, Emma's 18/16 profile views; Sarah's UK default view leaves her shortlist out.
- P4-C3 endpoints beyond §5: `GET /admin/moderation/accounts/:userId`; status counts on the account list; no `/recruiter/overview/momentum` yet.
- P4-C4 shared fixes: Modal focus through an `onClose` ref, PillBadge forwards `data-*`, no onboarding refetch on a phone code request, completeness refresh only for candidates.
- P4-C5 client leftovers: `company/data/company.js` kept for Phase 6, candidate Overview AI card removed, job status order published, paused, draft, closed.
- P4-C6 field error keys: own keys for the CV request and account decision reasons; email templates skip empty body lines.
- P4-C7 earlier-phase checks: P3-08 allows the Account review 403, P3-06 clears by keyboard, `mail:test` knows the 4 new email types.

**Results and exact commands** (run from the repo root unless noted; never run the server tests and the e2e at the same time):

| Command | Result |
|---|---|
| `cd server && npm test` | 165 of 165 |
| `cd server && npm run lint` | clean |
| `cd client && npm run lint && npm run build` | clean, built |
| `node e2e/run.js phase-2` | 27 of 27 |
| `node e2e/run.js phase-3` | 19 of 19 |
| `node e2e/run.js phase-4` | 24 of 24 |
| `node e2e/run.js sweep` | D and M pass |
| `cd server && npm run mail:test -- recruiter_approved +alex` (and `recruiter_rejected`, `recruiter_suspended`, `cv_request`) | sent; the owner has not yet confirmed arrival |

**Flaky or watch.**
- One sweep run timed out at 375 px (`Navigation timeout of 30000 ms exceeded`) waiting for `/recruiter/jobs/:job` to go network-idle; desktop passed in the same run and the next full sweep passed at both widths. Not reproduced; cause unknown.
- The Phase 1 one-off `server/test/permissions.test.js` failure (see the Phase 3 handoff: possibly a test-created admin role left behind) did not recur in the Phase 4 server runs (last full run 165 of 165), but its cause was never confirmed.
- P3-06 failed once on mobile (two codes in one field), fixed in the scenario (P4-C7); it then passed 4 runs in a row.
- The candidate phone form requests a code and then refetches; the recruiter onboarding had a stale-refetch race of this kind (P4-C4). The candidate page has not shown it, but it has the same shape.

**Open.**
- The owner confirms the four live emails.
- The development database `eujobs` still holds the Phase 3 seed. Run `cd server && npm run seed:catalog && npm run seed:demo` to see Phase 4 data in the dev app; this wipes and recreates the demo data and files.
- Sarah's seeded shortlist shows only in the Germany or Netherlands view (P4-C2); optional fix in Phase 11 task 8.
- The CV request reason reads "Verify employment history" in the email and "Verify employment" on screen (server and client enum labels): Phase 11 task 6.
- The candidate Overview tabs row does not wrap, so longer es/fr labels may overflow at 375 px: Phase 11 task 7.
- P2-11's English-only exception (P4-Q5) and P2-19's (P3-C2) are removed in Phase 11 task 5.
- Applications, conversations, the pipeline and AI surfaces hidden by P4-Q1: their phases.

### Phase 5: Payments, plan, Stripe, entitlements and gates

**Scope.** The plan catalogue in Stripe; subscription Checkout; the webhook and payment records; entitlements in `/me` and in middleware; the Portal; billing; every plan gate and upsell in the UI.

The course-purchase path is built here but verified in Phase 8. AI pages are gated here; their content arrives in Phase 9.

**Decisions.** M-115 … M-130, M-118, M-119 (AI and alerts lock), M-195 (plan subtitle), M-196, C12, C13, C14, C25, U38, U40, OD1, OD8, OQ-4; ordering items 4 and 11.

**Prep.**
- P5 rest: a paid Checkout end-to-end in each currency, done by P5-02.
- P6: the Portal configuration, created by `seed:catalog`.
- P8: `npm run stripe:check-secret` must print `match`.
- P7 is optional; nothing depends on it.

**Tasks**

1. Install `stripe`. `lib/stripe.js`. `seed:catalog` creates the Product, the 8 Prices and the Portal configuration and stores their ids (idempotent). Scripts `stripe:listen` and `stripe:check-secret` (§2.2). Verify: running `seed:catalog` twice creates no duplicates in Stripe; `stripe:check-secret` prints `match`.
2. `subscriptions`, `payments`, `counters`, `stripeevents`. The webhook with every handler (§2.10); the reference sequence; the entitlement rule with `retrying`; `requireEntitlement`; `me.plan` and `me.entitlements`. Verify: API tests.
3. Checkout:
   - `GET /payments/quote` and `POST /payments/checkout-sessions`;
   - the confirm dialog reuses the `CheckoutDialog` shell (A: shared §6);
   - return routes `/candidate/checkout/return` and `/recruiter/checkout/return` (M-125) poll the session, invalidate `Me`, `Subscription`, `Payments` and `Enrollments`, then go back to `from`;
   - delete `payments/utils/card.js` and the demo card form and copy.
4. Candidate Billing: plan and status, period end, cancel-at-period-end flag, subscription currency, "Manage subscription" → Portal session, the payments table from `/me/payments` with receipt links, and the Free upsell.
5. Gates in the UI:
   - `RequirePlan` on `ai-insights/*` and `job-alerts`;
   - plan chips in the sidebar and global search (M-118); the global `PLAN_REQUIRED` handler opening the upgrade dialog;
   - updated PlusGate copy; the promo card (M-196); the onboarding plan step with real Checkout and "You're on Plus" (M-129);
   - the profile-menu plan subtitle.
6. Emails `renewal_failed` and `plan_ended`.
7. `seed:demo` (OD8, OQ-4):
   - Emma's real Stripe test customer and subscription with `pm_card_visa`, in her picker country's currency, tagged `seed` and `db`;
   - the paid mock payments as `source: seed` rows; one historical Plus row for each other seeded applicant;
   - re-seeding deletes only this database's Stripe seed objects.
8. Delete: `lwm.candidate.subscription`, `useSubscription`, the `PLANS` constants, `usePayments` localStorage, `SEED_PAYMENTS`.

**Done when.** A Free candidate subscribes in every currency through hosted Checkout in Chrome. Webhooks create the correct rows exactly once. Lapse locks and unlocks correctly whatever the Stripe final retry action. Gates show and enforce. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P5-01 | Upgrade | D, M | Free candidate, picker Poland, opens AI insights → the gate shows the Plus price in PLN (45) formatted for en-PL. Upgrade → confirm dialog (item, price, currency, "Continue to secure payment") → hosted Checkout shows PLN 45.00, card and Link only, in the user's language → pay with 4242 → the return page polls → back on AI insights, unlocked. The database has an active subscription and one paid `LWM-` row with a receipt link. Billing shows PLN and the renewal date. |
| P5-02 | Every currency | D | Repeat with fresh Free candidates in Germany (EUR), UK (GBP), Sweden (SEK), Denmark (DKK), Czechia (CZK), Hungary (HUF), Romania (RON) and Remote (EUR). Each Checkout and each stored row has the requested currency and the OD1 amount (C14, P5). |
| P5-03 | Portal cancel | D | Billing → Manage subscription → Portal shows cancel, card update and invoices, and no plan switching. Cancel → back → Billing shows "Ends on {date}"; still Plus. |
| P5-04 | Renewal failure (Test Clock) | D | A harness helper creates a test-clock customer with card 0341 and links it to a candidate. Advance past the period end → `past_due` + `retrying` → still Plus; a failed row; `renewal_failed` captured. Advance through the whole retry schedule → Free (whether Stripe cancels, marks unpaid or leaves past due) → `plan_ended` captured → AI page locked. |
| P5-05 | Refund | D | Refund a payment through the Stripe API → `charge.refunded` → the row shows "Refunded" in Billing. |
| P5-06 | Idempotency | D | Resend a processed event with `stripe events resend <id> --api-key …` → no duplicate row. |
| P5-07 | Promo card | D, M | Free → upsell with the local price. Plus but incomplete → "Complete your profile" to the checklist. Plus and complete → hidden. A subscriber whose picker changed sees the subscription currency. |
| P5-08 | Onboarding plan step | D | A subscriber sees "You're on Plus"; Continue does not cancel. |
| P5-09 | Lock chips | D, M | Free: chips on AI insights and Job alerts in the sidebar and in global search. Plus: no chips. |
| P5-10 | Re-seed | D | `seed:demo` twice → Stripe has exactly one seed customer for `eujobs_test` (searched by metadata). Emma shows Plus. |

**API tests.**
- The entitlement table: every Stripe status × `retrying`.
- Webhook: bad signature → 400; idempotency on `eventId`; each handler with constructed payloads (subscription create, update, delete; `invoice.paid` as first and renewal; `invoice.payment_failed` with and without `next_payment_attempt`; `charge.refunded`; course checkout creates an enrollment).
- The reference sequence under concurrency.
- Currency rules (picker, Remote = EUR, display in the subscription currency); quotes equal to OD1 for all 8 currencies.
- Session parameters (card + Link, adaptive pricing off, locale, currency).
- The Portal only for subscribers; `requireEntitlement` returns 402 for Free.
- Seed cleanup scoped by database.

#### Phase 5 handoff (2026-11-02, built, awaiting owner review)

**Built.**
- Server: `lib/stripe.js` (API version `2026-10-28.endive`, the SDK 23.1.0 default), the `payments` module (quote, Checkout sessions, session status, Portal session, `/me/payments`, `/candidate/subscription`, the webhook with every §2.10 handler and the event marker, the `LWM-` sequence, the entitlement rule with `retrying`), `requireEntitlement`, `me.plan` and `me.entitlements`, the `renewal_failed` and `plan_ended` emails in en/es/fr, minimal `courses` and `enrollments` for the course path, and the scripts `stripe:listen` and `stripe:check-secret` (prints `match`).
- Seed: `seed:catalog` creates or reuses the Plus Product, the 8 Prices and the Portal configuration (P6). `seed:demo` deletes this database's Stripe customers and test clocks (P5-Q3), gives Emma a real GBP subscription with her first invoice as a seed row (P5-Q4), and writes the 3 mock course rows and the 5 historical Plus months (OQ-4.2).
- Client: the confirm step before Stripe (`CheckoutDialog`), the return pages `/candidate/checkout/return` and `/recruiter/checkout/return`, candidate and recruiter Billing, `RequirePlan` on AI insights and Job alerts, plan chips in the sidebar and search, the global upgrade dialog on `PLAN_REQUIRED`, the promo card (M-196, P5-Q5), the onboarding plan step (M-129), paid course buying hidden until Phase 8 (P5-Q2), and the admin Payments sample rows moved into the admin feature (P5-Q1). Deleted: `payments/utils/card.js`, `usePayments`, `billing/data/subscription.js`, `useSubscription`, `PlusGate`, both `PurchaseDialog`s.
- e2e: `stripe listen` in the stack, `e2e/lib/payments.js`, scenarios P5-01 … P5-10 (real hosted Checkout with the test cards), the two return pages in the sweep.

**Calls the plan did not specify:** owner answers P5-Q1 … Q5 and builder calls P5-C1 … P5-C7 in the Owner answers table, all awaiting review. Most important: P5-C1 (`allowed_payment_method_types` replaces `payment_method_types`, which this API version rejects) and P5-C2 (`stripe listen --all-snapshot`).

**Results and exact commands** (run from the repo root unless noted; never run the server tests and the e2e at the same time):

| Command | Result |
|---|---|
| `cd server && npm run stripe:check-secret` | match |
| `cd server && npm test` | 190 of 190 |
| `cd server && npm run lint` | clean |
| `cd client && npm run lint && npm run build` | clean, built |
| `node e2e/run.js phase-5` | 13 of 13 |
| `node e2e/run.js sweep` | D and M pass |
| `node e2e/run.js phase-2` | 27 of 27 (after the es/fr `billing` files; the run before them failed P2-01 and P2-14 on missing es/fr keys) |
| `node e2e/run.js phase-3` | 19 of 19 |
| `node e2e/run.js phase-4` | 24 of 24 |
| `cd server && npm run mail:test -- renewal_failed +alex` and `… plan_ended +alex` | sent; the owner has not yet confirmed arrival |

**Observed in Stripe.** The sandbox's final retry action after a failed renewal is "cancel subscription" (P5-04 ended `canceled`); the code also handles "mark unpaid" and "leave past due" (API tests). The Customer Portal shows the sandbox business name "New Business" (a Stripe Dashboard setting).

**Flaky or watch.**
- Stripe's customer search lags up to a minute; P5-10 waits for it (about 90 s).
- P5-02 takes about 2.5 minutes (8 hosted Checkouts), P5-04 about 1.5 minutes (Test Clock).
- `npm audit` reports 3 moderate findings in `minimatch` under `archiver` (Phase 3), not in `stripe`.

**Open.**
- The owner confirms the two live emails.
- The development database `eujobs` still holds the Phase 4 seed. Run `cd server && npm run seed:catalog && npm run seed:demo` to see Phase 5 data in the dev app (this creates Emma's Stripe subscription), and run `cd server && npm run stripe:listen` next to `npm run dev`, so webhooks reach the dev server.
- Optional: rename the sandbox business in the Stripe Dashboard; P7 retry settings stay optional.
- Course purchases: Phase 8 wires the screens to the course checkout path built here.

### Phase 6: Applications and pipeline

**Scope.** The apply gate and dialog; candidate Applications; the recruiter Applications table, board, stages and reject; status and new-application emails; recruiter Overview hiring numbers; counters (unread messages count is real and stays 0 until Phase 7).

**Decisions.** M-043, M-069 … M-078, M-082, M-083, M-090, M-091, M-094 (applications part), M-095, M-119 (applications after lapse), M-170, M-178, OD5, OD14, U13, U33, OQ-6e, C8.

**Prep.** None.

**Tasks**

1. `applications` and `pipelinestages`. Apply (the gate in one request), withdraw, re-apply as a new record, status history, the "Next step" text per status (i18n).
2. Candidate UI:
   - every Apply button calls the gate (A: candidate D2 list);
   - the gate modal lists missing items with links, plus Upgrade;
   - the apply dialog (M-073);
   - the Applications page (statuses, dated history, withdraw, re-apply);
   - the active-applications badge through `/me/counters` polled every 15 s, paused in hidden tabs.
3. Recruiter UI:
   - Applications table (Job, Applied, job filter, Withdrawn and Not selected filters); remove "Candidate portal activity";
   - board with one card per application and a job filter; stage select per application;
   - Manage stages with a category select (M-072, OD5);
   - the reject dialog with "Email the candidate" (M-090); undo through the stage select (OQ-6e);
   - job details: the applicants list.
4. Status mapping and history; scheduled tasks `email.stage` and `email.new-applications`; emails `application_status`, `application_rejected`, `new_applications`; activity events `applied`, `withdrawn`, `stage_changed`, `rejected`.
5. Recruiter Overview: the Applications KPI (M-082), the funnel over the company's stages ever reached (M-178), momentum with this week and last week in the browser time zone (M-083, M-170).
6. `seed:demo`: applications from the mock `pipeline.js` placements with coherent stage histories; the applicants are complete and have their OQ-4 payment history.
7. Delete: candidate `applications.js` and `useApplications`; recruiter `pipeline.js`, `usePipeline`, `useLiveApplicant`; the overview mock numbers.

**Done when.** The gate, applying, stage moves, rejection and withdrawal work end-to-end in Chrome, with the correct delayed emails. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P6-01 | Gate, Free and incomplete | D, M | Alex clicks Apply → the gate lists the missing items with links and "Upgrade to apply"; Apply is disabled. |
| P6-02 | Gate variants | D | Plus but incomplete → only the missing items. Free but complete → only the upgrade. Direct API calls → 402 and 403 with `missing`. |
| P6-03 | Apply | D, M | Emma: dialog with CV version (live by default); a cover note of 2,001 characters → error; consent required → submit → Applications shows "Applied" with a dated history; the sidebar badge updates within 15 s. Tick +1 h → the recruiter gets "1 new application for {job}". A second application to the same job within the hour → no email until the hour passes, then "{n} new applications". |
| P6-04 | Stage emails | D | The recruiter moves Applied → Screening → Shortlisted within 10 min. Tick +10 min → exactly one "Under review" email. Interview → "Interview" email. Interview → Screening → Interview within 10 min → no email. |
| P6-05 | Reject and undo | D, M | Reject with the box checked → the card leaves the board and shows under the "Not selected" filter. Within 10 min, a stage chosen again in its stage select → no email. Reject again with the box unchecked → no email. Reject with it checked → after 10 min the email arrives in the candidate's language (an es candidate gets Spanish). |
| P6-06 | Withdraw and re-apply | D | The candidate withdraws → the recruiter sees it under the Withdrawn filter and badge, off the board. Re-apply → a new record; the old one stays withdrawn. |
| P6-07 | Manage stages | D, M | Add "Portfolio review" (category screening), rename it, reorder it ("Applied" stays first). Deleting a stage with active applications → blocked message. A 13th stage → blocked. A 25-character name or a duplicate (case-insensitive) → error. History keeps the old names. |
| P6-08 | KPIs and charts | D | The Applications KPI equals the database count of active applications. The funnel lists the company's stages with ever-reached counts. Momentum buckets follow the browser time zone (CDP time-zone override) with Monday weeks. |
| P6-09 | Lapse | D | Emma's subscription canceled → the existing application stays active and can be withdrawn; Apply elsewhere shows the upgrade. |
| P6-10 | Toggle off | D | The candidate turns emails off → no status emails (EmailLog `skipped_toggle`). |
| P6-11 | Job closed | D | The recruiter closes the job → the applicant's job page shows "No longer accepting applications"; the application is still listed. |

**API tests.** The gate matrix (plan × completeness × job state); duplicates and the partial unique index; withdraw and re-apply; stage rules (M-072) and category mapping; history; U13 collapse with tick(now); rejection undo; OD14 batching; counters; KPI, funnel and momentum aggregations with time zones.

#### Phase 6 handoff (2026-11-02, built, awaiting owner review)

**Built.**
- Server: the `applications` module, made of the `Application` model, `PipelineStage`, the apply gate (plan → completeness → job state in one request), withdraw and re-apply, recruiter list, stage move, reject with undo, Manage stages, the counters, the funnel and momentum endpoints, and the `email.stage` and `email.new-applications` tasks. The emails `application_status`, `application_rejected` and `new_applications` ship in en/es/fr. Discovery opens applicants' profiles and lists the CV sent with each application, and job cards carry the candidate's application. `GET /me/counters` was added. The scheduler passes the tick time to task handlers. `npm run mail:test` knows the three new types.
- Seed: the six pipeline placements as Acme applications with dated histories and activity events (P6-C7). Alex has none (P6-Q1).
- Client:
  - Candidate: Apply on job cards and job details, the gate, the apply dialog, Applications with history, next step, withdraw and Apply again, the badge (hidden at 0, polled every 15 s, paused in hidden tabs) and the Overview card and KPI.
  - Recruiter: the Applications table with job, stage, "Not selected" and "Withdrawn" filters, the board with a job filter, Manage stages with a status per stage, the reject dialog with "Email the candidate", stage selects on the candidate profile, the CVs sent with applications on the Resume tab, applicants on job details, and the Overview Applications KPI, funnel and momentum.
- Deleted:
  - the candidate mocks `applications.js`, `useApplications`, `useJobListings`, `jobs.js`, `recruiterJobs.js` and `jobUtils.js`, and the mock AI job summary dialog and button (P6-C8);
  - the recruiter mocks `pipeline.js`, `usePipeline`, `useLiveApplicant`, `overview/data/overview.js` and `company/data/company.js`.
  The admin Applications sample moved into the admin feature (as P5-Q1).
- e2e: `e2e/lib/applicants.js`, which builds complete candidates through the API with a real Stripe Plus (P6-C9), and scenarios P6-01 … P6-11.

**Calls the plan did not specify:** owner answers P6-Q1 and P6-Q2, and builder calls P6-C1 … P6-C9 in the Owner answers table, all awaiting review.

**Results and exact commands** (run from the repo root unless noted; never run the server tests and the e2e at the same time):

| Command | Result |
|---|---|
| `cd server && npm test` | 216 of 216 |
| `cd server && npm run lint` | clean |
| `cd client && npm run lint && npm run build` | clean, built |
| `npx oxlint .` in `e2e/` | clean (the two Phase 3/4 warnings were fixed first) |
| `node e2e/run.js phase-6` | 15 of 15 |
| `node e2e/run.js sweep` | D and M pass |
| `cd server && npm run mail:test -- application_status +alex`, `… application_rejected +alex`, `… new_applications +alex` | sent; the owner has not yet confirmed arrival |

**Fixed during the browser checks.** "Apply again" could send an empty CV id before the CV list had loaded (422 "Check this value."). The dialog now leaves the id out until a version is chosen, and the server uses the live CV.

**Flaky or watch.**
- Completing onboarding sets the language from the profile country (M-134). An e2e candidate meant to read Spanish emails must set `languageExplicit`.
- Phase 2–5 scenarios were not rerun in this phase; the sweep covers every route.
- In Git Bash, `npm run mail:test` once segfaulted inside npm before sending; `node --env-file=.env scripts/mailTest.js <type> <to>` worked.

**Open.**
- The owner confirms the three live emails.
- The development database `eujobs` still holds an older seed. Run `cd server && npm run seed:catalog && npm run seed:demo` to see the Phase 6 data in the dev app.
- Phase 7 makes the unread-messages counter real (it answers 0 now).

### Phase 7: Messaging, counters and job alerts

**Scope.** Two-way messages for both roles, with the unread badge and the email; job alerts with instant and digest delivery. "Translate" per message arrives in Phase 9; "Report message" in Phase 10.

**Decisions.** M-084 … M-089, M-093, M-094, M-096 … M-098, M-118, M-119, M-180, U12, U13, U28, U35, OD9.

**Prep.** None.

**Tasks**

1. `conversations` and `messages`, with the rules of §3.5. New screens (OD16): `/candidate/messages`, `/candidate/messages/:conversationId`, `/recruiter/messages`, `/recruiter/messages/:conversationId`, plus a "Messages" sidebar item for both roles.
2. Recruiter side: the `MessageModal` on the candidate profile sends a real first message with the default i18n template (M-088) and records `outreach` activity (M-180).
3. Candidate side:
   - a paid candidate can start a conversation from an application or the job of a company applied to;
   - Free candidates read only, with an upgrade prompt in place of the composer (M-118).
4. Read marking; `/me/counters` returns unread messages (both roles); badges are hidden at 0. The `email.message` task and the `new_message` email follow U13.
5. Job alerts:
   - `jobalerts` and `alertmatches`; CRUD with limits; the optional city through the Places city field (G-1);
   - the page is plan-gated and shows a "Paused" state while Free (M-119);
   - matching (M-098, U35, translated labels); `alerts.instant` on first publish (M-097);
   - daily and weekly digests at 08:00 in the user's time zone (U12);
   - emails `alert_instant`, `alert_daily`, `alert_weekly`.
6. `seed:demo`: a few threads that match the mock outreach activity; alerts from `alerts.js`, moved to the U42 cities.
7. Delete: `job-alerts/data/alerts.js` and `useJobAlerts`; the device-only outreach text.

**Done when.** Messaging works both ways with correct gating, badges and email timing. Alerts send at the right times with the right jobs. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P7-01 | Recruiter outreach | D, M | Sarah opens a discoverable candidate → Message → the default template in Sarah's language → send → the thread is in her inbox. Alex (Free) sees the badge within 15 s, opens the thread and reads it. The composer is replaced by the upgrade prompt. The badge clears. |
| P7-02 | Plus reply | D | Emma replies → the recruiter badge increments; reading clears it. |
| P7-03 | Email timing | D | A message stays unread. Tick +14 min → no email; +15 min → `new_message` in the recipient's language. A second message 20 min later, also unread → no email (within 60 min); tick +61 min → email. |
| P7-04 | Candidate start rule | D | Emma can start a conversation with a company she applied to. The API refuses another company with 403. |
| P7-05 | Recruiter limits | D | No Message button for a non-discoverable non-applicant, and the API returns 403. After a candidate hides, the existing thread works both ways; a new thread is refused. |
| P7-06 | Plan invisibility | D | The recruiter thread with Alex shows nothing about his plan. |
| P7-07 | Polling pause | D | Background tab → no `/me/counters` requests (CDP). Visible again → polling resumes. |
| P7-08 | Instant alert | D, M | Emma creates "designer" (instant) with the picker on Germany. A recruiter publishes a matching German job → tick → captured email lists the job. Pausing and resuming the job, and editing it → no second email. |
| P7-09 | Digest | D | A daily alert, user time zone Europe/Madrid. Tick at 07:59 local → nothing; 08:00 → a digest of jobs first published since the last one. The next day with no new jobs → no email. |
| P7-10 | Keyword rule | D | "react senior" matches only jobs containing both words in the listed fields. An es-language alert matches through the Spanish level label. |
| P7-11 | Gating and lapse | D | Free → Job alerts locked with the chip and gate. A lapsed Plus candidate sees alerts as "Paused" and gets no emails; after re-subscribing, delivery resumes. |
| P7-12 | Limits | D | An 11th alert → error. A name of 81 characters → error. A message of 2,001 characters → error. |

**API tests.** The start and reply matrix (role × plan × applied × discoverable × hidden after a thread exists); the 2,000-character limit; unread counts and read; U13 scheduling; alert CRUD and limits; matching (fields, translated labels, country including Remote); first publish only; digest scheduling with luxon time zones; lapse pause.

#### Phase 7 handoff (2026-11-02, built, awaiting owner review)

**Baseline before building** (Phase 6 approved): phase-2 26 of 27, phase-3 19 of 19, phase-4 23 of 24, phase-5 13 of 13, phase-6 15 of 15. Both failures were stale checks, fixed and rerun green (P7-C7): P2-10 at 375 px (code field race) and P4-17 (Aisha has applied to Acme since Phase 6).

**Built.**
- Server:
  - the `messages` module: `Conversation` and `Message`, `/conversations` (list, start or add, thread, send, read), the M-084 / M-085 / U28 rules, unread counts per side, `outreach` and `message_reply` activity, and the `email.message` task (U13);
  - the `alerts` module: `JobAlert` and `AlertMatch`, `/candidate/job-alerts` (read and delete for every candidate; create and change with `job_alerts`), matching through the Find jobs haystack, `alerts.instant` scheduled on a job's first publish, and daily and weekly digests checked on every tick (new scheduler `tickJobs`);
  - `GET /me/counters` returns unread messages for both roles;
  - emails `new_message`, `alert_instant`, `alert_daily`, `alert_weekly` in en/es/fr; the email layout lists `params.items`; `npm run mail:test` knows the four types.
- Seed: two Acme threads (P7-Q3) and Emma's two alerts (P7-Q4).
- Client:
  - a shared `features/messages` (inbox and thread for both roles, the composer, or the upgrade prompt on Free, start dialogs), mounted in both workspaces with a "Messages" sidebar item and badge;
  - the recruiter's Message button with the M-088 template on the candidate profile; the candidate's "Message the company" in the application activity dialog and on job details after applying;
  - Job alerts on the API with the Places city field, the "Paused" state and notice for Free candidates with alerts, and the gate otherwise (P7-Q2);
  - counters moved to `app/counters.js`; `PlanGate` split from `RequirePlan`.
- Deleted: `job-alerts/data/alerts.js` and `useJobAlerts`. The device-only outreach text had already gone with the Phase 4 `MessageModal` removal.
- e2e: `e2e/lib/messages.js`, scenarios P7-01 … P7-12, and the inboxes plus Acme's thread with Emma in the sweep.

**Calls the plan did not specify:** owner answers P7-Q1 … P7-Q4 and builder calls P7-C1 … P7-C7 in the Owner answers table.

**Results and exact commands** (from the repo root unless noted; never run the server tests and the e2e at the same time):

| Command | Result |
|---|---|
| `cd server && npm test` | 239 of 239 |
| `cd server && npm run lint` | clean |
| `cd client && npm run lint && npm run build` | clean, built |
| `npx oxlint .` in `e2e/` | clean |
| `node e2e/run.js phase-7` | 14 of 14 (P7-01 and P7-08 at 1440 and 375 px) |
| `node e2e/run.js sweep` | D and M pass (candidate 25, recruiter 27 routes, including the inboxes and a thread) |
| `cd server && npm run mail:test -- new_message +alex`, `… alert_instant +alex`, `… alert_daily +alex`, `… alert_weekly +alex` | sent; the owner has not yet confirmed arrival |

**Fixed during the browser checks.**
- P7-09: signing in through the browser saves the browser's time zone (U12), and this machine's Chrome reports Asia/Calcutta, which overwrote the Madrid zone set through the API. The scenario now puts the browser in Europe/Madrid with the CDP override before signing in. The product rule was right.
- P7-03: the Spanish candidate lands on the Overview, still English-only in Spanish (P4-Q5), so the scenario checks the Spanish inbox only.

**Flaky or watch.**
- Ticks with future times (`/_test/scheduler/tick`) also send other users' due digests and message emails in the same run. Scenarios filter mail by recipient and alert name.
- The machine's Chrome time zone is Asia/Calcutta, so any e2e sign-in stores that zone unless the scenario overrides it.

**Open.**
- The owner confirms the four live emails.
- The development database `eujobs` holds an older seed. Run `cd server && npm run seed:catalog && npm run seed:demo` to see the Phase 7 threads and alerts.
- "Translate" per message comes with Phase 9 and "Report message" with Phase 10.

**Approved 2026-11-03** with two changes, built at the start of Phase 8: P7-A1 (withdrawn applications do not allow a new conversation) and P7-A2 (digests list at most 20 jobs, with "See all"). New API tests cover both; `messages.test.js` and `alerts.test.js` pass 24 of 24. The daily-digest test now uses the next 08:00 after the current time: it failed when run before 08:00 Madrid time (a time-of-day flake, not a product bug).

### Phase 8: Learning

**Scope.** The admin course builder and Courses page; the learner catalogue, purchase, lesson viewer, quiz, certificates and public verification; recruiter learning; rule-based suggestions.

**Decisions.** M-099 … M-114, M-130 (course prices), M-207, M-209, C18, C24, U15 … U17, U24, U42, OD1, OQ-3.

**Prep.**
- P9, server part: Inter and Manrope TTF with Latin Extended in `server/assets/fonts`.
- P11, part 3, made by `e2e/fixtures/make.js` in Chrome:
  - a ~30 s WebM through `MediaRecorder` on a canvas stream;
  - an MP4 the same way if Chrome supports `video/mp4;codecs=avc1`, otherwise a small CC0 H.264/AAC MP4 downloaded;
  - a synthetic 501 MB file with an MP4 header for the size test.

**Tasks**

1. `courses` (with lessons and quiz embedded), `enrollments`, `quizattempts`, `certificates`. Admin routes `/admin/courses/new`, `/admin/courses/:id/edit` (full-page builder, M-101; tabs Details, Lessons, Quiz, Preview) and `/admin/courses/:id/learners`:
   - uploads with progress; video duration read in the browser and editable;
   - Markdown with the server preview (marked + DOMPurify); https links only; the free-preview flag; skill tags; the recruiter-course pipeline category (OQ-3);
   - 8 prices or Free; publish validation (U24, quiz rules, at least 1 lesson);
   - lock after the first enrollment; unpublish;
   - the admin Courses list and stats (M-111, Revenue only with `finance.view`);
   - Learning audit events.
2. Learner pages, candidate and recruiter:
   - catalogue with prices in the picker currency and no tiers; course details with the derived "Included" list and curriculum states;
   - free-preview lessons; free enrol; purchase through the Phase 5 Checkout (`kind: course`; recruiters buy for themselves);
   - lesson viewer `/…/learning/:courseId/lessons/:lessonId` (video through a signed URL with 15 s heartbeats; text, PDF and link complete on open);
   - quiz `/…/learning/:courseId/quiz`; the certificate block (PDF, code, URL);
   - "Certificates & badges" on My profile; recruiter learning stats; suggestions (OQ-3).
3. Certificates:
   - pdfkit + qrcode with the embedded fonts, in the holder's language, stored as a snapshot;
   - the public `/certificates/:code` page (public layout with a language picker, 30/min/IP);
   - re-issue on a name change; admin revoke from the learners list (audited); the `certificate_issued` email.
4. `seed:demo`:
   - 12 courses from the learner catalogues (M-207), each with 3 English Markdown lessons (300–600 words) and 5 single-choice questions;
   - OD1 prices; covers from client assets; skill tags and pipeline categories taken from each course's category or stream;
   - enrollments that match the seed payments (Alex: course 1 with lesson 1 done; Sarah: course 1 with lesson 1 done).
5. Delete: the candidate and recruiter learning mocks and hooks, the admin courses mock, `learnerCourse.js`, `CourseFormModal`, the "Mark complete" toggles, and `PurchaseDialog`'s demo copy.

**Done when.** An admin authors and publishes a course. Learners buy, complete, pass the quiz and get a certificate that verifies publicly. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P8-01 | Builder | D, M | Create a candidate course: Details (all learner fields, cover JPG); prices with HUF missing → publish blocked with the reason. Lessons: MP4 upload with progress and auto-filled duration (editable); a text lesson whose Markdown has `<script>` and a `javascript:` link → the preview is sanitised; an `http://` link → error; a PDF; an https link; lesson 1 flagged as free preview. Reorder by drag and by keyboard. Quiz: 5 questions (single and multiple); 1 option → error; no correct option → error. Publish → listed in the candidate catalogue. |
| P8-02 | Upload limits | D | 501 MB video (localhost) → `FILE_TOO_LARGE`. 51 MB PDF → error. 6 MB cover → error. |
| P8-03 | Catalogue | D, M | Poland view → prices in PLN; Free courses say "Free"; no Included or Plus tier badges. The preview lesson opens without buying; the others are locked. |
| P8-04 | Purchase | D | A candidate in Germany buys → confirm → Checkout in EUR → return page → enrolled. The row appears in Billing with a receipt link. |
| P8-05 | Completion | D, M | A text lesson completes on open; a PDF on open; a link on click-through. A ~30 s video played at 1× completes at about 90%. Seeking to the end does not complete it. 2× speed credits at most 2×. |
| P8-06 | Quiz | D, M | Locked until every lesson is complete. A wrong submission → score shown without correct answers; options reshuffled on retry. A pass ≥ 70 → certificate issued; the best score kept; `certificate_issued` captured. |
| P8-07 | Certificate | D, M | A user named "Łukasz Żółć" downloads the PDF: the diacritics render, the course title is as authored, the date is in his language, with the code and QR. `/certificates/:code` signed out → Valid with name, course and date. The 31st request in a minute → rate-limited. The admin revokes it → Revoked. A name change → re-issued PDF with the same code. |
| P8-08 | Lock and unpublish | D | Lesson and quiz editing is disabled once learners exist, with the reason shown; copy and prices still save. Unpublish → hidden from the catalogue while the buyer keeps access. |
| P8-09 | Recruiter learning | D | Sarah buys a recruiter course (personal). The stats show in progress, certificates and streams. Suggestions follow OQ-3 with real numbers in the reason. |
| P8-10 | Candidate suggestions | D | "Suggested for you" lists courses tagged with the candidate's gap skills (OQ-3). |
| P8-11 | Badge visibility | D | The certificate shows on My profile and on the recruiter's view of the candidate. A non-discoverable candidate who applied still shows it to that company (C24). |
| P8-12 | Admin list | D | Rows "{enrolled} enrolled, {purchased} purchased, {completions} completed". Revenue per currency only with `finance.view`. Page totals and the learners list are correct. |

**API tests.** Course validation and publishability (U24, quiz limits); the lock rules; lesson access (enrolled, preview, signed URL); heartbeat crediting (U15: wall clock, rate, seek); completion; quiz (unlock, single and multiple scoring, shuffle, best score); certificate code uniqueness, PDF with embedded fonts, public rate limit, revoke, re-issue; M-110 and M-111 numbers; OQ-3 suggestions; the purchase webhook creating an enrollment once.

#### Phase 8a handoff (2026-11-03, built, awaiting owner review; 8b not started)

**Built (8a, P8-Q1).**
- Server: the `learning` module: `Course` with lessons and quiz, `Enrollment` with the progress fields 8b uses; the admin builder (`/admin/courses…`, `/admin/uploads`, `/admin/markdown/preview`) with the publish rules, the lock at the first enrollment and unpublish, all Learning audit events; the learner side (`/courses`, `/learning/enrollments`, `/learning/courses/:id/lessons/:lessonId`). Lesson videos and PDFs go to `UPLOAD_DIR` on disk through `_incoming` (P8-C4). The course purchase webhook enrolls through the same `enroll()` as free enrolment and the seed, so it also locks the course.
- Seed: 12 published courses with covers, 3 text lessons and 5 questions each, OD1 prices, P8-Q2 categories; the seed course payments now point at their course and give the three seed enrollments (P8-C2).
- Client: shared `features/learning` (API, course texts, the enrol / buy / continue action, the lesson viewer); candidate and recruiter catalogue and details pages on the API; admin Courses list and the full-page builder (Details, Lessons, Quiz, Preview) with upload progress.
- Deleted: the candidate and recruiter learning mocks and hooks, `useCourses`, the admin courses mock, `courseFormat.js`, `learnerCourse.js`, `CourseFormModal` and the "Mark complete" toggles. `PurchaseDialog` no longer existed.
- e2e: P11 part 3 fixtures, `e2e/lib/learning.js`, scenarios P8-01, 02, 03, 04, 08; the sweep visits the builder, the course pages and a lesson of Alex and Sarah.

**Not in 8a (8b):** heartbeats and completion, the quiz page, certificates and the public page, Certificates & badges on My profile, the M-111 stats, revenue and learners list, recruiter learning stats beyond the catalogue counts, and the OQ-3 suggestions (hidden until then, P8-C5). `SuggestionCard.jsx` stays for 8b.

**Calls the plan did not specify:** P8-Q1, P8-Q2 (owner) and builder calls P8-C1 … P8-C6 in the Owner answers table; the Phase 7 changes P7-A1 and P7-A2.

**Results** (repo root unless noted; never run the server tests and the e2e at the same time, or two e2e runs at once):

| Command | Result |
|---|---|
| `cd server && npm test` | 252 of 252 |
| `cd server && npm run lint` | clean |
| `cd client && npm run lint && npm run build` | clean, built |
| `npx oxlint .` in `e2e/` | clean |
| `node e2e/run.js phase-8` | 7 of 7 (P8-01 and P8-03 at 1440 and 375 px) |
| `node e2e/run.js phase-7` | 14 of 14 (with the P7-A1 checks in P7-04 and P7-05) |
| `node e2e/run.js sweep` | D and M pass (candidate 26, recruiter 28, admin 26 routes) |

**Fixed during the browser checks.** `IconButton` takes `icon`, not children (the builder crashed). P8-01 now waits for the refused publish response: the checklist is always on screen for a draft, and a late 422 moved the builder back to the Details tab (correct behaviour, wrong test timing). Another session ran the e2e at the same time once; both runs reseed `eujobs_test` and use ports 5100/5174, so they break each other.

**Open.**
- The development database `eujobs` holds an older seed: `cd server && npm run seed:catalog && npm run seed:demo` shows the courses.
- No new email type in 8a (the `certificate_issued` email comes with 8b).

#### Phase 8b handoff (2026-11-03, built, awaiting owner review; Phase 8 complete)

**Prep.** P9 server part done with the owner's choices: Inter only (P8-Q3), `qrcode` installed (P8-Q4). P11 part 3 was done in 8a.

**Built (8b, P8-Q1).**
- Server:
  - `learning.progress.js`: `POST /learning/lessons/:lessonId/progress` (open and U15 heartbeats), `GET /learning/courses/:id/quiz`, `POST …/quiz/attempts` (P8-C8).
  - `learning.certificates.js` and `lib/pdf.js`: the certificate PDF, issue on the first pass, re-issue on a name change (three places), the learner's list and PDF link, `GET /public/certificates/:code` (30 a minute per IP), `POST /admin/certificates/:id/revoke` (audited), and badges on the recruiter's candidate profile (P8-C7).
  - `learning.suggestions.js`: `GET /learning/suggestions` (OQ-3 for both roles).
  - The admin list now answers completions, revenue per currency (`finance.view` only) and page totals; `GET /admin/courses/:id/learners` (P8-C9).
  - New models `QuizAttempt` and `Certificate`; the `certificate_issued` email in en/es/fr; `mail:test` knows it.
- Client: lesson progress in the viewer (video heartbeats, open, link click-through), the quiz page, the final-quiz card and certificate block on both course pages, "Suggested for you" and "Skills to explore" (candidate), recruiter suggestions with real reasons, "Certificates & badges" on My profile, course certificates on the recruiter's Skills tab, the public `/certificates/:code` page (en/es/fr), the admin Revenue column, page totals and the learners page with Revoke (P8-C10).
- e2e: scenarios P8-05, 06, 07, 09, 10, 11, 12; `e2e/lib/learning.js` builds courses with chosen lessons and questions, finishes lessons and passes quizzes through the API; the sweep visits both quiz pages and the learners list.

**Calls the plan did not specify:** P8-Q3, P8-Q4 (owner) and P8-C7 … P8-C10 (builder) in the Owner answers table.

**Results** (repo root unless noted; never run the server tests and the e2e at the same time, or two e2e runs at once):

| Command | Result |
|---|---|
| `cd server && npm test` | 260 of 260 |
| `cd server && npm run lint` | clean |
| `cd client && npm run lint && npm run build` | clean, built |
| `npx oxlint .` in `e2e/` | clean |
| `node e2e/run.js phase-8` | 17 of 17 (8a and 8b; P8-01, 03, 05, 06, 07 at 1440 and 375 px) |
| `node e2e/run.js sweep` | D and M pass (candidate 27, recruiter 29, admin 27 routes) |
| `cd server && npm run mail:test -- certificate_issued +alex` | sent; the owner has not yet confirmed arrival |

**Fixed during the checks.** The first full `npm test` failed one 8a test that compared the page cards exactly (8b adds the totals to them); it was updated and the full suite then passed 260 of 260. Test-only fixes: the heartbeat test moved the wrong lesson entry back in time; pdf.js detached the buffer the PDF test read; the stat-card reader in P8-09 and P8-10 picked the caption instead of the value; P8-09 clicked Buy before the course page loaded. New blocks on a page enter with the `rise` animation, so P8-06 waits about 0.6 s before its result screenshots.

**Flaky or watch.**
- P8-05 plays the 30 s video in real time four times per viewport (about 90 s each). It relies on headless Chrome playing H.264 muted.
- The learning screens are English until Phase 11; P8-07 issues the French certificate, then switches the learner to English for the browser part.

**Open.**
- The owner confirms the live `certificate_issued` email.
- The development database `eujobs` holds an older seed: `cd server && npm run seed:catalog && npm run seed:demo`.
- 3 moderate `npm audit` findings predate this phase (`archiver` → `minimatch`, P8-Q4).

### Phase 9: Matching and AI

**Scope.** Embeddings, policy versions, scores, relevance and recommendations, which replace the Phase 4 interim rules. Every OpenAI feature. The admin AI & matching page.

**Decisions.** M-047 … M-068, M-088 (translate), M-113 (translate), M-117 (superseded by Phase 11c: recruiter AI needs Recruiter Plus), M-144, U3 … U7, OD13, C6, C11, C23, OQ-6g; ordering item 9.

**Prep.** P13: check the storage headroom for about 12 KB per embedding.

**Tasks**

1. Install `openai`. `lib/ai.js` (§2.9), `aicaches`, `aiusages`, the cap, `AI_UNAVAILABLE`.
2. `embeddings`: the U6 recipe; triggers on profile, CV, consent and job changes; a backfill command run by `seed:demo`.
3. `matchingpolicies` and versions; default v1 in `seed:catalog` (U5 weights and thresholds, all signals on). The score service (U5 with OQ-6g) and `matchresults` per policy version. Relevance (M-051, U7: on job save, nightly at 03:00, startup catch-up).
4. Display:
   - Plus candidate cards: score, label and explanation disclosure; For you and Recommended by score ≥ Good (M-053);
   - recruiter Recommended sort, talent cards and Recommended KPI by score, never exposing a number (C6);
   - admin oversight with %.
   The Phase 4 fallback stays only for jobs or candidates without an embedding (M-051).
5. OpenAI features (U4 models):
   - job AI summary on each candidate card and row (Plus), recruiter job rows, and admin with Regenerate;
   - match explanations and insight narratives (code evidence + narrative; the invented gap texts removed);
   - AI insights pages: overview, role picker (M-063), skill gap with "I have this skill" (M-064), improve profile, job match with "Save this opportunity" (M-065), why recommended with feedback (M-067), skill demand (M-066);
   - recruiter Match insights;
   - CV snapshot proposal and confirm (M-027) with the CV Compare panel shown again (P3-Q3); assisted draft (M-061); profile AI summary (M-062) with the My profile button back;
   - Translate (M-144: job brief, responsibilities, company About, candidate about, work descriptions, messages, course text, outreach).
6. Admin AI & matching page: policies (create, edit name and description, at least 1 signal, archive drafts, versions, activate → recompute); the policy suggestion (`OPENAI_MODEL`); oversight (job picker, top 4, evidence); feedback aggregates; AI status (models, last success).
7. Delete: `ai-insights/data/insights.js`, `useInsightsState`, `ai-insights/utils/matching.js`, recruiter `matchEvidence` fake texts, the AI summary templates, the admin `matching.js` mock and `useMatchingPolicies`.

**Done when.** Scores, labels and relevance are real and policy-driven. Every AI feature works in en/es/fr with caching and the cap. Recruiters never see a number. Lint, build, tests and sweep are green.

**Browser verification** (real OpenAI)

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P9-01 | Candidate scores | D, M | Plus cards show Strong or Good and a score. The explanation shows code evidence plus a narrative in the user's language. Switching to fr → a French narrative (a new cache entry). Free cards show the overlap label only, never a number. |
| P9-02 | For you | D | Plus: jobs in the picker country with score ≥ Good, ranked; "+N this week". |
| P9-03 | Recruiter view | D, M | The Recommended sort follows the scores. Talent cards. Expanding Match insights → evidence (skills, years, work mode, languages, right to work) plus a narrative. No percentage anywhere in the recruiter DOM, and API responses carry no score field. |
| P9-04 | Relevance | D | A job's "N relevant" equals the population with score ≥ Good. Editing the brief recomputes the embedding and the count. A tick at 03:00 runs the nightly job; after 25 h with the server off, startup catches up. |
| P9-05 | Policy | D, M | Create a draft, switch "experience" off (weights renormalise), activate → scores recompute; the history shows v1 and v2. Archive a draft. Switching every signal off is refused. "Suggest" fills the description. |
| P9-06 | Oversight and feedback | D | The admin picks a job → top 4 with % and evidence. A candidate clicks "Helpful" → the aggregate counts it. |
| P9-07 | Insights pages | D, M | The role picker offers top 10 + saved + applied and defaults to the top one. "I have this skill" adds the skill; a 13th is refused. "Save this opportunity" adds to saved jobs. Feedback is stored. Every narrative is in the user's language. Free → gate. |
| P9-08 | Job summaries | D | Per card (Plus), per row (recruiter), and the admin page with Regenerate. The second open is a cache hit: no OpenAI call and the cap unchanged. |
| P9-09 | CV AI | D | Plus upload → snapshot proposal; the profile is unchanged until Confirm. The assisted draft gives suggestions and a revised snapshot with no file; the pending draft can be deleted. Free → locked. |
| P9-10 | Translate and profile summary | D | Plus translates a German brief and a message. A recruiter translates a candidate's about for free. Free candidate → locked. The profile summary can be copied. |
| P9-11 | Cap | D | `aiusages` set to 50 via `/_test/db` → the next generation shows the friendly limit message. Cache hits still render. Admins are unaffected. |
| P9-12 | AI failure | D | `/_test/ai/fail-next` → a friendly fallback message; the code evidence still shows. |
| P9-13 | Consent off | D | A candidate turns matching consent off → gone from Find candidates and the relevant counts; their job cards show no score. |

**API tests.** The U5 formula (renormalisation, OQ-6g location cap, thresholds); policy versions and recompute; relevance population and nightly catch-up; cosine on Float32 buffers; embedding text and truncation; cache keys and invalidation (entity version, language, profile hash); cap counting (U3, admin exempt); recruiter and Free DTOs never carrying a score; consent exclusion; `AI_UNAVAILABLE`. OpenAI is stubbed in these tests.

#### Phase 9a handoff (2026-11-03, built, awaiting owner review; 9b not started)

**Prep.** P13: `eujobs` held 0.02 MB of data and `eujobs_test` 0.37 MB before the phase; after a seed with real vectors `eujobs_test` holds 0.70 MB (19 vectors of 3072 dims).

**Built (9a, P9-Q1).**
- Server: `openai` 7.47; `lib/ai.js` (embeddings, cosine, cached generations, the 50-a-day cap, `AI_UNAVAILABLE`, AI status); `modules/ai` (`aicaches`, `aiusages`); `modules/matching`: embeddings with their triggers, `matchingpolicies` and versions (default v1 in `seed:catalog`), the U5 score with the OQ-6g cap, `matchresults`, relevance with the nightly slot, the admin routes (policies, Suggest, oversight, AI status); `/_test/ai/fail-next`. The Phase 4 relevance fallback now applies only to pairs without a score.
- Display: Plus job cards, details, Recommended and For you by score; Free keeps the overlap label; recruiter Recommended, relevant talent, KPI and talent cards by score with no score in any recruiter answer; admin oversight with %.
- Client: the admin AI & matching page on the API; `MatchBadge` on the candidate job card and details; Overview caption by ranking basis.
- Seed: `seed:demo` resets the policies, then backfills embeddings, scores and counts, reusing unchanged vectors.
- Deleted: `admin/ai-matching/data/matching.js`, `hooks/useMatchingPolicies.js`.
- e2e: `e2e/lib/matching.js`; scenarios P9-01 (score half), P9-02, 03, 04, 05, 13.

**Not in 9a (9b):** explanations and narratives, job summaries, the insights pages and the learning plan (P9-Q2), CV AI with Compare, the profile Ai Job Summary button, Translate, explanation feedback and its admin aggregate, the cap and failure messages in the UI, the remaining mock deletions (`insights.js`, `useInsightsState`, `ai-insights/utils/matching.js`, the AI summary templates). Scenarios P9-01 (narrative half) and P9-06 … 12.

**Calls the plan did not specify:** P9-Q1 … Q4 (owner) and P9-C1 … C8 (builder) in the Owner answers table.

**Results** (repo root unless noted; never run the server tests and the e2e at the same time):

| Command | Result |
|---|---|
| `cd server && npm test` | 279 of 280 in the last full run; the one failure was `jobs.test.js` expecting the Overview answer without the new `recommended.byScore`; after updating it, `jobs.test.js` passes 12 of 12 |
| `cd server && npm run lint` | clean |
| `cd client && npm run lint && npm run build` | clean, built |
| `npx oxlint .` in `e2e/` | clean |
| `node e2e/run.js phase-9` (9a scenarios) | 9 of 9 (P9-01, 03, 05 at 1440 and 375 px; P9-02, 04, 13 at 1440 px), with real OpenAI vectors |
| `node e2e/run.js phase-4` | 22 of 24, then the two failures rerun: P4-11 passes with Alex (P9-C8); P4-06 at 375 px timed out once at the SVG logo step and passed on the rerun (D and M) |
| `node e2e/run.js p08-10-candidate-suggestions` | 1 of 1 |
| `node e2e/run.js sweep` | D and M pass |

**Real scores.** With real vectors the seeded pairs have cosines from 0.33 to 0.60 (median 0.51), so the U5 similarity spreads from 0.33 to 1.0; Emma's Remote view reads 93 % to 52 %.

**Fixed during the checks.** The first e2e runs scored with 16-dimension stub vectors: the seed API test had written them to `eujobs_test` and the e2e seed reused them by hash (fixed by P9-C1; the stub vectors were deleted). A job recompute skipped candidates without a vector (P9-C2). After creating a policy the editor briefly showed the active policy, so clicks could edit it (P9-C6). Scenario fixes: Emma's Remote view, the job's own market for remote jobs, CSS upper-case in `innerText`, a sticky header covering a switch, the Overview path `/candidate`.

#### Phase 9b handoff (2026-11-03, built, awaiting owner review; Phase 9 complete)

**Before 9b (owner's three checks).** The full server suite passed 280 of 280 (its last files ran after the first additive 9b edits). The P4-06 timeout was traced to a network-idle wait and fixed (P9-C9); `phase-4` then passed 24 of 24 twice in a row. The development database was reseeded: the default policy v1 is active, all 19 vectors are `text-embedding-3-large` with 3072 dimensions (none from the stub), 84 scores, 0.69 MB of data in `eujobs`.

**Built (9b, P9-Q1).**
- Server, `modules/ai`: prompts and schemas (`ai.prompts.js`), facts and the cached writer (`ai.facts.js`), job summaries, the recruiter's Match insights narrative and the profile summary (`ai.summaries.js`), the insights pages, narratives, feedback, "I have this skill" and the learning plan (`ai.insights.js`), Translate (`ai.translate.js`), routes and schemas; `ExplanationFeedback`; `CandidateProfile.learningPlan`. CV AI in `cv.ai.js`. `GET /admin/jobs` (P9-Q5) and the admin feedback summary. Suggestions rank by the learning plan too (P9-Q2).
- Client: `features/ai` (API, the AI state component, the Plus-aware button, Translate, the job summary dialog and button); the five AI insights pages rewritten on the API with the learning plan on the server; the AI explanation and the AI job summary on candidate job cards; Translate on job details, the recruiter's candidate profile, messages, course About and text lessons; the Match insights narrative for recruiters; the CV page's snapshot proposal and confirm (P9-Q3), assisted drafts and the Compare panel (P3-Q3); the Ai Job Summary button on My profile (P3-Q3); the admin Jobs page on the real list with the summary and Regenerate; the admin feedback summary; the Overview AI teaser (P9-C15).
- Deleted: `ai-insights/data/insights.js`, `hooks/useInsightsState.js`, `utils/matching.js`, `RoleLogo`, and the admin `JobSummaryModal` template. `features/recruiter/jobs/hooks/useJobs.js` (the recruiter mock list) is **not** deleted: the admin Overview and Moderation pages still import it until Phase 10.
- e2e: scenarios P9-01 (narrative and French half), P9-06 … P9-12.

**Calls the plan did not specify:** P9-Q5, P9-Q6 (owner) and P9-C9 … C15 (builder) in the Owner answers table.

**Results** (repo root unless noted; never run the server tests and the e2e at the same time):

| Command | Result |
|---|---|
| `cd server && npm test` | 294 of 294 |
| `cd server && npm run lint` | clean |
| `cd client && npm run lint && npm run build` | clean, built |
| `npx oxlint .` in `e2e/` | clean |
| `node e2e/run.js phase-9` | 17 of 17 (P9-01, 03, 05, 07 at 1440 and 375 px), real OpenAI |
| P2-12, P2-14, P3-05, P4-10, P4-11, P8-10 (screens 9b changed) | 8 of 8 |
| `node e2e/run.js phase-7` (messages gained Translate) | 14 of 14 |
| `node e2e/run.js sweep` | D and M pass |

**Fixed during the checks.** Scenario fixes: three regexes in P9-01 were broken when the file was written through a shell heredoc (a `\b` became a backspace character); the AI cache outlives a reseed by design, so P9-01 and P9-12 clear the entries they must see written; P9-07 waits for its own feedback answer (P9-06 answers for the same job first); waits now skip the "Writing with AI…" line; the review checkbox is a hidden native input, so the label is waited for. Layout: the CV version row and the job card footer let their actions wrap (the new AI buttons squeezed the version text at 1440 px and crowded the card footer at 375 px).

**Open.**
- The new `ai` and `aiInsights` namespaces (and the new `cv`, `learning` and `aiMatching` keys) are English until Phase 11, as the other new namespaces.
- No new email type in 9b.

### Phase 10: Admin

**Scope.** Every remaining admin area: access enforcement and its UI; user tables and details; jobs, applications and recruitment; overview, analytics and reports; audit; payments admin; content moderation with Report buttons.

**Decisions.** M-013 (photo removal), M-046, M-123, M-138, M-154 … M-167, M-169 … M-183, M-206, OD6, OD7, U9 … U11, U20, U21, U23, U34, OQ-1, OQ-2, OQ-5, OQ-6d, OQ-6f.

**Prep.** P11, part 4: a voice note. Reuse the P4 audio file (ask the owner for its path). If it is not available, generate a short spoken MP3 once with the OpenAI speech API.

**Tasks**

1. Access management:
   - roles: create, duplicate, edit through the prefilled dialog, archive (blocked while assigned);
   - user access, admin staff only; invites (U21) with `/admin/set-password`;
   - Owner and lock-out rules (M-160);
   - hide the sidebar, search and page actions per `me.permissions`; a 403 page (OD16).
2. Users:
   - Candidates and Recruiters tables: M-161 columns and filters, M-169 states, country filter, server pagination, audited CSV export with OQ-6d labels;
   - detail pages `/admin/candidates/:id` and `/admin/recruiters/:id` (profile, verification, plan, applications, history; documents through `documents.view`);
   - "Manage" opens the detail page.
3. Jobs (all statuses and a filter; "Open case" from a job), Applications (pagination, export), Recruitment (data view and funnel by category; OD5, M-178, M-179).
   - Jobs extends the 9b list (P9-Q5), it does not rebuild it. Already there: `GET /admin/jobs` (`jobs.view`; every job except drafts, newest first, as the recruiter job DTO with the company display name), the admin Jobs table on it (published rows, client-side search, the AI summary with Regenerate). Phase 10 adds: the status filter on the server and the table showing every status (drafts excluded or not, to decide then); pagination (M-206 lists only Users, Applications, Payments and Audit, so confirm whether Jobs needs it); the country filter (M-138); "Open case" from a row (OQ-1, M-164) replacing the "Review" link to the mock moderation page; and moving the page's literal English texts into an i18n namespace.
4. Overview and Analytics:
   - the §3.15 metrics with OQ-5;
   - the charts (M-170, M-171) and "All time" captions (M-177);
   - recent activity = the latest 5 audit events.
5. Reports (M-181 … M-183, U23): type, period (this week, last week, last month), a brief ≤ 500, a voice-note attachment (≤ 25 MB) → transcription (`OPENAI_TRANSCRIBE_MODEL` with the `whisper-1` fallback) and an executive summary in the admin's language → CSV in the U23 layout, stored as a snapshot; "Download again" returns the same bytes; audited.
6. Audit logs (M-162, M-163): category chips including Learning, Payments and Jobs; actor types; pagination; audited export.
7. Payments admin (M-122, M-123, U34): rows including renewals, failures and refunds; details with subscription status and period; Active subscribers and MRR per currency; the Plan column and filter on Candidates; export.
8. Moderation content:
   - Report buttons on job details, the recruiter's candidate profile view, the company section and messages (U20 limits);
   - the case list and detail; Dismiss or Restrict on jobs and profiles (M-167), including photo removal;
   - company and message cases offer Dismiss only, and the message excerpt is the reported message plus 5 earlier ones (OQ-1);
   - the `content_restricted` email; the summary counts.
9. `seed:demo`: moderation cases and audit history from the mocks (`auditEvents.js`, `moderation.js`); roles.
10. Delete: the remaining admin mock data (overview, analytics, recruitment, access, moderation, audit events, reports, users) and `utils/downloadCsv.js`.

**Done when.** Every admin page shows real data and enforces permissions on both API and UI. Reports, exports and moderation work end-to-end. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P10-01 | Invite and permissions | D, M | The Owner invites a Staff admin → the captured invite opens `/admin/set-password` → sign in → the sidebar and search show only permitted pages. A direct URL to Payments → 403 page; the API → `PERMISSION_DENIED`. |
| P10-02 | Roles | D | A 41-character name, a duplicate name (any case) and 0 permissions each → error. Duplicate, edit. Archive with users assigned → blocked; archive an unused role → archived. |
| P10-03 | Lock-out | D | The Owner cannot be revoked. An admin with `roles.assign` cannot remove their own `roles.assign`. |
| P10-04 | Users | D, M | The Candidates table shows Country, Right to work, Verification (Not started, In review, n of 3 verified, Verified), Completeness % and Plan, with filters, pagination and the country filter. The CSV export has a BOM and headers in the admin's language, and an audit event. "Manage" opens the detail page with every section. Recruiters show Pending, Approved, Rejected or Suspended. |
| P10-05 | Overview and Analytics | D, M | Every KPI equals an independent count from `/_test/db`. "Average role match" is captioned "Across {n} published roles". Charts show real counts for this week, last week and last month in the browser time zone. KPIs say "All time". The country filter changes the numbers. |
| P10-06 | Recruitment | D | Stage counts by category. The funnel uses ever-reached counts without withdrawn applications, in the fixed shapes. |
| P10-07 | Reports | D | "Marketplace summary", last week, with a brief and the voice note → a transcript and an executive summary in the admin's language → a CSV with the U23 layout → a history entry. "Download again" returns identical bytes (hash). Both actions are audited. |
| P10-08 | Audit | D | Chips include Learning, Payments and Jobs. Actor types are admin, user and system. A recruiter job status change, a CV download and a KYC submission are listed. Export is audited. |
| P10-09 | Payments | D, M | Rows include a renewal, a failed payment and a refund. Details show the subscription status and period. Active subscribers and MRR show one line per currency, at most 3, then "+n more". |
| P10-10 | Moderation | D, M | A candidate reports a job (scam_or_fraud; details of 501 characters → error) → a case appears. A second report on the same job by the same user → refused. An 11th report in one day → limited. Restrict → the job is paused and locked, the recruiter sees the reason and cannot republish, and gets an email. Dismiss lifts it. A profile report → Restrict hides the profile from discovery; the photo can be removed. A message report shows only the 6-message excerpt. A company case offers Dismiss only. |
| P10-11 | Jobs admin | D | All statuses with the status filter. "Open case" from a job row creates a case. |

**API tests.** The permission matrix for every admin route, generated from the route table; Owner and lock-out rules; role validation and archive; invites (expiry, single use); user filters and pagination; each metric with fixtures (OQ-5); report generation, snapshot and transcription fallback (stubbed); audit categories and actor types; audited exports; moderation limits, one open case, and the restrict and dismiss effects; payments KPIs per currency.

#### Phase 10a handoff (2026-11-03, built, awaiting owner review; 10b not started)

**Built (10a, P10-Q1).**
- Server: access management in `modules/admin/admin.access.js` (roles, admin staff access with the Owner and lock-out rules, invites with `/auth/invite/:token` and `/auth/invite/accept`, the `admin_invite` email in en/es/fr); Candidates and Recruiters in `admin.users.js` (tables, filters, pagination, detail pages, export rows); Audit logs in `admin.audit.js`; Payments admin in `modules/payments/payments.admin.js`; `lib/csv.js` (BOM, quoting, formula guard, audited export) and `lib/pages.js` (pagination); new audit events (P10-C4) with `describeAudit` and the server `audit.*`, `csv.*` and `labels.*` keys; `ADMIN_MOUNTS` and the tagged `requirePermission` (P10-C8).
- Client: Roles (create, duplicate, prefilled edit, archive) and User access (manage, revoke, invite) on the API; `/admin/set-password`; Candidates and Recruiters on the server with the M-161 columns, filters in the URL, pagination and the server export; the detail pages `/admin/candidates/:id` and `/admin/recruiters/:id`; Payments with the four cards, filters, the seeded badge, details and export; Audit logs with the eight category chips, actor types, search, pagination and export; the sidebar, global search and page actions follow `me.permissions`; the 403 page and the admin landing page (P10-C1).
- Deleted: `access-management/data/accessData.js`, `hooks/useAccess.js`, `utils/validateRole.js`, `payments/data/payments.js`. Still used by 10b screens (Moderation, Reports, Overview), so kept: `useAuditLog`, `auditEvents.js`, `audit-logs/utils/formatDate.js`, `shared/data/users.js`, `utils/downloadCsv.js`, `recruiter/jobs/hooks/useJobs.js` (P10-C7).
- e2e: every `page.waitForNetworkIdle()` replaced (P10-Q2) by `responseTo` or `waitForSettled`; `lib/admins.js`; scenarios P10-01, 02, 03, 04, 08, 09; the sweep's new admin routes (P10-C9).

**Not in 10a (10b):** content moderation and the Report buttons, Jobs (task 3), Applications and Recruitment, Overview and Analytics, Reports with the voice note (P10-Q3), the `seed:demo` additions, the remaining mock deletions, the matrix tests of `dashboard.view`, `reports.view` and `candidates.view` (todo until their routes exist), scenarios P10-05, 06, 07, 10, 11.

**Calls the plan did not specify:** P10-Q1 … Q7 (owner) and P10-C1 … C9 (builder) in the Owner answers table.

**Results** (repo root unless noted; never run the server tests and the e2e at the same time):

| Command | Result |
|---|---|
| `cd server && npm test` | 334 tests: 331 pass, 0 fail, 3 todo (the 10b permissions, P10-C8); new files `admin.matrix.test.js` (19 + 3 todo), `admin.access.test.js` (9), `admin.lists.test.js` (9) |
| `cd server && npm run lint` | clean |
| `cd client && npm run lint && npm run build` | clean, built (after the last change) |
| `npx oxlint .` in `e2e/` | clean |
| `node e2e/run.js phase-10` (10a scenarios) | 9 of 9 in one clean run after the last change (P10-01, 04, 09 at 1440 and 375 px; P10-02, 03, 08 at 1440 px) |
| `node e2e/run.js phase-4` (P10-Q2) | 21 of 24; the 3 failures were a missing `responseTo` import in P4-08 and P4-10 (the edit script added the calls, not the import), which after the fix passed 3 of 3. P4-06, the original network-idle flake, passed at 1440 and 375 px |
| `node e2e/run.js phase-9` (P10-Q2) | 17 of 17, real OpenAI |
| Changed Phase 2, 3 and 6 scenarios (P2-01, 03, 06, 08, 10, 11, 16, P3-01, 07, P6-10) and P5-01, 04, 05, 09, P8-04 (shared payments table, global search) | 17 of 23 in the first run (after a session restart; the earlier attempt stopped when the shell died); the 6 failures, P2-11, P3-07 and P5-09 at 1440 and 375 px, came from the new sign-in wait (the router keeps the sign-in page on screen until the landing page's data has loaded, so its heading passed the "settled" check; `signInWithForm` now also waits for the sign-in form to go) and from P3-07's evidence preview, which loads by its own request; after the fix 6 of 6 |
| `node e2e/run.js sweep` | D and M pass |

**Fixed during the checks.** Real bugs: the search box of the four admin tables lost characters when typing fast (its text came only from the URL); two quick filter changes undid each other (React Router builds every update from the last rendered URL). Both are fixed in `lib/useUrlFilters.js`. Scenario fixes: `_id` from `/_test/db` is `{ $oid }`; `innerText` is upper-cased by CSS; puppeteer drops a body's BOM (checked from Node); Intl's no-break space; waits that matched the sidebar instead of the page; a sticky header over the search box at 375 px; a triple click does not select a search field.

**Open.**
- The new namespaces `access`, `adminUsers`, `adminPayments` and `audit` are English until Phase 11.
- `npm run mail:test` now knows `admin_invite`; no live invite email has been sent for the owner to confirm (it reaches a real inbox, so it waits for the owner's go-ahead).

#### Phase 10b handoff (2026-11-04, built, awaiting owner review; Phase 10 complete)

**Before 10b (owner request, P10-Q9).** After the owner rolled the Stripe test key: no backend or `stripe listen` process was running (checked by process kind, command lines never printed); `npm run stripe:listen` and `npm run dev` started from `server/`, Vite on 5173; Alex paid with 4242 on hosted Checkout: 13 webhook events, all answered 200; `/me` says Plus; LWM-000010 (£9, Paid, receipt link) shows in his Billing and in admin Payments. `npm run mail:test admin_invite +alex` sent (the owner confirms receipt).

**Built (10b, P10-Q1).**
- Server: content moderation in `modules/moderation` (`POST /reports`, the content queue, case details and decisions, the two decision emails, P10-C10); "Open case" and the extended `GET /admin/jobs` (P10-C11); `admin.metrics.js` (Overview, activity chart, Analytics, Recruitment, the Overview export; P10-C12, C13); `admin.applications.js` (P10-C15); `modules/reports` with `transcribe()` in `lib/ai.js` (P10-C14); `seed/moderation.js` (P10-C16); server dictionaries en/es/fr (`email.content_restricted`, `email.content_restriction_lifted`, `email.moderationSummary`, `reports.*`, `csv.applications`, `csv.overview`, `labels.reportTargetType`, `labels.reportReason`, the new `audit.*` sentences).
- Client: Report buttons on job details (job and company section), the recruiter's candidate profile and messages from the other side; the Moderation content tab on the server (priority P10-Q10, reports, target, message excerpt, history, Restrict with photo removal, Dismiss and lift); admin Jobs, Applications, Recruitment, Overview, Analytics and Reports on the server; the remaining admin mocks deleted (P10-C17).
- Verified company badge (P10-Q8): built after 10a (owner commits dbf1bd3, 6f3de96); recorded in the Owner answers table; its API test is in `jobs.test.js` and P10-12 ran again with the 10b regression.
- Tests: `admin.moderation.test.js`, `admin.metrics.test.js`; the permission matrix covers `dashboard.view`, `reports.view` and `candidates.view` (0 todo). e2e: P10-05, 06, 07, 10, 11 and the voice-note fixture (P10-C18).

**No admin page reads mock data.** Every admin page reads the server; no file under `features/admin` imports a `data/` file or local storage. `utils/downloadCsv.js` stays for the candidate's own profile export (Phase 12).

**Calls the plan did not specify:** P10-Q9 … Q15 (owner) and P10-C10 … C18 (builder) in the Owner answers table.

**Results** (repo root unless noted; never run the server tests and the e2e at the same time):

| Command | Result |
|---|---|
| `cd server && npm test` | 349 tests: 348 pass, 1 fail, 0 todo. The failure was `foundation.test.js` still pinning 22 email types (P10-Q12 adds the 23rd); after the fix the file passes 13 of 13. New files `admin.moderation.test.js` (7) and `admin.metrics.test.js` (7); `admin.matrix.test.js` 22 of 22, 0 todo (`dashboard.view`, `reports.view`, `candidates.view` now have routes) |
| `cd server && npm run lint` | clean |
| `cd client && npm run lint && npm run build` | clean, built |
| `npx oxlint .` in `e2e/` | clean |
| `node e2e/run.js` P10-05 (D, M), P10-06 (D), P10-07 (D), P10-10 (D, M), P10-11 (D) | 7 of 7 after the scenario fixes below; P10-07 with the real OpenAI transcription and summary (English and, for a Spanish admin, Spanish) |
| Earlier scenarios on changed screens, in 7 groups: P2-06, P3-07, P3-08, P4-03, 04, 05, 10, 13, 14, 15, 17, P6-02, 03, 09, 11, P7-01, 03, 04, 05, 06, 08, P8-11, P9-03, 08, 10, 11, P10-01, 08, 12 | 39 of 41 runs. P3-08 expected the Phase 3 in-page "no permission" text, which the 403 page replaced in 10a (it was not in 10a's rerun); updated to the 403 page plus the API refusal → pass. P9-08 failed once because Regenerate returned the same text (real OpenAI); rerun → pass |
| `node e2e/run.js sweep` | D and M pass (admin 29 routes) |
| `npm run seed:demo` (dev database `eujobs`) | done: Alex is Free again, the two seeded cases and the audit history are there |

**Fixed during the checks.** Real bugs: `GET /admin/jobs` answered 500 when a job's company no longer existed (now left out); the Open case button was cut off at 1440 px (narrower columns); "Download again" was answered 304 from the browser cache (now `no-store`); the AI summary read empty "In period" cells as zero (the prompt now says what they mean); two component files also exported constants (moved to `overview/chartScale.js` and `moderation/tones.js`). Scenario fixes: `waitForPath` with a function runs in the browser; selects need `page.select`; the recruiter profile path is `/recruiter/find-candidates/:id`; the Manager role has no `reports.export` (Accounts Head is used). A failing API test that leaves a request pending keeps `node --test` alive; use `--test-force-exit` while debugging.

**Open.**
- The new namespaces `adminJobs`, `adminApplications`, `adminRecruitment`, `adminOverview` and `adminReports` (and the 10b keys of `moderation` and `audit`) are English until Phase 11.
- Live emails waiting for the owner: `admin_invite` (sent 2026-11-04, to confirm); `content_restricted` and `content_restriction_lifted` exist in `npm run mail:test` but were not sent live (owner's go-ahead).

### Phase 11: Translations (es, fr), formats and long-text layout

**Scope.** Complete Spanish and French for every UI string, every Intl format, and the layout fixes for long translations listed in A: shared §12.13.

**Decisions.** S (en/es/fr for all UI text), M-133, M-141 … M-143, M-193 (tagline kept), M-194, OQ-6b, U43.

**Prep.** None.

**Tasks**

1. Scan for any remaining literal UI string (the A: shared §12.15 method) and move it to en keys. Translate every namespace into es and fr with one glossary: "Local WorkMan", "AI Job Portal" and "Plus" stay untranslated.
2. Plurals (A: shared §12.12); Intl everywhere (no `en-US`, `£`, `$` or hand-made formats); weekday and month labels through Intl; locale-aware `localeCompare`; accent-insensitive search and filters.
3. CSS fixes (A: shared §12.13):
   - remove `text-transform: capitalize`;
   - let Modal footers wrap;
   - fix ViewToggle and SegmentedTabs overflow;
   - fix StatCard values and PageTitle actions;
   - let StepFooter wrap;
   - ellipsis on Sidebar labels;
   - Dropdown max-height; the ProfileMenu list;
   - AuthLayout heights; Checkbox alignment.
4. Review the server texts (emails, PDF, CSV) in es and fr for terminology.
5. Restore P2-11 and P2-19 to check EVERY namespace with no English-only exceptions:
   - P2-19: remove the temporary Phase 3 skip (`englishOnly` in `e2e/scenarios/p02-19-formats-and-catalogue.js`, P3-C2), so a namespace without an es or fr file fails the check;
   - P2-11: remove the temporary Phase 4 filter (`notEnglishOnly` and the raw-key overflow skip in `e2e/scenarios/p02-11-language-and-country.js`, P4-Q5), so every missing key and the 375 px overflow fail the check.
   - P9-01: remove the same exception from its French step (P9-Q6).
6. Unify the CV-request reason wording: the server's `cvRequestReason` (emails: "Verify employment history") and the client's `enums:cvRequestReason` (screens: "Verify employment") say the same thing in en, es and fr; update P4-13's expected texts to match.
7. Make the candidate Overview tabs row (`.tabsRow` in `client/src/features/candidate/overview/pages/OverviewPage.module.css`: tabs plus "Preferences") wrap, and re-check it at 375 px in en, es and fr.
8. Optional: make the demo recruiter's default country show her seeded shortlist (P4-C2), either by seeding Sarah's picker country as Germany or by seeding shortlisted candidates who are in her UK view.

**Done when.** No missing keys and no English leftovers in es or fr; P2-11 and P2-19 check every namespace with no exceptions; formats are correct per locale; no overflow at 375 px. Lint, build, tests and sweep are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P11-01 | Sweep in es and fr | D, M | Every route for every role: zero missing keys, zero 375 px overflow. The English-leftover check (rendered text equal to an en value longer than 3 words, except the allowlist) finds nothing. |
| P11-02 | Formats | D | Samples on Billing, Find jobs and admin Payments in en-DE, fr-BE, es-ES and en-IE (Remote). HUF whole amounts show 0 decimals. StatCard counts read "12 345" in fr. |
| P11-03 | Long labels | M | fr dialogs with long buttons (the checkout confirm) wrap. Sidebar labels show an ellipsis. Tabs and toggles scroll or wrap. The recruiter onboarding footer wraps. |
| P11-04 | Server texts | D | One captured email of each type for an es user and an fr user, plus a certificate PDF in each language, read correctly. |
| P11-05 | Search | D | Global search finds "Paramètres" by typing "parametres". Help search is accent-insensitive. |

**API tests.** The server dictionaries have every en key in es and fr; CSV header localisation.

#### Phase 11 handoff (2026-11-04, built, awaiting owner review)

**Before Phase 11 (owner request).**
- Full server suite: two runs, neither counts. Run 1: 349 tests, 346 pass, 3 fail; the other agent's e2e reseeded `eujobs_test` during it. Run 2: 353 tests, 351 pass, 2 fail; it overlapped another agent's e2e (14:46) and a P11-01 seed. One of its failures was real and is fixed: the Spanish default stage name (P11-C2). The clean total is in Results below.
- P9-08 checks a new generation, not new wording (P11-C9).
- `content_restricted` and `content_restriction_lifted` were sent live to +alex (en), for the owner to confirm.

**Built.**
- Translations: Spanish and French for all 38 client namespaces, including the 23 that were English only (P11-C2). The Data & account demo pages and both Settings layouts were moved to keys (P11-C4). The moderation tabs' aria-label is now a key. The three system roles are translated (P11-Q6).
- Server texts: every email type in es and fr. The CV-request wording is one set everywhere (P11-Q2). fr "short-list" and es "Preseleccionados" are used in the server dictionaries too.
- Checks:
  - `client/scripts/check-i18n.js` fails the build on any missing key, plural form, placeholder or extra key (P11-C3);
  - `foundation.test.js` covers the server dictionaries and a client message for every error code;
  - P2-11, P2-19, P9-01, P7-03 and P8-07 no longer skip English-only namespaces (task 5).
- Formats: the client already used Intl for everything (`lib/format.js`, `useFormat`). The admin server filters now ignore accents (P11-C5).
- Layout:
  - task 3: SegmentedTabs and ViewToggle scroll; StatCard values break; PageTitle actions wrap; Dropdown has a max height; Checkbox aligns to the first line. StepFooter, the Modal footer and AuthLayout were already fixed in earlier phases; capitalize was already gone;
  - sidebar labels wrap (P11-C1); the mobile breadcrumb takes two lines;
  - task 7: the Overview tabs row wraps;
  - fixes found by the new layout check (P11-C8).
- e2e:
  - `lib/i18nChecks.js` (layout and English-leftover checks, P11-C7);
  - `lib/sweep.js` (P11-C10);
  - P11-01 (sweep in es and fr), P11-02 (formats), P11-03 (long labels at 375 px), P11-04 (server texts and certificates), P11-05 (search), P11-06 (system roles).

**Not done.**
- Task 8 (owner: skipped, P11-Q4).
- Database content stays as written (P11-Q3): seeded jobs, companies, courses, messages and custom roles. On-demand Translate (M-144) covers what it covers.
- The downloaded device-only CSV of the Data & account demo page (Phase 12).

**Calls the plan did not specify:** P11-Q1 … Q6 (owner) and P11-C1 … C12 (builder) in the Owner answers table.

**Results** (repo root unless noted; never run the server tests and the e2e at the same time. Other agents run tests and e2e on `eujobs_test` too, so every run below was watched for foreign runs, P11-Q5):

| Command | Result |
|---|---|
| `cd server && npm test`, last full run (17:06–17:23, with the files as they were then) | 356 tests: 335 pass, 21 fail, 0 todo. **No clean Phase 11 total.** Phase 11's server work was committed by the owner at 16:58 (`9b8fba8`); from then on the working tree also held another session's uncommitted "Phase 11b" (notifications: `modules/notifications`, 5 new email types, `/me` and counter fields, mailer and `seed/demo.js` changes). Every failure is in that work: the enum count (23 → 28) and the new email types without dictionary entries or client labels (foundation ×3, caught by the P11-C12 test); `notifyEmail` replaced by `emailSwitches` and the email toggle (mailer, messages, users); counters with a `notifications` field (messages); seed contents (seed ×4); and the users and verification tests that ran after a foreign test run started at 17:23:01 on `eujobs_test`. Every Phase 11 test file passed (admin access, lists, matrix, moderation, metrics, companies, jobs, payments, and the new i18n tests). |
| Earlier full runs | Run 1: 349 tests, 346 pass, 3 fail (another agent's e2e ran meanwhile). Run 2: 353 tests, 351 pass, 2 fail (overlapped other runs); one real failure was the Spanish default stage name (P11-C2, test updated). Run 3: cut off by a session restart. |
| Phase 11 test files, alone and in sequence | `companies`, `jobs`, `admin.lists`, `foundation`: 52/52 (15:01). `foundation` + `admin.access` (with the P11-Q6 and P11-C12 tests): 28/28 (16:42). |
| `cd server && npm run lint`; `npx oxlint .` in `e2e/` | clean |
| `cd client && npm run lint && npm run build` | clean; the build runs the translation check first: "es, fr match en" |
| `node e2e/run.js` P11-01 (es and fr sweep, every role) | D and M pass (16:15–16:37, no foreign run): public 13, onboarding 5, candidate 27, recruiter 29, admin 29 routes per language. 0 missing keys, 0 English leftovers, 0 layout problems. Notes list 35 (D) / 36 (M) truncated user-data items (message previews, long emails, the admin's name in the sidebar). Runs 1–4 failed: seed collisions with other agents, then the layout findings fixed in P11-C1 and P11-C8. |
| `node e2e/run.js sweep` (English, with the layout check) | D and M pass |
| P11-02, P11-03 (M), P11-04, P11-05, P11-06 (D, M) | all pass. P11-02 and P11-05 first failed on scenario mistakes (a payment row without a payer role; the wrong API path), which were fixed. P11-02 samples: en-DE "€10" and "£90,000 – £113,000"; fr-BE "10 €" and "90 000–113 000 £GB"; es-ES "10 €" and "90.000-113.000 GBP"; en-IE "€10"; admin fr "12 345 HUF", es "12.345 HUF" |
| P9-08 (owner pre-step) | pass twice: once Regenerate returned the same wording (the old failure case), once new wording |
| Changed earlier scenarios | P2-11 (D, M), P2-19, P4-13, P7-03, P8-07 (D, M), P9-01 (D, M), P10-01 (D, M), P10-02, P2-01 (D, M): all pass. P2-19 first found the missing enum label (P11-C12). P10-02 first hit the `fill` race (P11-C11). The P2-19/P7-03/P8-07/P9-01 group started while 2 foreign test processes were running and still passed. |

**Open.**
- Live emails waiting for the owner's confirmation: `content_restricted`, `content_restriction_lifted` (sent 2026-11-04), and `admin_invite` (sent earlier).
- Phase 12: if erasure leaves payments without a payer role, admin Payments must show it without `enums:role.null` (P11-02 found this with a row without `payerRole`; no such row can exist today).
- Two orphan mock files for Phase 12 (P11-C4).

### Phase 11b: Notifications (candidate, recruiter, admin)

**Scope.** In-app notifications for the three roles with deep links, the bell dropdown, a Notifications page per role, per-section sidebar counts, per-category email switches for every role and the five admin emails (§3.21). Supersedes M-093/OD6.

**Decisions.** P11b-Q1 … Q15 (owner, 2026-11-04), M-089, M-091, OD14, U13, U33, OQ-6c.

**Tasks**

1. Server: `modules/notifications` (model, service, routes), catalogue entries (`NOTIFICATION_TYPES`, `EMAIL_CATEGORY`, `EMAIL_CATEGORIES`, five admin email types, `LIMITS.notifications`), hooks at every event of §3.21, `users.emailOff` with the startup copy of the old toggle, the mailer's per-category check, `/me/counters` for admins, `GET /recruiter/applications/:id`, `seed:demo` notifications (Q13), mail samples.
2. Client: the bell and dropdown, the Notifications page in each workspace, sidebar section counts, the email switches in the three Settings pages, item URLs (Q9), "seen" on every item page (Q10), the `notifications` namespace and enum labels in en/es/fr.
3. Update P2-12 (bell), P2-16 (switches) and P6-10 (the Applications switch; the in-app notification still comes).

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P11b-01 | Candidate | D, M | A status change (after 10 min) and a message: bell 2, Applications accent count beside the active count, Messages only its own badge; the dropdown lists both; the status opens the activity dialog, the message the thread; counts clear; the page shows both read and an empty Unread view; the Messages switch saves. |
| P11b-02 | Recruiter | D, M | "Account approved" opens the Overview; a new application opens the list filtered to its job with the row highlighted; a withdrawal is listed unread; Mark all as read clears the bell; the New applications switch saves. |
| P11b-03 | Admin | D, M | Evidence submitted: the moderation admin gets bell, Moderation count and email; the notification opens the verification item; a finance-only admin gets nothing; the Verification switch saves in admin Settings. |
| P11b-04 | es and fr | D, M | A Spanish candidate's two verification decisions and a French moderator's grouped report (2 reports) read in their language with no English left and a clean layout; opening clears the counts; the French switches. |
| P11b-05 | No longer available | D, M | A notification of a deleted item says "This item is no longer available." and is marked read; direct links to a missing application (candidate, recruiter) and payment say the same; no 403 page, no crash. |

**API tests.** `notifications.test.js` (every event to the right users only, admins without the permission get nothing, grouping, the 10-minute status rule, reading, counts, mark all read, seen, visibility, unavailable items, the deep links, the switches and the always-on emails, the old toggle's copy) and the payment notifications in `payments.test.js`.

#### Phase 11b handoff (2026-11-04, built, awaiting owner review)

**Built.** Everything in §3.21 and the Phase 11b tasks: `modules/notifications`, hooks at every event, per-category email switches for all roles with the startup copy of the old toggle, the five admin emails (en/es/fr, `mail:test` samples), `/me/counters` for admins, `GET /recruiter/applications/:id`, seeded notifications (Q13); the bell dropdown, the Notifications page per role, sidebar counts, the switches in the three Settings pages, item URLs and "seen" on item pages. Calls the plan did not specify: P11b-C1 … C10 in the Owner answers table.

**Results** (2026-11-04; before every run ports 5100/5174 were checked):

| Command | Result |
|---|---|
| `cd server && npm test` (18:51–19:10, nothing else on `eujobs_test`) | 376 tests, 376 pass, 0 fail, 0 todo |
| New test files | `notifications.test.js` (19 tests) and the payment notifications test in `payments.test.js` ran inside the full run above |
| `npm run lint` server, client; `npx oxlint .` e2e | clean |
| `cd client && npm run build` (check-i18n first) | clean; "es, fr match en" |
| P11b-01 … P11b-05 (D, M) | 10/10 pass (final run 19:10–19:20; P11b-01 and P11b-05 again after the C6 change, 20:03) |
| Updated: P2-12 (D, M), P2-15, P2-16, P6-10 | pass |
| Screens changed: P6-03 (D, M), P6-04, P6-05 (D, M), P6-06, P6-07 (D, M), P10-09 (D, M), P10-10 (D, M), P7-01 (D, M), P7-02, P11-04, P5-01 (D, M), P8-04, P11-03 (M) | pass (P6-06 failed once and led to C6; P2-12 M and P2-15 failed on OD6 assertions, updated) |
| `node e2e/run.js sweep` (en) | D and M pass |
| P11-01 (es and fr sweep, every role) | D and M pass: public 13, onboarding 5, candidate 28, recruiter 30, admin 30 routes per language |
| `npm run mail:test` to +alex | `admin_account_review`, `admin_verification_submitted`, `admin_content_report`, `admin_renewal_failed`, `admin_joined`: sent |

**Overlaps (P11-Q5).** The Phase 11 session (ai-job-24) ran the full server suite 17:06–17:23 over half-finished 11b edits (its 21 failures came from them) and wrote the Phase 11 results into this file meanwhile; it also disturbed one notifications test run (17:23, not counted). ai-job-e7 ran p04 scenarios (~18:22–18:35) and a sweep (~18:43) on `eujobs_test`, which signed one P11b-02 run's recruiter out (not counted); it then paused its runs until 20:11. The owner committed Phase 11 (`9b8fba8`, 16:58) before the 11b edits.

**Open.**
- The five admin emails sent live to +alex: owner to confirm.
- A few headless Chrome processes from an e2e run that crashed on a scenario typo (18:16) were left running; they hold no ports.

### Phase 11c: Recruiter Plus (paid recruiter plan)

**Scope.** A paid recruiter plan with the locks, the job limit, the plan-end pause, the recruiter payment emails and notifications, and the admin totals (§3.22). Supersedes M-117.

**Decisions.** P11c-Q1 … Q19 (owner, 2026-11-05), M-115 … M-130 (reused for recruiters), U38, P11b-Q11 (recruiter part replaced), §3.21.

**Tasks**

1. Server: plan record `recruiter_plus` with `role`, the Stripe Product and Prices in `seed:catalog`; Checkout, Portal, `/recruiter/subscription` and the webhooks by role (company-country currency); `me.plan`/`me.entitlements` for recruiters; `requireEntitlement` for both roles; the locks of §3.22; the 1-published-job rule; the plan-end pause and the one-time start-up step; recruiter `payment_paid` / `renewal_failed` / `plan_ended` (notifications and emails in en/es/fr, `mail:test` samples); admin Payments cards, list, details, Overview and Users → Recruiters by role.
2. Client: the upgrade dialog in the recruiter shell (Recruiter Plus item), `lacksEntitlement` for recruiters, every lock of §3.22, the Shortlists gate and chip, Billing's plan card shared with candidates, the profile-menu plan, the admin screens; en/es/fr keys.
3. `seed:demo`: Sarah on Recruiter Plus (real GBP subscription, her first invoice as a seed row, Q11).
4. e2e: `p11c-*` scenarios and `e2e/lib` helpers; rerun the recruiter scenarios of changed screens and the sweep in en, es and fr.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P11c-01 | Free locks | D, M | A Free approved recruiter with one live job: Find candidates lists only applicants; search, filters, sort, Shortlist, Compare, profile Message, CV request, Match insights, Translate, the job AI summary, "See candidates" and Publish of a 2nd job each show a lock and open the upgrade dialog with "Recruiter Plus", and no request is sent. Shortlists shows the gate. Applicant stages, reject and notes work; a reply in an existing thread sends. |
| P11c-02 | Subscribe | D, M | The recruiter (company in a non-GBP country) subscribes with 4242: Checkout shows the company currency and the £49-row amount; the webhook arrives; the locks lift; Billing shows Recruiter Plus with the renewal date; admin Payments lists the row and the cards count the recruiter. |
| P11c-03 | Plan end | D | Portal cancel, then the test clock passes the period end: the plan ends, only the most recently published job stays live, the others are paused; the plan_ended notification names them; Applications and Messages stay. |
| P11c-04 | es and fr | D, M | The Free locks and the upgrade dialog in es and fr, with no English left and a clean layout. |

**API tests.** Every recruiter lock Free vs Plus (Compare: the data it reads), the job limit (create, edit, status), the plan-end pause and the start-up step, the webhook handlers for recruiter subscriptions (first invoice, renewal, failed renewal, cancel), the admin totals by role.

### Phase 12: GDPR export and erasure, retention, full regression

**Scope.** Data export, candidate erasure, recruiter deletion, the retention sweep, removal of the last demo leftovers, the static-data audit and the full regression.

**Decisions.** M-185 … M-190, OD15, U29 … U32, C18, OQ-6k; S ("Delete my data" is real, "Reset demo" is removed).

**Prep.** None.

**Tasks**

1. Export ZIP (archiver):
   - candidate: JSON of every own record plus CV files, photo and certificate PDFs, with no recruiter notes;
   - recruiter: JSON of account, company, jobs, notes, messages and payments, plus a CSV summary (OQ-6d).
2. Candidate erasure (§3.16) and recruiter deletion (§3.16, OQ-6k). Both require the password; Stripe is cancelled and deleted; the cascade covers every collection in §4.2.
3. The `retention-sweep` daily job (M-186, U32, certificate files exempt).
4. Remove "Reset demo", `candidate/settings/utils/localData.js`, the recruiter reset code, `useSharedLocalStorage` and any leftover mock.
5. A static-data audit script (`e2e/audit-static.js`). It must find nothing:
   - `useLocalStorage(` outside the four allowed sites (§2.15);
   - mock `data/` files;
   - currency symbols and `en-US` in code;
   - hard-coded demo names.
6. The full regression: every phase scenario plus the cross-role scenarios below.
7. Update the README facts (how to run the server, client, seeds and tests; the client no longer uses mock data).
8. Re-check `npm audit` (the `archiver` warnings, P8-Q4) before go-live.

**Done when.** Every scenario of every phase passes in one run, the static-data audit is clean, and lint, build and tests are green.

**Browser verification**

| # | Scenario | Viewports | Expected |
|---|---|---|---|
| P12-01 | Candidate export | D | Data & account → Export → a ZIP with JSON (profile, applications, messages, payments, alerts, enrollments) plus the CV, photo and certificate files; no recruiter notes. |
| P12-02 | Candidate erasure | D, M | "Delete my data" with the password → signed out; signing in fails. For the recruiter: the application is gone, the thread shows "Deleted user", the shortlist count changes, the notes are gone. The certificate page says "No longer valid". Admin Payments shows the payer as "Deleted user". In Stripe the subscription is canceled and the Customer deleted. Audit entries show "Deleted user". |
| P12-03 | Recruiter deletion | D | Jobs closed. Candidates' applications and threads show the company display name. The KYC files are gone from disk. Payments are kept. The company's notes, shortlist and activity are gone. |
| P12-04 | Retention | D | Approved evidence with `decidedAt` shifted back 31 days → tick at 03:00 → the file is deleted from disk and the decision kept. Certificate files are untouched. |
| P12-05 | Full sweep | D, M | Every route × every role × en/es/fr: no console errors, failed requests, missing keys or overflow. |
| P12-06 | Cross-role journeys | D, M | (1) A new fr candidate signs up, verifies, onboards, completes the profile, gets approvals, subscribes in EUR, applies; the recruiter moves stages; fr emails arrive; they message; the recruiter rejects; the candidate sees "Not selected". (2) A new recruiter signs up, is approved, publishes; a Plus candidate gets the instant alert and applies. (3) The admin restricts that job → candidates see "no longer available". (4) A course purchase → certificate → public verification. (5) Candidate erasure → every view stays consistent. |
| P12-07 | Static audit | — | `node e2e/audit-static.js` reports 0 findings. |

**API tests.** Export contents for both roles; the erasure cascade (one assertion per collection); the recruiter deletion cascade; the retention sweep; tombstones; Stripe calls (stubbed in API tests, real in the e2e).

---

## 7. Prep checklist

| # | Item | Status | Exact steps |
|---|---|---|---|
| P1 | Remove the stale `questions-merged.md` (it contradicted the JSON on M-017 and M-159) | **done** | — (the JSON and `DECISIONS.md` are authoritative; C1) |
| P2 | Uploads folder outside OneDrive | **done** | `C:/eujobs-data/uploads` exists; `UPLOAD_DIR` is set |
| P3 | Missing env vars (`UPLOAD_DIR`, `FILE_URL_SECRET`, `SEED_ADMIN_EMAIL`, `OPENAI_TRANSCRIBE_MODEL`) | **done** | All 22 names are present (§1.3) |
| P4 | One real transcription | **done** | `gpt-4o-mini-transcribe` passed; `whisper-1` is the fallback (OD7) |
| P5 | Stripe currency checks | mostly **done**; rest in **Phase 5** | Done: Checkout in 8 currencies, currency switch on one Customer, Adaptive Pricing off. Remaining: P5-02 pays one subscription per currency end-to-end and checks the stored currency and amount. P8-04 buys a course in a currency other than an existing subscription's; if Stripe refuses, switch to one Customer per currency (U40). |
| P6 | Customer Portal configuration | **Phase 5** | `seed:catalog` calls `stripe.billingPortal.configurations.create` once (cancel at period end, payment-method update, invoice history, no plan switching) and stores the id in `AppConfig('stripe')`. Portal sessions pass that `configuration`. |
| P7 | Failed-payment retry settings | **optional** (not a prerequisite) | The code handles any final retry action (§2.10). Optionally the owner turns on Smart Retries in the Stripe Dashboard's failed-payment settings with final action "cancel subscription". The tests use Test Clocks + card `4000 0000 0000 0341` through the full schedule. |
| P8 | Webhook signing secret | **Phase 5** | `cd server && npm run stripe:check-secret` must print `match` (it runs `stripe listen --api-key <key> --print-secret` without printing anything). On `mismatch`, ask the owner to update `STRIPE_WEBHOOK_SECRET` in `server/.env`. There is no CLI browser login; always use `npm run stripe:listen`. |
| P9 | Fonts | **Phase 2** (client), **Phase 8** (server) | Client: install `@fontsource/inter` and `@fontsource/manrope`, import the weights used, remove the Google Fonts `<link>`. Server: download Inter and Manrope TTF with Latin Extended from the official font repositories into `server/assets/fonts/` and embed them in pdfkit. |
| P10 | Common-password list | **Phase 1** | Download SecLists `Passwords/Common-Credentials/10k-most-common.txt` (MIT) into `server/data/common-passwords.txt` and load it into a Set at startup. |
| P11 | Test fixtures | **Phases 3, 4, 8, 10** | `e2e/fixtures/make.js` writes to `C:/eujobs-data/fixtures`: PDFs and images through pdfkit and sharp; a DOCX zipped with archiver; an SVG with `<script>`; oversized files; WebM (and MP4 where Chrome's `MediaRecorder` supports it) recorded in Chrome; a synthetic 501 MB MP4. Download a small CC0 MP4 only if Chrome cannot record MP4. Voice note: the P4 audio file (ask the owner for its path), or one MP3 made with the OpenAI speech API. |
| P12 | Plus-alias test accounts | **Phase 1** | `seed:demo` derives `<local>+alex@<domain>`, `+emma`, `+sarah` and `+james` from `SEED_ADMIN_EMAIL`. Keep non-critical test sends under the 400/day cap. |
| P13 | Atlas tier and headroom | **done** (2026-10-30) | The stuti cluster (`cluster0.6bhj96m`) is shared with about 20 other projects and has about 194 MB used. Only `eujobs` and `eujobs_test` are ever touched, and seed and test data stay small. Phase 9 keeps the embedded population small (about 12 KB per embedding). |
| P14 | Logo file | **not needed** | OD11: crop the existing AI mark; live text in Manrope (Phase 2). |
| P15 | Imprint legal entity details | **before go-live** (§8) | The Imprint stays a marked draft placeholder now (S, OD12). |
| P16 | npm packages | **per phase** | §2.14 lists each package, with the phase that installs it and the resolved duplicates. |
| P17 | cloudflared | **not needed now** (§8) | Installed (2026.8.2). Used only for a later Vercel demo: 100 MB request cap, URL changes each run. |
| P18 | Google Places proxy | key verified by the owner (2026-10-30); **first call in Phase 3** | Through the dev server's proxy (never with the key in a command or log): an autocomplete for a few letters in en/es/fr returns only EU 27 + UK cities, "Las Palmas", "Funchal", "Limassol" and "Valletta" each return results (P3-Q1), and place details for one result return `{ countryCode, city, placeId }`. If Google refuses the key or the API is not enabled on the Housbe project, stop and ask the owner. |

---

## 8. Out of scope now, or before go-live

| Item | When | Source |
|---|---|---|
| Final legal wording for Terms and Privacy; Imprint legal entity name, address and contact (replace the `2026-11-draft` texts) | before go-live | OD12, M-191, M-197, P15 |
| Legal reviews: the right-to-work filter; recruiter notes in the candidate export; the erasure scope; the 30-day evidence retention | before go-live | OD4, M-056, OD15, M-080, M-188, M-186 |
| Live Stripe keys, VAT handling, Stripe Tax and VAT ids, live receipts | before go-live | M-127, C12 |
| Hosting the API; the Vercel client with `VITE_API_URL`; the public `CLIENT_ORIGIN` | before go-live | M-204, S |
| Regenerate the stored certificate PDFs with the public base URL in the QR code (codes unchanged, like the U17 re-issue) | at the base-URL switch | M-105, ordering item 13 |
| Tunnel demos through cloudflared: video uploads only on localhost (100 MB cap); rate limiting by `CF-Connecting-IP` | when demoing | M-204, C26, P17 |
| A transactional email provider if volume exceeds personal Gmail (about 500/day) | before go-live | C19, OD9 |
| Google Places: an own key instead of the shared Housbe key; confirm that the Google Maps Platform terms allow keeping the city name and country code with the place id (place ids may be stored indefinitely, other Places content has caching limits) | before go-live | G-1 |
| SMS phone verification (codes are shown on screen now) | not in v1 | M-003 |
| Antivirus scanning of uploads | not in v1 | M-185 (rejected option) |
| OCR for image-only PDFs; video transcoding | not in v1 | U18, M-102 |
| Email change in the app | not in v1 | M-010, C21 |
| ~~Notification feed or bell dropdown~~ | ~~not in v1~~ superseded: built in Phase 11b (P11b-Q1 … Q15) | ~~M-093, OD6~~ |
| Server-side global search | not in v1 | M-194 |
| Admin FAQ editor; admin Plans screen | not in v1 | M-200, M-116 |
| Recruiter teams (several recruiters per company) | later | M-145 |
| Sourced candidates in the pipeline; interview scheduling | not in v1 | M-071, M-075 |
| Admin subscription actions (cancel, refund, grant) | not in v1 | M-123 |
| Course archive and delete | not in v1 | M-109 |
| AI outreach drafts; AI course suggestions; AI job quality review | not in v1 | M-088, M-114, M-060 |
| Redis, queues, Docker | not used | S, OD10 |

---

## Appendix A: The 26 contradictions and the adopted resolutions

| # | Contradiction | Adopted resolution |
|---|---|---|
| C1 | The stale md vs the JSON on M-017 and M-159 | The JSON is authoritative. Salary is optional and not counted (M-017). Admins are invited by email (M-159). P1 done. |
| C2 | "One phone per account" vs on-screen codes | OD3: drop phone uniqueness. |
| C3 | Right-to-work filter vs the legal review before a sponsorship filter | OD4: ship "Has right to work in {country}" in test mode; legal review before go-live. |
| C4 | Toggles that control nothing | OD6: remove the in-app toggle and the admin email preferences. Superseded by Phase 11b: in-app is always on; every role has one email switch per category (P11b-Q3, Q12). |
| C5 | The CV-request "notification" has no channel | U19: an email under the toggle plus a pending list on the CV page. |
| C6 | Score visibility for recruiters | Recruiters get ranking and evidence only. Paid candidates and admins see the number. |
| C7 | The relevant-count population vs who Find candidates can open | Use the M-054 + M-055 population (U7). |
| C8 | Custom stages vs the fixed admin funnel | OD5: 6 fixed stage categories. |
| C9 | Remote jobs in country views vs one salary currency | OD2: remote jobs appear only in the Remote view. |
| C10 | Salary cap vs HUF salaries | U26: salary max 100,000,000. |
| C11 | Free "For you" vs score-based Recommended | U8: Free gets jobs sharing at least 1 required skill. |
| C12 | "Stripe emails receipts" vs test mode | Store and show the receipt or hosted-invoice link; do not test receipt emails. |
| C13 | "Cards, wallets, Link" vs dynamic payment methods | `payment_method_types: ['card','link']` on every session (U40). |
| C14 | 8 currencies on a US sandbox | P5 verified. The subscriber's own currency is shown in Billing and the promo. Any country's currency is accepted in test mode. |
| C15 | Single money KPIs vs per-currency reports | U34: one line per currency, at most 3, then "+n more". |
| C16 | Protected files vs Bearer tokens | U39: signed file URLs. |
| C17 | Uploads inside OneDrive | P2: `UPLOAD_DIR` outside OneDrive (done). |
| C18 | Certificate deletion vs "Revoked"; certificate files vs 30-day deletion | A tombstone `{ code, status }` showing "No longer valid". Certificate files are exempt from the 30-day deletion. |
| C19 | Gmail volume | OD9: reserved-domain suppression, a cap of 400/24 h for non-critical email, critical email always sent. |
| C20 | "No queues" vs deferred work | OD10: an in-process 60 s timer over MongoDB due-records. |
| C21 | Email change re-verification vs no email change | Build only the phone part. |
| C22 | Code right after sign-up vs a token at sign-up | U37: a token at sign-up; `EMAIL_UNVERIFIED` until the code is entered. |
| C23 | Three policy signals vs a two-input formula | U5: experience → sim, skills → skill, location → cap at 49. |
| C24 | Badge hidden when not discoverable vs profile visible to companies applied to | Show the badge wherever the profile is visible. |
| C25 | Seeded Plus subscribers vs Stripe-driven state | OD8: real Stripe test customers and subscriptions in the seed. |
| C26 | Tunnel limits | Video uploads on localhost only; rate-limit by `CF-Connecting-IP` with trust proxy. |

## Appendix B: The 44 under-specified items and the adopted defaults

| # | Adopted default |
|---|---|
| U1 | 5 failed logins per email per 15 min; 20 per IP per 15 min; forgot password 5/h per email; sign-up 10/h per IP; `RATE_LIMITED` + `retryAfter`. |
| U2 | Min 8 characters, max 72 bytes; reject the top-10k list and the email local part; bcryptjs cost 12. |
| U3 | The cap is OD13. Not counted: cache hits, embeddings, admin Regenerate. |
| U4 | gpt-5.4-mini for job summaries, match explanations, insight narratives, translations and the profile summary. gpt-5.5 for the CV snapshot, assisted draft, policy suggestion and report summary. |
| U5 | `sim = clamp((cos−0.20)/0.40, 0, 1)`; `skill` = matched required ÷ required; score = round(100 × (0.6·sim + 0.4·skill)); signals as in C23; Strong ≥ 75, Good ≥ 50; stored per policy version. |
| U6 | Candidate text = headline + about + skills + work + education + live CV. Job text = title + brief + responsibilities + skills + level + languages. ~8,000 tokens; 3072 dims as Float32; cosine in Node; embed everyone with consent. |
| U7 | Relevant = score ≥ Good within the M-054 + M-055 population; nightly at 03:00 server time, with startup catch-up after 24 h. |
| U8 | Free "For you" = jobs sharing at least 1 required skill, ranked by overlap, then recency. |
| U9 | M-172: N = 5. |
| U10 | The M-173 card links to `/admin/candidates` with Status = Active. |
| U11 | M-176 = applications whose candidate is on that company's shortlist ÷ non-withdrawn applications, all-time. |
| U12 | Digests daily at 08:00 and weekly on Monday at 08:00 in `User.timezone` (saved at each sign-in); jobs since the last digest; no empty digests; missed slots at the next tick. |
| U13 | Tick 60 s. Message email when unread ≥ 15 min and no email for that conversation in 60 min. Stage email 10 min after the last move, only if the mapped status changed. |
| U14 | The new-application email is OD14. |
| U15 | Heartbeat every 15 s; credit min(Δwall, 15 s) × min(rate, 2) only when the position advanced without a seek; complete at ≥ 90%. |
| U16 | Duration read in the browser and editable; no global disk cap; text lessons in sanitised Markdown; https links only. |
| U17 | Verify page 30/min/IP. A name change re-issues with the same code. PDF chrome in the holder's language; the course title as authored. |
| U18 | CV PDF or DOCX ≤ 10 MB. No text layer → "No readable text", and matching uses profile text. The AI snapshot is paid; Free gets extraction only. |
| U19 | "Earlier CV version requested" email (toggle) plus a pending list on the CV page. |
| U20 | Report reasons: spam, scam_or_fraud, discriminatory, offensive, misleading, other; details ≤ 500; 10 reports per user per day; one open case per reporter and target. |
| U21 | Invite link valid 72 h, single use, role chosen at invite. `isOwner` set only by the seed; invited admins are never Owner. |
| U22 | A new Terms or Privacy version → a blocking re-accept dialog at the next sign-in. |
| U23 | Report CSV: an "Executive summary" row, then the summary; a "Brief" row with the brief or transcript; a blank row; then the data table. |
| U24 | A course needs all 8 prices (or Free) to publish; integer minor units; whole amounts shown with 0 decimals. |
| U25 | Monthly salary × 12 for filters, sort and the minimum-salary check. The Remote salary filter is in EUR. The candidate minimum is compared only within the same currency. |
| U26 | Salary max 100,000,000. |
| U27 | Checks per category, one approval each. Editing or deleting the linked entry resets that category. An expired permit shows "Permit expired", counts as no right to work in filters, and leaves completeness unchanged. |
| U28 | "Discoverable" = listed in Find candidates now. Existing threads stay open after hiding; no new threads. |
| U29 | Candidate erasure details are OD15. |
| U30 | Recruiter deletion details are OD15. |
| U31 | Recruiter notes are excluded from the candidate export (legal check at go-live; OD15). |
| U32 | 30 days as a constant; daily sweep at 03:00; certificate files exempt. |
| U33 | Reject sets `not_selected`; the card leaves the board; a "Not selected" filter; the rejection email uses the 10-min delay, which is also the undo window. |
| U34 | Money cards: one line per currency, largest first, at most 3, then "+n more". |
| U35 | Keywords match the job text plus labels in the alert's language; the alert stores the picker country (Remote allowed) and matches only that country. |
| U36 | A duplicate sign-up shows the same screen; the existing account gets "You already have an account" (sign-in + reset links) under the 1/min, 5/day limits. |
| U37 | A token is issued at recruiter sign-up; until the email is verified, recruiter endpoints except verify, resend and `/me` return 403 `EMAIL_UNVERIFIED` (logout is client-side, M-007). |
| U38 | Paid when active, trialing or past_due; Free for unpaid, canceled, incomplete, incomplete_expired. Refined: past_due counts as paid only while Stripe still retries (M-120, §2.10). |
| U39 | Signed URLs: HMAC(`FILE_URL_SECRET`) over path + userId + expiry; 15 min for images, PDFs and CVs; 6 h for video; issued after the ownership check; downloads logged. |
| U40 | One Product, one Price per currency (`plus_monthly_<cur>`) via `seed:catalog`; courses use inline `price_data`; every session sends the currency, card + Link, locale and Adaptive Pricing off; one Customer per currency only if Stripe refuses a switch. |
| U41 | `seed:catalog` is an idempotent upsert (countries, plan + Stripe prices, permissions, FAQs, legal texts); `seed:demo` wipes and recreates the demo data. |
| U42 | Courses: 3 English Markdown lessons (300–600 words) + 5 single-choice questions each. Cities: London, Manchester, Dublin, Berlin, Munich, Paris, Lyon, Madrid, Barcelona, Amsterdam, Warsaw, Lisbon, Stockholm. USD salaries converted once at fixed rounded rates (OQ-4), rounded to 1,000. |
| U43 | The build session writes all new copy in en/es/fr: about 22 email templates, FAQ answers per audience, certificate text, lock and upgrade prompts, the restricted-admin notice and every new UI string. Legal texts per OD12. |
| U44 | New screens without Figma follow OD16. |

## Appendix C: OD1–OD16 adopted

| # | Adopted decision |
|---|---|
| OD1 | Prices per currency: the table in §3.10, verbatim. |
| OD2 | Remote-flagged jobs appear only in the Remote view. Country views list on-site and hybrid jobs located there. Eligible countries show as a badge or filter inside Remote (OQ-6i: both). |
| OD3 | Drop "one phone per account". |
| OD4 | Ship "Has right to work in {country}" (citizen/settled or valid permit) in test mode; legal review before go-live. |
| OD5 | Each stage picks one of 6 fixed categories. The candidate status derives from it. The admin funnel counts categories; the recruiter funnel lists the company's stages. |
| OD6 | ~~Remove the in-app toggle (no bell feed in v1) and the admin email notification preferences.~~ **Superseded 2026-11-04 by Phase 11b** (P11b-Q1 … Q15): bell feed, Notifications page, per-category email switches for all three roles; in-app always on. |
| OD7 | Speech-to-text: `gpt-4o-mini-transcribe`, with `whisper-1` as fallback. **Resolved:** a real transcription test passed (P4). |
| OD8 | The seed creates real Stripe test customers and subscriptions (`pm_card_visa`) tagged `metadata.seed=true` (plus `metadata.db`), removed on re-seed. Historical seed payments are `source: seed`, without receipt links. |
| OD9 | The Owner uses `SEED_ADMIN_EMAIL`. The demo accounts use plus-aliases of it (S). Every other seed account uses `@example.com`. Reserved domains are never mailed, only logged. Non-critical emails are capped at 400 per rolling 24 h. Verification, code, reset and invite emails are always sent. |
| OD10 | An in-process 60 s timer over MongoDB due-records; missed work runs at the next start. |
| OD11 | Keep the "AI" mark cropped from `logo.png`; render "Local WorkMan" and "AI Job Portal" as live text in Manrope. |
| OD12 | Terms, Privacy and Imprint seeded in en/es/fr as marked drafts, version `2026-11-draft`. The Imprint is a placeholder. Final wording before go-live. |
| OD13 | 50 OpenAI generations per user per UTC day. Cache hits, embeddings and admin Regenerate are not counted. Admins are exempt. |
| OD14 | A new-application email to recruiters, at most 1 per job per hour ("{n} new applications for {job}"), under the email toggle. |
| OD15 | Candidate erasure scope, messages deleted for both sides ("Deleted user"), audit and moderation entries kept with "Deleted user", the Stripe subscription cancelled and the Customer deleted, certificate tombstones, recruiter deletion (jobs closed, display name kept, personal data and KYC deleted), notes excluded from the candidate export. Full list in §3.16. |
| OD16 | New screens with no Figma are built from existing components and `docs/DESIGN_SYSTEM.md` and checked in a real browser; there is no separate Figma step. |

## Appendix D: Reference map

| Need | Where |
|---|---|
| Full text of a decision | `docs/backend/DECISIONS.md` (grouped by topic; M-id headings) |
| Contradictions, external dependencies (D1–D26), defaults, ordering, OD, prep | `docs/backend/blocker-review.md` §1, §2, §3, §4 and its last two sections |
| **Candidate** screens, route by route | `audits/candidate.md` §0 (screen index), §1–§23 (per screen), §24 (decision impacts D1–D5), §25 (messages) |
| Candidate static items (file:line), formatters, demo copy | `audits/candidate.md` §28 (S1–S60), §28a, §28b |
| Candidate storage call sites and `data/` imports | `audits/candidate.md` §31a, §31b |
| **Recruiter** screens | `audits/recruiter.md` Part A (A0–A36), Part B (decision impacts B1–B4) |
| Recruiter storage keys, entities, endpoints | `audits/recruiter.md` §0.1, Part C, Part D |
| Recruiter static items, formatting, cross-role effects | `audits/recruiter.md` Part E, Part F, Part G; storage grep J2 |
| **Admin** screens | `audits/admin.md` §1.1–§1.28 |
| Admin entities, endpoints, permission map, course content gap | `audits/admin.md` §2, §3, §4, §5 |
| Admin static items and new-decision changes | `audits/admin.md` §6, §9.1–§9.4; storage grep §10.2 |
| **Shell, auth, help, payments core** | `audits/shared.md` §1–§8 |
| Shared endpoints, cross-feature imports, storage call sites (53) | `audits/shared.md` §9, §10, §11 |
| Formatting and i18n inventory; CSS for long translations | `audits/shared.md` §12 (plurals §12.12, CSS §12.13, size §12.15) |
| Shared static items | `audits/shared.md` §13 |
| Design tokens, Figma frames, flows, client conventions | `docs/DESIGN_SYSTEM.md`, `docs/FIGMA_SCREEN_INVENTORY.md`, `docs/USER_FLOW.md`, `docs/CONVENTIONS.md` |

**Per phase, read:**

| Phase | Audit sections |
|---|---|
| 2 | shared §1–§4, §8.1, §8.2, §11, §12, §13; candidate §0.1; recruiter A0–A2; admin §1.2, §1.28 |
| 3 | candidate §6–§8, §17–§19, §21–§23, §24 D1, D3; admin §9.2 (verification queue) |
| 4 | recruiter A3–A24, A30, B1, B2; candidate §1–§3; admin §1.25, §1.26, §9.2 |
| 5 | shared §6, §8.3; candidate §9, §9a, §20, §24 D4; admin §9.3; recruiter A33 |
| 6 | candidate §4, §24 D2; recruiter A25–A27, A9 |
| 7 | candidate §5, §25; recruiter A16 (message modal), A31, A36, B3 |
| 8 | candidate §15, §16, §24 D5; recruiter A28, A29, B4; admin §1.14–§1.16, §5, §9.1 |
| 9 | candidate §10–§14; recruiter A11, A15, A17; admin §1.6, §1.18, §1.19 |
| 10 | admin §1.1, §1.3–§1.13, §1.17, §1.20–§1.27, §4, §9.3, §9.4 |
| 11 | shared §12; candidate §28a; recruiter Part F |
| 12 | candidate §19; recruiter A32; shared §11 |
