import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { PLACES } from '../../server/seed/data/places.js'
import { API_URL } from './env.js'
import { api, TEST_PASSWORD, uniqueEmail, verifiedCandidate } from './testApi.js'

/* Candidates for the Phase 3 checks, created through the API so each scenario starts from a known state. */

/** A verified candidate who finished onboarding (London, remote); returns { email, token, user }. */
export async function onboardedCandidate(label, overrides = {}) {
  const email = uniqueEmail(label.toLowerCase())
  await verifiedCandidate(email, TEST_PASSWORD, { fullName: `${label} ${Date.now() % 100000}`, ...overrides })
  const { body } = await api('/auth/login', { method: 'POST', body: { email, password: TEST_PASSWORD, portal: 'candidate' } })
  const preferences = await api('/candidate/onboarding/preferences', { method: 'PUT', token: body.token, body: { workPreference: 'remote', placeId: PLACES.london.placeId } })
  if (preferences.status !== 200) throw new Error(`onboarding preferences failed: ${preferences.status}`)
  const completed = await api('/candidate/onboarding/complete', { method: 'POST', token: body.token })
  return { email, token: body.token, user: completed.body }
}

/** A multipart upload from Node (e.g. evidence for a check). */
export async function uploadAs(token, path, filePath, type, fields = {}) {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  form.append('file', new Blob([readFileSync(filePath)], { type }), basename(filePath))
  const response = await fetch(`${API_URL}/api/v1${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
  return { status: response.status, body: await response.json() }
}
