import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { ScheduledTask } from '../jobs/models.js'
import { AdminRole } from '../modules/admin/admin.model.js'
import { AiCache, AiUsage, ExplanationFeedback } from '../modules/ai/ai.model.js'
import { Application } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { CvVersion } from '../modules/cv/cv.model.js'
import { SavedJob } from '../modules/jobs/jobs.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Course, Enrollment } from '../modules/learning/learning.model.js'
import { ensureDefaultPolicy } from '../modules/matching/matching.admin.js'
import { Embedding, MatchingPolicy, MatchingPolicyVersion, MatchResult } from '../modules/matching/matching.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { aiStub } from './helpers/ai.js'
import { api, auth, createUser, useTestDb } from './helpers/index.js'
import { approvedRecruiter, jobBody, listedCandidate } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

useTestDb([
  User, Company, Job, SavedJob, CandidateProfile, CvVersion, Application, Subscription, AiCache, AiUsage, ExplanationFeedback,
  Embedding, MatchResult, ScheduledTask, MatchingPolicy, MatchingPolicyVersion, Conversation, Message, Course, Enrollment,
])
useFakePlaces()
before(() => seedCatalog())
beforeEach(async () => {
  aiStub.reset()
  await ensureDefaultPolicy()
})
after(() => aiStub.reset())

const v1 = '/api/v1'
const designer = { skills: ['Figma', 'Design Systems'], headline: 'Product Designer', about: 'Senior product designer for design systems in Figma.' }
const plus = async (user) => {
  await Subscription.create({ userId: user._id, planKey: 'plus', status: 'active' })
  return user
}
const responses = () => aiStub.calls.filter((call) => call.kind === 'response')

async function market() {
  const { user: recruiter, company } = await approvedRecruiter()
  const { body: job } = await api().post(`${v1}/recruiter/jobs`).set(auth(recruiter)).send(jobBody({ requiredSkills: ['Figma', 'Design Systems', 'Prototyping'] }))
  await api().patch(`${v1}/recruiter/jobs/${job.id}/status`).set(auth(recruiter)).send({ status: 'published' })
  const candidate = await plus(await listedCandidate({ profile: designer }))
  return { recruiter, company, job, candidate }
}

/** Every key anywhere in a JSON answer. */
function keysOf(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, found))
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) keysOf(item, found.add(key))
  return found
}

describe('job summaries (M-058, M-059, P9-Q5)', () => {
  it('summarises a visible job for Plus, from the cache the second time, and refuses Free with PLAN_REQUIRED', async () => {
    const { job, candidate } = await market()
    aiStub.reply = () => ({ overview: 'A senior design role.', highlights: ['Design systems'], considerations: ['Check the salary'] })
    const first = await api().post(`${v1}/jobs/${job.id}/ai-summary`).set(auth(candidate))
    assert.equal(first.status, 200)
    assert.equal(first.body.overview, 'A senior design role.')
    const again = await api().post(`${v1}/jobs/${job.id}/ai-summary`).set(auth(candidate))
    assert.deepEqual(again.body, first.body)
    assert.equal(responses().length, 1, 'the second open is a cache hit')
    assert.equal((await AiUsage.findOne({ userId: candidate._id })).count, 1, 'the cap counts the first only')
    const free = await listedCandidate()
    const refused = await api().post(`${v1}/jobs/${job.id}/ai-summary`).set(auth(free))
    assert.equal(refused.status, 402)
    assert.equal(refused.body.error.params.entitlement, 'ai')
  })

  it('lets an approved recruiter summarise only their own jobs', async () => {
    const { recruiter, job } = await market()
    assert.equal((await api().post(`${v1}/jobs/${job.id}/ai-summary`).set(auth(recruiter))).status, 200)
    const { user: other } = await approvedRecruiter()
    assert.equal((await api().post(`${v1}/jobs/${job.id}/ai-summary`).set(auth(other))).status, 404)
  })

  it('lists jobs for admins with jobs.view, summarises in their language and regenerates without counting', async () => {
    const { job } = await market()
    const owner = await createUser({ role: 'admin', isOwner: true, language: 'fr' })
    const list = await api().get(`${v1}/admin/jobs`).set(auth(owner))
    assert.equal(list.status, 200)
    assert.deepEqual(list.body.items.map((item) => item.id), [job.id])
    assert.equal(list.body.items[0].company.displayName.length > 0, true)
    let count = 0
    aiStub.reply = () => ({ overview: `Résumé ${++count}`, highlights: [], considerations: [] })
    assert.equal((await api().get(`${v1}/admin/jobs/${job.id}/ai-summary`).set(auth(owner))).body.overview, 'Résumé 1')
    assert.match(responses()[0].instructions, /in French\./)
    assert.equal((await api().get(`${v1}/admin/jobs/${job.id}/ai-summary`).set(auth(owner))).body.overview, 'Résumé 1', 'cached')
    const regenerated = await api().post(`${v1}/admin/jobs/${job.id}/ai-summary/regenerate`).set(auth(owner))
    assert.equal(regenerated.body.overview, 'Résumé 2')
    assert.equal((await api().get(`${v1}/admin/jobs/${job.id}/ai-summary`).set(auth(owner))).body.overview, 'Résumé 2', 'the regenerated text replaces the cache')
    assert.equal(await AiUsage.countDocuments({ userId: owner._id }), 0)

    const role = await AdminRole.create({ name: 'Readers no jobs', nameLower: 'readers no jobs', permissions: ['ai.view'] })
    const reader = await createUser({ role: 'admin', adminAccess: { roleId: role._id } })
    for (const path of ['/admin/jobs', `/admin/jobs/${job.id}/ai-summary`]) {
      const refused = await api().get(`${v1}${path}`).set(auth(reader))
      assert.equal(refused.status, 403)
      assert.equal(refused.body.error.code, 'PERMISSION_DENIED')
    }
    await AdminRole.deleteOne({ _id: role._id })
  })
})

describe('AI insights (M-057, M-063 … M-067)', () => {
  it('answers the code evidence, and the narrative separately, in the user language', async () => {
    const { job, candidate } = await market()
    await User.updateOne({ _id: candidate._id }, { language: 'es' })
    const overview = (await api().get(`${v1}/candidate/insights/overview`).set(auth(candidate))).body
    assert.deepEqual(overview.stats, { skillsCount: 2, rolesWithAlignedSkills: 1, jobsConsidered: 1, yearsExperience: 5 })
    assert.deepEqual(overview.skillDemand, [{ skill: 'Figma', jobCount: 1 }, { skill: 'Design Systems', jobCount: 1 }])
    const gap = (await api().get(`${v1}/candidate/insights/skill-gap?jobId=${job.id}`).set(auth(candidate))).body
    assert.deepEqual(gap.evidence.missingSkills, ['Prototyping'])
    aiStub.reply = (request) => (request.text.format.name === 'insights' ? { guidance: [{ skill: 'Prototyping', text: 'Muestra un prototipo.' }] } : null)
    const narrative = await api().get(`${v1}/candidate/insights/narrative?section=skill_gap&jobId=${job.id}`).set(auth(candidate))
    assert.deepEqual(narrative.body.guidance, [{ skill: 'Prototyping', text: 'Muestra un prototipo.' }])
    assert.match(responses()[0].instructions, /in Spanish\./)
    assert.equal(JSON.parse(responses()[0].input).missingSkills[0], 'Prototyping')
  })

  it('offers the top recommendations plus saved and applied jobs in the role picker', async () => {
    const { recruiter, job, candidate } = await market()
    const { body: other } = await api().post(`${v1}/recruiter/jobs`).set(auth(recruiter)).send(jobBody({ title: 'Accountant', requiredSkills: ['Bookkeeping'] }))
    await api().patch(`${v1}/recruiter/jobs/${other.id}/status`).set(auth(recruiter)).send({ status: 'published' })
    await SavedJob.create({ candidateId: candidate._id, jobId: other.id })
    const roles = (await api().get(`${v1}/candidate/insights/roles`).set(auth(candidate))).body.items.map((item) => item.id)
    assert.deepEqual(roles, [job.id, other.id], 'the recommended job first, then the saved one')
  })

  it('keeps the evidence when OpenAI fails, and shows the limit once 50 generations are used (a cache hit still answers)', async () => {
    const { job, candidate } = await market()
    await api().post(`${v1}/_test/ai/fail-next`)
    const failed = await api().get(`${v1}/candidate/insights/narrative?section=job_match&jobId=${job.id}`).set(auth(candidate))
    assert.equal(failed.status, 503)
    assert.equal(failed.body.error.code, 'AI_UNAVAILABLE')
    assert.equal((await api().get(`${v1}/candidate/insights/job-match?jobId=${job.id}`).set(auth(candidate))).status, 200)
    assert.equal((await api().get(`${v1}/candidate/insights/narrative?section=job_match&jobId=${job.id}`).set(auth(candidate))).status, 200)
    await AiUsage.updateOne({ userId: candidate._id }, { count: 50 })
    const limited = await api().get(`${v1}/candidate/insights/narrative?section=why&jobId=${job.id}`).set(auth(candidate))
    assert.equal(limited.status, 429)
    assert.equal(limited.body.error.code, 'AI_DAILY_LIMIT')
    assert.ok(limited.body.error.params.resetAt)
    assert.equal((await api().get(`${v1}/candidate/insights/narrative?section=job_match&jobId=${job.id}`).set(auth(candidate))).status, 200, 'cache hit')
  })

  it('stores feedback and aggregates it for admins', async () => {
    const { job, candidate } = await market()
    const put = (value) => api().put(`${v1}/candidate/insights/feedback/${job.id}`).set(auth(candidate)).send({ value })
    assert.equal((await put('helpful')).status, 204)
    assert.equal((await api().get(`${v1}/candidate/insights/why-recommended?jobId=${job.id}`).set(auth(candidate))).body.feedback, 'helpful')
    const owner = await createUser({ role: 'admin', isOwner: true })
    const summary = (await api().get(`${v1}/admin/matching/feedback`).set(auth(owner))).body
    assert.deepEqual([summary.helpful, summary.needsReview, summary.jobs[0].id], [1, 0, job.id])
    await put(null)
    assert.equal(await ExplanationFeedback.countDocuments(), 0)
  })

  it('adds a reviewed skill to the profile, refuses a 13th, and undoes it', async () => {
    const { candidate } = await market()
    const add = (skill) => api().post(`${v1}/candidate/profile/skills`).set(auth(candidate)).send({ skill })
    assert.deepEqual((await add('Prototyping')).body.skills, ['Figma', 'Design Systems', 'Prototyping'])
    assert.equal((await add('prototyping')).body.error.fields.skill, 'duplicate')
    assert.equal((await add('x'.repeat(31))).body.error.fields.skill, 'too_long')
    for (let index = 0; index < 9; index += 1) assert.equal((await add(`Skill ${index}`)).status, 201)
    const thirteenth = await add('One more')
    assert.equal(thirteenth.status, 422)
    assert.equal(thirteenth.body.error.fields.skill, 'too_many')
    assert.equal((await api().delete(`${v1}/candidate/profile/skills/Prototyping`).set(auth(candidate))).body.skills.length, 11)
  })

  it('keeps the learning plan on the server and ranks suggestions by its skills (P9-Q2)', async () => {
    const { candidate } = await market()
    const course = await Course.create({ audience: 'candidate', title: 'Motion basics', status: 'published', skillTags: [{ name: 'Motion', key: 'motion' }], isFree: true, lessons: [], quiz: { passMark: 70, questions: [] } })
    const plan = (await api().put(`${v1}/candidate/learning-plan/Motion`).set(auth(candidate))).body
    assert.deepEqual(plan.items, ['Motion'])
    assert.deepEqual((await CandidateProfile.findOne({ userId: candidate._id })).learningPlan.map((skill) => skill.name), ['Motion'])
    assert.deepEqual((await api().get(`${v1}/candidate/insights/improve-profile`).set(auth(candidate))).body.learningPlan, ['Motion'])
    const suggestions = (await api().get(`${v1}/learning/suggestions`).set(auth(candidate))).body
    assert.deepEqual(suggestions.planSkills, ['Motion'])
    assert.deepEqual(suggestions.items.map((item) => item.id), [String(course._id)])
    assert.deepEqual((await api().delete(`${v1}/candidate/learning-plan/Motion`).set(auth(candidate))).body.items, [])
    assert.equal((await api().get(`${v1}/learning/suggestions`).set(auth(candidate))).body.items.length, 0)
  })

  it('writes a recruiter-ready profile summary for Plus only', async () => {
    const { candidate } = await market()
    aiStub.reply = () => ({ summary: 'A product designer.' })
    assert.equal((await api().post(`${v1}/candidate/profile/ai-summary`).set(auth(candidate))).body.summary, 'A product designer.')
    assert.equal((await api().post(`${v1}/candidate/profile/ai-summary`).set(auth(await listedCandidate()))).status, 402)
  })
})

describe('recruiter Match insights narrative (M-057, C6)', () => {
  it('answers a narrative with no score field', async () => {
    const { recruiter, job, candidate } = await market()
    const { body } = await api().get(`${v1}/recruiter/candidates/${candidate._id}/match?jobId=${job.id}`).set(auth(recruiter))
    assert.ok(['summary', 'strengths', 'openQuestions'].every((key) => key in body))
    assert.ok(!['score', 'percent', 'label'].some((key) => keysOf(body).has(key)))
    assert.doesNotMatch(responses()[0].input, /"score"/)
  })
})

describe('CV AI (M-027, M-061, P9-Q3)', () => {
  async function withCv(user) {
    const version = await CvVersion.create({ userId: user._id, number: 1, fileId: new User()._id, originalName: 'cv.pdf', mime: 'application/pdf', size: 10, extractedText: 'Lead product designer, 8 years. Figma, Research, Motion.' })
    await CandidateProfile.updateOne({ userId: user._id }, { liveCvVersionId: version._id })
    return version
  }

  it('proposes a snapshot that changes nothing until confirmed, then sets headline and years and adds missing skills up to 12', async () => {
    const { candidate } = await market()
    await CandidateProfile.updateOne({ userId: candidate._id }, { skills: Array.from({ length: 10 }, (_, index) => ({ name: `Skill ${index}`, key: `skill ${index}` })) })
    const version = await withCv(candidate)
    aiStub.reply = () => ({ role: 'Lead Product Designer', years: 8, skills: ['Skill 1', 'Figma', 'Research', 'Motion'] })
    const proposed = await api().post(`${v1}/candidate/cv/versions/${version._id}/snapshot`).set(auth(candidate))
    assert.equal(proposed.status, 200)
    assert.equal(responses()[0].model, aiStub.models.main, 'OPENAI_MODEL (U4)')
    assert.deepEqual(proposed.body.items[0].pendingSnapshot.skills, ['Skill 1', 'Figma', 'Research', 'Motion'])
    assert.equal((await CandidateProfile.findOne({ userId: candidate._id })).headline, 'Product Designer', 'unchanged until confirmed')
    const confirmed = await api().post(`${v1}/candidate/cv/versions/${version._id}/snapshot/confirm`).set(auth(candidate))
    assert.equal(confirmed.body.items[0].pendingSnapshot, null)
    assert.equal(confirmed.body.items[0].snapshot.role, 'Lead Product Designer')
    const profile = await CandidateProfile.findOne({ userId: candidate._id })
    assert.equal(profile.headline, 'Lead Product Designer')
    assert.equal(profile.yearsExperience, 8)
    assert.deepEqual(profile.skills.slice(10).map((skill) => skill.name), ['Figma', 'Research'], 'two new skills fit; Skill 1 was already listed')
    assert.equal(profile.skills.length, 12)
  })

  it('creates and deletes assisted drafts, refuses Free and a CV without text', async () => {
    const { candidate } = await market()
    const version = await withCv(candidate)
    aiStub.reply = () => ({ suggestions: ['Add outcomes'], revisedSnapshot: { role: 'Designer', years: 8, skills: ['Figma'] } })
    const created = await api().post(`${v1}/candidate/cv/drafts`).set(auth(candidate)).send({ versionId: String(version._id) })
    assert.equal(created.status, 201)
    const [draft] = created.body.items[0].drafts
    assert.deepEqual(draft.suggestions, ['Add outcomes'])
    assert.equal((await api().delete(`${v1}/candidate/cv/drafts/${draft.id}`).set(auth(candidate))).body.items[0].drafts.length, 0)
    await CvVersion.updateOne({ _id: version._id }, { noReadableText: true })
    assert.equal((await api().post(`${v1}/candidate/cv/versions/${version._id}/snapshot`).set(auth(candidate))).body.error.fields.version, 'no_text')
    const free = await listedCandidate()
    assert.equal((await api().post(`${v1}/candidate/cv/drafts`).set(auth(free)).send({ versionId: String(version._id) })).status, 402)
  })
})

describe('Translate (M-144, M-117)', () => {
  it('translates for a Plus candidate and an approved recruiter, refuses Free and anyone outside the conversation', async () => {
    const { recruiter, company, job, candidate } = await market()
    aiStub.reply = (request) => ({ texts: JSON.parse(request.input).texts.map((text) => `[fr] ${text}`) })
    await User.updateOne({ _id: candidate._id }, { language: 'fr' })
    const brief = await api().post(`${v1}/translate`).set(auth(candidate)).send({ entity: 'job', id: job.id, field: 'brief' })
    assert.equal(brief.body.texts[0], `[fr] ${jobBody().brief}`)
    const responsibilities = await api().post(`${v1}/translate`).set(auth(candidate)).send({ entity: 'job', id: job.id, field: 'responsibilities' })
    assert.equal(responsibilities.body.texts.length, 3)
    const free = await listedCandidate()
    assert.equal((await api().post(`${v1}/translate`).set(auth(free)).send({ entity: 'job', id: job.id, field: 'brief' })).status, 402)

    const about = await api().post(`${v1}/translate`).set(auth(recruiter)).send({ entity: 'candidate', id: String(candidate._id), field: 'about' })
    assert.equal(about.body.texts[0], `[fr] ${designer.about}`)
    const conversation = await Conversation.create({ companyId: company._id, candidateId: candidate._id, startedBy: 'recruiter' })
    const message = await Message.create({ conversationId: conversation._id, senderId: recruiter._id, senderRole: 'recruiter', body: 'Hello there' })
    assert.equal((await api().post(`${v1}/translate`).set(auth(candidate)).send({ entity: 'message', id: String(message._id), field: 'body' })).body.texts[0], '[fr] Hello there')
    const stranger = await plus(await listedCandidate())
    assert.equal((await api().post(`${v1}/translate`).set(auth(stranger)).send({ entity: 'message', id: String(message._id), field: 'body' })).status, 404)
    assert.equal((await api().post(`${v1}/translate`).set(auth(candidate)).send({ entity: 'job', id: job.id, field: 'about' })).body.error.fields.field, 'invalid')
  })
})
