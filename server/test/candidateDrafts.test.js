import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import mongoose from 'mongoose'
import { ScheduledTask } from '../jobs/models.js'
import { clearUsageCache } from '../lib/usage.js'
import { AiCache, AiUsage, ApiUsage } from '../modules/ai/ai.model.js'
import { cleanVoiceProfile } from '../modules/ai/ai.candidateDrafts.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { Interview } from '../modules/interviews/interviews.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { ensureDefaultPolicy } from '../modules/matching/matching.admin.js'
import { Embedding, MatchingPolicy, MatchingPolicyVersion, MatchResult } from '../modules/matching/matching.model.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { aiStub } from './helpers/ai.js'
import { api, attach, auth, createUser, useTestDb, useTestUploads } from './helpers/index.js'
import { approvedRecruiter, jobBody, listedCandidate } from './helpers/market.js'
import { suggestion, useFakePlaces } from './helpers/places.js'

/* Phase 3 (owner 2026-11-17): the candidate's AI drafts — cover note, job alert, headline and About, interview prep, voice. */
useTestDb([
  User, Company, Job, CandidateProfile, Subscription, Application, PipelineStage, Interview, AiCache, AiUsage, ApiUsage,
  Embedding, MatchResult, ScheduledTask, MatchingPolicy, MatchingPolicyVersion,
])
const places = useFakePlaces()
useTestUploads()
before(() => seedCatalog())
beforeEach(async () => {
  aiStub.reset()
  clearUsageCache()
  await ensureDefaultPolicy()
})
after(() => aiStub.reset())

const v1 = '/api/v1'
const draft = (user, path, body) => api().post(`${v1}/candidate/ai/${path}`).set(auth(user)).send(body)
const requests = (name) => aiStub.calls.filter((call) => call.kind === 'response' && call.text?.format?.name === name)
const plus = async (user) => {
  await Subscription.create({ userId: user._id, planKey: 'plus', status: 'active' })
  return user
}

async function publishedJob() {
  const { user: recruiter } = await approvedRecruiter()
  const { body: job } = await api().post(`${v1}/recruiter/jobs`).set(auth(recruiter)).send(jobBody())
  await api().patch(`${v1}/recruiter/jobs/${job.id}/status`).set(auth(recruiter)).send({ status: 'published' })
  return { recruiter, job }
}

describe('cover note writer', () => {
  it('writes from the profile and the job, never cached, for Plus only', async () => {
    const { job } = await publishedJob()
    const candidate = await plus(await listedCandidate())
    aiStub.reply = (request) => (request.text.format.name === 'cover_note' ? { coverNote: `  I design systems in Figma. ${'x'.repeat(3000)}` } : null)
    const { body } = await draft(candidate, 'cover-note', { jobId: job.id, notes: 'Mention my accessibility work' })
    assert.equal(body.coverNote.length, 2000)
    const input = JSON.parse(requests('cover_note')[0].input)
    assert.deepEqual([input.job.title, input.candidate.headline, input.notes], [job.title, 'Product Designer', 'Mention my accessibility work'])
    await draft(candidate, 'cover-note', { jobId: job.id })
    assert.equal(requests('cover_note').length, 2, 'asking again writes a new note')
    assert.equal((await draft(await listedCandidate(), 'cover-note', { jobId: job.id })).status, 402)
    assert.equal((await draft(candidate, 'cover-note', { jobId: new mongoose.Types.ObjectId().toString() })).status, 404)
  })
})

describe('job alert from a sentence', () => {
  it('fills name, keywords and frequency, and finds the city in the named country', async () => {
    const candidate = await plus(await listedCandidate())
    aiStub.reply = (request) =>
      request.text.format.name === 'job_alert_draft' ? { name: 'Design roles in London', keywords: 'product designer figma', city: 'London', countryCode: 'gb', frequency: 'weekly' } : null
    places.fake.suggestions = [suggestion('ChIJdd4hrwug2EcRmSrV3Vo6llI', 'London', 'UK')]
    const { body } = await draft(candidate, 'job-alert', { text: 'Product design jobs in London with Figma, weekly' })
    assert.deepEqual([body.name, body.keywords, body.frequency], ['Design roles in London', 'product designer figma', 'weekly'])
    assert.deepEqual([body.place?.city, body.place?.countryCode], ['London', 'GB'])
    assert.ok(await ApiUsage.exists({ provider: 'places', userId: candidate._id }), 'the city lookup counts as Places usage')

    // Made in the France view, a city in another country is not filled in (the alert could not be saved).
    const french = (await draft(candidate, 'job-alert', { text: 'Product design jobs in London, weekly', country: 'FR' })).body
    assert.equal(french.place, null)

    // No city named: no place and no Places call.
    aiStub.reply = (request) => (request.text.format.name === 'job_alert_draft' ? { name: 'Remote React', keywords: 'react', city: '', countryCode: '', frequency: 'daily' } : null)
    const calls = places.calls.length
    const remote = (await draft(candidate, 'job-alert', { text: 'remote react jobs' })).body
    assert.deepEqual([remote.place, places.calls.length], [null, calls])
  })
})

describe('headline and About writer', () => {
  it('writes both from the profile, cut to the limits, and caches by the facts', async () => {
    const candidate = await plus(await listedCandidate())
    aiStub.reply = (request) => (request.text.format.name === 'profile_text' ? { headline: 'Senior Product Designer · Design Systems · Figma expert', about: `I design calm tools. ${'y'.repeat(700)}` } : null)
    const { body } = await draft(candidate, 'profile-text')
    assert.equal(body.headline.length, 55)
    assert.equal(body.about.length, 600)
    await draft(candidate, 'profile-text')
    assert.equal(requests('profile_text').length, 1, 'unchanged profile: answered from the cache')
    assert.equal((await draft(await plus(await createUser({ role: 'candidate' })), 'profile-text')).status, 422, 'no profile yet')
  })
})

describe('interview prep', () => {
  it('prepares the candidate of a confirmed interview only', async () => {
    const { recruiter, job } = await publishedJob()
    const candidate = await plus(await listedCandidate())
    const base = { companyId: recruiter.companyId, candidateId: candidate._id, applicationId: new mongoose.Types.ObjectId(), jobId: job.id, conversationId: new mongoose.Types.ObjectId(), createdBy: recruiter._id, mode: 'video' }
    const confirmed = await Interview.create({ ...base, status: 'confirmed', startAt: new Date(Date.now() + 86_400_000) })
    const offered = await Interview.create({ ...base, status: 'offered' })
    aiStub.reply = (request) =>
      request.text.format.name === 'interview_prep'
        ? { questions: Array.from({ length: 10 }, (_, index) => ({ question: ` Question ${index} `, talkingPoint: 'Use your design systems work.' })), askThem: ['What does success look like?', 'Who is on the team?', 'What comes next?', 'Fourth'] }
        : null
    const { body } = await draft(candidate, `interviews/${confirmed._id}/prep`)
    assert.equal(body.questions.length, 8)
    assert.deepEqual(body.questions[0], { question: 'Question 0', talkingPoint: 'Use your design systems work.' })
    assert.equal(body.askThem.length, 3)
    assert.equal(JSON.parse(requests('interview_prep')[0].input).mode, 'video')
    assert.equal((await draft(candidate, `interviews/${offered._id}/prep`)).status, 404, 'not confirmed yet')
    assert.equal((await draft(await plus(await listedCandidate()), `interviews/${confirmed._id}/prep`)).status, 404, 'someone else’s interview')
  })
})

describe('voice profile cleaning', () => {
  it('keeps only what fits the profile: valid months, ISO languages, unique skills', () => {
    const clean = cleanVoiceProfile({
      headline: 'Nurse',
      about: 'I care for patients.',
      yearsExperience: 61.4,
      skills: ['Triage', 'triage', '', 'Wound care'],
      workHistory: [
        { title: 'Nurse', employer: 'City Hospital', start: '2019-03', end: '', current: true },
        { title: 'Assistant', employer: 'Clinic', start: '2015', end: '2019-13', current: false },
        { title: '', employer: 'Nobody', start: '', end: '', current: false },
      ],
      education: [{ degree: 'BSc Nursing', institution: 'Uni' }],
      languages: [{ code: 'EN', level: 'native' }, { code: 'xx', level: 'b2' }, { code: 'en', level: 'b2' }],
    })
    assert.equal(clean.yearsExperience, 50)
    assert.deepEqual(clean.skills, ['Triage', 'Wound care'])
    assert.deepEqual(clean.workHistory, [
      { title: 'Nurse', employer: 'City Hospital', start: '2019-03', end: null, current: true },
      { title: 'Assistant', employer: 'Clinic', start: null, end: null, current: false },
    ])
    assert.deepEqual(clean.languages, [{ code: 'en', level: 'native' }])
  })
})

describe('voice profile builder', () => {
  const mp3 = () => Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(4000)])
  const record = (user) => attach(api().post(`${v1}/candidate/ai/voice-profile`).set(auth(user)), mp3(), 'voice.mp3', 'audio/mpeg')
  /** Runs `work` while the stub transcription answers `text`. */
  async function hearing(text, work) {
    const original = aiStub.audio.transcriptions.create
    aiStub.audio.transcriptions.create = async ({ file }) => {
      file.destroy()
      return { text }
    }
    try {
      return await work()
    } finally {
      aiStub.audio.transcriptions.create = original
    }
  }

  it('transcribes, proposes, and applies by adding to the profile without removing anything', async () => {
    const candidate = await plus(await listedCandidate())
    aiStub.reply = (request) =>
      request.text.format.name === 'voice_profile'
        ? {
            headline: 'Senior Product Designer',
            about: 'I design calm, accessible tools for hiring teams and lead design systems work.',
            yearsExperience: 7,
            skills: ['Figma', 'Accessibility', 'User Research'],
            workHistory: [{ title: 'Lead Designer', employer: 'Harbour Labs', start: '2021-02', end: '', current: true }],
            education: [{ degree: 'MA Interaction Design', institution: 'RCA' }],
            languages: [{ code: 'fr', level: 'b2' }],
          }
        : null
    const said = 'I am a product designer with seven years of experience, now leading design at Harbour Labs.'
    const proposed = await hearing(said, () => record(candidate))
    assert.equal(proposed.status, 200)
    assert.equal(proposed.body.transcript, said)
    assert.equal(JSON.parse(requests('voice_profile')[0].input).transcript, said)
    assert.equal(proposed.body.profile.headline, 'Senior Product Designer')

    const before = await CandidateProfile.findOne({ userId: candidate._id })
    const applied = await api().post(`${v1}/candidate/ai/voice-profile/apply`).set(auth(candidate)).send(proposed.body.profile)
    assert.equal(applied.status, 200)
    assert.deepEqual(applied.body.added, { skills: 2, workHistory: 1, education: 1 })
    const after = await CandidateProfile.findOne({ userId: candidate._id })
    assert.equal(after.headline, 'Senior Product Designer')
    assert.equal(after.yearsExperience, 7)
    assert.deepEqual(after.skills.map((skill) => skill.name), [...before.skills.map((skill) => skill.name), 'Accessibility', 'User Research'], 'existing skills stay, Figma is not repeated')
    assert.equal(after.workHistory.length, before.workHistory.length + 1)
    assert.ok(after.languages.some((language) => language.code === 'fr'))

    // Applying the same proposal again adds nothing new.
    const again = await api().post(`${v1}/candidate/ai/voice-profile/apply`).set(auth(candidate)).send(proposed.body.profile)
    assert.deepEqual(again.body.added, { skills: 0, workHistory: 0, education: 0 })
  })

  it('takes the voice credits before the paid transcription: kept when too short, given back when OpenAI fails', async () => {
    const candidate = await plus(await listedCandidate())
    const credits = async () => (await AiUsage.findOne({ userId: candidate._id }))?.count ?? 0
    await hearing('Hi.', () => record(candidate))
    assert.equal(await credits(), 3, 'too short: the transcription was paid, so the 3 credits stay')
    const failed = await hearing('I am a nurse with eight years of experience in emergency care.', async () => {
      const original = aiStub.audio.transcriptions.create
      aiStub.audio.transcriptions.create = async ({ file }) => {
        file.destroy()
        throw new Error('openai down')
      }
      try {
        return await record(candidate)
      } finally {
        aiStub.audio.transcriptions.create = original
      }
    })
    assert.equal(failed.status, 503)
    assert.equal(await credits(), 3, 'a failed transcription gives its credits back')
    await AiUsage.updateOne({ userId: candidate._id }, { count: 39 })
    const broke = await hearing('I am a nurse with eight years of experience in emergency care.', () => record(candidate))
    assert.equal(broke.status, 429, 'not enough credits: refused before anything is transcribed')
  })

  it('refuses a recording with too little speech, and Free candidates', async () => {
    const candidate = await plus(await listedCandidate())
    const short = await hearing('Hi.', () => record(candidate))
    assert.equal(short.status, 422)
    assert.equal(short.body.error.fields.file, 'too_short')
    assert.equal((await record(await listedCandidate())).status, 402)
  })
})
