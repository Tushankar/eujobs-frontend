import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { File } from '../modules/files/files.model.js'
import { Course, Enrollment } from '../modules/learning/learning.model.js'
import { enroll } from '../modules/learning/learning.service.js'
import { Payment } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { image, MB, mp4Header, padded, textPdf, webmHeader } from './helpers/fixtures.js'
import { api, attach, auth, createUser, useTestDb, useTestUploads } from './helpers/index.js'
import { approvedRecruiter } from './helpers/market.js'

useTestDb([User, Company, Course, Enrollment, File, AuditEvent, Payment])
useTestUploads()
before(() => seedCatalog())

const v1 = '/api/v1'
const code = (res) => res.body.error?.code
// OD1: the £19 course in the 8 currencies.
const PRICES = { GBP: 1900, EUR: 2200, PLN: 9500, SEK: 24900, DKK: 16900, CZK: 54900, HUF: 849000, RON: 11500 }
const prices = (skip) => Object.entries(PRICES).filter(([currency]) => currency !== skip).map(([currency, amountMinor]) => ({ currency, amountMinor }))

const owner = () => createUser({ role: 'admin', isOwner: true })
const admin = {
  create: (user, body) => api().post(`${v1}/admin/courses`).set(auth(user)).send(body),
  details: (user, id, body) => api().patch(`${v1}/admin/courses/${id}`).set(auth(user)).send(body),
  addLesson: (user, id, body) => api().post(`${v1}/admin/courses/${id}/lessons`).set(auth(user)).send(body),
  lesson: (user, id, lessonId, body) => api().patch(`${v1}/admin/courses/${id}/lessons/${lessonId}`).set(auth(user)).send(body),
  quiz: (user, id, body) => api().put(`${v1}/admin/courses/${id}/quiz`).set(auth(user)).send(body),
  status: (user, id, status) => api().patch(`${v1}/admin/courses/${id}/status`).set(auth(user)).send({ status }),
  upload: (user, purpose, buffer, filename, type) => attach(api().post(`${v1}/admin/uploads?purpose=${purpose}`).set(auth(user)), buffer, filename, type),
}
const QUESTION = { text: 'Which state helps first-time users?', type: 'single', options: [{ text: 'An empty state' }, { text: 'A spinner' }], correct: [0] }

/** A publishable candidate course with a text lesson (flagged preview) and a PDF lesson, published unless asked not to. */
async function readyCourse(user, { publish = true, audience = 'candidate', ...details } = {}) {
  const created = await admin.create(user, { audience, title: 'Interaction design foundations' })
  const id = created.body.id
  const cover = await admin.upload(user, 'course_cover', await image('jpeg', { width: 320, height: 180 }), 'cover.jpg', 'image/jpeg')
  const recruiterFields = audience === 'recruiter' ? { lead: 'Build fluency so you can read evidence and ask sharper questions.', tagline: 'Practical learning.', designedFor: 'Recruiters', pipelineCategory: 'screening' } : {}
  await admin.details(user, id, {
    category: 'Interaction Design',
    level: 'foundation',
    summary: 'Build clear flows, useful states and accessible interactions.',
    about: 'Prototype one end-to-end flow with keyboard interaction and helpful errors.',
    outcomes: ['Apply core principles to a practical challenge.'],
    skillTags: ['Interaction Design'],
    coverFileId: cover.body.id,
    prices: prices(),
    ...recruiterFields,
    ...details,
  })
  await admin.addLesson(user, id, { title: 'Mapping a user flow', type: 'text', textMarkdown: '## Flows\n\nStart with the goal.', isPreview: true })
  const pdf = await admin.upload(user, 'lesson_document', await textPdf(['Worksheet']), 'worksheet.pdf', 'application/pdf')
  const course = await admin.addLesson(user, id, { title: 'Worksheet', type: 'document', documentFileId: pdf.body.id })
  await admin.quiz(user, id, { passMark: 70, questions: [QUESTION] })
  if (publish) assert.equal((await admin.status(user, id, 'published')).status, 200)
  return { id, lessons: course.body.lessons }
}

describe('course builder (M-101, M-102, M-106, U16, U24)', () => {
  it('creates a draft, refuses to publish an incomplete course and names the reasons and the tab', async () => {
    const user = await owner()
    const created = await admin.create(user, { audience: 'candidate', title: 'Interaction design foundations' })
    assert.equal(created.status, 201)
    assert.deepEqual([created.body.status, created.body.locked, created.body.currencies.length], ['draft', false, 8])
    const refused = await admin.status(user, created.body.id, 'published')
    assert.equal(refused.status, 422)
    assert.equal(refused.body.error.params.tab, 'details')
    for (const field of ['summary', 'about', 'coverFileId', 'prices.HUF', 'lessons', 'quiz.questions']) assert.ok(refused.body.error.fields[field], field)

    // U24: all 8 prices, or Free.
    const { id } = await readyCourse(user, { publish: false, prices: prices('HUF') })
    const noHuf = await admin.status(user, id, 'published')
    assert.deepEqual([noHuf.status, noHuf.body.error.fields, noHuf.body.error.params.tab], [422, { 'prices.HUF': 'required' }, 'details'])
    await admin.details(user, id, { isFree: true })
    assert.equal((await admin.status(user, id, 'published')).body.status, 'published')
    const audit = await AuditEvent.find({ category: 'learning' }).sort({ at: 1 })
    assert.ok(audit.some((event) => event.type === 'learning.course_published'))
    assert.ok(audit.some((event) => event.type === 'learning.lesson_added'))
  })

  it('needs a recruiter course to carry a pipeline category, lead, tagline and designed for (OQ-3, M-107)', async () => {
    const user = await owner()
    const { id } = await readyCourse(user, { publish: false, audience: 'recruiter', pipelineCategory: null, tagline: '' })
    const refused = await admin.status(user, id, 'published')
    assert.deepEqual(refused.body.error.fields, { pipelineCategory: 'required', tagline: 'required' })
  })

  it('sanitises Markdown, accepts https links only, and checks lesson files and quiz rules', async () => {
    const user = await owner()
    const { id } = await readyCourse(user, { publish: false })
    const preview = await api().post(`${v1}/admin/markdown/preview`).set(auth(user)).send({ markdown: '<script>alert(1)</script>\n\n[x](javascript:alert(2)) [ok](https://example.org)' })
    assert.doesNotMatch(preview.body.html, /<script|href="javascript/)
    assert.match(preview.body.html, /href="https:\/\/example.org"/)

    const http = await admin.addLesson(user, id, { title: 'Further reading', type: 'link', url: 'http://example.org' })
    assert.deepEqual([http.status, http.body.error.fields.url], [422, 'invalid'])
    assert.equal((await admin.addLesson(user, id, { title: 'Further reading', type: 'link', url: 'https://example.org' })).status, 201)
    const pdfAsVideo = await admin.addLesson(user, id, { title: 'Intro video', type: 'video', videoFileId: (await File.findOne({ purpose: 'lesson_document' }))._id.toString() })
    assert.deepEqual(pdfAsVideo.body.error.fields, { videoFileId: 'invalid' })

    // A video lesson without duration cannot be published (the browser reads it at upload, U16).
    const video = await admin.upload(user, 'lesson_video', mp4Header(), 'intro.mp4', 'video/mp4')
    assert.equal(video.status, 201)
    const added = await admin.addLesson(user, id, { title: 'Intro video', type: 'video', videoFileId: video.body.id })
    const refused = await admin.status(user, id, 'published')
    assert.deepEqual([refused.body.error.fields, refused.body.error.params.tab], [{ 'lessons.3.durationSec': 'required' }, 'lessons'])
    await admin.lesson(user, id, added.body.lessons[3].id, { durationSec: 31 })

    // M-104: 2–6 options; one correct option for single choice, at least one for multiple.
    const oneOption = await admin.quiz(user, id, { passMark: 70, questions: [{ ...QUESTION, options: [{ text: 'Only' }] }] })
    assert.equal(oneOption.body.error.fields['questions.0.options'], 'too_few')
    const noCorrect = await admin.quiz(user, id, { passMark: 70, questions: [{ ...QUESTION, type: 'multiple', correct: [] }] })
    assert.equal(noCorrect.body.error.fields['questions.0.correct'], 'invalid')
    const twoForSingle = await admin.quiz(user, id, { passMark: 70, questions: [{ ...QUESTION, correct: [0, 1] }] })
    assert.equal(twoForSingle.body.error.fields['questions.0.correct'], 'invalid')
    const saved = await admin.quiz(user, id, { passMark: 80, questions: [QUESTION, { ...QUESTION, type: 'multiple', options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }], correct: [0, 2] }] })
    assert.deepEqual(saved.body.quiz.questions.map((question) => question.correct), [[0], [0, 2]])
    assert.equal((await admin.status(user, id, 'published')).status, 200)
  })

  it('reorders lessons and replaces lesson files', async () => {
    const user = await owner()
    const { id, lessons } = await readyCourse(user, { publish: false })
    const order = await api().put(`${v1}/admin/courses/${id}/lessons/order`).set(auth(user)).send({ lessonIds: [lessons[1].id, lessons[0].id] })
    assert.deepEqual(order.body.lessons.map((lesson) => lesson.title), ['Worksheet', 'Mapping a user flow'])
    const partial = await api().put(`${v1}/admin/courses/${id}/lessons/order`).set(auth(user)).send({ lessonIds: [lessons[0].id] })
    assert.equal(partial.status, 422)
    const replacement = await admin.upload(user, 'lesson_document', await textPdf(['Worksheet v2']), 'worksheet-2.pdf', 'application/pdf')
    await admin.lesson(user, id, lessons[1].id, { documentFileId: replacement.body.id })
    assert.equal(await File.countDocuments({ purpose: 'lesson_document' }), 1)
  })

  it('checks upload types and sizes (M-185, M-102)', async () => {
    const user = await owner()
    const webm = await admin.upload(user, 'lesson_video', webmHeader(), 'intro.webm', 'video/webm')
    assert.deepEqual([webm.status, webm.body.mime], [201, 'video/webm'])
    const renamed = await admin.upload(user, 'lesson_video', await textPdf(['x']), 'intro.mp4', 'video/mp4')
    assert.deepEqual([renamed.status, code(renamed)], [422, 'FILE_TYPE_NOT_ALLOWED'])
    const bigCover = await admin.upload(user, 'course_cover', padded(await image('jpeg'), 6 * MB), 'cover.jpg', 'image/jpeg')
    assert.deepEqual([bigCover.status, code(bigCover)], [413, 'FILE_TOO_LARGE'])
    const bigPdf = await admin.upload(user, 'lesson_document', padded(await textPdf(['x']), 51 * MB), 'big.pdf', 'application/pdf')
    assert.deepEqual([bigPdf.status, code(bigPdf)], [413, 'FILE_TOO_LARGE'])
    // Refused disk uploads leave nothing behind.
    assert.equal(await File.countDocuments({ purpose: { $ne: 'lesson_video' } }), 0)
  })

  it('needs learning.view to read and learning.manage to change (M-155)', async () => {
    const role = await AdminRole.create({ name: 'Course readers', nameLower: 'course readers', permissions: ['learning.view'] })
    const reader = await createUser({ role: 'admin', adminAccess: { roleId: role._id } })
    assert.equal((await api().get(`${v1}/admin/courses?audience=candidate`).set(auth(reader))).status, 200)
    const refused = await admin.create(reader, { audience: 'candidate', title: 'Nope course' })
    assert.deepEqual([refused.status, refused.body.error.params], [403, { permission: 'learning.manage' }])
    const upload = await admin.upload(reader, 'course_cover', await image('jpeg'), 'cover.jpg', 'image/jpeg')
    assert.equal(upload.status, 403)
    await role.deleteOne()
  })
})

describe('lock, unpublish and the learner side (M-106, M-108, M-109, M-110, M-130)', () => {
  it('lists published courses of the own audience with the header-country price, and opens only preview lessons', async () => {
    const user = await owner()
    const { id, lessons } = await readyCourse(user)
    const draft = await readyCourse(user, { publish: false })
    await readyCourse(user, { audience: 'recruiter' })
    const candidate = await createUser({ pickerCountry: 'PL' })

    const list = await api().get(`${v1}/courses`).set(auth(candidate))
    assert.deepEqual(list.body.items.map((item) => [item.id, item.price, item.isFree]), [[id, { currency: 'PLN', amountMinor: 9500 }, false]])
    assert.equal((await api().get(`${v1}/courses/${draft.id}`).set(auth(candidate))).status, 404)

    const details = await api().get(`${v1}/courses/${id}`).set(auth(candidate))
    assert.deepEqual(details.body.curriculum.map((lesson) => lesson.state), ['open', 'locked'])
    assert.deepEqual(details.body.included, { video: 0, text: 1, document: 1, link: 0, quizQuestions: 1 })
    const preview = await api().get(`${v1}/learning/courses/${id}/lessons/${lessons[0].id}`).set(auth(candidate))
    assert.deepEqual([preview.status, preview.body.html.includes('<h2>Flows</h2>'), preview.body.nextId], [200, true, lessons[1].id])
    assert.equal((await api().get(`${v1}/learning/courses/${id}/lessons/${lessons[1].id}`).set(auth(candidate))).status, 403)
  })

  it('enrols in a free course once, locks lessons and quiz but not copy or prices, streams the PDF with Range', async () => {
    const user = await owner()
    const { id, lessons } = await readyCourse(user, { isFree: true })
    const candidate = await createUser()
    const enrolled = await api().post(`${v1}/learning/enrollments`).set(auth(candidate)).send({ courseId: id })
    assert.deepEqual([enrolled.status, enrolled.body.enrollment.source], [201, 'free'])
    assert.equal(code(await api().post(`${v1}/learning/enrollments`).set(auth(candidate)).send({ courseId: id })), 'CONFLICT')

    const lesson = await api().get(`${v1}/learning/courses/${id}/lessons/${lessons[1].id}`).set(auth(candidate))
    assert.equal(lesson.body.media.mime, 'application/pdf')
    const range = await api().get(lesson.body.media.url).set('Range', 'bytes=0-3')
    assert.deepEqual([range.status, range.headers['content-range']?.startsWith('bytes 0-3/')], [206, true])

    // M-108: locked once anyone is enrolled; copy and prices stay editable.
    const locked = await admin.addLesson(user, id, { title: 'Extra lesson', type: 'text', textMarkdown: 'More.' })
    assert.deepEqual([locked.status, code(locked)], [409, 'LOCKED'])
    assert.equal(code(await admin.quiz(user, id, { passMark: 70, questions: [QUESTION] })), 'LOCKED')
    const copy = await admin.details(user, id, { summary: 'A new summary that is long enough.', isFree: false })
    assert.deepEqual([copy.status, copy.body.locked], [200, true])

    // M-109: unpublished courses leave the catalogue; the enrolled learner keeps them.
    await admin.status(user, id, 'unpublished')
    const other = await createUser()
    assert.equal((await api().get(`${v1}/courses`).set(auth(other))).body.total, 0)
    assert.equal((await api().get(`${v1}/courses/${id}`).set(auth(other))).status, 404)
    assert.equal((await api().get(`${v1}/courses`).set(auth(candidate))).body.items[0].status, 'unpublished')
    assert.equal((await api().get(`${v1}/learning/courses/${id}/lessons/${lessons[1].id}`).set(auth(candidate))).status, 200)
  })

  it('refuses a free enrolment in a paid course, and lets approved recruiters learn recruiter courses (M-112)', async () => {
    const user = await owner()
    const paid = await readyCourse(user)
    const candidate = await createUser()
    assert.equal((await api().post(`${v1}/learning/enrollments`).set(auth(candidate)).send({ courseId: paid.id })).status, 403)
    const recruiterCourse = await readyCourse(user, { audience: 'recruiter', isFree: true })
    const { user: recruiter } = await approvedRecruiter()
    assert.equal((await api().get(`${v1}/courses`).set(auth(recruiter))).body.items[0].id, recruiterCourse.id)
    assert.equal((await api().post(`${v1}/learning/enrollments`).set(auth(recruiter)).send({ courseId: recruiterCourse.id })).status, 201)
    const { user: pending } = await approvedRecruiter({ status: 'pending_review' })
    assert.equal((await api().get(`${v1}/courses`).set(auth(pending))).status, 403)
  })

  it('counts enrolled, purchased and active learners on the admin list (M-110)', async () => {
    const user = await owner()
    const { id, lessons } = await readyCourse(user)
    const [a, b] = await Promise.all([createUser(), createUser()])
    await enroll({ userId: a._id, courseId: id, source: 'purchase' })
    await enroll({ userId: b._id, courseId: id, source: 'seed' })
    await Enrollment.updateOne({ userId: a._id }, { lessons: [{ lessonId: lessons[0].id, completedAt: new Date() }] })
    await Payment.create({ reference: 'LWM-T00001', userId: a._id, payerRole: 'candidate', payerName: 'A', kind: 'course', itemId: id, itemName: 'x', amountMinor: 1900, currency: 'GBP', status: 'paid', source: 'stripe', paidAt: new Date() })
    const list = await api().get(`${v1}/admin/courses?audience=candidate`).set(auth(user))
    const [row] = list.body.items
    assert.deepEqual([row.enrolled, row.purchased, row.active, row.lessons], [2, 1, 1, 2])
    assert.deepEqual(list.body.stats, {
      total: 1,
      published: 1,
      paid: 1,
      activeLearners: 1,
      // M-111 page totals; revenue because the Owner has finance.view.
      enrolled: 2,
      purchased: 1,
      completions: 0,
      revenue: [{ currency: 'GBP', amountMinor: 1900 }],
    })
    assert.ok((await Course.findById(id)).lockedAt)
  })
})
