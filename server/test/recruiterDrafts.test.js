import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { ScheduledTask } from '../jobs/models.js'
import { clearUsageCache } from '../lib/usage.js'
import { AiCache, AiUsage, ApiUsage } from '../modules/ai/ai.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { ensureDefaultPolicy } from '../modules/matching/matching.admin.js'
import { Embedding, MatchingPolicy, MatchingPolicyVersion, MatchResult } from '../modules/matching/matching.model.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { aiStub } from './helpers/ai.js'
import { api, auth, useTestDb } from './helpers/index.js'
import { applicantCandidate, approvedRecruiter, jobBody, listedCandidate } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

/* Phase 2 (owner 2026-11-17): the recruiter's AI drafts — job post, company description, shortlist and messages. */
useTestDb([
  User, Company, Job, CandidateProfile, Subscription, Application, PipelineStage, Conversation, Message, AiCache, AiUsage, ApiUsage,
  Embedding, MatchResult, ScheduledTask, MatchingPolicy, MatchingPolicyVersion,
])
useFakePlaces()
before(() => seedCatalog())
beforeEach(async () => {
  aiStub.reset()
  clearUsageCache()
  await ensureDefaultPolicy()
})
after(() => aiStub.reset())

const v1 = '/api/v1'
const draft = (user, path, body) => api().post(`${v1}/recruiter/ai/${path}`).set(auth(user)).send(body)
const requests = (name) => aiStub.calls.filter((call) => call.kind === 'response' && call.text?.format?.name === name)

async function publishedJob(recruiter, fields = {}) {
  const { body: job } = await api().post(`${v1}/recruiter/jobs`).set(auth(recruiter)).send(jobBody(fields))
  await api().patch(`${v1}/recruiter/jobs/${job.id}/status`).set(auth(recruiter)).send({ status: 'published' })
  return job
}

describe('job post writer', () => {
  it('drafts a posting cut to the form limits, for Recruiter Plus only, as one AI use', async () => {
    const { user: recruiter } = await approvedRecruiter()
    // Messy on purpose: blanks, duplicates, a required skill repeated as preferred, a bad language code, too many years.
    aiStub.reply = (request) =>
      request.text.format.name === 'job_draft'
        ? {
            brief: '  You will build the booking flow for small hotels.  ',
            responsibilities: ['Ship features', ' ', 'Ship features', 'x'.repeat(400)],
            requiredSkills: ['React', 'react', 'TypeScript', ''],
            preferredSkills: ['React', 'GraphQL'],
            level: 'senior',
            experienceYears: 99,
            languages: [{ code: 'EN', minLevel: 'c1' }, { code: 'zz', minLevel: 'b2' }, { code: 'en', minLevel: 'b2' }],
          }
        : null
    const response = await draft(recruiter, 'job-draft', { title: 'Frontend Engineer', employmentType: 'full_time', notes: 'React, English' })
    assert.equal(response.status, 200)
    const body = response.body
    assert.equal(body.brief, 'You will build the booking flow for small hotels.')
    assert.deepEqual(body.responsibilities, ['Ship features', 'x'.repeat(300)])
    assert.deepEqual(body.requiredSkills, ['React', 'TypeScript'])
    assert.deepEqual(body.preferredSkills, ['GraphQL'])
    assert.deepEqual([body.level, body.experienceYears], ['senior', 50])
    assert.deepEqual(body.requiredLanguages, [{ code: 'en', minLevel: 'c1' }])
    const [request] = requests('job_draft')
    assert.equal(JSON.parse(request.input).notes, 'React, English')
    assert.equal(JSON.parse(request.input).company.name, `${recruiter.fullName} Studio`)
    assert.equal((await AiUsage.findOne({ userId: recruiter._id })).count, 1)

    const { user: free } = await approvedRecruiter({ plus: false })
    assert.equal((await draft(free, 'job-draft', { title: 'Frontend Engineer', employmentType: 'full_time' })).status, 402)
    assert.equal((await draft(recruiter, 'job-draft', { title: 'x', employmentType: 'full_time' })).status, 422)
  })
})

describe('company description writer', () => {
  it('writes from the company details only, cut to the description limit', async () => {
    const { user: recruiter } = await approvedRecruiter()
    aiStub.reply = (request) => (request.text.format.name === 'company_description' ? { description: `  We build booking software. ${'a'.repeat(4000)}` } : null)
    const { body } = await draft(recruiter, 'company-description', { name: 'Harbour Labs', industry: 'Software', size: '11_50', city: 'London', notes: 'hotels' })
    assert.equal(body.description.length, 3000)
    assert.ok(body.description.startsWith('We build booking software.'))
    assert.deepEqual(JSON.parse(requests('company_description')[0].input), { company: { name: 'Harbour Labs', industry: 'Software', size: '11_50', city: 'London' }, notes: 'hotels' })
  })
})

describe('AI shortlist', () => {
  it('ranks new applicants without their names, drops unknown ids, and answers again from the cache', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const job = await publishedJob(recruiter)
    const first = await applicantCandidate({ fullName: 'Ada First' })
    const second = await applicantCandidate({ fullName: 'Bo Second' })
    for (const candidate of [first, second]) {
      assert.equal((await api().post(`${v1}/candidate/applications`).set(auth(candidate)).send({ jobId: job.id, consent: true, coverNote: `Keen to join. Best, ${candidate.fullName.split(' ')[0]}` })).status, 201)
    }
    const applications = await Application.find({ jobId: job.id }).sort({ appliedAt: 1 })
    aiStub.reply = (request) =>
      request.text.format.name === 'applicant_shortlist'
        ? {
            items: [
              { applicationId: String(applications[1]._id), reason: ' All required skills. ' },
              { applicationId: '000000000000000000000000', reason: 'Unknown.' },
              { applicationId: String(applications[1]._id), reason: 'Twice.' },
              { applicationId: String(applications[0]._id), reason: 'Missing one skill.' },
            ],
          }
        : null
    const { body } = await draft(recruiter, `jobs/${job.id}/shortlist`)
    assert.equal(body.considered, 2)
    assert.deepEqual(body.items.map((item) => [item.candidate.fullName, item.reason]), [['Bo Second', 'All required skills.'], ['Ada First', 'Missing one skill.']])
    const input = requests('applicant_shortlist')[0].input
    assert.ok(!input.includes('Ada First') && !input.includes('Bo Second'), 'names never reach OpenAI')
    assert.equal(JSON.parse(input).applicants[0].coverNote, 'Keen to join. Best, the candidate', 'the signature name is taken out')

    await draft(recruiter, `jobs/${job.id}/shortlist`)
    assert.equal(requests('applicant_shortlist').length, 1, 'cached while nothing changed')
    assert.equal((await AiUsage.findOne({ userId: recruiter._id })).count, 1)

    const { user: other } = await approvedRecruiter()
    assert.equal((await draft(other, `jobs/${job.id}/shortlist`)).status, 404)
  })
})

describe('message drafts', () => {
  it('drafts a first message, a status update before a reject, and a reply; never cached', async () => {
    const { user: recruiter } = await approvedRecruiter({ fullName: 'Sam Rivera' })
    const job = await publishedJob(recruiter)
    aiStub.reply = (request) => (request.text.format.name === 'message_draft' ? { body: '  Hi, your work stood out.  ' } : null)
    const candidate = await listedCandidate()

    const first = await draft(recruiter, 'message-draft', { purpose: 'first_message', candidateId: String(candidate._id), jobId: job.id })
    assert.equal(first.body.body, 'Hi, your work stood out.')
    const firstInput = JSON.parse(requests('message_draft')[0].input)
    assert.deepEqual([firstInput.purpose, firstInput.recruiterFirstName, firstInput.job.title], ['first_message', 'Sam', job.title])
    await draft(recruiter, 'message-draft', { purpose: 'first_message', candidateId: String(candidate._id), jobId: job.id })
    assert.equal(requests('message_draft').length, 2, 'drafting again asks again')

    const applicant = await applicantCandidate()
    await api().post(`${v1}/candidate/applications`).set(auth(applicant)).send({ jobId: job.id, consent: true })
    const application = await Application.findOne({ candidateId: applicant._id })
    await draft(recruiter, 'message-draft', { purpose: 'status_update', applicationId: String(application._id), rejected: true })
    assert.equal(JSON.parse(requests('message_draft')[2].input).status, 'not_selected')

    const { body: started } = await api().post(`${v1}/conversations`).set(auth(recruiter)).send({ candidateId: String(applicant._id), jobId: job.id, body: 'Hello!' })
    await api().post(`${v1}/conversations/${started.conversation.id}/messages`).set(auth(applicant)).send({ body: 'Thanks, what are the next steps?' })
    await draft(recruiter, 'message-draft', { purpose: 'reply', conversationId: started.conversation.id })
    assert.deepEqual(JSON.parse(requests('message_draft')[3].input).messages.at(-1), { from: 'them', text: 'Thanks, what are the next steps?' })

    const { user: other } = await approvedRecruiter()
    assert.equal((await draft(other, 'message-draft', { purpose: 'reply', conversationId: started.conversation.id })).status, 404)
    assert.equal((await draft(other, 'message-draft', { purpose: 'status_update', applicationId: String(application._id) })).status, 404)
    assert.equal(await AiCache.countDocuments({ kind: 'message_draft' }), 0)

    // The status update is sent in the company's thread with the applicant about that job.
    const sent = await api().post(`${v1}/recruiter/applications/${application._id}/message`).set(auth(recruiter)).send({ body: 'Thank you for applying.' })
    assert.equal(sent.status, 201)
    assert.equal(sent.body.conversation.id, started.conversation.id)
    assert.ok(await Message.exists({ conversationId: started.conversation.id, body: 'Thank you for applying.' }))
    assert.equal((await api().post(`${v1}/recruiter/applications/${application._id}/message`).set(auth(other)).send({ body: 'Hi' })).status, 404)
  })
})
