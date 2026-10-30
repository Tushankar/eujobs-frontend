import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { before, describe, it } from 'node:test'
import sharp from 'sharp'
import { absolutePath } from '../lib/files.js'
import { computeCompleteness } from '../modules/candidates/candidates.completeness.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { File } from '../modules/files/files.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { image, MB, padded } from './helpers/fixtures.js'
import { api, attach, auth, createUser, useTestDb, useTestUploads } from './helpers/index.js'
import { TORONTO, useFakePlaces } from './helpers/places.js'

useTestDb([User, CandidateProfile, VerificationSubmission, File])
useTestUploads()
before(() => seedCatalog())
const { calls } = useFakePlaces()

const BASICS = {
  fullName: 'Ada Lovelace',
  headline: 'Product Designer',
  placeId: PLACES.warsaw.placeId,
  about: 'I design calm, accessible products for complex domains.',
  yearsExperience: 5,
  skills: ['Figma', 'Design Systems'],
  workPreference: 'remote',
  availability: 'available_now',
}
const WORK = { title: 'Designer', employer: 'Studio', start: '2020-01', end: '2023-06' }
const EDUCATION = { institution: 'Warsaw University', degree: 'BA Design', start: '2014-09', end: '2018-06' }

const put = (user, path, body) => api().put(`/api/v1/candidate/${path}`).set(auth(user)).send(body)
const post = (user, path, body) => api().post(`/api/v1/candidate/${path}`).set(auth(user)).send(body)
const patch = (user, path, body) => api().patch(`/api/v1/candidate/${path}`).set(auth(user)).send(body)
const fields = (res) => res.body.error?.fields

describe('completeness (§3.2, M-015, M-023)', () => {
  const emptyProfile = () => ({ workHistory: [], education: [], languages: [], rightToWork: [], skills: [], links: {} })
  const keys = (result) => result.items.map((item) => item.key)

  it('counts 10 items for an empty profile and 0 done', () => {
    const result = computeCompleteness({ user: { fullName: 'A' }, profile: emptyProfile(), approved: new Set() })
    assert.equal(result.total, 10)
    assert.equal(result.done, 0)
    assert.deepEqual(keys(result), ['basics', 'work_history', 'education', 'languages', 'right_to_work', 'photo', 'links', 'live_cv', 'phone', 'check_identity'])
  })

  it('adds the academic and employment checks only with such an entry (N 10 to 12)', () => {
    const user = { fullName: 'A' }
    const withEducation = { ...emptyProfile(), education: [{}] }
    assert.equal(computeCompleteness({ user, profile: withEducation, approved: new Set() }).total, 11)
    const withBoth = { ...withEducation, workHistory: [{}] }
    const result = computeCompleteness({ user, profile: withBoth, approved: new Set(['academic']) })
    assert.equal(result.total, 12)
    assert.deepEqual(keys(result).slice(-3), ['check_identity', 'check_academic', 'check_employment'])
    assert.equal(result.items.find((item) => item.key === 'check_academic').done, true)
  })

  it('treats the opt-outs as done without adding a check', () => {
    const profile = { ...emptyProfile(), noWorkExperience: true, noFormalQualification: true }
    const result = computeCompleteness({ user: { fullName: 'A' }, profile, approved: new Set() })
    assert.equal(result.total, 10)
    assert.deepEqual(result.items.filter((item) => item.done).map((item) => item.key), ['work_history', 'education'])
  })

  it('needs every basic field (salary excluded) and is complete when all items are done', () => {
    const profile = {
      headline: 'H',
      location: { placeId: 'p' },
      about: 'About me',
      yearsExperience: 0,
      skills: [{ name: 'X' }],
      workPreference: 'remote',
      workHistory: [{}],
      education: [{}],
      languages: [{}],
      rightToWork: [{}],
      photo: { fileId: 'f' },
      links: { portfolio: 'https://a.example.com' },
      liveCvVersionId: 'v',
    }
    const user = { fullName: 'A', phone: { verifiedAt: new Date() } }
    const result = computeCompleteness({ user, profile, approved: new Set(['identity', 'academic', 'employment']) })
    assert.deepEqual([result.complete, result.done, result.total, result.percent], [true, 12, 12, 100])
    const noHeadline = computeCompleteness({ user, profile: { ...profile, headline: '' }, approved: new Set(['identity', 'academic', 'employment']) })
    assert.deepEqual([noHeadline.complete, noHeadline.percent], [false, 92])
  })
})

describe('PUT /candidate/profile (P3-D9)', () => {
  it('saves the core fields with the city resolved through the proxy, never coordinates', async () => {
    const user = await createUser({ fullName: 'Old Name' })
    const res = await put(user, 'profile', { ...BASICS, salaryMin: { amount: 12000, currency: 'PLN', period: 'month' } })
    assert.equal(res.status, 200)
    assert.equal(res.body.fullName, 'Ada Lovelace')
    assert.deepEqual(res.body.location, PLACES.warsaw)
    assert.deepEqual(res.body.salaryMin, { amount: 12000, currency: 'PLN', period: 'month' })
    assert.equal(res.body.completeness.items.find((item) => item.key === 'basics').done, true)
    const stored = await CandidateProfile.collection.findOne({ userId: user._id })
    assert.deepEqual(Object.keys(stored.location).sort(), ['city', 'countryCode', 'placeId'])
    assert.deepEqual(stored.completeness.missing.includes('basics'), false)
    // An unchanged city is not looked up again.
    calls.length = 0
    await put(user, 'profile', BASICS)
    assert.equal(calls.length, 0)
  })

  it('applies the field rules', async () => {
    const user = await createUser()
    const cases = [
      [{ headline: 'x'.repeat(61) }, { headline: 'too_long' }],
      [{ about: 'x'.repeat(19) }, { about: 'too_short' }],
      [{ yearsExperience: 51 }, { yearsExperience: 'too_big' }],
      [{ skills: Array.from({ length: 13 }, (_, i) => `Skill ${i}`) }, { skills: 'too_many' }],
      [{ skills: ['x'.repeat(31)] }, { 'skills.0': 'too_long' }],
      [{ skills: ['Figma', 'figma'] }, { skills: 'duplicate' }],
      [{ salaryMin: { amount: 100, currency: 'EUR', period: 'year' } }, { 'salaryMin.currency': 'not_allowed' }],
      [{ salaryMin: { amount: 100_000_001, currency: 'PLN', period: 'year' } }, { 'salaryMin.amount': 'too_big' }],
      [{ placeId: TORONTO.placeId }, { placeId: 'not_allowed' }],
    ]
    for (const [change, expected] of cases) {
      const res = await put(user, 'profile', { ...BASICS, ...change })
      assert.equal(res.status, 422, JSON.stringify(change))
      assert.deepEqual(fields(res), expected)
    }
  })

  it('is for candidates only', async () => {
    const recruiter = await createUser({ role: 'recruiter' })
    assert.equal((await api().get('/api/v1/candidate/profile').set(auth(recruiter))).body.error.code, 'FORBIDDEN')
  })
})

describe('work history and education (M-018, M-019)', () => {
  it('adds, edits and deletes entries with month rules', async () => {
    const user = await createUser()
    assert.deepEqual(fields(await post(user, 'profile/work-history', { ...WORK, end: '2019-12' })), { end: 'before_start' })
    assert.deepEqual(fields(await post(user, 'profile/work-history', { ...WORK, end: null })), { end: 'required' })
    assert.deepEqual(fields(await post(user, 'profile/work-history', { ...WORK, start: '2020-13' })), { start: 'invalid' })
    const created = await post(user, 'profile/work-history', { ...WORK, current: true })
    assert.equal(created.status, 200)
    const [entry] = created.body.workHistory
    assert.deepEqual({ ...entry, id: undefined }, { ...WORK, id: undefined, end: null, current: true, description: '' })
    const edited = await patch(user, `profile/work-history/${entry.id}`, { ...WORK, description: 'Led the design system.' })
    assert.equal(edited.body.workHistory[0].description, 'Led the design system.')
    const deleted = await api().delete(`/api/v1/candidate/profile/work-history/${entry.id}`).set(auth(user))
    assert.deepEqual(deleted.body.workHistory, [])
    assert.equal((await api().delete(`/api/v1/candidate/profile/work-history/${entry.id}`).set(auth(user))).status, 404)
  })

  it('allows the opt-out only while the list is empty, and an entry clears it', async () => {
    const user = await createUser()
    const optedOut = await put(user, 'profile/education/none', { none: true })
    assert.equal(optedOut.body.noFormalQualification, true)
    assert.equal(optedOut.body.completeness.items.find((item) => item.key === 'education').done, true)
    const added = await post(user, 'profile/education', { ...EDUCATION, stillStudying: true })
    assert.equal(added.body.noFormalQualification, false)
    assert.equal(added.body.education[0].end, null)
    assert.deepEqual(fields(await put(user, 'profile/education/none', { none: true })), { none: 'not_allowed' })
    assert.equal(added.body.completeness.total, 11)
  })

  it('keeps at most 20 entries (M-031)', async () => {
    const user = await createUser()
    const profile = await CandidateProfile.create({ userId: user._id, workHistory: Array.from({ length: 20 }, () => ({ ...WORK })) })
    assert.equal(profile.workHistory.length, 20)
    const res = await post(user, 'profile/work-history', WORK)
    assert.deepEqual([res.status, fields(res), res.body.error.params], [422, { workHistory: 'too_many' }, { max: 20 }])
  })
})

describe('languages, right to work, links and certificates', () => {
  it('stores unique ISO 639-1 languages with a level (M-020, P3-D5)', async () => {
    const user = await createUser()
    assert.deepEqual(fields(await put(user, 'profile/languages', { languages: [{ code: 'xx', level: 'b2' }] })), { 'languages.0.code': 'invalid' })
    const duplicate = [{ code: 'pl', level: 'native' }, { code: 'pl', level: 'b2' }]
    assert.deepEqual(fields(await put(user, 'profile/languages', { languages: duplicate })), { languages: 'duplicate' })
    const res = await put(user, 'profile/languages', { languages: [{ code: 'pl', level: 'native' }, { code: 'en', level: 'c1' }] })
    assert.deepEqual(res.body.languages, [{ code: 'pl', level: 'native' }, { code: 'en', level: 'c1' }])
  })

  it('keeps one right-to-work entry per region with an expiry for permits (M-021, P3-D4, U27)', async () => {
    const user = await createUser()
    const twice = [{ region: 'eu', status: 'citizen_settled' }, { region: 'eu', status: 'needs_sponsorship' }]
    assert.deepEqual(fields(await put(user, 'profile/right-to-work', { rightToWork: twice })), { rightToWork: 'duplicate' })
    const permit = [{ region: 'uk', status: 'visa_permit' }]
    assert.deepEqual(fields(await put(user, 'profile/right-to-work', { rightToWork: permit })), { 'rightToWork.0.permitExpiresOn': 'required' })
    const res = await put(user, 'profile/right-to-work', {
      rightToWork: [{ region: 'eu', status: 'citizen_settled' }, { region: 'uk', status: 'visa_permit', permitExpiresOn: '2020-01-31' }],
    })
    const uk = res.body.rightToWork.find((entry) => entry.region === 'uk')
    assert.equal(uk.permitExpired, true)
    assert.equal(res.body.completeness.items.find((item) => item.key === 'right_to_work').done, true)
    const again = await put(user, 'profile/right-to-work', { rightToWork: [{ region: 'uk', status: 'visa_permit', permitExpiresOn: '2031-01-31' }] })
    assert.deepEqual(again.body.rightToWork.map((entry) => [entry.id, entry.permitExpired]), [[uk.id, false]])
  })

  it('accepts a linkedin.com/in link and an https portfolio (M-022)', async () => {
    const user = await createUser()
    assert.deepEqual(fields(await put(user, 'profile/links', { linkedin: 'https://linkedin.com/company/acme' })), { linkedin: 'invalid' })
    assert.deepEqual(fields(await put(user, 'profile/links', { portfolio: 'http://ada.example.com' })), { portfolio: 'invalid' })
    const res = await put(user, 'profile/links', { linkedin: 'https://uk.linkedin.com/in/ada-l/', portfolio: '' })
    assert.deepEqual(res.body.links, { linkedin: 'https://uk.linkedin.com/in/ada-l/', portfolio: '' })
    assert.equal(res.body.completeness.items.find((item) => item.key === 'links').done, true)
  })

  it('manages certificates with an optional file (M-025, P3-D3)', async () => {
    const user = await createUser()
    const certificate = { name: 'UX Certificate', issuer: 'NN/g', issuedOn: '2024-05', expiresOn: '2024-01' }
    assert.deepEqual(fields(await post(user, 'profile/certificates', certificate)), { expiresOn: 'before_start' })
    const created = await post(user, 'profile/certificates', { ...certificate, expiresOn: null, url: 'https://cert.example.com/1' })
    const [{ id }] = created.body.certificates
    const withFile = await attach(api().put(`/api/v1/candidate/profile/certificates/${id}/file`).set(auth(user)), await image('png'), 'cert.png', 'image/png')
    assert.equal(withFile.status, 200)
    assert.equal(withFile.body.certificates[0].file.name, 'cert.png')
    assert.match(withFile.body.certificates[0].file.url, /^\/api\/v1\/files\//)
    const removed = await api().delete(`/api/v1/candidate/profile/certificates/${id}`).set(auth(user))
    assert.deepEqual(removed.body.certificates, [])
    assert.equal(await File.countDocuments({ purpose: 'certificate_file' }), 0)
  })
})

describe('photo (M-013)', () => {
  it('stores a square 400 and 96 pixel photo and shows it in /me', async () => {
    const user = await createUser()
    const res = await attach(api().post('/api/v1/candidate/profile/photo').set(auth(user)), await image('png', { width: 800, height: 500 }), 'me.png', 'image/png')
    assert.equal(res.status, 200)
    assert.ok(res.body.photoUrl)
    const stored = await File.find({ ownerId: user._id, purpose: 'photo' })
    const sizes = await Promise.all(stored.map(async (file) => (await sharp(await readFile(absolutePath(file))).metadata()).width))
    assert.deepEqual(sizes.sort((a, b) => a - b), [96, 400])
    const me = await api().get('/api/v1/me').set(auth(user))
    const small = await api().get(me.body.photoUrl)
    assert.equal(small.status, 200)
    assert.equal(small.headers['content-type'], 'image/webp')
    assert.equal(me.body.completeness.items.find((item) => item.key === 'photo').done, true)
    // A new photo replaces both files.
    await attach(api().post('/api/v1/candidate/profile/photo').set(auth(user)), await image('jpeg'), 'me.jpg', 'image/jpeg')
    assert.equal(await File.countDocuments({ ownerId: user._id, purpose: 'photo' }), 2)
    const deleted = await api().delete('/api/v1/candidate/profile/photo').set(auth(user))
    assert.equal(deleted.body.photoUrl, null)
    assert.equal(await File.countDocuments({ ownerId: user._id, purpose: 'photo' }), 0)
  })

  it('refuses other types and sizes (M-185)', async () => {
    const user = await createUser()
    const upload = (buffer, name, type) => attach(api().post('/api/v1/candidate/profile/photo').set(auth(user)), buffer, name, type)
    const gif = await upload(await image('gif'), 'me.gif', 'image/gif')
    assert.deepEqual([gif.status, gif.body.error.code], [422, 'FILE_TYPE_NOT_ALLOWED'])
    const big = await upload(padded(await image('png'), 6 * MB), 'big.png', 'image/png')
    assert.deepEqual([big.status, big.body.error.code], [413, 'FILE_TOO_LARGE'])
    const missing = await api().post('/api/v1/candidate/profile/photo').set(auth(user))
    assert.deepEqual(fields(missing), { file: 'required' })
  })
})

describe('identity reset on a name change (U27)', () => {
  it('stops counting an approved identity check after the name changes', async () => {
    const user = await createUser()
    await VerificationSubmission.create({ userId: user._id, category: 'identity', evidenceType: 'passport', status: 'approved' })
    const before = await api().get('/api/v1/me').set(auth(user))
    assert.equal(before.body.completeness.items.find((item) => item.key === 'check_identity').done, true)
    await api().patch('/api/v1/me').set(auth(user)).send({ fullName: 'New Name' })
    const after = await api().get('/api/v1/me').set(auth(user))
    assert.equal(after.body.completeness.items.find((item) => item.key === 'check_identity').done, false)
    assert.ok((await VerificationSubmission.findOne({ userId: user._id })).resetAt)
  })
})

describe('onboarding (M-014, M-136, P3-D2)', () => {
  it('saves preferences, then completes and moves the header country to the profile country', async () => {
    const user = await createUser({ pickerCountry: 'GB', language: 'en' })
    assert.deepEqual(fields(await post(user, 'onboarding/complete')), { preferences: 'required' })
    const prefs = await put(user, 'onboarding/preferences', { workPreference: 'remote', placeId: PLACES.warsaw.placeId, salaryMin: { amount: 12000, currency: 'PLN', period: 'month' } })
    assert.equal(prefs.status, 200)
    assert.deepEqual(prefs.body.location, PLACES.warsaw)
    const done = await post(user, 'onboarding/complete')
    assert.equal(done.status, 200)
    assert.equal(done.body.onboardingCompleted, true)
    assert.equal(done.body.pickerCountry, 'PL')
    assert.equal(done.body.language, 'en')
  })

  it('keeps an explicit language when the country moves (M-134)', async () => {
    const user = await createUser({ pickerCountry: 'GB', language: 'fr', languageExplicit: true })
    await put(user, 'onboarding/preferences', { workPreference: 'hybrid', placeId: PLACES.madrid.placeId })
    const done = await post(user, 'onboarding/complete')
    assert.deepEqual([done.body.pickerCountry, done.body.language], ['ES', 'fr'])
    const other = await createUser({ pickerCountry: 'GB', language: 'en' })
    await put(other, 'onboarding/preferences', { workPreference: 'hybrid', placeId: PLACES.madrid.placeId })
    assert.equal((await post(other, 'onboarding/complete')).body.language, 'es')
  })
})

describe('privacy settings (M-187)', () => {
  it('defaults to discoverable, CV hidden, matching on, and persists changes', async () => {
    const user = await createUser()
    assert.deepEqual((await api().get('/api/v1/candidate/settings/privacy').set(auth(user))).body, {
      discoverable: true,
      resumeVisible: false,
      matchingConsent: true,
    })
    await patch(user, 'settings/privacy', { resumeVisible: true, matchingConsent: false })
    assert.deepEqual((await api().get('/api/v1/candidate/settings/privacy').set(auth(user))).body, {
      discoverable: true,
      resumeVisible: true,
      matchingConsent: false,
    })
  })
})
