# Blocker review: 210 accepted answers (Local WorkMan backend)

Inputs checked: `questions-merged.json` (210 items), `questions-page/submission.json` (all 210 answers equal the JSON recommendation; 0 mismatches), the settled decisions, `server/.env` variable names (values not read except non-secret config), client code where an answer depends on it, and the local toolchain (Node 24.19.0, Stripe CLI 1.55.3, cloudflared 2026.8.2, **no ffmpeg**).

Counts: 1. Contradictions: 26 · 2. External dependencies: 26 · 3. Under-specified: 44 · 4. Ordering steps: 16 · Owner must decide: 16 · Prep checklist: 17

---

## 1. Contradictions

**C1. Stale `questions-merged.md` disagrees with the JSON on M-017 and M-159.** The md recommends "(a) Required everywhere, counts" and "(a) Seed only". The JSON, the page and the submission recommend "(a) Optional, not counted" and "(a) Invite by email". The submission stores only the letter "a", so whoever reads the md gets the opposite answer. The JSON is authoritative. Note that both accepted answers move a settled decision: M-017(a) takes salary out of "all profile fields", and M-159(a) adds invited admins to "admins seeded". → Prep P1.

**C2. M-004 "one phone per account" vs the on-screen code (settled; M-003 "shows it on screen").** No ownership is proven, so anyone can claim someone else's number. The real owner then cannot verify, cannot complete the profile and cannot apply. → OD3.

**C3. M-021 vs M-056.** M-021 says right to work is "shown and filterable for recruiters", with a "needs sponsorship" value. M-056 requires "a legal review before any sponsorship filter". Every right-to-work filter works as a sponsorship filter. → OD4.

**C4. Toggles that control nothing.** M-095 says the "in-app toggle controls the bell/dot", but M-093 says "Remove dot … No feed in v1". M-199 puts "email notification preferences" on admin Settings, but no accepted answer sends any email to admins (M-092 recipients are candidates and recruiters only). → OD6.

**C5. M-029 "(and as a notification)" has no channel.** M-093 has no feed, and neither M-092 nor M-095 lists a CV-request email. → U19.

**C6. Score visibility for recruiters.** The M-047 note says "one number reused by candidate, recruiter and admin screens". M-057 says "recruiters never see a score", and the client agrees (`matchEvidence.js`: "never a score or a percentage"). Fix: recruiters get ranking and evidence only. The number is shown to paid candidates and to admins (M-068 shows %).

**C7. M-051 vs M-054/M-055.** "N relevant" counts "discoverable, consenting, email-verified candidates in the job's market". Find candidates also requires a complete profile and uses the residence/right-to-work country rule. The count would include people the recruiter cannot open. Fix: use the M-054 and M-055 population (U7).

**C8. Stage mapping vs fixed funnel.** M-070 maps "screening/shortlisted/custom to Under review", and M-072 allows 2–12 custom stages per company. M-179 keeps "the Figma shapes": the admin `FunnelChart` has 6 fixed steps (applied, screening, shortlisted, interview, offer, hire). M-178 aggregates across companies. Nothing shared lets the admin funnel separate Screening from Shortlisted across companies. → OD5.

**C9. Remote jobs vs salary currency.** M-131(a) "works because the picker shows only that country's jobs", with "remote jobs entered in EUR". M-032 gives remote jobs "a list of eligible countries". If a remote job eligible for Poland appears in the Poland view, it shows EUR in a PLN view. → OD2.

**C10. M-033 "salary integers 0-10,000,000" vs HUF local salaries (M-130/M-131).** Senior Hungarian annual salaries (12–25 M HUF) exceed the cap. → U26.

**C11. M-050 vs M-053.** Free candidates get "a non-AI overlap label", but Recommended jobs / For you is defined as "score at or above Good", and Free users have no score. → U8.

**C12. M-127 "Stripe emails receipts" vs settled test mode.** Stripe does not send receipts automatically for test-mode payments. Fix: rely on the stored receipt/hosted-invoice link (M-122). Do not test for receipt emails.

**C13. M-126 "Cards, wallets and Link" vs Stripe dynamic payment methods.** Checkout may also offer iDEAL, Bancontact, SEPA, Klarna and others per currency, and some of these are asynchronous. M-122 defines no handling for async payments. Fix: pass `payment_method_types: ['card','link']` on every session (U40).

**C14. M-130 "EUR, GBP, PLN, SEK, DKK, CZK, HUF, RON" vs settled "US sandbox, EUR and GBP verified".**
- Six currencies are unverified.
- Adaptive Pricing, if enabled, can re-present prices in the buyer's local currency.
- A Stripe Customer that already has a subscription in one currency may refuse another currency.
- The header country is a free browsing preference (M-136), so a user can buy in any country's currency. Accept this in test mode.

Billing and the M-196 promo should show a subscriber's own subscription currency. → P5, U40.

**C15. Money KPIs are single numbers.** M-123 "Active subscribers and MRR cards" and the M-111 Revenue column are designed for one currency, but M-130 says "reports total each currency separately". → U34.

**C16. Protected files vs the Bearer token.** M-185 "served only through authenticated, ownership-checked endpoints", M-007 "token in localStorage" and M-102 "HTTP Range streaming" clash: `<img>`, `<video>`, PDF viewers and download links cannot send an `Authorization` header. → U39 (signed URLs).

**C17. Upload location.** The settled "uploads on server disk" plus the repo path (`C:\Users\tusha\OneDrive\Desktop\Ai Job\`) means CVs, identity and KYC documents and 500 MB videos would sync to OneDrive. They would also persist in the OneDrive recycle bin, which defeats M-186 (delete after 30 days) and M-188 (full erasure), and sync locks can break writes. → P2.

**C18. Certificates and retention.**
- M-188 deletes certificates ("verify page says revoked"), but the M-105 public check can only say "Revoked" if a record survives. "Revoked" also misstates a certificate that was earned. Fix: keep a tombstone {code, status} with no personal data. The page says "No longer valid".
- M-186 deletes "identity, KYC and evidence files" 30 days after a decision. M-025 and M-166 make external-certificate files both evidence and profile content shown to recruiters. Fix: certificate files are exempt from the 30-day deletion.

**C19. Gmail volume.** Settled personal Gmail allows about 500 recipients per 24 h. Planned volume comes from:
- M-096 instant alerts and digests
- M-089, M-091 and M-092 emails
- M-095 "new-application" emails
- M-159 invites

Seeded accounts (M-208/M-210) would receive verification, alert and stage emails. Fake addresses bounce from the personal Gmail account, which risks a sending lock. → OD9.

**C20. Settled "no queues" vs deferred work.** These answers all need work that runs later:
- M-089 "Only if unread after 15 min"
- M-091 "delayed ~10 min and collapsed"
- M-096 "Digests at 08:00 in the user's timezone"
- M-051 "nightly"
- M-186 "30 days after decision"

→ OD10.

**C21. M-001 and M-004 vs M-010.** M-001 says "an email change needs re-verification" and M-004 says "changing email/phone resets verification", but M-010 allows "no email change in v1". This is harmless: build only the phone part.

**C22. M-002 vs M-153.** M-002 says "Code entered immediately after sign-up; onboarding continues only after it". M-153 says "Sign-up creates the account and returns a token", so a token exists before verification. → U37.

**C23. M-048 vs M-047.** Policy signals switch inputs on and off. The client has three signals (`matching.js`: skills, experience, location), but the M-047 formula has only two inputs (embedding similarity and required-skill overlap). "Location" maps to nothing. → U5.

**C24. Certificate badge visibility.** The M-105 note says "badge hidden when the candidate is not discoverable". M-187 says a non-discoverable profile stays visible "to companies applied to". Fix: show the badge wherever the profile is visible.

**C25. Seeded subscribers vs Stripe.** M-208 asks for a coherent seed with Plus subscribers and past payments ("Alex paid £49", M-207). Plan state is Stripe-driven (settled; M-120/M-121 Portal). A seeded plan without a Stripe customer and subscription breaks the Portal and the webhooks. → OD8.

**C26. Tunnel limits.**
- M-102 allows 500 MB videos, but traffic through the M-204 tunnel (Cloudflare edge) has a 100 MB request-body cap, so video uploads must happen on localhost.
- The M-008 per-IP limiter sees the tunnel's IP for every user unless the client IP is taken from `CF-Connecting-IP` with `trust proxy` set.

---

## 2. External dependencies

| # | Dependency | Needed by | Kind | What to prepare |
|---|---|---|---|---|
| D1 | OpenAI speech-to-text model (not one of the 3 verified models) | M-181 | **Real blocker until verified** | Test `gpt-4o-mini-transcribe`, else `whisper-1`, with the key; add `OPENAI_TRANSCRIBE_MODEL` (OD7) |
| D2 | Stripe charging in PLN/SEK/DKK/CZK/HUF/RON on a US sandbox | M-130 | Verification + config | Test Checkout (payment and subscription) in each (P5). All 8 use 2-decimal minor units in Stripe; all prices are above Stripe minimums |
| D3 | Stripe Adaptive Pricing off | M-130 | Config | Dashboard setting or session parameter (P5) |
| D4 | Stripe Customer Portal configuration | M-121 | Config (hard error without it) | Save test-mode portal settings (P6) |
| D5 | Stripe failed-payment settings + Test Clocks | M-120, M-122 | Config + test tool | P7 |
| D6 | `stripe listen` forwarding | all payments | Ready | Keep its whsec equal to `STRIPE_WEBHOOK_SECRET`; CLI login expires after 90 days (P8) |
| D7 | PDF + QR generation with a Unicode font | M-105 | npm + font files | `pdfkit`, `qrcode`. The built-in PDF fonts lack ł/ř/ő/ș, so embed Inter TTF (P9) |
| D8 | Video streaming / duration | M-102, M-103 | None | Express `sendFile` handles Range. ffmpeg is **not installed**, so read duration in the browser; no transcoding (matches M-102) |
| D9 | CV text extraction | settled, M-027 | npm | `pdfjs-dist` (or `pdf-parse`) + `mammoth` for DOCX. No OCR available (U18) |
| D10 | Image resize (400/96 px, covers, logos) | M-013, M-107, M-150 | npm | `sharp` (prebuilt win32-x64) |
| D11 | Upload type checks | M-185 | npm | `multer`, `file-type`. Antivirus is not required by any accepted answer |
| D12 | SVG / Markdown sanitising | M-150, M-102 | npm | `dompurify` + `jsdom`; `marked` + `sanitize-html` |
| D13 | ZIP export | M-190 | npm | `archiver` |
| D14 | Scheduling without a queue | M-051/089/091/096/186 | None (code) | In-process 60 s timer + Mongo due-records (OD10); `luxon` optional for time-zone math |
| D15 | Exchange rates | — | **Not needed** | M-130(a)/M-131(a) avoid conversion; only the one-off seed price/salary table (OD1, U42) |
| D16 | ISO country / language / phone data | M-139, M-020, M-004 | npm + seed | 29 seeded country rows (BG = EUR since 2026, Remote = EUR); `iso-639-1`; `libphonenumber-js`; names via `Intl.DisplayNames` (Node 24 has full ICU) |
| D17 | Common-password list | M-006 | Data file | P10 |
| D18 | Self-hosted fonts | M-192 | npm | `@fontsource/inter`, `@fontsource/manrope`; remove the Google Fonts link in `client/index.html` |
| D19 | Public tunnel | M-204 | Installed | cloudflared 2026.8.2 (quick tunnel, no account, URL changes each run). Not needed for the build |
| D20 | Gmail SMTP | settled | Ready | App-side safeguards (OD9) |
| D21 | Corrected logo (current `logo.png` reads "Local Worksmen") | M-193 | **Design asset (blocker for M-193 only)** | OD11 |
| D22 | Legal texts + Imprint identity | M-191, M-197 | **Owner content** | OD12 |
| D23 | i18n library | settled i18n | npm | `i18next` + `react-i18next` (client); JSON dictionaries on the server |
| D24 | Rate limiting | M-008, M-105 | npm | `express-rate-limit` (memory store) |
| D25 | Atlas storage for embeddings | M-047, M-051 | Check | 3072-dim vectors: about 12 KB as Float32 binary, about 43 KB as a BSON array. Atlas Vector Search not needed (P13) |
| D26 | Test fixtures (no ffmpeg to make them) | M-102, M-181, M-185, CV | Files | P11 |

---

## 3. Under-specified, with proposed defaults

- **U1 M-008:** 5 failed logins per email per 15 min; 20 per IP per 15 min; forgot-password 5 per hour per email; sign-up 10 per hour per IP; error `RATE_LIMITED` + retryAfter.
- **U2 M-006:** min 8 characters, max 72 bytes (bcrypt); reject the top-10k list and the email local part; `bcryptjs` cost 12.
- **U3 M-058 cap:** → OD13. Not counted: cache hits, embeddings, admin "Regenerate".
- **U4 Model per feature:** `gpt-5.4-mini` for job summaries, match explanations and insight narrative, translations and the profile AI summary. `gpt-5.5` for the CV snapshot proposal, CV assisted draft, policy suggestion and report-brief summary.
- **U5 M-047/M-048 formula:**
  - sim = clamp((cos − 0.20)/(0.60 − 0.20), 0, 1).
  - skill = matched required / required.
  - score = round(100 × (0.6·sim + 0.4·skill)). The "experience" signal controls sim and "skills" controls skill; renormalise the weights when one is off.
  - "location" on: country/work-mode mismatch caps the score at 49.
  - Strong ≥75, Good ≥50. Weights and thresholds are stored per policy version.
  - Check the split on seed data once.
- **U6 Embeddings:**
  - Candidate text: headline + about + skills + work history + education + live-CV text.
  - Job text: title + brief + responsibilities + skills + level + languages.
  - Truncate to 8,000 tokens; full 3072 dims; Float32 binary; cosine in Node.
  - Embed every candidate with matching consent, Free included; only the display is gated.
- **U7 M-051:** threshold = score ≥ Good; population = M-054 + M-055; nightly at 03:00 server time, catching up at startup if more than 24 h have passed.
- **U8 M-053 for Free:** jobs sharing ≥1 required skill, ranked by overlap then recency.
- **U9 M-172:** N = 5.
- **U10 M-173:** link to `/admin/candidates` filtered to Status = Active (today's target).
- **U11 M-176:** applications whose candidate is on that company's shortlist ÷ non-withdrawn applications, all-time.
- **U12 M-096:** daily at 08:00; weekly Monday 08:00, in `User.timezone` (IANA, saved from the browser at each sign-in). A digest lists jobs first published since the last digest. Empty digests are not sent; missed slots are sent at the next tick.
- **U13 M-089/M-091:**
  - Scheduler tick: 60 s.
  - Message email: when unread ≥15 min and no email for that conversation in the last 60 min.
  - Stage email: 10 min after the last move, only if the mapped status differs from the last emailed status.
- **U14 New-application email (only named in M-095):** → OD14.
- **U15 M-103:** heartbeat every 15 s. Credit min(Δwall, 15 s) × min(rate, 2) only when the position advanced without a seek. The lesson completes at credited ≥90% of duration.
- **U16 M-102:** duration read in the browser at upload and editable; no global disk cap; text lessons are Markdown (textarea + preview), sanitised; links https only.
- **U17 M-105:** verify page 30 requests/min/IP. Re-issue on a name change keeps the code and replaces the PDF. PDF chrome is in the holder's UI language; the course title stays as authored.
- **U18 CV:** PDF/DOCX ≤10 MB (current UI). A PDF without a text layer is stored and flagged "No readable text", and matching uses profile text. The M-027 AI snapshot is paid only; Free gets extraction only.
- **U19 M-029:** email "Earlier CV version requested" (under the email toggle) plus a pending list on the CV page.
- **U20 M-164:**
  - Reasons: spam, scam_or_fraud, discriminatory, offensive, misleading, other.
  - Details: up to 500 characters.
  - Limits: 10 reports per user per day; one open case per reporter and target.
- **U21 M-159/M-160:** invite link valid 72 h, single use; role chosen at invite. Owner is an `isOwner` flag set only by the seed; invited admins are never Owner.
- **U22 M-191:** a new Terms/Privacy version shows a blocking re-accept dialog at the next sign-in.
- **U23 M-181:** CSV starts with an "Executive summary" row, then the summary cell, then a "Brief" row with the brief/transcript, a blank row, then the data table.
- **U24 M-130:** a course needs all 8 prices (or Free) to publish; integer minor units; whole amounts displayed with 0 decimals.
- **U25 M-131:** monthly salary × 12 for filtering, sorting and the minimum-salary check. The Remote-view salary filter is in EUR. Candidate minimum salary is compared only within the same currency.
- **U26 M-033:** salary max 100,000,000.
- **U27 M-023:**
  - Checks are per category (identity, academic, employment); one approved item per category is enough.
  - Editing or deleting the entry linked to an approved item resets that category.
  - An expired permit shows "Permit expired" and counts as no right to work in filters; completeness is unaffected.
- **U28 M-085/M-079:** "discoverable" means listed in Find candidates now. Existing threads stay open for both sides after a candidate hides; no new threads can start.
- **U29 M-188 erasure:** → OD15.
- **U30 M-189 recruiter deletion:** → OD15.
- **U31 M-080:** notes are excluded from the candidate's self-service export (legal check at go-live) → OD15.
- **U32 M-186:** 30 days as a constant; daily sweep at 03:00; certificate files exempt (C18).
- **U33 M-090:** Reject sets status `not_selected`. The card leaves the board and gets a "Not selected" filter (like withdrawn). The rejection email uses the M-091 10-min delay, which doubles as an undo window.
- **U34 M-123/M-111:** money cards show one line per currency, largest first, max 3, then "+n more".
- **U35 M-098:** keywords match job text plus labels translated into the alert's language. An alert stores the picker country at creation (Remote allowed) and matches only that country.
- **U36 M-001:** a duplicate sign-up shows the same screen; the existing account gets a "You already have an account" email (sign-in and reset links) under the same 1/min, 5/day limits.
- **U37 M-002/M-153:** a token is issued at sign-up. Until the email is verified, recruiter endpoints except verify, resend, me and logout return 403 `EMAIL_UNVERIFIED`.
- **U38 Entitlement (M-119/M-120):** paid when the Stripe status is active, trialing or past_due; Free for unpaid, canceled, incomplete or incomplete_expired.
- **U39 Signed file URLs (C16):** HMAC(`FILE_URL_SECRET`) over path + userId + expiry. Valid 15 min for images, PDFs and CVs; 6 h for video. Issued after the ownership check; downloads logged (M-187).
- **U40 Stripe objects:**
  - Plan: one Product, one Price per currency (`lookup_key` `plus_monthly_<cur>`), created by `seed:catalog`.
  - Courses: inline `price_data`.
  - Every session sends `currency`, `payment_method_types: ['card','link']`, `locale` en/es/fr, and Adaptive Pricing off.
  - If Stripe refuses a currency switch on one Customer, use one Customer per currency.
- **U41 M-116:** `seed:catalog` is an idempotent upsert (countries, plan + Stripe prices, permissions, FAQs, legal texts). `seed:demo` wipes and recreates the demo data.
- **U42 M-209/M-210:**
  - Courses: 3 English Markdown lessons (300–600 words) + 5 single-choice questions each.
  - Cities: London, Manchester, Dublin, Berlin, Munich, Paris, Lyon, Madrid, Barcelona, Amsterdam, Warsaw, Lisbon, Stockholm.
  - Seed USD salaries converted once at fixed rounded rates, rounded to 1,000.
- **U43 Copy the builder writes (en/es/fr):**
  - About 20 email templates: verify link, already registered, recruiter code, reset, admin invite, alert instant/daily/weekly, status update, rejection, new message, new application, recruiter approved/rejected/suspended, verification approved/rejected, content restricted, certificate issued, renewal failed, plan ended, CV request.
  - FAQ answers per audience, certificate text, lock/upgrade prompts, restricted-admin notice, all new UI strings.
  - Legal texts → OD12.
- **U44 New screens with no Figma** (work history, education, languages, right to work, links and photo editors; course builder; admin detail pages; return page; verify-email, set-password and certificate pages; legal pages; third Moderation tab): → OD16.

---

## 4. Ordering risks (build order)

1. **Answer source:** the JSON plus `submission.json` are authoritative; remove or regenerate the md before writing BACKEND_PLAN, and quote option labels, not letters (C1).
2. **Key catalogue (M-142)**, before any schema:
   - statuses and the stage categories (OD5)
   - work modes, levels, job types, company sizes, availability
   - right-to-work statuses, CEFR levels
   - payment, verification and recruiter states
   - report reasons, audit categories, the final permission ids (M-156), email types
3. **Countries + money format**, before the Job, Course, Plan and Payment models:
   - 29 country rows (BG = EUR; Remote = EUR).
   - Prices as integer minor units + ISO code.
   - Salaries as integer + currency + period.
4. **Price table (OD1) and the Stripe Product/Prices (`seed:catalog`)**, before checkout code.
5. **User + Company models**, before auth:
   - User: role, status, emailVerified, tokenVersion, language, pickerCountry, timezone, phone in E.164 + verifiedAt, termsVersion, isOwner.
   - Every recruiter-owned record carries `companyId` (M-145).
6. **`UPLOAD_DIR` outside OneDrive and signed URLs**, before CV, photo, KYC, evidence or lesson uploads.
7. **Email layer + scheduler**, before the first feature (verification email): i18n templates, reserved-domain suppression, daily budget, EmailLog and due-records.
8. **Permission catalogue, API enforcement and the audit writer**, before any admin endpoint (M-155: retrofitting costs more).
9. **Embedding recipe, dims and storage plus the policy defaults and versions**, before the first cached score. A later change means re-embedding everything; M-049 results reference the policy version.
10. **Application + stage-history + category model**, before KPIs, funnels, stage emails and the seed.
11. **Entitlement rule (U38) and webhook idempotency** (unique Stripe event id), before gating apply, replies, alerts and AI.
12. **One server completeness function** (items + per-category checks), before the apply gate, discovery, promo card and admin columns.
13. **Public base URL**, before certificate PDFs are stored: the QR/link is baked into the snapshot (M-105), while M-204 means localhost now and Vercel later. Alternatively, render the QR at download time.
14. **Seed accounts' email domain rule (OD9)**, before any email code runs against seed data. `seed:demo` comes after the models are stable.
15. **Error-code and i18n namespaces (M-141/M-143)**, before client strings are migrated.
16. **Unique indexes**, before data: email, certificate code, payment-reference counter, Stripe event id, and phone only if OD3 keeps uniqueness.

---

## Owner must decide

1. **OD1 Prices per currency** (plan, settled at £9; course price points £19/29/39/49). Recommended table, approximate rates rounded to retail prices:
   - Plan: GBP 9 · EUR 10 · PLN 45 · SEK 119 · DKK 79 · CZK 259 · HUF 3,990 · RON 55
   - £19 course: EUR 22 · PLN 95 · SEK 249 · DKK 169 · CZK 549 · HUF 8,490 · RON 115
   - £29 course: EUR 34 · PLN 145 · SEK 369 · DKK 249 · CZK 829 · HUF 12,990 · RON 169
   - £39 course: EUR 45 · PLN 195 · SEK 499 · DKK 339 · CZK 1,099 · HUF 17,490 · RON 229
   - £49 course: EUR 57 · PLN 245 · SEK 629 · DKK 429 · CZK 1,399 · HUF 21,990 · RON 289
2. **OD2 Remote jobs placement (C9).** Recommended: remote-flagged jobs appear only in the Remote view. Country views list on-site and hybrid jobs located there, so each view has one salary currency. The eligible-countries list is shown as a badge or filter inside Remote.
3. **OD3 Phone uniqueness (C2).** Recommended: drop "one phone per account". On-screen codes prove nothing, so uniqueness only lets someone block a real owner.
4. **OD4 Right-to-work filter (C3).** Recommended: ship a "Has right to work in {country}" filter (citizen/settled or valid permit) in test mode, and do the legal review before go-live.
5. **OD5 Stage categories (C8, changes M-070's UI).** Recommended: each pipeline stage picks one of 6 fixed categories (applied, screening, shortlisted, interview, offer, hired). The candidate status derives from it (screening and shortlisted become Under review). The admin funnel counts categories; the recruiter funnel lists the company's own stages.
6. **OD6 Toggles with nothing to control (C4).** Recommended: remove the in-app toggle (no bell in v1), and remove "email notification preferences" from admin Settings (no admin emails in v1).
7. **OD7 Speech-to-text (M-181).** Recommended: `gpt-4o-mini-transcribe`, with `whisper-1` as fallback. If neither works with the key, the AI summary is written from the typed brief only and the voice note is stored as an attachment.
8. **OD8 Seeded Plus subscribers (C25).** Recommended: the seed creates real Stripe test-mode customers and subscriptions (`pm_card_visa`), tagged `metadata.seed=true` and removed on re-seed. Historical seed payment rows are flagged `source: seed` and have no receipt link.
9. **OD9 Email safety (C19).** Recommended:
   - The seeded Owner admin uses a real inbox you give as `SEED_ADMIN_EMAIL`.
   - All other seed accounts use `@example.com`, and the mailer never sends to reserved domains (example.com/.org/.net, .test, .invalid, .localhost); those sends are only logged.
   - Non-critical emails (alerts, digests, message, application and stage notifications) are capped at 400 per rolling 24 h.
   - Verification, codes, reset and invite emails are always sent.
10. **OD10 Deferred work without a queue (C20).** Recommended: accept an in-process 60-second timer that processes MongoDB "due" records (no queue service). Anything missed while the server is off runs at the next start.
11. **OD11 Logo (M-193).** Recommended: keep the existing "AI" mark, cropped from `logo.png`, and render "Local WorkMan" + "AI Job Portal" as live text in Manrope (no new raster needed). Alternatively, supply a corrected PNG/SVG.
12. **OD12 Legal texts and Imprint (M-191/M-197).** Recommended: seed Terms, Privacy and Imprint in en/es/fr as clearly marked drafts (version `2026-11-draft`). You supply the legal entity name, address and contact email for the Imprint. The final legal wording comes before go-live.
13. **OD13 AI daily cap (M-058).** Recommended: 50 OpenAI generations per user per UTC day. Cache hits, embeddings and admin Regenerate are not counted; admins are exempt.
14. **OD14 New-application email to recruiters (named only in M-095).** Recommended: send it, batched to at most one email per job per hour ("{n} new applications for {job}"), under the email toggle.
15. **OD15 Erasure details (M-188/M-189/M-080, legal defaults).** Recommended:
    - Candidate erasure also deletes saved jobs, shortlist entries, recruiter notes about them, profile views, CV requests and download logs, verification evidence and decisions, alerts and AI caches.
    - Messages are deleted for both sides; the company sees "Deleted user".
    - Audit and moderation entries are kept with the actor/author shown as "Deleted user".
    - Stripe: the subscription is cancelled immediately (no refund) and the Stripe Customer is deleted.
    - Certificates become a tombstone showing "No longer valid".
    - Recruiter deletion: jobs closed; the company display name is kept for past applications and threads; personal data and KYC files are deleted.
    - Recruiter notes are excluded from the candidate's self-service export.
16. **OD16 New screens with no Figma (U44).** Recommended: build them from existing components and `docs/DESIGN_SYSTEM.md`, check them in a real browser, with no separate Figma step.

## Prep checklist

1. **P1** Delete or regenerate the stale `scratchpad/questions-merged.md`. It contradicts the JSON on M-017 and M-159. BACKEND_PLAN quotes the chosen option labels.
2. **P2** Create an uploads folder outside OneDrive (for example `C:\eujobs-data\uploads`) and set `UPLOAD_DIR` in `server/.env`.
3. **P3** Add the missing env vars: `UPLOAD_DIR`, `FILE_URL_SECRET`, `SEED_ADMIN_EMAIL`, `OPENAI_TRANSCRIBE_MODEL`. Keep `CLIENT_ORIGIN=http://localhost:5173` as the link base for now.
4. **P4** OpenAI: run one transcription of a short MP3 with the key (`gpt-4o-mini-transcribe`, then `whisper-1`).
5. **P5** Stripe sandbox checks:
   - Run a test Checkout (one-time and subscription) in PLN, SEK, DKK, CZK, HUF and RON; confirm the charged currency matches the request.
   - On the same Customer, cancel and re-subscribe in another currency.
   - Turn Adaptive Pricing off, or confirm that the session parameter disables it.
6. **P6** Stripe: save the Customer Portal settings in test mode (cancel at period end, update payment method, invoice history; plan switching off).
7. **P7** Stripe: under failed payments, set Smart Retries on with "cancel subscription" (or "mark unpaid") as the final action. Test renewals and failures with Test Clocks and card 4000 0000 0000 0341.
8. **P8** Stripe CLI: confirm `stripe listen --forward-to http://localhost:5000/<webhook path>` prints the same whsec as `STRIPE_WEBHOOK_SECRET`; re-login if the 90-day CLI key has expired.
9. **P9** Fonts: download Inter and Manrope TTF files with Latin Extended into `server/assets/fonts` for PDFs. The client switches to `@fontsource/inter` and `@fontsource/manrope`.
10. **P10** Download a top-10,000 common-password list (for example SecLists `10k-most-common.txt`) into `server/data`.
11. **P11** Gather test fixtures outside the repo (ffmpeg is not installed, so download them):
    - A 10–50 MB H.264/AAC MP4, a WebM, and a file over 500 MB for the limit test.
    - A text PDF, an image-only PDF and a DOCX CV.
    - JPG, PNG and WebP photos, and an ID-like image.
    - An SVG containing `<script>`.
    - An MP3 or M4A voice note under 25 MB.
12. **P12** Gmail: create test accounts with plus-aliases of the sending inbox (name+cand1@…) so real mail arrives, and keep test volume under 400 per day.
13. **P13** Atlas: confirm the cluster tier and storage headroom (about 12 KB per embedding) and that the IP access list includes the current IP.
14. **P14** Logo file, only if OD11 = supply your own.
15. **P15** Legal entity details for the Imprint (OD12).
16. **P16** npm packages:
    - Server: `express`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `multer`, `file-type`, `sharp`, `pdfjs-dist`, `mammoth`, `pdfkit`, `qrcode`, `nodemailer`, `stripe`, `openai`, `express-rate-limit`, `helmet`, `cors`, `archiver`, `libphonenumber-js`, `iso-639-1`, `marked`, `sanitize-html`, `dompurify`, `jsdom`, `luxon`.
    - Client: `@reduxjs/toolkit`, `react-redux`, `i18next`, `react-i18next`, `@fontsource/inter`, `@fontsource/manrope`.
17. **P17** cloudflared 2026.8.2 is already installed. Nothing to do until the Vercel demo; remember the 100 MB request cap and the changing URL.
