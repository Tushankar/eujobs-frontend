import { PLACES } from '../../server/seed/data/places.js'
import { fixture } from '../fixtures/make.js'
import { uploadAs } from './candidates.js'
import { seedCredentials } from './env.js'
import { api, db, mailTo, TEST_PASSWORD, uniqueEmail } from './testApi.js'

/* Recruiters for the Phase 4 checks, created through the API so each scenario starts from a known state. */

export const COMPANY = {
  website: 'example-studio.example.com',
  businessEmail: 'hello@example-studio.example.com',
  industry: 'Design services',
  size: '11_50',
  businessAddress: '1 Sample Street',
}

function check(result, what) {
  if (result.status >= 300) throw new Error(`${what} failed: ${result.status} ${JSON.stringify(result.body?.error ?? {})}`)
  return result.body
}

/** Signs in through the API; returns the token. */
export async function login(email, portal = 'recruiter', password = TEST_PASSWORD) {
  return check(await api('/auth/login', { method: 'POST', body: { email, password, portal } }), `login ${email}`).token
}

export const ownerToken = () => login(seedCredentials.email(), 'admin', seedCredentials.password)

/** A recruiter who entered the email code (status onboarding); returns { email, token, fullName }. */
export async function registeredRecruiter(label, overrides = {}) {
  const email = uniqueEmail(label.toLowerCase())
  const fullName = `${label} ${Date.now() % 100000}`
  const registered = check(
    await api('/auth/recruiter/register', {
      method: 'POST',
      body: { fullName, email, password: TEST_PASSWORD, acceptTerms: true, language: 'en', country: 'GB', jobTitle: 'Talent lead', phone: '+44 20 7946 0999', ...overrides },
    }),
    'recruiter register',
  )
  const { code } = (await mailTo(email, 'recruiter_email_code')).at(-1).params
  check(await api('/auth/email-code/verify', { method: 'POST', token: registered.token, body: { code } }), 'email code')
  return { email, token: registered.token, fullName }
}

/** Saves the company (step 2) in `city`; returns the onboarding state. */
export const saveCompany = (token, { legalName, city = 'london' } = {}) =>
  api('/recruiter/onboarding/company', { method: 'PUT', token, body: { legalName: legalName ?? `Studio ${Date.now() % 100000} Ltd`, ...COMPANY, placeId: PLACES[city].placeId } }).then((result) =>
    check(result, 'company'),
  )

/** Steps 2–4 and submit: company, the two required KYC files, the on-screen phone code. */
export async function submittedRecruiter(label, { city = 'london', ...overrides } = {}) {
  const recruiter = await registeredRecruiter(label, overrides)
  const { token } = recruiter
  await saveCompany(token, { city, legalName: `${label} Studio ${Date.now() % 100000} Ltd` })
  check(await uploadAs(token, '/recruiter/onboarding/documents', fixture('kyc-identity.pdf'), 'application/pdf', { type: 'identity' }), 'identity file')
  check(await uploadAs(token, '/recruiter/onboarding/documents', fixture('kyc-registration.png'), 'image/png', { type: 'registration' }), 'registration file')
  const { code } = check(await api('/recruiter/onboarding/phone/code', { method: 'POST', token, body: { phone: '+44 20 7946 0999' } }), 'phone code')
  check(await api('/recruiter/onboarding/phone/confirm', { method: 'POST', token, body: { code } }), 'phone confirm')
  const state = check(await api('/recruiter/onboarding/submit', { method: 'POST', token }), 'submit')
  return { ...recruiter, company: state.company }
}

/** An Owner decision on a recruiter (by user id). */
export async function decide(userId, decision, reason) {
  return check(await api(`/admin/moderation/accounts/${userId}/decision`, { method: 'POST', token: await ownerToken(), body: { decision, reason } }), `decision ${decision}`)
}

/** A submitted recruiter approved by the Owner; returns { email, token, fullName, company, userId }. */
/**
 * An approved recruiter. On Recruiter Plus unless `plus: false` (§3.22), as the scenarios written before Phase 11c
 * expect; that plan is an active subscription row written straight to the test database (no Stripe, no rows in
 * Payments). P11c-02 buys it through the real Checkout instead.
 */
export async function approvedRecruiter(label, { plus = true, tour = false, ...options } = {}) {
  const recruiter = await submittedRecruiter(label, options)
  const me = check(await api('/me', { token: recruiter.token }), 'me')
  await decide(me.id, 'approved')
  if (plus) await giveRecruiterPlus(me.id)
  // The first-login product tour is marked done so it does not cover the Overview, unless `tour: true`.
  if (!tour) check(await api('/me/tour', { method: 'POST', token: recruiter.token }), 'tour')
  return { ...recruiter, userId: me.id }
}

/** Recruiter Plus without Stripe: an active subscription row for `userId` (test setups only). */
export async function giveRecruiterPlus(userId) {
  const now = new Date()
  await db('subscriptions', 'insertOne', {
    doc: { userId: { $oid: userId }, planKey: 'recruiter_plus', status: 'active', retrying: false, currency: 'GBP', amountMinor: 4900, cancelAtPeriodEnd: false, source: 'stripe', startedAt: { $date: now.toISOString() }, createdAt: { $date: now.toISOString() }, updatedAt: { $date: now.toISOString() } },
  })
}

/** A publishable job body (M-033); `city` or workPreference remote. */
export function jobBody({ city = 'london', ...overrides } = {}) {
  return {
    title: 'Senior Product Designer',
    employmentType: 'full_time',
    brief: 'Lead the design of our hiring tools, from research to shipped product, with a small and kind team.',
    responsibilities: ['Run research', 'Design flows', 'Ship with engineers'],
    requiredSkills: ['Figma', 'Design Systems'],
    preferredSkills: ['Prototyping'],
    level: 'senior',
    experienceYears: 5,
    workPreference: 'hybrid',
    placeId: PLACES[city]?.placeId ?? null,
    salary: { min: 60000, max: 80000, period: 'year' },
    ...overrides,
  }
}

/** Creates a draft and, unless `draft`, publishes it; returns the job. */
export async function postJob(token, body, { draft = false } = {}) {
  const job = check(await api('/recruiter/jobs', { method: 'POST', token, body }), 'create job')
  if (draft) return job
  return check(await api(`/recruiter/jobs/${job.id}/status`, { method: 'PATCH', token, body: { status: 'published' } }), 'publish job')
}
