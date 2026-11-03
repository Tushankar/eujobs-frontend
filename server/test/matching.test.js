import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { JobRun, ScheduledTask } from '../jobs/models.js'
import { cosine, embed, generate, toBuffer, toVector } from '../lib/ai.js'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { AiCache, AiUsage } from '../modules/ai/ai.model.js'
import { Application } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { CvVersion } from '../modules/cv/cv.model.js'
import { ShortlistEntry } from '../modules/discovery/discovery.model.js'
import { File } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { ensureDefaultPolicy } from '../modules/matching/matching.admin.js'
import { Embedding, MatchingPolicy, MatchingPolicyVersion, MatchResult } from '../modules/matching/matching.model.js'
import { locationMismatch, scoreMatch } from '../modules/matching/matching.score.js'
import { candidateText, ensureEmbeddings, jobText, scheduleRecompute } from '../modules/matching/matching.service.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { aiStub } from './helpers/ai.js'
import { api, auth, createUser, useTestDb } from './helpers/index.js'
import { approvedRecruiter, jobBody, listedCandidate } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

useTestDb([
  User, Company, Job, CandidateProfile, CvVersion, File, Application, ShortlistEntry, Subscription, VerificationSubmission,
  Embedding, MatchResult, AiCache, AiUsage, ScheduledTask, AuditEvent, MatchingPolicy, MatchingPolicyVersion,
])
useFakePlaces()
before(() => seedCatalog())
beforeEach(async () => {
  aiStub.reset()
  await ensureDefaultPolicy()
})
after(() => aiStub.reset())

const v1 = '/api/v1'
const tick = (now = new Date()) => api().post(`${v1}/_test/scheduler/tick`).send({ now: now.toISOString() })
const POLICY = { signals: { skills: true, experience: true, location: true }, weights: { sim: 0.6, skill: 0.4 }, thresholds: { strong: 75, good: 50 } }
const skills = (names) => names.map((name) => ({ name, key: name.toLocaleLowerCase() }))
const JOB = { requiredSkills: skills(['Figma', 'Design Systems', 'Research', 'Prototyping']), preferredSkills: skills(['Motion']), workPreference: 'hybrid', country: 'GB', remoteCountries: [] }
const PROFILE = { skills: skills(['Figma', 'Design Systems', 'Motion']), workPreference: 'hybrid', location: { countryCode: 'GB' } }

/** Every key anywhere in a JSON answer. */
function keysOf(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, found))
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) keysOf(item, found.add(key))
  return found
}

describe('the score (U5, C23, OQ-6g)', () => {
  it('blends similarity and the required-skill share, with Strong ≥ 75 and Good ≥ 50', () => {
    // sim = (0.6 − 0.2) / 0.4 = 1; skill = 2 of 4 required (Motion is preferred) → 100 × (0.6 + 0.2) = 80
    const strong = scoreMatch({ cos: 0.6, profile: PROFILE, job: JOB, policy: POLICY })
    assert.equal(strong.score, 80)
    assert.equal(strong.label, 'strong')
    assert.deepEqual(strong.matchedSkills, ['Figma', 'Design Systems', 'Motion'])
    assert.deepEqual(strong.missingSkills, ['Research', 'Prototyping'])
    // sim clamps at 0 below 0.20 and at 1 above 0.60
    assert.equal(scoreMatch({ cos: 0.1, profile: PROFILE, job: JOB, policy: POLICY }).score, 20)
    assert.equal(scoreMatch({ cos: 0.9, profile: PROFILE, job: JOB, policy: POLICY }).score, 80)
    // sim = 0.75 → 100 × (0.45 + 0.2) = 65 → Good
    assert.equal(scoreMatch({ cos: 0.5, profile: PROFILE, job: JOB, policy: POLICY }).label, 'good')
    assert.equal(scoreMatch({ cos: 0.1, profile: PROFILE, job: JOB, policy: POLICY }).label, null)
    const at = (score) => scoreMatch({ cos: 0.2 + (0.4 * score) / 100, profile: PROFILE, job: JOB, policy: { ...POLICY, signals: { ...POLICY.signals, skills: false } } })
    assert.deepEqual([75, 74, 50, 49].map((score) => at(score).label), ['strong', 'good', 'good', null])
  })

  it('renormalises the weights when a signal is off', () => {
    const noExperience = { ...POLICY, signals: { ...POLICY.signals, experience: false } }
    assert.equal(scoreMatch({ cos: 0.6, profile: PROFILE, job: JOB, policy: noExperience }).score, 50)
    const noSkills = { ...POLICY, signals: { ...POLICY.signals, skills: false } }
    assert.equal(scoreMatch({ cos: 0.5, profile: PROFILE, job: JOB, policy: noSkills }).score, 75)
  })

  it('caps a location or work-mode mismatch at 49 only while the location signal is on', () => {
    const elsewhere = { ...PROFILE, location: { countryCode: 'DE' } }
    const capped = scoreMatch({ cos: 0.6, profile: elsewhere, job: JOB, policy: POLICY })
    assert.equal(capped.score, 49)
    assert.equal(capped.locationCapped, true)
    assert.equal(capped.label, null)
    const off = { ...POLICY, signals: { ...POLICY.signals, location: false } }
    assert.equal(scoreMatch({ cos: 0.6, profile: elsewhere, job: JOB, policy: off }).score, 80)
  })

  it('defines a mismatch as OQ-6g says', () => {
    const remote = { ...JOB, workPreference: 'remote', country: 'REMOTE' }
    const remoteProfile = { ...PROFILE, workPreference: 'remote' }
    assert.equal(locationMismatch(PROFILE, JOB), false)
    assert.equal(locationMismatch({ ...PROFILE, location: { countryCode: 'FR' } }, JOB), true)
    assert.equal(locationMismatch({ ...PROFILE, workPreference: 'on_site' }, JOB), true)
    assert.equal(locationMismatch(remoteProfile, remote), false, 'an empty eligible list means every country')
    assert.equal(locationMismatch(remoteProfile, { ...remote, remoteCountries: ['IE', 'GB'] }), false)
    assert.equal(locationMismatch(remoteProfile, { ...remote, remoteCountries: ['IE'] }), true)
    assert.equal(locationMismatch(PROFILE, remote), true, 'a hybrid candidate and a remote job differ in work mode')
  })
})

describe('embeddings (U6)', () => {
  it('stores Float32 vectors and computes the cosine in Node', () => {
    const vector = Float32Array.from([0.5, -1, 2])
    assert.deepEqual(Array.from(toVector(toBuffer(vector))), [0.5, -1, 2])
    assert.equal(toBuffer(vector).length, 12)
    assert.ok(Math.abs(cosine(vector, vector) - 1) < 1e-6)
    assert.equal(cosine(Float32Array.from([1, 0]), Float32Array.from([0, 1])), 0)
  })

  it('builds the candidate and job texts and cuts the input at about 8,000 tokens', async () => {
    const profile = {
      headline: 'Product Designer',
      about: 'Calm tools',
      skills: skills(['Figma']),
      workHistory: [{ title: 'Designer', employer: 'Studio North', description: 'Led the kit' }],
      education: [{ degree: 'BA Design', institution: 'Art School' }],
    }
    assert.equal(candidateText(profile, 'CV text'), 'Product Designer\nCalm tools\nFigma\nDesigner · Studio North · Led the kit\nBA Design · Art School\nCV text')
    const job = { title: 'Senior Designer', brief: 'Lead design.', responsibilities: ['Run research'], requiredSkills: skills(['Figma']), preferredSkills: skills(['Motion']), level: 'senior', requiredLanguages: [{ code: 'de', minLevel: 'b2' }] }
    assert.equal(jobText(job), 'Senior Designer\nLead design.\nRun research\nFigma, Motion\nSenior\nGerman b2')
    await embed(['x'.repeat(40_000)])
    assert.equal(aiStub.calls[0].input[0].length, 32_000)
  })

  it('reuses the vector of an unchanged text, also for a new owner, and re-embeds a changed one', async () => {
    const [a, b] = [new User()._id, new User()._id]
    await ensureEmbeddings([{ ownerType: 'job', ownerId: a, text: 'Senior Product Designer' }])
    await ensureEmbeddings([{ ownerType: 'job', ownerId: a, text: 'Senior Product Designer' }, { ownerType: 'job', ownerId: b, text: 'Senior Product Designer' }])
    assert.equal(aiStub.calls.length, 1, 'one OpenAI call for one text')
    assert.equal(await Embedding.countDocuments({ ownerId: { $in: [a, b] } }), 2)
    await ensureEmbeddings([{ ownerType: 'job', ownerId: a, text: 'Lead Product Designer' }])
    assert.equal(aiStub.calls.length, 2)
  })
})

describe('generations: cache and cap (§2.9, OD13, U3)', () => {
  const schema = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false }
  const ask = (user, overrides = {}) => generate({ kind: 'job_summary', user, language: 'en', cacheKey: { job: 'one', version: 1 }, instructions: 'Summarise.', input: 'job', schema, ...overrides })

  it('answers a cache hit without OpenAI or the cap, per language and entity version', async () => {
    const user = await createUser()
    await ask(user)
    await ask(user)
    assert.equal(aiStub.calls.length, 1)
    assert.match(aiStub.calls[0].instructions, /Write every text value in English\./)
    await ask(user, { language: 'fr' })
    assert.match(aiStub.calls[1].instructions, /in French\./)
    await ask(user, { cacheKey: { job: 'one', version: 2 } })
    assert.equal(aiStub.calls.length, 3)
    assert.equal((await AiUsage.findOne({ userId: user._id })).count, 3)
    assert.equal(await AiCache.countDocuments({ kind: 'job_summary' }), 3)
  })

  it('refuses the 51st generation of a UTC day with the reset time; admins are exempt', async () => {
    const user = await createUser()
    await AiUsage.create({ userId: user._id, day: new Date().toISOString().slice(0, 10), count: 50 })
    await assert.rejects(ask(user, { cacheKey: null }), (error) => error.code === 'AI_DAILY_LIMIT' && error.params.resetAt.endsWith('T00:00:00.000Z'))
    assert.equal(aiStub.calls.length, 0)
    const admin = await createUser({ role: 'admin', isOwner: true })
    await ask(admin, { cacheKey: null })
    await ask(admin, { regenerate: true })
    assert.equal(await AiUsage.countDocuments({ userId: admin._id }), 0)
  })

  it('turns a failed call into AI_UNAVAILABLE and gives the reserved generation back', async () => {
    const user = await createUser()
    assert.equal((await api().post(`${v1}/_test/ai/fail-next`)).status, 204)
    await assert.rejects(ask(user), (error) => error.code === 'AI_UNAVAILABLE')
    assert.equal((await AiUsage.findOne({ userId: user._id })).count, 0)
    await ask(user)
    assert.equal((await AiUsage.findOne({ userId: user._id })).count, 1)
  })
})

describe('policies (M-048, M-049, P9-Q4)', () => {
  const policies = (user) => api().get(`${v1}/admin/matching/policies`).set(auth(user))
  const create = (user, body) => api().post(`${v1}/admin/matching/policies`).set(auth(user)).send(body)
  const signals = (user, id, body) => api().put(`${v1}/admin/matching/policies/${id}/signals`).set(auth(user)).send(body)
  const action = (user, id, name) => api().post(`${v1}/admin/matching/policies/${id}/${name}`).set(auth(user))
  const draft = { name: 'UK product roles', description: 'Product and design roles hired in the United Kingdom.' }

  it('creates a draft with every signal on, saves versions and refuses location alone', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true })
    const created = await create(owner, draft)
    assert.equal(created.status, 201)
    assert.equal(created.body.status, 'draft')
    assert.deepEqual(created.body.signals, { skills: true, experience: true, location: true })
    assert.equal(created.body.version, 1)
    const duplicate = await create(owner, { ...draft, name: 'uk PRODUCT roles' })
    assert.equal(duplicate.status, 422)
    assert.equal(duplicate.body.error.fields.name, 'taken')

    const saved = await signals(owner, created.body.id, { skills: true, experience: false, location: true })
    assert.equal(saved.body.version, 2)
    assert.deepEqual(saved.body.versions.map((version) => version.version), [2, 1])
    const locationOnly = await signals(owner, created.body.id, { skills: false, experience: false, location: true })
    assert.equal(locationOnly.status, 422)
    assert.equal(locationOnly.body.error.fields.signals, 'skills_or_experience')
    assert.equal(await MatchingPolicyVersion.countDocuments({ policyId: created.body.id }), 2, 'nothing saved')
    assert.equal(await ScheduledTask.countDocuments({ type: 'matching.recompute' }), 0, 'a draft does not recompute')
  })

  it('activates one policy at a time, recomputes, archives only drafts and audits each step', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true })
    const previous = await MatchingPolicy.findOne({ status: 'active' })
    const { body: created } = await create(owner, draft)
    const activated = await action(owner, created.id, 'activate')
    assert.equal(activated.body.status, 'active')
    assert.equal((await MatchingPolicy.findById(previous._id)).status, 'draft')
    assert.equal(await ScheduledTask.countDocuments({ type: 'matching.recompute', key: 'matching:all:all', status: 'pending' }), 1)
    assert.equal((await action(owner, created.id, 'archive')).status, 409, 'the active policy is not archived')
    assert.equal((await action(owner, previous._id, 'archive')).body.status, 'archived')
    assert.equal((await signals(owner, previous._id, POLICY.signals)).status, 409, 'an archived policy is read-only')
    const types = (await AuditEvent.find({ category: 'policy' }).sort({ at: 1 })).map((event) => event.type)
    assert.deepEqual(types, ['policy.created', 'policy.activated', 'policy.archived'])
    const { body } = await policies(owner)
    assert.deepEqual(body.items.map((item) => item.status).sort(), ['active', 'archived'])
  })

  it('needs ai.view to read and ai.manage to change', async () => {
    const role = await AdminRole.create({ name: 'AI readers', nameLower: 'ai readers', permissions: ['ai.view'] })
    const reader = await createUser({ role: 'admin', adminAccess: { roleId: role._id } })
    assert.equal((await policies(reader)).status, 200)
    assert.equal((await api().get(`${v1}/admin/ai/status`).set(auth(reader))).status, 200)
    const refused = await create(reader, draft)
    assert.equal(refused.status, 403)
    assert.equal(refused.body.error.code, 'PERMISSION_DENIED')
    await AdminRole.deleteOne({ _id: role._id })
  })

  it('suggests a description with OPENAI_MODEL, never cached and within 500 characters', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true, language: 'es' })
    aiStub.reply = () => ({ description: 'y'.repeat(600) })
    const response = await api().post(`${v1}/admin/matching/policies/suggest`).set(auth(owner)).send(draft)
    assert.equal(response.status, 200)
    assert.equal(response.body.description.length, 500)
    assert.equal(aiStub.calls[0].model, aiStub.models.main, 'OPENAI_MODEL (the stub names its own)')
    assert.match(aiStub.calls[0].instructions, /in Spanish\./)
    assert.equal(await AiCache.countDocuments({ kind: 'policy_suggestion' }), 0)
  })
})

describe('scores, relevance and who sees them (M-047, M-050, M-051, C6, U7)', () => {
  const plus = async (user) => Subscription.create({ userId: user._id, planKey: 'plus', status: 'active' })
  const designer = { skills: ['Figma', 'Design Systems'], headline: 'Product Designer', about: 'Senior product designer for design systems in Figma.' }

  async function market() {
    const { user: recruiter, company } = await approvedRecruiter()
    const { body: job } = await api().post(`${v1}/recruiter/jobs`).set(auth(recruiter)).send(jobBody())
    await api().patch(`${v1}/recruiter/jobs/${job.id}/status`).set(auth(recruiter)).send({ status: 'published' })
    const close = await listedCandidate({ fullName: 'Close Match', profile: designer })
    const far = await listedCandidate({ fullName: 'Far Match', city: 'berlin', profile: { ...designer, workPreference: 'remote' } })
    await tick()
    return { recruiter, company, job, close, far }
  }

  it('embeds, scores every pair and counts the relevant population (score ≥ Good)', async () => {
    const { job, close, far } = await market()
    assert.equal(await Embedding.countDocuments({ ownerType: 'job' }), 1)
    assert.equal(await Embedding.countDocuments({ ownerType: 'candidate' }), 2)
    const results = await MatchResult.find({ jobId: job.id })
    assert.equal(results.length, 2)
    const policy = await MatchingPolicy.findOne({ status: 'active' })
    assert.ok(results.every((result) => String(result.policyVersionId) === String(policy.versionId)))
    const byCandidate = new Map(results.map((result) => [String(result.candidateId), result]))
    assert.equal(byCandidate.get(String(far._id)).locationCapped, true)
    const relevant = results.filter((result) => result.label).map((result) => String(result.candidateId))
    // Only London candidates are in the GB market; Berlin's candidate is out of it anyway.
    assert.equal((await Job.findById(job.id)).relevantCount, relevant.filter((id) => id === String(close._id)).length)
  })

  it('gives Plus candidates with consent the score and keeps it from Free candidates and recruiters', async () => {
    const { recruiter, job, close } = await market()
    const free = await listedCandidate({ fullName: 'Free Reader', profile: designer })
    await plus(close)
    await tick()
    const card = async (user) => (await api().get(`${v1}/jobs/${job.id}`).set(auth(user))).body
    const scored = await card(close)
    assert.equal(typeof scored.match.score, 'number')
    assert.equal(scored.match.label, (await MatchResult.findOne({ jobId: job.id, candidateId: close._id })).label ?? null)
    assert.equal((await card(free)).match, null, 'Free sees the overlap label only (M-050)')
    await User.updateOne({ _id: close._id }, { 'privacy.matchingConsent': false })
    assert.equal((await card(close)).match, null, 'no score without matching consent')

    const answers = await Promise.all(
      [`/recruiter/candidates?jobId=${job.id}`, `/recruiter/candidates/${free._id}?jobId=${job.id}`, `/recruiter/jobs/${job.id}/relevant-talent`, '/recruiter/overview/talent', '/recruiter/overview'].map(
        async (path) => (await api().get(`${v1}${path}`).set(auth(recruiter))).body,
      ),
    )
    for (const body of answers) {
      const keys = keysOf(body)
      assert.ok(!['score', 'percent', 'label', 'sim'].some((key) => keys.has(key)), `no score in a recruiter answer: ${[...keys].join(',')}`)
    }
  })

  it('ranks Recommended by score and leaves applicants out of the talent cards', async () => {
    const { recruiter, job, close } = await market()
    const second = await listedCandidate({ fullName: 'Second Match', profile: { ...designer, skills: ['Figma'], about: 'Illustrator.' } })
    await scheduleRecompute('candidate', second._id)
    await tick()
    const scores = new Map((await MatchResult.find({ jobId: job.id })).map((result) => [String(result.candidateId), result.score]))
    const { body } = await api().get(`${v1}/recruiter/candidates?jobId=${job.id}&sort=recommended`).set(auth(recruiter))
    const ids = body.items.map((item) => item.id)
    assert.deepEqual(ids, [...ids].sort((a, b) => scores.get(b) - scores.get(a)))
    const talent = async () => (await api().get(`${v1}/recruiter/overview/talent`).set(auth(recruiter))).body.items.map((item) => item.id)
    assert.ok((await talent()).includes(String(close._id)))
    await Application.create({ candidateId: close._id, jobId: job.id, companyId: (await Job.findById(job.id)).companyId, status: 'applied', stageId: new User()._id, appliedAt: new Date(), consentAt: new Date() })
    assert.ok(!(await talent()).includes(String(close._id)), 'an applicant is not "talent worth meeting"')
  })

  it('removes a candidate who turns consent off from scores and counts on the next tick', async () => {
    const { job, close } = await market()
    const before = (await Job.findById(job.id)).relevantCount
    const response = await api().patch(`${v1}/candidate/settings/privacy`).set(auth(close)).send({ matchingConsent: false })
    assert.equal(response.status, 200)
    await tick()
    assert.equal(await Embedding.countDocuments({ ownerId: close._id }), 0)
    assert.equal(await MatchResult.countDocuments({ candidateId: close._id }), 0)
    assert.ok((await Job.findById(job.id)).relevantCount <= before)
    assert.equal((await Job.findById(job.id)).relevantCount, 0)
  })

  it('re-embeds an edited brief and recomputes; the nightly slot and the startup catch-up rescore everything', async () => {
    const { recruiter, job } = await market()
    const calls = aiStub.calls.length
    await api().put(`${v1}/recruiter/jobs/${job.id}`).set(auth(recruiter)).send(jobBody({ brief: 'Shape research operations for a growing design team across Europe and beyond.' }))
    await tick()
    assert.equal(aiStub.calls.length, calls + 1, 'only the job text changed')
    const computed = async () => (await MatchResult.findOne({ jobId: job.id })).computedAt.getTime()
    const first = await computed()
    // A tick at 03:00 after the last run, and the startup catch-up after 25 h, run the nightly recompute.
    await JobRun.updateOne({ name: 'relevance-nightly' }, { lastRunAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }, { upsert: true })
    await tick()
    assert.ok((await computed()) > first)
    assert.equal(aiStub.calls.length, calls + 1, 'nothing changed, so no new embedding')
  })

  it('shows admins the top 4 of a job with % and the code evidence', async () => {
    const { job, close } = await market()
    const owner = await createUser({ role: 'admin', isOwner: true })
    const { body } = await api().get(`${v1}/admin/matching/oversight?jobId=${job.id}`).set(auth(owner))
    assert.equal(body.job.id, job.id)
    assert.ok(body.candidates.length >= 1 && body.candidates.length <= 4)
    assert.equal(body.candidates[0].id, String(close._id))
    assert.equal(typeof body.candidates[0].score, 'number')
    assert.deepEqual(body.selected.evidence.matchedSkills, ['Figma', 'Design Systems'])
    assert.equal(body.selected.evidence.workMode.met, true)
    assert.equal(PLACES.london.countryCode, body.selected.evidence.location.countryCode)
  })
})
