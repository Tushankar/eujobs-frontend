import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { CvAccessRequest, CvVersion } from '../modules/cv/cv.model.js'
import { CandidateNote, ProfileView, RecruiterActivity, ShortlistEntry } from '../modules/discovery/discovery.model.js'
import { File, FileAccessLog } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { textPdf } from './helpers/fixtures.js'
import { api, attach, auth, mailTo, useTestDb, useTestUploads } from './helpers/index.js'
import { approvedRecruiter, jobBody, listedCandidate } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

useTestDb([User, Company, Job, CandidateProfile, ShortlistEntry, CandidateNote, RecruiterActivity, ProfileView, CvVersion, CvAccessRequest, File, FileAccessLog, VerificationSubmission])
useTestUploads()
useFakePlaces()
before(() => seedCatalog())

const DAY_MS = 24 * 60 * 60 * 1000
const isoDay = (offsetDays) => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10)
const find = async (user, query = '') => (await api().get(`/api/v1/recruiter/candidates${query}`).set(auth(user))).body
const names = (body) => body.items.map((item) => item.fullName).sort()
// The factory profile is listable by its stored flag; an upload recomputes completeness, so the flag is set again.
async function uploadCv(user) {
  await attach(api().post('/api/v1/candidate/cv/versions').set(auth(user)), await textPdf('Curriculum vitae'), 'cv.pdf', 'application/pdf')
  await CandidateProfile.updateOne({ userId: user._id }, { 'completeness.complete': true })
}

describe('Find candidates (M-054, M-055, M-056, OD4, OQ-6a, OQ-6f)', () => {
  it('lists only verified, discoverable, consenting, complete candidates in the picker country', async () => {
    const { user } = await approvedRecruiter({ pickerCountry: 'DE' })
    await listedCandidate({ fullName: 'Lives in Berlin', city: 'berlin' })
    await listedCandidate({ fullName: 'EU citizen in London', profile: { rightToWork: [{ region: 'eu', status: 'citizen_settled' }] } })
    await listedCandidate({ fullName: 'Valid EU permit', profile: { rightToWork: [{ region: 'eu', status: 'visa_permit', permitExpiresOn: isoDay(30) }] } })
    await listedCandidate({ fullName: 'Expired EU permit', profile: { rightToWork: [{ region: 'eu', status: 'visa_permit', permitExpiresOn: isoDay(-1) }] } })
    await listedCandidate({ fullName: 'Needs sponsorship', profile: { rightToWork: [{ region: 'eu', status: 'needs_sponsorship' }] } })
    await listedCandidate({ fullName: 'Hidden', city: 'berlin', privacy: { discoverable: false, resumeVisible: false, matchingConsent: true } })
    await listedCandidate({ fullName: 'No consent', city: 'berlin', privacy: { discoverable: true, resumeVisible: false, matchingConsent: false } })
    await listedCandidate({ fullName: 'Incomplete', city: 'berlin', profile: { completeness: { complete: false, done: 9, total: 12, missing: ['phone'] } } })
    await listedCandidate({ fullName: 'Unverified email', city: 'berlin', emailVerifiedAt: null })
    await listedCandidate({ fullName: 'Restricted', city: 'berlin', profile: { restricted: { reason: 'x', at: new Date() } } })
    assert.deepEqual(names(await find(user)), ['EU citizen in London', 'Lives in Berlin', 'Valid EU permit'])

    // OD4: "Has right to work in Germany" leaves out residence-only candidates.
    assert.deepEqual(names(await find(user, '?rightToWork=1')), ['EU citizen in London', 'Valid EU permit'])
    // OQ-6a: Remote = work preference remote, any country.
    await listedCandidate({ fullName: 'Remote in Lisbon', city: 'lisbon', profile: { workPreference: 'remote' } })
    user.pickerCountry = 'REMOTE'
    await user.save()
    assert.deepEqual(names(await find(user)), ['Remote in Lisbon'])
  })

  it('filters by language level, availability, city, verified and keywords, and sorts by overlap (P4-D10)', async () => {
    const { user } = await approvedRecruiter()
    const ana = await listedCandidate({ fullName: 'Ana Díaz', profile: { skills: ['Figma', 'Design Systems'], languages: [{ code: 'de', level: 'b2' }], availability: 'within_1_month' } })
    await listedCandidate({ fullName: 'Ben Ode', profile: { skills: ['Figma'], languages: [{ code: 'de', level: 'a2' }] } })
    await listedCandidate({ fullName: 'Cleo Park', city: 'manchester', profile: { skills: ['Excel'], education: [], workHistory: [] } })
    await VerificationSubmission.create({ userId: ana._id, category: 'identity', status: 'approved' })

    assert.deepEqual(names(await find(user, '?language=de&languageLevel=b2')), ['Ana Díaz'])
    assert.deepEqual(names(await find(user, '?availability=within_1_month')), ['Ana Díaz'])
    assert.deepEqual(names(await find(user, `?placeId=${PLACES.manchester.placeId}`)), ['Cleo Park'])
    assert.deepEqual(names(await find(user, '?q=diaz%20figma')), ['Ana Díaz'])
    const verified = await find(user, '?verified=1')
    assert.deepEqual(verified.items.map((item) => [item.fullName, item.verification.count, item.verification.required]), [])
    await VerificationSubmission.create({ userId: ana._id, category: 'academic', status: 'approved' })
    await VerificationSubmission.create({ userId: ana._id, category: 'employment', status: 'approved' })
    assert.deepEqual(names(await find(user, '?verified=1')), ['Ana Díaz'])

    const job = (await api().post('/api/v1/recruiter/jobs').set(auth(user)).send(jobBody())).body
    await api().patch(`/api/v1/recruiter/jobs/${job.id}/status`).set(auth(user)).send({ status: 'published' })
    const ranked = await find(user)
    assert.deepEqual(ranked.matchJob, { id: job.id, title: job.title })
    assert.deepEqual(ranked.items.map((item) => [item.fullName, item.overlap.count]), [
      ['Ana Díaz', 2],
      ['Ben Ode', 1],
      ['Cleo Park', 0],
    ])
    assert.deepEqual(ranked.items[0].overlap.missing, [])
    assert.equal('score' in ranked.items[0], false)
    assert.deepEqual((await find(user, '?sort=name')).items.map((item) => item.fullName), ['Ana Díaz', 'Ben Ode', 'Cleo Park'])
  })
})

describe('candidate profile, views, shortlist, notes and activity (M-079 … M-081, M-184, P4-D11)', () => {
  it('records one view per recruiter per day and 404s for hidden candidates', async () => {
    const { user } = await approvedRecruiter()
    const candidate = await listedCandidate()
    const profile = await api().get(`/api/v1/recruiter/candidates/${candidate._id}`).set(auth(user))
    assert.deepEqual([profile.status, profile.body.about.length > 0, profile.body.workHistory.length], [200, true, 1])
    await api().get(`/api/v1/recruiter/candidates/${candidate._id}`).set(auth(user))
    assert.equal(await ProfileView.countDocuments({ candidateId: candidate._id }), 1)
    const overview = (await api().get('/api/v1/candidate/overview').set(auth(candidate))).body
    assert.deepEqual(overview.profileViews, { last30: 1, previous30: 0 })

    await User.updateOne({ _id: candidate._id }, { 'privacy.discoverable': false })
    assert.equal((await api().get(`/api/v1/recruiter/candidates/${candidate._id}`).set(auth(user))).status, 404)
  })

  it('keeps one company shortlist and counts candidates who are no longer available (M-079)', async () => {
    const { user, company } = await approvedRecruiter()
    const first = await listedCandidate({ fullName: 'First' })
    const second = await listedCandidate({ fullName: 'Second' })
    await api().put(`/api/v1/recruiter/shortlist/${first._id}`).set(auth(user))
    await api().put(`/api/v1/recruiter/shortlist/${first._id}`).set(auth(user))
    await api().put(`/api/v1/recruiter/shortlist/${second._id}`).set(auth(user))
    let list = (await api().get('/api/v1/recruiter/shortlist').set(auth(user))).body
    assert.deepEqual([names(list), list.hiddenCount, list.items[0].addedBy], [['First', 'Second'], 0, user.fullName])

    await User.updateOne({ _id: second._id }, { 'privacy.discoverable': false })
    list = (await api().get('/api/v1/recruiter/shortlist').set(auth(user))).body
    assert.deepEqual([names(list), list.hiddenCount], [['First'], 1])
    await api().delete(`/api/v1/recruiter/shortlist/${first._id}`).set(auth(user))
    const events = await RecruiterActivity.find({ companyId: company._id, candidateId: first._id }).sort({ at: 1 })
    assert.deepEqual(events.map((event) => event.type), ['shortlisted', 'unshortlisted'])
  })

  it('stores one note per company with updatedBy, up to 5,000 characters (M-080)', async () => {
    const { user } = await approvedRecruiter()
    const candidate = await listedCandidate()
    const tooLong = await api().put(`/api/v1/recruiter/candidates/${candidate._id}/note`).set(auth(user)).send({ text: 'x'.repeat(5001) })
    assert.deepEqual(tooLong.body.error.fields, { text: 'too_long' })
    const saved = await api().put(`/api/v1/recruiter/candidates/${candidate._id}/note`).set(auth(user)).send({ text: 'Strong portfolio.' })
    assert.deepEqual([saved.body.text, saved.body.updatedBy, Boolean(saved.body.updatedAt)], ['Strong portfolio.', user.fullName, true])
    const other = await approvedRecruiter()
    assert.equal((await api().get(`/api/v1/recruiter/candidates/${candidate._id}/note`).set(auth(other.user))).body.text, '')
    const activity = (await api().get(`/api/v1/recruiter/candidates/${candidate._id}/activity`).set(auth(user))).body.items
    assert.deepEqual(activity.map((event) => [event.type, event.actor.name]), [['note_updated', user.fullName]])
  })
})

describe('CV access and earlier-version requests (M-029, M-187, U19, P4-D12, P4-D13)', () => {
  it('shares the live CV only with resumeVisible, runs the request flow and logs downloads', async () => {
    const { user, company } = await approvedRecruiter()
    const candidate = await listedCandidate()
    await uploadCv(candidate)
    await uploadCv(candidate)
    const [latest, earlier] = await CvVersion.find({ userId: candidate._id }).sort({ number: -1 })

    let cv = (await api().get(`/api/v1/recruiter/candidates/${candidate._id}/cv`).set(auth(user))).body
    assert.deepEqual([cv.live, cv.resumeVisible, cv.shared], [null, false, []])

    const request = await api().post(`/api/v1/recruiter/candidates/${candidate._id}/cv-requests`).set(auth(user)).send({ reason: 'verify_employment', details: 'The 2021 role.' })
    assert.equal(request.status, 201)
    assert.equal(request.body.requests[0].status, 'pending')
    const again = await api().post(`/api/v1/recruiter/candidates/${candidate._id}/cv-requests`).set(auth(user)).send({ reason: 'other' })
    assert.equal(again.body.error.code, 'CONFLICT')
    const mail = mailTo(candidate.email, 'cv_request')[0]
    assert.deepEqual([mail.params.company, mail.params.reason], [company.displayName, 'Verify employment history'])

    const pending = (await api().get('/api/v1/candidate/cv/requests').set(auth(candidate))).body.items
    assert.deepEqual(pending.map((item) => [item.company.displayName, item.status]), [[company.displayName, 'pending']])
    const decide = (body) => api().post(`/api/v1/candidate/cv/requests/${pending[0].id}/decision`).set(auth(candidate)).send(body)
    assert.deepEqual((await decide({ decision: 'approved' })).body.error.fields, { versionId: 'required' })
    const decided = await decide({ decision: 'approved', versionId: String(earlier._id) })
    assert.deepEqual([decided.body.items[0].status, decided.body.items[0].versionNumber], ['approved', 1])

    cv = (await api().get(`/api/v1/recruiter/candidates/${candidate._id}/cv`).set(auth(user))).body
    assert.deepEqual(cv.shared.map((version) => version.number), [1])
    assert.equal((await api().get(cv.shared[0].url)).status, 200)
    const downloads = (await api().get('/api/v1/candidate/cv/downloads').set(auth(candidate))).body.items
    assert.deepEqual(downloads.map((item) => [item.company.displayName, item.version.number]), [[company.displayName, 1]])

    await User.updateOne({ _id: candidate._id }, { 'privacy.resumeVisible': true })
    cv = (await api().get(`/api/v1/recruiter/candidates/${candidate._id}/cv`).set(auth(user))).body
    assert.equal(cv.live.number, latest.number)

    // P4-D13: a new live CV shows on this company's timeline.
    await uploadCv(candidate)
    const types = (await api().get(`/api/v1/recruiter/candidates/${candidate._id}/activity`).set(auth(user))).body.items.map((event) => event.type)
    assert.deepEqual(types, ['cv_updated', 'cv_download', 'cv_request_decided', 'cv_request'])
  })
})

describe('recruiter overview and talent (A: recruiter A9, M-201)', () => {
  it('counts open positions, recommended candidates and the shortlist; talent leaves out shortlisted people', async () => {
    const { user } = await approvedRecruiter()
    const best = await listedCandidate({ fullName: 'Best', profile: { skills: ['Figma', 'Design Systems', 'Prototyping'] } })
    await listedCandidate({ fullName: 'Good', profile: { skills: ['Figma'] } })
    await listedCandidate({ fullName: 'Other', profile: { skills: ['Excel'] } })
    const job = (await api().post('/api/v1/recruiter/jobs').set(auth(user)).send(jobBody())).body
    await api().patch(`/api/v1/recruiter/jobs/${job.id}/status`).set(auth(user)).send({ status: 'published' })
    await api().put(`/api/v1/recruiter/shortlist/${best._id}`).set(auth(user))
    const overview = (await api().get('/api/v1/recruiter/overview').set(auth(user))).body
    assert.deepEqual(overview, { openPositions: 1, recommendedCandidates: 2, shortlisted: 1, applications: 0 })
    const talent = (await api().get('/api/v1/recruiter/overview/talent').set(auth(user))).body.items
    assert.deepEqual(talent.map((item) => [item.fullName, item.bestJob.title]), [['Good', job.title]])
    const relevant = (await api().get(`/api/v1/recruiter/jobs/${job.id}/relevant-talent`).set(auth(user))).body
    assert.deepEqual([relevant.items.map((item) => item.fullName), relevant.total], [['Best', 'Good'], 2])
  })
})
