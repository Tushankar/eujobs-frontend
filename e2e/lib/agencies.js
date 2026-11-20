import { fixture } from '../fixtures/make.js'
import { uploadAs } from './candidates.js'
import { decide, saveCompany } from './recruiters.js'
import { api, db, login as apiLogin, mailTo, TEST_PASSWORD, uniqueEmail } from './testApi.js'

/* 2026-11-20 (agencies): agencies for the browser checks, created through the API like the recruiters. */

function check(result, what) {
  if (result.status >= 300) throw new Error(`${what} failed: ${result.status} ${JSON.stringify(result.body?.error ?? {})}`)
  return result.body
}

/** Signs an agency in through the API (the agency portal); returns the token. */
export async function agencyLogin(email, password = TEST_PASSWORD) {
  return check(await apiLogin(email, password, 'agency'), `agency login ${email}`).token
}

/** An agency that entered the email code; returns { email, token, fullName }. */
export async function registeredAgency(label) {
  const email = uniqueEmail(label.toLowerCase())
  const fullName = `${label} ${Date.now() % 100000}`
  const registered = check(
    await api('/auth/agency/register', {
      method: 'POST',
      body: { fullName, email, password: TEST_PASSWORD, acceptTerms: true, language: 'en', country: 'GB', jobTitle: 'Agency director', phone: '+44 20 7946 0999' },
    }),
    'agency register',
  )
  const { code } = (await mailTo(email, 'recruiter_email_code')).at(-1).params
  check(await api('/auth/email-code/verify', { method: 'POST', token: registered.token, body: { code } }), 'email code')
  return { email, token: registered.token, fullName }
}

/** An agency that finished onboarding and submitted for review. */
export async function submittedAgency(label) {
  const agency = await registeredAgency(label)
  const { token } = agency
  await saveCompany(token, { legalName: `${label} Staffing ${Date.now() % 100000} Ltd` })
  check(await uploadAs(token, '/recruiter/onboarding/documents', fixture('kyc-identity.pdf'), 'application/pdf', { type: 'identity' }), 'identity file')
  check(await uploadAs(token, '/recruiter/onboarding/documents', fixture('kyc-registration.png'), 'image/png', { type: 'registration' }), 'registration file')
  const { code } = check(await api('/recruiter/onboarding/phone/code', { method: 'POST', token, body: { phone: '+44 20 7946 0999' } }), 'phone code')
  check(await api('/recruiter/onboarding/phone/confirm', { method: 'POST', token, body: { code } }), 'phone confirm')
  const state = check(await api('/recruiter/onboarding/submit', { method: 'POST', token }), 'submit')
  return { ...agency, company: state.company }
}

/** An approved agency on Agency Plus (a subscription row, no Stripe), tour done; returns { email, token, userId, company }. */
export async function approvedAgency(label) {
  const agency = await submittedAgency(label)
  const me = check(await api('/me', { token: agency.token }), 'me')
  await decide(me.id, 'approved')
  const now = { $date: new Date().toISOString() }
  await db('subscriptions', 'insertOne', {
    doc: { userId: { $oid: me.id }, planKey: 'agency_plus', status: 'active', retrying: false, currency: 'GBP', amountMinor: 4900, cancelAtPeriodEnd: false, source: 'stripe', startedAt: now, createdAt: now, updatedAt: now },
  })
  const token = await agencyLogin(agency.email)
  check(await api('/me/tour', { method: 'POST', token }), 'tour')
  return { ...agency, token, userId: me.id }
}

/** Uploads the sample agreement, types its rules (the notice quoted from the PDF) and publishes version 1. */
export async function publishAgreement(token) {
  check(await uploadAs(token, '/agency/agreement', fixture('agency-agreement.pdf'), 'application/pdf'), 'agreement upload')
  const none = { value: null, clause: null }
  check(
    await api('/agency/agreement/draft/rules', {
      method: 'PUT',
      token,
      body: { exclusivity: { value: 'no_other_agency_work', clause: null }, noticeDays: { value: 7, clause: 'Either party may end an Assignment by giving seven days of written notice.' }, coolingOffDays: none, maxWeeklyHours: none },
    }),
    'agreement rules',
  )
  return check(await api('/agency/agreement/draft/publish', { method: 'POST', token }), 'agreement publish')
}

/** A day `offset` days from today (UTC), as "YYYY-MM-DD". */
export const dayFromToday = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
