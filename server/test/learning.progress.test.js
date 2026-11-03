import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { before, describe, it } from 'node:test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { File } from '../modules/files/files.model.js'
import { Job, SavedJob } from '../modules/jobs/jobs.model.js'
import { Certificate, Course, Enrollment, QuizAttempt } from '../modules/learning/learning.model.js'
import { enroll } from '../modules/learning/learning.service.js'
import { Payment } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { absolutePath } from '../lib/files.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { api, auth, createUser, mailTo, useTestDb, useTestUploads } from './helpers/index.js'
import { approvedRecruiter, listedCandidate } from './helpers/market.js'

useTestDb([User, Company, CandidateProfile, Course, Enrollment, QuizAttempt, Certificate, File, AuditEvent, Payment, Job, SavedJob, Application, PipelineStage])
useTestUploads()
before(() => seedCatalog())

const v1 = '/api/v1'
const code = (res) => res.body.error?.code
const skills = (...names) => names.map((name) => ({ name, key: name.toLocaleLowerCase() }))

/**
 * A published course written straight to the database (the builder has its own tests): a 100 s video, a text
 * lesson and a quiz with one single- and one multiple-choice question, pass mark 70.
 */
async function course({ audience = 'candidate', title = 'Interaction design foundations', ...fields } = {}) {
  const created = new Course({
    audience,
    title,
    category: 'Interaction Design',
    level: 'foundation',
    summary: 'Build clear flows and useful states.',
    skillTags: skills('Interaction Design'),
    isFree: true,
    status: 'published',
    publishedAt: new Date(),
    lessons: [
      { title: 'Intro video', type: 'video', durationSec: 100, videoFileId: new File()._id },
      { title: 'Reading', type: 'text', textMarkdown: 'Read.', textHtml: '<p>Read.</p>' },
    ],
    ...fields,
  })
  created.quiz.passMark = 70
  created.quiz.questions = [
    { text: 'Which state helps a first-time user?', type: 'single', options: [{ text: 'Empty state' }, { text: 'Spinner' }] },
    { text: 'Which are list states?', type: 'multiple', options: [{ text: 'Empty' }, { text: 'Loading' }, { text: 'Font' }] },
  ]
  const [single, multiple] = created.quiz.questions
  single.correctOptionIds = [single.options[0]._id]
  multiple.correctOptionIds = [multiple.options[0]._id, multiple.options[1]._id]
  return created.save()
}

const progress = (user, lessonId, body) => api().post(`${v1}/learning/lessons/${lessonId}/progress`).set(auth(user)).send(body)
const quiz = (user, courseId) => api().get(`${v1}/learning/courses/${courseId}/quiz`).set(auth(user))
const attempt = (user, courseId, answers) => api().post(`${v1}/learning/courses/${courseId}/quiz/attempts`).set(auth(user)).send({ answers })

/** Moves the video lesson's last heartbeat (the only entry with one) `seconds` back, as if that much time had passed. */
const wait = (user, seconds) =>
  Enrollment.updateOne({ userId: user._id, lessons: { $elemMatch: { lastHeartbeatAt: { $type: 'date' } } } }, { $set: { 'lessons.$.lastHeartbeatAt': new Date(Date.now() - seconds * 1000) } })

/** Completes every lesson of `created` for `user` through the API (the video by credited heartbeats). */
async function finishLessons(user, created) {
  const [video, text] = created.lessons
  await progress(user, video._id, { event: 'heartbeat', positionSec: 0, rate: 1 })
  for (let position = 15; position <= 90; position += 15) {
    await wait(user, 15)
    await progress(user, video._id, { event: 'heartbeat', positionSec: position, rate: 1 })
  }
  return progress(user, text._id, { event: 'open' })
}

/** Answers: the correct ones, or the wrong option of the single-choice question. */
function answersFor(created, { wrong = false } = {}) {
  return created.quiz.questions.map((question) => ({
    questionId: String(question._id),
    optionIds: wrong && question.type === 'single' ? [String(question.options[1]._id)] : question.correctOptionIds.map(String),
  }))
}

describe('completion (M-099, M-103, U15)', () => {
  it('completes text on open and credits video only for real-time playback, at most 2×, completing at 90 %', async () => {
    const created = await course()
    const user = await createUser()
    const [video, text] = created.lessons
    assert.equal((await progress(user, text._id, { event: 'open' })).status, 403, 'not enrolled: not tracked')
    await enroll({ userId: user._id, courseId: created._id, source: 'free' })

    const opened = await progress(user, text._id, { event: 'open' })
    assert.deepEqual([opened.body.lesson.done, opened.body.course.lessonsDone], [true, 1])
    // Opening a video does not complete it.
    assert.equal((await progress(user, video._id, { event: 'open' })).body.lesson.done, false)

    const beat = async (seconds, positionSec, rate = 1) => {
      await wait(user, seconds)
      return (await progress(user, video._id, { event: 'heartbeat', positionSec, rate })).body.lesson
    }
    await progress(user, video._id, { event: 'heartbeat', positionSec: 0, rate: 1 })
    assert.equal((await beat(15, 15)).creditedSec, 15, '15 s at 1×')
    assert.equal((await beat(3, 60)).creditedSec, 15, 'a seek forward earns nothing')
    assert.equal((await beat(15, 90, 2)).creditedSec, 45, '30 s of video in 15 s at 2×')
    assert.equal((await beat(15, 150, 4)).creditedSec, 45, 'faster than 2× earns nothing')
    assert.equal((await beat(15, 140)).creditedSec, 45, 'a seek back earns nothing')
    assert.equal((await beat(40, 155)).creditedSec, 60, 'a long gap credits the position moved, at most 15 s')
    assert.equal((await beat(15, 170)).creditedSec, 75)
    const almost = await beat(15, 184)
    assert.deepEqual([almost.creditedSec, almost.done], [89, false])
    const done = await beat(15, 199)
    assert.deepEqual([done.creditedSec, done.done], [100, true], 'complete at 90 % (credit capped at the duration)')
  })
})

describe('final quiz (M-104)', () => {
  it('unlocks after every lesson, hides the answers, reshuffles, scores exactly, keeps the best score and passes once', async () => {
    const created = await course()
    const user = await createUser({ fullName: 'Łukasz Żółć', language: 'fr' })
    await enroll({ userId: user._id, courseId: created._id, source: 'free' })
    const locked = await quiz(user, created._id)
    assert.deepEqual([locked.body.unlocked, locked.body.questions], [false, []])
    assert.equal(code(await attempt(user, created._id, answersFor(created))), 'LOCKED')

    assert.equal((await finishLessons(user, created)).body.course.quizUnlocked, true)
    const open = await quiz(user, created._id)
    assert.equal(open.body.questions.length, 2)
    assert.ok(!JSON.stringify(open.body).includes('correct'), 'no correct answers in the quiz')
    const orders = new Set()
    for (let index = 0; index < 12; index++) orders.add((await quiz(user, created._id)).body.questions[1].options.map((option) => option.text).join())
    assert.ok(orders.size > 1, 'options are shuffled per request')

    // One of two right: 50 %, not passed, nothing revealed. A multiple-choice answer needs exactly the right set.
    const failed = await attempt(user, created._id, answersFor(created, { wrong: true }))
    assert.deepEqual([failed.status, failed.body.scorePercent, failed.body.passed, failed.body.certificate], [201, 50, false, null])
    assert.ok(!JSON.stringify(failed.body).includes('correct'))
    const partial = answersFor(created)
    partial[1].optionIds = partial[1].optionIds.slice(0, 1)
    assert.equal((await attempt(user, created._id, partial)).body.scorePercent, 50)

    const passed = await attempt(user, created._id, answersFor(created))
    assert.deepEqual([passed.body.scorePercent, passed.body.passed, passed.body.bestScore], [100, true, 100])
    assert.match(passed.body.certificate.code, /^LWM-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/)
    const [mail] = mailTo(user.email, 'certificate_issued')
    assert.equal(mail.language, 'fr')
    assert.ok(mail.params.secondaryLink.endsWith(`/certificates/${passed.body.certificate.code}`))

    // Unlimited attempts; a lower score keeps the best; a second pass issues nothing new.
    assert.equal((await attempt(user, created._id, answersFor(created, { wrong: true }))).body.bestScore, 100)
    await attempt(user, created._id, answersFor(created))
    assert.equal(await Certificate.countDocuments(), 1)
    assert.equal(mailTo(user.email, 'certificate_issued').length, 1)
    assert.equal(await QuizAttempt.countDocuments(), 5)
    const enrollment = await Enrollment.findOne({ userId: user._id })
    assert.ok(enrollment.completedAt && enrollment.quizPassedAt && enrollment.certificateId)
  })
})

describe('certificates (M-105, U17, C18, C24)', () => {
  async function certified(fields = {}) {
    const created = await course()
    const user = await listedCandidate({ fullName: 'Łukasz Żółć', language: 'fr', ...fields })
    await enroll({ userId: user._id, courseId: created._id, source: 'free' })
    await finishLessons(user, created)
    const { certificate } = (await attempt(user, created._id, answersFor(created))).body
    return { user, created, certificate }
  }
  const pdfText = async (fileId) => {
    const buffer = await readFile(absolutePath(await File.findById(fileId)))
    // pdf.js takes over (detaches) the array it is given, so it gets a copy.
    const page = await (await getDocument({ data: new Uint8Array(buffer) }).promise).getPage(1)
    return { bytes: buffer.toString('latin1'), text: (await page.getTextContent()).items.map((item) => item.str).join(' ') }
  }

  it('stores a PDF with the embedded Inter fonts, the name with its diacritics, the chrome in French and the code', async () => {
    const { certificate } = await certified()
    const stored = await Certificate.findOne({ code: certificate.code })
    const { bytes, text } = await pdfText(stored.pdfFileId)
    assert.match(bytes, /\/FontFile2/)
    assert.match(bytes, /Inter-Bold/)
    for (const expected of ['Łukasz Żółć', 'Interaction design foundations', 'CERTIFICAT DE RÉUSSITE', certificate.code]) assert.ok(text.includes(expected), `${expected} in ${text}`)
    assert.match(text, /Délivré le \d+/)
  })

  it('answers the public check, rate-limits it at 30 a minute per IP, and shows a revoke', async () => {
    const { certificate } = await certified()
    const check = (ip = '203.0.113.7') => api().get(`${v1}/public/certificates/${certificate.code}`).set('X-Forwarded-For', ip)
    const valid = await check()
    assert.deepEqual([valid.status, valid.body.status, valid.body.holderName, valid.body.courseTitle], [200, 'valid', 'Łukasz Żółć', 'Interaction design foundations'])
    for (let index = 0; index < 29; index++) await check()
    const limited = await check()
    assert.deepEqual([limited.status, code(limited)], [429, 'RATE_LIMITED'])
    assert.equal((await check('203.0.113.8')).status, 200, 'another IP is not limited')
    assert.equal((await api().get(`${v1}/public/certificates/LWM-2222-2222`).set('X-Forwarded-For', '203.0.113.9')).status, 404)

    const owner = await createUser({ role: 'admin', isOwner: true })
    const id = String((await Certificate.findOne({ code: certificate.code }))._id)
    assert.equal((await api().post(`${v1}/admin/certificates/${id}/revoke`).set(auth(owner)).send({ reason: '' })).status, 422)
    const revoked = await api().post(`${v1}/admin/certificates/${id}/revoke`).set(auth(owner)).send({ reason: 'Quiz answers were shared.' })
    assert.equal(revoked.body.status, 'revoked')
    assert.equal((await check('203.0.113.10')).body.status, 'revoked')
    assert.equal(await AuditEvent.countDocuments({ type: 'learning.certificate_revoked', 'params.reason': 'Quiz answers were shared.' }), 1)

    // C18: a tombstone shows only its code and "No longer valid".
    await Certificate.updateOne({ _id: id }, { status: 'no_longer_valid', userId: null })
    assert.deepEqual((await check('203.0.113.11')).body, { code: certificate.code, status: 'no_longer_valid' })
  })

  it('re-issues the PDF under the same code when the name changes, and shows the badge where the profile is visible', async () => {
    const { user, certificate } = await certified({ privacy: { discoverable: false, resumeVisible: false, matchingConsent: true } })
    const before = await Certificate.findOne({ code: certificate.code })
    assert.equal((await api().patch(`${v1}/me`).set(auth(user)).send({ fullName: 'Łukasz Żółć-Nowak' })).status, 200)
    const after = await Certificate.findOne({ code: certificate.code })
    assert.equal(after.holderName, 'Łukasz Żółć-Nowak')
    assert.notEqual(String(after.pdfFileId), String(before.pdfFileId))
    assert.equal(await File.countDocuments({ _id: before.pdfFileId }), 0, 'the old PDF is deleted')
    assert.ok((await pdfText(after.pdfFileId)).text.includes('Łukasz Żółć-Nowak'))
    const own = await api().get(`${v1}/learning/certificates`).set(auth(user))
    assert.deepEqual(own.body.items.map((item) => item.code), [certificate.code])
    const pdf = await api().get(`${v1}/learning/certificates/${own.body.items[0].id}/pdf`).set(auth(user))
    assert.equal((await api().get(pdf.body.url)).headers['content-type'], 'application/pdf')

    // C24: hidden, but an applicant of this company, so the profile and its badge show; another company sees nothing.
    const { user: recruiter, company } = await approvedRecruiter()
    const stage = await PipelineStage.findOne({ companyId: company._id, isEntry: true })
    const job = await Job.create({ companyId: company._id, createdBy: recruiter._id, title: 'Product Designer', employmentType: 'full_time', brief: 'A role.', requiredSkills: skills('Figma'), level: 'mid', experienceYears: 3, workPreference: 'hybrid', country: 'GB', location: PLACES.london, status: 'published' })
    await Application.create({ candidateId: user._id, jobId: job._id, companyId: company._id, stageId: stage._id, status: 'applied', consentAt: new Date(), appliedAt: new Date() })
    const profile = await api().get(`${v1}/recruiter/candidates/${user._id}`).set(auth(recruiter))
    assert.deepEqual(profile.body.courseCertificates.map((badge) => badge.code), [certificate.code])
    const { user: other } = await approvedRecruiter()
    assert.equal((await api().get(`${v1}/recruiter/candidates/${user._id}`).set(auth(other))).status, 404)
  })
})

describe('admin stats and learners (M-110, M-111)', () => {
  it('counts enrolled, purchased and completions, shows revenue per currency only with finance.view, and lists learners', async () => {
    const created = await course({ isFree: false, prices: [{ currency: 'GBP', amountMinor: 1900 }, { currency: 'EUR', amountMinor: 2200 }] })
    const [a, b, c] = await Promise.all([createUser(), createUser(), createUser()])
    for (const user of [a, b, c]) await enroll({ userId: user._id, courseId: created._id, source: 'purchase' })
    const paid = (user, currency, amountMinor, reference) =>
      Payment.create({ reference, userId: user._id, payerRole: 'candidate', payerName: 'x', kind: 'course', itemId: String(created._id), itemName: created.title, amountMinor, currency, status: 'paid', source: 'stripe', paidAt: new Date() })
    await paid(a, 'GBP', 1900, 'LWM-T00001')
    await paid(b, 'EUR', 2200, 'LWM-T00002')
    await paid(c, 'EUR', 2200, 'LWM-T00003')
    await finishLessons(a, created)
    await attempt(a, created._id, answersFor(created))

    const owner = await createUser({ role: 'admin', isOwner: true })
    const list = await api().get(`${v1}/admin/courses?audience=candidate`).set(auth(owner))
    const [row] = list.body.items
    assert.deepEqual([row.enrolled, row.purchased, row.completions], [3, 3, 1])
    assert.deepEqual(row.revenue, [{ currency: 'EUR', amountMinor: 4400 }, { currency: 'GBP', amountMinor: 1900 }])
    assert.deepEqual([list.body.stats.enrolled, list.body.stats.completions, list.body.stats.revenue.length], [3, 1, 2])

    const role = await AdminRole.create({ name: 'Learning only', nameLower: 'learning only', permissions: ['learning.view'] })
    const reader = await createUser({ role: 'admin', adminAccess: { roleId: role._id } })
    const limited = await api().get(`${v1}/admin/courses?audience=candidate`).set(auth(reader))
    assert.equal(limited.body.items[0].revenue, undefined)
    assert.equal(limited.body.stats.revenue, undefined)
    await role.deleteOne()

    const learners = await api().get(`${v1}/admin/courses/${created._id}/learners`).set(auth(owner))
    const done = learners.body.items.find((item) => item.user.id === String(a._id))
    assert.deepEqual([learners.body.total, done.lessonsDone, done.quizBestScore, done.certificate.status], [3, 2, 100, 'valid'])
  })
})

describe('suggestions (M-114, OQ-3)', () => {
  it('suggests candidate courses tagged with gap skills from saved, applied and For-you jobs, ranked by matches', async () => {
    const { user: recruiter, company } = await approvedRecruiter()
    const candidate = await listedCandidate({ profile: { skills: ['Figma'] } })
    const job = (title, required) => Job.create({ companyId: company._id, createdBy: recruiter._id, title, employmentType: 'full_time', brief: 'A role.', requiredSkills: skills(...required), level: 'mid', experienceYears: 3, workPreference: 'hybrid', country: 'GB', location: PLACES.london, status: 'published', publishedAt: new Date(), firstPublishedAt: new Date() })
    const saved = await job('Fintech designer', ['Fintech', 'Interaction Design'])
    await SavedJob.create({ candidateId: candidate._id, jobId: saved._id })
    await job('Systems designer', ['Figma', 'Design Systems'])
    const both = await course({ title: 'Fintech interactions', skillTags: skills('Fintech', 'Interaction Design') })
    const one = await course({ title: 'Design systems basics', skillTags: skills('Design Systems') })
    await course({ title: 'Leadership', skillTags: skills('Leadership') })
    const enrolled = await course({ title: 'Already enrolled', skillTags: skills('Fintech') })
    await enroll({ userId: candidate._id, courseId: enrolled._id, source: 'free' })

    const result = await api().get(`${v1}/learning/suggestions`).set(auth(candidate))
    assert.deepEqual(new Set(result.body.gapSkills), new Set(['Fintech', 'Interaction Design', 'Design Systems']))
    assert.deepEqual(result.body.items.map((item) => [item.id, item.matchedSkills.length]), [[String(both._id), 2], [String(one._id), 1]])
  })

  it('suggests up to 3 recruiter courses by active applications in their pipeline category', async () => {
    const { user: recruiter, company } = await approvedRecruiter()
    const stages = await PipelineStage.find({ companyId: company._id })
    const stageOf = (category) => stages.find((stage) => stage.category === category)
    const job = await Job.create({ companyId: company._id, createdBy: recruiter._id, title: 'Designer', employmentType: 'full_time', brief: 'A role.', requiredSkills: skills('Figma'), level: 'mid', experienceYears: 3, workPreference: 'hybrid', country: 'GB', location: PLACES.london, status: 'published' })
    const apply = async (category, status = 'applied') => {
      const candidate = await createUser()
      return Application.create({ candidateId: candidate._id, jobId: job._id, companyId: company._id, stageId: stageOf(category)._id, status, consentAt: new Date(), appliedAt: new Date() })
    }
    await apply('applied')
    await apply('applied')
    await apply('applied')
    await apply('interview')
    await apply('screening', 'withdrawn')
    await apply('offer', 'not_selected')
    const applied = await course({ audience: 'recruiter', title: 'Talent Strategy', pipelineCategory: 'applied' })
    const interview = await course({ audience: 'recruiter', title: 'Structured Interviewing', pipelineCategory: 'interview' })
    await course({ audience: 'recruiter', title: 'Screening well', pipelineCategory: 'screening' })
    await course({ audience: 'recruiter', title: 'Offers', pipelineCategory: 'offer' })

    const result = await api().get(`${v1}/learning/suggestions`).set(auth(recruiter))
    assert.deepEqual(result.body.items.map((item) => [item.id, item.reason]), [
      [String(applied._id), { count: 3, stage: 'applied' }],
      [String(interview._id), { count: 1, stage: 'interview' }],
    ])
  })
})
