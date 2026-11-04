import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { ProfileView } from '../modules/discovery/discovery.model.js'
import { Job, SavedJob } from '../modules/jobs/jobs.model.js'
import { User } from '../modules/users/users.model.js'
import { JobRun } from '../jobs/models.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { api, auth, createUser, useTestDb } from './helpers/index.js'
import { approvedRecruiter, jobBody, listedCandidate } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

useTestDb([User, Company, Job, SavedJob, CandidateProfile, ProfileView, JobRun])
useFakePlaces()
before(() => seedCatalog())

const create = (user, body) => api().post('/api/v1/recruiter/jobs').set(auth(user)).send(body)
const update = (user, id, body) => api().put(`/api/v1/recruiter/jobs/${id}`).set(auth(user)).send(body)
const setStatus = (user, id, status) => api().patch(`/api/v1/recruiter/jobs/${id}/status`).set(auth(user)).send({ status })
async function published(user, body) {
  const { id } = (await create(user, jobBody(body))).body
  const res = await setStatus(user, id, 'published')
  assert.equal(res.status, 200, JSON.stringify(res.body))
  return res.body
}
const findJobs = (user, query = '') => api().get(`/api/v1/jobs${query}`).set(auth(user))

describe('recruiter jobs (§3.7, M-033 … M-041, P4-D6 … D8)', () => {
  it('creates a draft from step 1 only and publishes once every step is valid (M-039)', async () => {
    const { user } = await approvedRecruiter()
    const draft = await create(user, { title: 'Designer', employmentType: 'contract' })
    assert.deepEqual([draft.status, draft.body.status, draft.body.company.displayName], [201, 'draft', `${user.fullName} Studio`])
    const invalid = await setStatus(user, draft.body.id, 'published')
    assert.equal(invalid.status, 422)
    assert.equal(invalid.body.error.params.step, 'responsibilities')
    assert.deepEqual(Object.keys(invalid.body.error.fields).sort(), ['brief', 'experienceYears', 'level', 'requiredSkills', 'workPreference'])

    const saved = await update(user, draft.body.id, jobBody({ title: 'Designer', employmentType: 'contract' }))
    assert.equal(saved.body.status, 'draft')
    const live = await setStatus(user, draft.body.id, 'published')
    assert.deepEqual([live.body.status, Boolean(live.body.firstPublishedAt)], ['published', true])
  })

  it('applies the field limits with the wizard step (M-033, U26)', async () => {
    const { user } = await approvedRecruiter()
    const cases = [
      [{ title: 'UX' }, { title: 'too_short' }, 'basics'],
      [{ requiredSkills: ['Figma', 'figma'] }, { requiredSkills: 'duplicate' }, 'required-skills'],
      [{ preferredSkills: ['FIGMA'] }, { preferredSkills: 'in_both' }, 'preferred-skills'],
      [{ experienceYears: 51 }, { experienceYears: 'too_big' }, 'experience'],
      [{ salary: { min: 0, max: 100_000_001, period: 'year' } }, { 'salary.max': 'too_big' }, 'location'],
      [{ salary: { min: 90000, max: 80000, period: 'year' } }, { 'salary.max': 'below_min' }, 'location'],
      [{ requiredSkills: Array.from({ length: 21 }, (_, i) => `Skill ${i}`) }, { requiredSkills: 'too_many' }, 'required-skills'],
      [{ responsibilities: ['x'.repeat(301)] }, { 'responsibilities.0': 'too_long' }, 'responsibilities'],
      [{ requiredLanguages: [{ code: 'de', minLevel: 'b2' }, { code: 'de', minLevel: 'c1' }] }, { requiredLanguages: 'duplicate' }, 'experience'],
    ]
    for (const [override, fields, step] of cases) {
      const res = await create(user, jobBody(override))
      assert.equal(res.status, 422, JSON.stringify(override))
      assert.deepEqual(res.body.error.fields, fields)
      assert.equal(res.body.error.params.step, step)
    }
  })

  it('locks the salary currency to the job country, EUR for Remote (M-131, OD2, OQ-6i)', async () => {
    const { user } = await approvedRecruiter()
    const warsaw = await create(user, jobBody({ placeId: PLACES.warsaw.placeId, salary: { min: 9000, max: 12000, period: 'month' } }))
    assert.deepEqual([warsaw.body.country, warsaw.body.salary.currency, warsaw.body.salary.period], ['PL', 'PLN', 'month'])
    const remote = await create(user, jobBody({ workPreference: 'remote', placeId: null, remoteCountries: ['pl', 'DE'] }))
    assert.deepEqual([remote.body.country, remote.body.location, remote.body.remoteCountries, remote.body.salary.currency], ['REMOTE', null, ['PL', 'DE'], 'EUR'])
    const bad = await create(user, jobBody({ workPreference: 'remote', remoteCountries: ['US'] }))
    assert.deepEqual(bad.body.error.fields, { remoteCountries: 'invalid' })
  })

  it('follows the status transitions, deletes drafts only and respects the restricted lock (M-038, M-040, M-167)', async () => {
    const { user, company } = await approvedRecruiter()
    const job = await published(user)
    assert.equal((await setStatus(user, job.id, 'draft')).body.error.code, 'CONFLICT')
    assert.equal((await setStatus(user, job.id, 'paused')).body.status, 'paused')
    assert.equal((await setStatus(user, job.id, 'closed')).body.status, 'closed')
    const reopened = await setStatus(user, job.id, 'published')
    assert.deepEqual([reopened.body.status, reopened.body.firstPublishedAt], ['published', job.firstPublishedAt])
    assert.equal((await api().delete(`/api/v1/recruiter/jobs/${job.id}`).set(auth(user))).body.error.code, 'CONFLICT')
    const draft = await create(user, jobBody())
    assert.equal((await api().delete(`/api/v1/recruiter/jobs/${draft.body.id}`).set(auth(user))).status, 204)

    await setStatus(user, job.id, 'paused')
    await Job.updateOne({ _id: job.id }, { restricted: { reason: 'Misleading pay', at: new Date() } })
    const locked = await setStatus(user, job.id, 'published')
    assert.deepEqual([locked.status, locked.body.error.code], [409, 'LOCKED'])

    const list = (await api().get('/api/v1/recruiter/jobs').set(auth(user))).body
    assert.deepEqual(list.statusCounts, { published: 0, paused: 1, draft: 0, closed: 0 })
    // Another company's job is not found.
    const other = await approvedRecruiter()
    assert.equal((await api().get(`/api/v1/recruiter/jobs/${job.id}`).set(auth(other.user))).status, 404)
    assert.ok(company)
  })

  it('keeps live edits publishable (M-037)', async () => {
    const { user } = await approvedRecruiter()
    const job = await published(user)
    const renamed = await update(user, job.id, jobBody({ title: 'Lead Product Designer' }))
    assert.equal(renamed.body.title, 'Lead Product Designer')
    const broken = await update(user, job.id, jobBody({ brief: 'Too short' }))
    assert.deepEqual([broken.body.error.fields, broken.body.error.params.step], [{ brief: 'too_short' }, 'responsibilities'])
  })

  it('counts relevant candidates with the skill fallback (M-051, P4-D9) and refreshes nightly (U7)', async () => {
    const { user } = await approvedRecruiter()
    await listedCandidate({ profile: { skills: ['Figma'] } })
    await listedCandidate({ city: 'berlin', profile: { skills: ['Figma'], rightToWork: [{ region: 'uk', status: 'citizen_settled' }] } })
    await listedCandidate({ city: 'berlin', profile: { skills: ['Figma'] } })
    await listedCandidate({ profile: { skills: ['Excel'] } })
    await listedCandidate({ profile: { skills: ['Figma'] }, privacy: { discoverable: false, resumeVisible: false, matchingConsent: true } })
    const job = await published(user)
    assert.equal(job.relevantCount, 2)
    await listedCandidate({ profile: { skills: ['Design Systems'] } })
    await api().post('/api/v1/_test/scheduler/tick').send({ now: new Date().toISOString() })
    assert.equal((await Job.findById(job.id)).relevantCount, 3)
  })

  it('runs the quality checks and suggests skills of the company market (M-060, P4-D5)', async () => {
    const { user } = await approvedRecruiter()
    const checks = (await api().post('/api/v1/recruiter/jobs/quality-checks').set(auth(user)).send({ title: 'Designer', requiredSkills: ['Figma'] })).body.items
    assert.deepEqual(checks.map((check) => [check.key, check.ok]), [
      ['title_words', false],
      ['brief_length', false],
      ['responsibilities', false],
      ['required_skills', false],
      ['salary_range', false],
    ])
    await published(user, { requiredSkills: ['Figma', 'Framer'] })
    await published(user, { requiredSkills: ['Figma'], preferredSkills: [] })
    const berlin = await approvedRecruiter({ city: 'berlin' })
    await published(berlin.user, { placeId: PLACES.berlin.placeId, requiredSkills: ['Fotografie'] })
    const suggestions = (await api().get('/api/v1/skills/suggestions?q=f').set(auth(user))).body.items
    assert.deepEqual(suggestions, ['Figma', 'Framer', 'Fotografie'])
  })

  it('refuses recruiters who are not approved and candidates (M-151)', async () => {
    const pending = await createUser({ role: 'recruiter', status: 'pending_review' })
    assert.equal((await api().get('/api/v1/recruiter/jobs').set(auth(pending))).body.error.code, 'RECRUITER_NOT_APPROVED')
    const candidate = await createUser()
    assert.equal((await api().get('/api/v1/recruiter/jobs').set(auth(candidate))).body.error.code, 'FORBIDDEN')
  })
})

describe('candidate job browsing (M-043, M-044, M-052, M-053, OD2, U8, U25, P4-Q4)', () => {
  it('lists only published jobs of approved, unrestricted companies in the picker view', async () => {
    const acme = await approvedRecruiter()
    const suspended = await approvedRecruiter()
    const visible = await published(acme.user)
    await published(suspended.user)
    await User.updateOne({ _id: suspended.user._id }, { status: 'suspended' })
    const restricted = await published(acme.user, { title: 'Restricted role' })
    await Job.updateOne({ _id: restricted.id }, { restricted: { reason: 'x', at: new Date() } })
    await create(acme.user, jobBody({ title: 'Draft role' }))
    const remote = await published(acme.user, { workPreference: 'remote', placeId: null, remoteCountries: ['PL'] })
    await published(acme.user, { placeId: PLACES.berlin.placeId, title: 'Berlin role' })

    const candidate = await createUser({ pickerCountry: 'GB' })
    const gb = (await findJobs(candidate)).body
    assert.deepEqual(gb.items.map((job) => job.id), [visible.id])
    assert.deepEqual(gb.view, { country: 'GB', currency: 'GBP' })
    assert.deepEqual(gb.items[0].company.displayName, `${acme.user.fullName} Studio`)

    const remoteViewer = await createUser({ pickerCountry: 'REMOTE' })
    const remoteView = (await findJobs(remoteViewer)).body
    assert.deepEqual([remoteView.items.map((job) => job.id), remoteView.view.currency], [[remote.id], 'EUR'])
    assert.deepEqual((await findJobs(remoteViewer, '?eligible=PL')).body.items.map((job) => job.id), [remote.id])
    assert.deepEqual((await findJobs(remoteViewer, '?eligible=DE')).body.items, [])
  })

  it('filters by keywords, level, work mode, city and annual salary, and sorts (§3.6, U25, P4-Q4)', async () => {
    const { user } = await approvedRecruiter()
    const monthly = await published(user, { title: 'Brand Designer', level: 'mid', salary: { min: 5000, max: 6000, period: 'month' } })
    const yearly = await published(user, { title: 'Design Lead', level: 'lead', workPreference: 'on_site', salary: { min: 65000, max: 70000, period: 'year' } })
    const unpaid = await published(user, { title: 'Junior Designer', level: 'junior', salary: null, placeId: PLACES.manchester.placeId })
    const candidate = await createUser({ pickerCountry: 'GB', language: 'es' })
    const ids = async (query) => (await findJobs(candidate, query)).body.items.map((job) => job.id)

    // 6,000 a month = 72,000 a year.
    assert.deepEqual(await ids('?salaryMin=71000'), [monthly.id])
    assert.deepEqual(await ids('?sort=salary'), [monthly.id, yearly.id, unpaid.id])
    assert.deepEqual(await ids('?level=lead,junior&sort=newest'), [unpaid.id, yearly.id])
    assert.deepEqual(await ids('?workPreference=on_site'), [yearly.id])
    assert.deepEqual(await ids(`?placeId=${PLACES.manchester.placeId}`), [unpaid.id])
    // Every keyword must match; labels count in the user's language ("Presencial" = on-site).
    assert.deepEqual(await ids('?q=presencial%20LEAD'), [yearly.id])
    assert.deepEqual(await ids('?q=figma%20brand'), [monthly.id])
    assert.deepEqual(await ids('?q=nothing'), [])
  })

  it('shows the overlap label, the U8 recommendations and the saved-job states (M-043, M-065)', async () => {
    const { user } = await approvedRecruiter()
    const strong = await published(user, { requiredSkills: ['Figma', 'Design Systems'] })
    const weak = await published(user, { title: 'Research Lead', requiredSkills: ['Figma', 'User Research'], preferredSkills: [] })
    const none = await published(user, { title: 'Data Analyst', requiredSkills: ['SQL'], preferredSkills: [] })
    const candidate = await listedCandidate({ profile: { skills: ['Figma', 'Design Systems', 'Prototyping'] } })

    const list = (await findJobs(candidate)).body.items
    assert.deepEqual(list.map((job) => [job.id, job.overlap.count, job.overlap.total]), [
      [strong.id, 3, 3],
      [weak.id, 1, 2],
      [none.id, 0, 1],
    ])
    assert.equal('score' in list[0], false)
    const recommended = (await api().get('/api/v1/jobs/recommended').set(auth(candidate))).body
    assert.deepEqual([recommended.items.map((job) => job.id), recommended.newThisWeek], [[strong.id, weak.id], 2])

    assert.equal((await api().put(`/api/v1/candidate/saved-jobs/${weak.id}`).set(auth(candidate))).body.saved, true)
    await setStatus(user, weak.id, 'paused')
    const details = await api().get(`/api/v1/jobs/${weak.id}`).set(auth(candidate))
    assert.deepEqual([details.status, details.body.accepting, details.body.saved], [200, false, true])
    const stranger = await createUser()
    assert.equal((await api().get(`/api/v1/jobs/${weak.id}`).set(auth(stranger))).status, 404)
    assert.equal((await api().put(`/api/v1/candidate/saved-jobs/${weak.id}`).set(auth(stranger))).status, 404)
    const saved = (await api().get('/api/v1/candidate/saved-jobs').set(auth(candidate))).body.items
    assert.deepEqual(saved.map((job) => [job.id, job.accepting]), [[weak.id, false]])

    const overview = (await api().get('/api/v1/candidate/overview').set(auth(candidate))).body
    assert.deepEqual(overview, { recommended: { count: 1, newThisWeek: 1, byScore: false }, savedJobs: 1, profileViews: { last30: 0, previous30: 0 } })
  })

  it('marks the company verified while it is approved and its recruiter active (P10-Q8)', async () => {
    const { user, company } = await approvedRecruiter()
    const job = await published(user)
    const candidate = await listedCandidate()
    const cardOf = async () => (await findJobs(candidate)).body.items.find((item) => item.id === job.id)
    assert.equal((await cardOf()).company.verified, true)
    assert.equal((await api().get(`/api/v1/jobs/${job.id}`).set(auth(candidate))).body.company.verified, true)
    await api().put(`/api/v1/candidate/saved-jobs/${job.id}`).set(auth(candidate))
    assert.equal((await api().get('/api/v1/jobs/recommended').set(auth(candidate))).body.items[0].company.verified, true)

    // Suspended: the job leaves Find jobs (M-044); where the candidate still sees it, the tick is gone.
    await User.updateOne({ _id: user._id }, { status: 'suspended' })
    assert.equal(await cardOf(), undefined)
    const details = (await api().get(`/api/v1/jobs/${job.id}`).set(auth(candidate))).body
    assert.deepEqual([details.accepting, details.company.verified], [false, false])
    const [saved] = (await api().get('/api/v1/candidate/saved-jobs').set(auth(candidate))).body.items
    assert.deepEqual([saved.id, saved.company.verified], [job.id, false])

    // Active again but the company never approved (no verifiedAt): no tick either.
    await User.updateOne({ _id: user._id }, { status: 'active' })
    await Company.updateOne({ _id: company._id }, { $unset: { verifiedAt: 1 } })
    assert.equal((await cardOf()).company.verified, false)
  })

  it('hides drafts from candidates (P4-17)', async () => {
    const { user } = await approvedRecruiter()
    const draft = await create(user, jobBody())
    const candidate = await createUser()
    assert.equal((await api().get(`/api/v1/jobs/${draft.body.id}`).set(auth(candidate))).status, 404)
  })
})
