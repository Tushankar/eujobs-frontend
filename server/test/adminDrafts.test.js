import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { LIMITS } from '../config/limits.js'
import { AiCache, AiUsage, ApiUsage } from '../modules/ai/ai.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company, KycDocument } from '../modules/companies/companies.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Course } from '../modules/learning/learning.model.js'
import { quizBody } from '../modules/learning/learning.schemas.js'
import { ModerationCase } from '../modules/moderation/moderation.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { aiStub } from './helpers/ai.js'
import { api, auth, createUser, useTestDb } from './helpers/index.js'

/* Phase 4 (owner 2026-11-17): the admin AI helpers — course details, quiz questions, report triage, blog drafts, account review. */
useTestDb([User, Course, ModerationCase, Company, KycDocument, Job, CandidateProfile, AiCache, AiUsage, ApiUsage])
before(() => seedCatalog())
beforeEach(() => aiStub.reset())
after(() => aiStub.reset())

const v1 = '/api/v1/admin/ai-drafts'
const C = LIMITS.course
const call = (user, path, body = {}) => api().post(`${v1}${path}`).set(auth(user)).send(body)
const requests = (name) => aiStub.calls.filter((entry) => entry.kind === 'response' && entry.text?.format?.name === name)
const admin = (...granted) => createUser({ role: 'admin', fullName: 'Ada Admin', adminAccess: { granted } })
const reply = (name, answer) => {
  aiStub.reply = (request) => (request.text.format.name === name ? answer : null)
}

async function course(fields = {}) {
  return Course.create({
    audience: 'candidate',
    title: 'Interview basics',
    category: 'Careers',
    level: 'foundation',
    lessons: [
      { title: 'Research the company', type: 'text', textMarkdown: `Read the job post twice. ${'Know the company. '.repeat(200)}` },
      { title: 'Answer with STAR', type: 'text', textMarkdown: 'Situation, task, action and result: one example per answer.' },
      { title: 'Welcome video', type: 'video' },
    ],
    ...fields,
  })
}

describe('course details writer', () => {
  it('drafts the details cut to the course limits, from the form and the lesson text, without counting the admin', async () => {
    const editor = await admin('learning.view', 'learning.manage')
    const item = await course()
    reply('course_details', {
      summary: `  ${'s'.repeat(400)}  `,
      about: 'a'.repeat(1200),
      tagline: 't'.repeat(200),
      designedFor: 'd'.repeat(300),
      outcomes: ['Prepare for an interview', ' ', 'prepare for an interview', ...Array.from({ length: 8 }, (_, index) => `Outcome ${index} ${'o'.repeat(250)}`)],
      skillTags: ['Interviewing', 'interviewing', '', 'STAR method', 'x'.repeat(80), ...Array.from({ length: 12 }, (_, index) => `Skill ${index}`)],
    })
    const response = await call(editor, `/courses/${item._id}/details`, { title: 'Interview skills', category: '', level: 'intermediate' })
    assert.equal(response.status, 200)
    const body = response.body
    assert.equal(body.summary, 's'.repeat(C.summary.max))
    assert.equal(body.about.length, C.about.max)
    assert.equal(body.tagline.length, C.tagline.max)
    assert.equal(body.designedFor.length, C.designedFor.max)
    assert.equal(body.outcomes.length, C.outcomes.max)
    assert.equal(body.outcomes[0], 'Prepare for an interview')
    assert.ok(body.outcomes.every((outcome) => outcome.length <= C.outcomes.itemMax))
    assert.equal(body.skillTags.length, C.skillTags.max)
    assert.deepEqual(body.skillTags.slice(0, 3), ['Interviewing', 'STAR method', 'x'.repeat(C.skillTags.itemMax)])

    const input = JSON.parse(requests('course_details')[0].input)
    // The form's unsaved title and level win; an empty category falls back to the saved one.
    assert.deepEqual([input.title, input.level, input.category, input.audience], ['Interview skills', 'intermediate', 'Careers', 'candidate'])
    assert.deepEqual(input.lessons.map((lesson) => lesson.title), ['Research the company', 'Answer with STAR', 'Welcome video'])
    assert.ok(input.lessons[0].text.length <= 1500)
    assert.equal(input.lessons[2].text, null)
    assert.equal(await AiUsage.countDocuments(), 0)
  })

  it('needs learning.manage', async () => {
    const item = await course()
    const viewer = await admin('learning.view')
    const refused = await call(viewer, `/courses/${item._id}/details`)
    assert.equal(refused.status, 403)
    assert.deepEqual(refused.body.error, { code: 'PERMISSION_DENIED', params: { permission: 'learning.manage' } })
    assert.equal((await call(await createUser(), `/courses/${item._id}/details`)).status, 403)
    assert.equal(requests('course_details').length, 0)
  })
})

describe('quiz question writer', () => {
  it('returns questions that obey the quiz rules, never repeating a saved one', async () => {
    const editor = await admin('learning.manage')
    const item = await course({ quiz: { passMark: 70, questions: [{ text: 'What does STAR stand for?', type: 'single', options: [{ text: 'A' }, { text: 'B' }] }] } })
    const long = 'o'.repeat(260)
    reply('quiz_questions', {
      questions: [
        { text: 'What should you read twice?', type: 'single', options: ['The job post', 'The contract', ' '], correct: [0] },
        // Single with two correct options becomes multiple.
        { text: 'Which are parts of STAR?', type: 'single', options: ['Situation', 'Result', 'Salary'], correct: [0, 1] },
        // No correct option: dropped.
        { text: 'Which answer is right here?', type: 'single', options: ['One', 'Two'], correct: [] },
        // Duplicates and blanks go, the correct index follows the option it pointed at; seven options are cut to six.
        { text: 'Pick the action step of STAR.', type: 'single', options: ['Task', 'task', '', 'Action', long, 'E', 'F', 'G', 'H'], correct: [3] },
        // Out of range only: dropped.
        { text: 'What comes after the task?', type: 'single', options: ['Action', 'Result'], correct: [5] },
        // Too short a text: dropped.
        { text: 'Why?', type: 'single', options: ['A', 'B'], correct: [0] },
        // Repeats the saved question: dropped.
        { text: 'What does STAR stand for?', type: 'single', options: ['Situation, task, action, result', 'Other'], correct: [0] },
        { text: 'How many examples per answer?', type: 'single', options: ['One', 'Three'], correct: [0] },
      ],
    })
    const response = await call(editor, `/courses/${item._id}/quiz-questions`, { count: 3 })
    assert.equal(response.status, 200)
    const { questions } = response.body
    assert.equal(questions.length, 3)
    assert.deepEqual(questions[0], { text: 'What should you read twice?', type: 'single', options: [{ text: 'The job post' }, { text: 'The contract' }], correct: [0] })
    assert.deepEqual([questions[1].type, questions[1].correct], ['multiple', [0, 1]])
    assert.deepEqual(questions[2].options.map((option) => option.text), ['Task', 'Action', 'o'.repeat(C.quiz.option.max), 'E', 'F', 'G'])
    assert.deepEqual(questions[2].correct, [1])
    // What the quiz editor would save passes the server's own rules.
    assert.ok(quizBody.safeParse({ passMark: 70, questions }).success)

    const input = JSON.parse(requests('quiz_questions')[0].input)
    assert.equal(input.count, 3)
    assert.deepEqual(input.existingQuestions, ['What does STAR stand for?'])
    assert.equal(input.lessons.length, 2)
    assert.equal(requests('quiz_questions')[0].model, aiStub.models.main)
  })

  it('refuses a course without lesson text, a bad count and an admin without learning.manage', async () => {
    const editor = await admin('learning.manage')
    const empty = await course({ lessons: [{ title: 'Welcome video', type: 'video' }, { title: 'Blank page', type: 'text', textMarkdown: '   ' }] })
    const refused = await call(editor, `/courses/${empty._id}/quiz-questions`, {})
    assert.equal(refused.status, 422)
    assert.deepEqual(refused.body.error.fields, { lessons: 'no_text' })
    const item = await course()
    assert.equal((await call(editor, `/courses/${item._id}/quiz-questions`, { count: C.quiz.questions.max + 1 })).status, 422)
    assert.equal((await call(await admin('learning.view'), `/courses/${item._id}/quiz-questions`, {})).status, 403)
    assert.equal(requests('quiz_questions').length, 0)
  })
})

describe('report triage', () => {
  async function jobCase() {
    const owner = await createUser({ role: 'recruiter', fullName: 'Rita Owner' })
    const company = await Company.create({ ownerUserId: owner._id, legalName: 'Shady Ltd', displayName: 'Shady Jobs' })
    const job = await Job.create({
      companyId: company._id,
      createdBy: owner._id,
      title: 'Easy money from home',
      employmentType: 'full_time',
      brief: 'Pay a 200 EUR starter fee and earn thousands. Write to me at boss@shady.example.',
      responsibilities: ['Send the fee'],
      requiredSkills: [{ name: 'Sales', key: 'sales' }],
      status: 'published',
    })
    const [zelda, omar] = await Promise.all([createUser({ fullName: 'Zelda Quill' }), createUser({ fullName: 'Omar Finch' })])
    const item = await ModerationCase.create({
      targetType: 'job',
      targetId: job._id,
      targetName: job.title,
      ownerId: owner._id,
      openedBy: 'user',
      reports: [
        { reporterId: zelda._id, reason: 'misleading', details: `They asked me for money. I am Zelda Quill, reach me at ${zelda.email}.`, at: new Date() },
        { reporterId: omar._id, reason: 'other', details: 'omar finch here: this is a scam', at: new Date() },
      ],
      history: [{ action: 'opened', at: new Date() }],
    })
    return { item, reporters: [zelda, omar] }
  }

  it('suggests severity, reason, action and rationale without sending who reported it', async () => {
    const moderator = await admin('moderation.manage')
    const { item, reporters } = await jobCase()
    reply('report_triage', { severity: 'high', reason: 'scam_or_fraud', action: 'restrict', rationale: `  ${'r'.repeat(700)}` })
    const response = await call(moderator, `/moderation/cases/${item._id}/triage`)
    assert.equal(response.status, 200)
    assert.deepEqual([response.body.severity, response.body.reason, response.body.action], ['high', 'scam_or_fraud', 'restrict'])
    assert.equal(response.body.rationale.length, 600)

    const [request] = requests('report_triage')
    const sent = request.input
    for (const reporter of reporters) {
      for (const secret of [reporter.fullName, reporter.email, String(reporter._id)]) assert.ok(!sent.toLowerCase().includes(secret.toLowerCase()), `sent ${secret}`)
    }
    // No e-mail address at all, also the one in the job text.
    assert.ok(!/@/.test(sent))
    const input = JSON.parse(sent)
    assert.deepEqual(input.availableActions, ['dismiss', 'restrict'])
    assert.deepEqual(input.reports.map((entry) => entry.reason), ['misleading', 'other'])
    assert.equal(input.content.title, 'Easy money from home')
    assert.match(input.content.brief, /starter fee/)
    assert.equal(await AiUsage.countDocuments(), 0)
  })

  it('never suggests an action the case does not allow, and needs moderation.manage', async () => {
    const moderator = await admin('moderation.manage')
    const company = await Company.create({ ownerUserId: (await createUser({ role: 'recruiter' }))._id, legalName: 'Acme Ltd', displayName: 'Acme' })
    const item = await ModerationCase.create({
      targetType: 'company',
      targetId: company._id,
      targetName: 'Acme',
      openedBy: 'user',
      reports: [{ reporterId: (await createUser())._id, reason: 'offensive', at: new Date() }],
    })
    reply('report_triage', { severity: 'medium', reason: 'offensive', action: 'restrict', rationale: 'Rude wording.' })
    const response = await call(moderator, `/moderation/cases/${item._id}/triage`)
    assert.equal(response.body.action, 'dismiss')
    assert.deepEqual(JSON.parse(requests('report_triage')[0].input).availableActions, ['dismiss'])

    const refused = await call(await admin('learning.manage', 'content.manage'), `/moderation/cases/${item._id}/triage`)
    assert.equal(refused.status, 403)
    assert.equal(refused.body.error.params.permission, 'moderation.manage')
  })
})

describe('blog draft writer', () => {
  it('drafts a Markdown body and an excerpt cut to the blog limits, never cached', async () => {
    const writer = await admin('content.view', 'content.manage')
    reply('blog_draft', { bodyMarkdown: `## Start\n\n${'b'.repeat(LIMITS.blog.body.max + 100)}`, excerpt: `  ${'e'.repeat(400)}` })
    const body = { title: 'How to write a CV for Europe', points: '- one page\n- keep it recent\n- list languages' }
    const response = await call(writer, '/blog-draft', body)
    assert.equal(response.status, 200)
    assert.equal(response.body.bodyMarkdown.length, LIMITS.blog.body.max)
    assert.ok(response.body.bodyMarkdown.startsWith('## Start'))
    assert.equal(response.body.excerpt, 'e'.repeat(LIMITS.blog.excerpt.max))
    assert.deepEqual(JSON.parse(requests('blog_draft')[0].input), body)
    await call(writer, '/blog-draft', body)
    assert.equal(requests('blog_draft').length, 2)
    assert.equal(await AiUsage.countDocuments(), 0)
  })

  it('needs a title, points and content.manage', async () => {
    const writer = await admin('content.manage')
    assert.equal((await call(writer, '/blog-draft', { title: 'Hiring tips', points: '' })).status, 422)
    assert.equal((await call(writer, '/blog-draft', { title: 'Tip', points: 'one point' })).status, 422)
    const refused = await call(await admin('content.view'), '/blog-draft', { title: 'Hiring tips', points: 'one point' })
    assert.equal(refused.status, 403)
    assert.equal(refused.body.error.params.permission, 'content.manage')
    assert.equal(requests('blog_draft').length, 0)
  })
})

describe('recruiter review summary', () => {
  async function pendingRecruiter(fields = {}) {
    const user = await createUser({ role: 'recruiter', status: 'pending_review', fullName: 'Priya Applicant', jobTitle: 'Head of People', email: 'priya@gmail.com', phone: { e164: '+447700900123', verifiedAt: new Date() } })
    const company = await Company.create({
      ownerUserId: user._id,
      legalName: 'Northwind Logistics Ltd',
      displayName: 'Northwind',
      website: 'https://www.northwind.example',
      businessEmail: 'hr@northwind-mail.example',
      industry: 'Logistics',
      size: '51_200',
      location: PLACES.london,
      businessAddress: 'Unit 4',
      registrationDetails: '',
      submittedAt: new Date(),
      ...fields,
    })
    await KycDocument.create({ companyId: company._id, userId: user._id, type: 'registration', fileId: company._id })
    return { user, company }
  }

  it('summarises the submitted details with flags, sends domains only and caches per details', async () => {
    const moderator = await admin('moderation.manage')
    const { user, company } = await pendingRecruiter()
    reply('account_review_summary', { summary: `  ${'s'.repeat(900)}`, flags: ['Email domain differs', 'email domain differs', '', ...Array.from({ length: 8 }, (_, index) => `Flag ${index} ${'f'.repeat(250)}`)] })
    const response = await call(moderator, `/moderation/accounts/${user._id}/summary`)
    assert.equal(response.status, 200)
    assert.equal(response.body.summary.length, 800)
    assert.equal(response.body.flags.length, 6)
    assert.equal(response.body.flags[0], 'Email domain differs')
    assert.ok(response.body.flags.every((flag) => flag.length <= 200))

    const sent = requests('account_review_summary')[0].input
    for (const secret of ['Priya', 'priya@', 'hr@', '+4477', String(company._id)]) assert.ok(!sent.includes(secret), `sent ${secret}`)
    const input = JSON.parse(sent)
    assert.deepEqual(
      [input.accountEmailDomain, input.company.websiteDomain, input.company.businessEmailDomain, input.company.businessEmailMatchesWebsite],
      ['gmail.com', 'northwind.example', 'northwind-mail.example', false],
    )
    assert.deepEqual([input.recruiterJobTitle, input.company.registrationDetails, input.uploadedDocumentTypes], ['Head of People', null, ['registration']])

    // The same details again: the cached summary, no new request; changed details ask again.
    await call(moderator, `/moderation/accounts/${user._id}/summary`)
    assert.equal(requests('account_review_summary').length, 1)
    await Company.updateOne({ _id: company._id }, { registrationDetails: 'Companies House 01234567' })
    await call(moderator, `/moderation/accounts/${user._id}/summary`)
    assert.equal(requests('account_review_summary').length, 2)
    assert.equal(await AiUsage.countDocuments(), 0)
  })

  it('needs moderation.manage and a recruiter', async () => {
    const { user } = await pendingRecruiter()
    const refused = await call(await admin('learning.manage'), `/moderation/accounts/${user._id}/summary`)
    assert.equal(refused.status, 403)
    assert.equal(refused.body.error.params.permission, 'moderation.manage')
    const candidate = await createUser()
    assert.equal((await call(await admin('moderation.manage'), `/moderation/accounts/${candidate._id}/summary`)).status, 404)
  })
})
