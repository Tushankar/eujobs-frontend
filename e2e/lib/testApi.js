import { API_URL } from './env.js'
import { nextAppCode, rememberSecret } from './totp.js'

/*
 * Node-side calls to the test API (§2.13): /_test helpers plus plain API requests for setup.
 * Dates in /db bodies use EJSON ({ "$date": "…" }).
 */
export async function api(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    ...(body && { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

/** Clears the rate-limit stores and the captured mail. */
export const resetTestState = () => api('/_test/reset', { method: 'POST' })

/** Captured emails to `to` (optionally of one type), oldest first. */
export async function mailTo(to, type) {
  const query = new URLSearchParams({ to, ...(type && { type }) })
  return (await api(`/_test/mail?${query}`)).body.items
}

/** The latest captured email's link token. */
export async function linkToken(to, type) {
  const mail = (await mailTo(to, type)).at(-1)
  if (!mail) throw new Error(`no ${type} email captured`)
  return new URL(mail.params.link)
}

export async function db(collection, op, args = {}) {
  const result = await api('/_test/db', { method: 'POST', body: { collection, op, ...args } })
  if (result.status !== 200) throw new Error(`/_test/db ${op} ${collection} failed: ${result.status}`)
  return result.body.result
}

export const date = (value) => ({ $date: new Date(value).toISOString() })

/** Registers a candidate and opens the emailed link, so the account can sign in (onboarding still open). */
export async function verifiedCandidate(email, password, overrides = {}) {
  const registered = await api('/auth/candidate/register', {
    method: 'POST',
    body: { fullName: 'Test Candidate', email, password, acceptTerms: true, language: 'en', country: 'GB', ...overrides },
  })
  if (registered.status !== 201) throw new Error(`register failed: ${registered.status}`)
  const link = await linkToken(email, 'verify_email')
  await api('/auth/verify-email', { method: 'POST', body: { token: link.searchParams.get('token') } })
}

/**
 * POST /auth/login, finishing the sign-in second step (2026-11-18): the emailed code from the captured mail, or the
 * authenticator app (set up on an admin's first sign-in). Answers { status, body } like api(); body has the token.
 */
export async function login(email, password, portal) {
  const res = await api('/auth/login', { method: 'POST', body: { email, password, portal } })
  const verification = res.body?.verification
  if (!verification) return res
  const { challenge, method } = verification
  let code
  if (method === 'email') code = (await mailTo(email, 'login_code')).at(-1)?.params.code
  else {
    if (method === 'totp_setup') rememberSecret(email, (await api('/auth/login/setup', { method: 'POST', body: { challenge } })).body.secret)
    code = await nextAppCode(email)
  }
  return api('/auth/login/verify', { method: 'POST', body: { challenge, code } })
}

/** Password of the accounts scenarios create (passes the password rules). */
export const TEST_PASSWORD = 'Harbour-Lantern-58'

/** A unique, non-reserved test address (nothing is really sent in test mode). */
export const uniqueEmail = (label) => `${label}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@inbox.localworkman.eu`
