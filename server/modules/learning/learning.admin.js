import { LIMITS } from '../../config/limits.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { removeFiles, signedUrl, storeFile } from '../../lib/files.js'
import { reencodeImage } from '../../lib/images.js'
import { renderMarkdown } from '../../lib/markdown.js'
import { skillEntries } from '../../lib/skills.js'
import { effectivePermissions } from '../admin/admin.service.js'
import { File } from '../files/files.model.js'
import { Country } from '../meta/meta.model.js'
import { userCurrency } from '../meta/meta.service.js'
import { Payment } from '../payments/payments.model.js'
import { User } from '../users/users.model.js'
import { certificateDto, certificatesById } from './learning.certificates.js'
import { Course, Enrollment } from './learning.model.js'

/*
 * Admin course builder (§3.9, M-101 … M-109, U16, U24). Drafts save with format checks only; a published course
 * must stay publishable after every change. Lessons and the quiz lock at the first enrollment (M-108); copy and
 * prices stay editable. Courses are never deleted (M-109). Every change is a Learning audit event.
 */
const C = LIMITS.course
const LESSON_FILES = { video: ['videoFileId', 'lesson_video'], document: ['documentFileId', 'lesson_document'] }

/** The 8 charging currencies (M-130), in country order. */
export async function courseCurrencies() {
  const countries = await Country.find({}, 'currency').sort({ order: 1 })
  return [...new Set(countries.map((country) => country.currency))]
}

async function findCourse(id) {
  const course = await Course.findById(id)
  if (!course) throw new AppError('NOT_FOUND')
  return course
}

const audit = (admin, course, type, params = {}) =>
  recordAudit({ type: `learning.${type}`, category: 'learning', actor: actorFor(admin), target: { type: 'course', id: course._id }, params: { title: course.title, ...params } })

/** U24: every problem that blocks publishing, as field keys. */
export async function publishProblems(course) {
  const fields = {}
  const recruiter = course.audience === 'recruiter'
  const required = ['category', 'level', 'summary', recruiter ? 'lead' : 'about', 'coverFileId', ...(recruiter ? ['tagline', 'designedFor', 'pipelineCategory'] : [])]
  for (const field of required) if (!course[field]) fields[field] = 'required'
  if (course.summary && course.summary.length < C.summary.min) fields.summary = 'too_short'
  const longText = recruiter ? 'lead' : 'about'
  if (course[longText] && course[longText].length < C.about.min) fields[longText] = 'too_short'
  if (!course.outcomes.length) fields.outcomes = 'required'
  if (!course.skillTags.length) fields.skillTags = 'required'
  if (!course.isFree) {
    for (const currency of await courseCurrencies()) {
      if (!course.prices.some((price) => price.currency === currency)) fields[`prices.${currency}`] = 'required'
    }
  }
  if (!course.lessons.length) fields.lessons = 'too_few'
  course.lessons.forEach((lesson, index) => {
    const missing = {
      video: !lesson.videoFileId ? 'videoFileId' : !lesson.durationSec ? 'durationSec' : null,
      document: !lesson.documentFileId && 'documentFileId',
      text: !lesson.textMarkdown?.trim() && 'textMarkdown',
      link: !lesson.url && 'url',
    }[lesson.type]
    if (missing) fields[`lessons.${index}.${missing}`] = 'required'
  })
  if (!course.quiz.questions.length) fields['quiz.questions'] = 'too_few'
  return fields
}

/** A refused publish names the first builder tab with a problem (as the job wizard step, M-039). */
async function assertPublishable(course) {
  const fields = await publishProblems(course)
  if (!Object.keys(fields).length) return
  const roots = new Set(Object.keys(fields).map((field) => field.split('.')[0]))
  const tab = [...roots].some((root) => root !== 'lessons' && root !== 'quiz') ? 'details' : roots.has('lessons') ? 'lessons' : 'quiz'
  throw fieldError(fields, { tab })
}

/** A published course must stay publishable (live edits, as jobs M-037); then save. */
async function save(course, admin) {
  course.updatedBy = admin._id
  if (course.status === 'published') await assertPublishable(course)
  await course.save()
}

function assertUnlocked(course) {
  if (course.lockedAt) throw new AppError('LOCKED', { params: { reason: 'enrolled' } })
}

/** A file just uploaded through POST /admin/uploads for this purpose. */
async function uploadedFile(id, purpose, field) {
  if (!id) return null
  const file = await File.findOne({ _id: id, purpose })
  if (!file) throw fieldError({ [field]: 'invalid' })
  return file._id
}

const fileDto = (file, viewerId, ttlMs) => (file ? { id: String(file._id), name: file.originalName, size: file.size, mime: file.mime, url: signedUrl(file, viewerId, { ttlMs }) } : null)

/** The full course for the builder (and its Preview tab). */
async function builderDto(course, admin) {
  const ids = [course.coverFileId, ...course.lessons.flatMap((lesson) => [lesson.videoFileId, lesson.documentFileId])].filter(Boolean)
  const files = new Map((await File.find({ _id: { $in: ids } })).map((file) => [String(file._id), file]))
  const file = (id, ttlMs) => fileDto(id && files.get(String(id)), admin._id, ttlMs)
  return {
    id: String(course._id),
    audience: course.audience,
    language: course.language,
    title: course.title,
    category: course.category ?? '',
    level: course.level ?? null,
    summary: course.summary ?? '',
    about: course.about ?? '',
    lead: course.lead ?? '',
    tagline: course.tagline ?? '',
    designedFor: course.designedFor ?? '',
    outcomes: course.outcomes,
    skillTags: course.skillTags.map((skill) => skill.name),
    pipelineCategory: course.pipelineCategory ?? null,
    cover: file(course.coverFileId),
    isFree: course.isFree,
    prices: course.prices.map(({ currency, amountMinor }) => ({ currency, amountMinor })),
    currencies: await courseCurrencies(),
    status: course.status,
    locked: Boolean(course.lockedAt),
    publishedAt: course.publishedAt ?? null,
    updatedAt: course.updatedAt,
    lessons: course.lessons.map((lesson) => ({
      id: String(lesson._id),
      title: lesson.title,
      type: lesson.type,
      durationSec: lesson.durationSec ?? null,
      textMarkdown: lesson.textMarkdown ?? '',
      textHtml: lesson.textHtml ?? '',
      url: lesson.url ?? '',
      isPreview: lesson.isPreview,
      contentLanguage: lesson.contentLanguage ?? null,
      video: file(lesson.videoFileId, LIMITS.videoUrlTtlMs),
      document: file(lesson.documentFileId),
    })),
    quiz: {
      passMark: course.quiz.passMark,
      questions: course.quiz.questions.map((question) => ({
        id: String(question._id),
        text: question.text,
        type: question.type,
        options: question.options.map((option) => ({ id: String(option._id), text: option.text })),
        correct: question.options.flatMap((option, index) => (question.correctOptionIds.some((id) => id.equals(option._id)) ? [index] : [])),
      })),
    },
    problems: await publishProblems(course),
  }
}

/** Money per currency, largest first; never summed across currencies (C15). */
const byCurrency = (rows) =>
  Object.entries(rows.reduce((totals, { currency, amountMinor }) => ({ ...totals, [currency]: (totals[currency] ?? 0) + amountMinor }), {}))
    .map(([currency, amountMinor]) => ({ currency, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor)

/**
 * M-110, M-111: enrolled = added or bought; purchased = paid course payments; completions = quiz passed; active =
 * at least one lesson done and not completed; revenue = paid amounts per currency.
 */
async function learnerCounts(courseIds) {
  const [enrollments, purchases] = await Promise.all([
    Enrollment.aggregate([
      { $match: { courseId: { $in: courseIds } } },
      {
        $group: {
          _id: '$courseId',
          enrolled: { $sum: 1 },
          completions: { $sum: { $cond: [{ $ifNull: ['$completedAt', false] }, 1, 0] } },
          active: { $sum: { $cond: [{ $and: [{ $not: ['$completedAt'] }, { $gt: [{ $size: { $filter: { input: '$lessons', cond: { $ne: ['$$this.completedAt', null] } } } }, 0] }] }, 1, 0] } },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { kind: 'course', status: 'paid', itemId: { $in: courseIds.map(String) } } },
      { $group: { _id: { itemId: '$itemId', currency: '$currency' }, purchased: { $sum: 1 }, amountMinor: { $sum: '$amountMinor' } } },
    ]),
  ])
  const byCourse = new Map(enrollments.map((row) => [String(row._id), row]))
  const payments = (id) => purchases.filter((row) => row._id.itemId === String(id))
  return (id) => {
    const row = byCourse.get(String(id))
    return {
      enrolled: row?.enrolled ?? 0,
      completions: row?.completions ?? 0,
      active: row?.active ?? 0,
      purchased: payments(id).reduce((sum, entry) => sum + entry.purchased, 0),
      revenue: byCurrency(payments(id).map((entry) => ({ currency: entry._id.currency, amountMinor: entry.amountMinor }))),
    }
  }
}

/**
 * GET /admin/courses?audience=: rows "{enrolled} enrolled, {purchased} purchased, {completions} completed" and the page
 * totals (M-111). Revenue, per row and in total, only for admins with `finance.view`.
 */
export async function listCourses(admin, { audience }) {
  const courses = await Course.find({ audience }).sort({ updatedAt: -1 })
  const counts = await learnerCounts(courses.map((course) => course._id))
  const finance = (await effectivePermissions(admin)).has('finance.view')
  const currency = (await userCurrency(admin)) ?? 'EUR'
  const items = courses.map((course) => ({
    id: String(course._id),
    title: course.title,
    category: course.category ?? '',
    level: course.level ?? null,
    lessons: course.lessons.length,
    durationSec: course.lessons.reduce((total, lesson) => total + (lesson.durationSec ?? 0), 0),
    isFree: course.isFree,
    price: course.isFree ? null : (course.prices.find((price) => price.currency === currency) ?? null),
    status: course.status,
    updatedAt: course.updatedAt,
    ...counts(course._id),
  }))
  const sum = (field) => items.reduce((total, item) => total + item[field], 0)
  const totals = { enrolled: sum('enrolled'), purchased: sum('purchased'), completions: sum('completions'), ...(finance && { revenue: byCurrency(items.flatMap((item) => item.revenue)) }) }
  return {
    items: items.map(({ revenue, ...item }) => (finance ? { ...item, revenue } : item)),
    total: items.length,
    page: 1,
    pageSize: items.length,
    stats: {
      total: items.length,
      published: items.filter((item) => item.status === 'published').length,
      paid: items.filter((item) => !item.isFree).length,
      activeLearners: sum('active'),
      ...totals,
    },
  }
}

/** GET /admin/courses/:id/learners (M-111): every enrollment with progress, best score and certificate. */
export async function listLearners(admin, id) {
  const course = await findCourse(id)
  const enrollments = await Enrollment.find({ courseId: course._id }).sort({ enrolledAt: -1 })
  const [users, certificates] = await Promise.all([
    User.find({ _id: { $in: enrollments.map((enrollment) => enrollment.userId) } }, 'fullName email role'),
    certificatesById(enrollments.map((enrollment) => enrollment.certificateId)),
  ])
  const byId = new Map(users.map((user) => [String(user._id), user]))
  const lessonIds = new Set(course.lessons.map((lesson) => String(lesson._id)))
  const items = enrollments.map((enrollment) => {
    const user = byId.get(String(enrollment.userId))
    const certificate = enrollment.certificateId && certificates.get(String(enrollment.certificateId))
    return {
      id: String(enrollment._id),
      user: user ? { id: String(user._id), name: user.fullName, email: user.email, role: user.role } : null,
      source: enrollment.source,
      enrolledAt: enrollment.enrolledAt,
      lessonsDone: enrollment.lessons.filter((entry) => entry.completedAt && lessonIds.has(String(entry.lessonId))).length,
      quizBestScore: enrollment.quizBestScore ?? null,
      completedAt: enrollment.completedAt ?? null,
      certificate: certificate ? certificateDto(certificate) : null,
    }
  })
  return { course: { id: String(course._id), title: course.title, audience: course.audience, lessons: course.lessons.length }, items, total: items.length, page: 1, pageSize: items.length }
}

export async function getCourse(admin, id) {
  return builderDto(await findCourse(id), admin)
}

export async function createCourse(admin, { audience, title }) {
  const course = await Course.create({ audience, title, language: admin.language, createdBy: admin._id, updatedBy: admin._id })
  await audit(admin, course, 'course_created')
  return builderDto(course, admin)
}

/** Details and prices: always editable, also after enrollment (M-108). */
export async function updateDetails(admin, id, body) {
  const course = await findCourse(id)
  const { skillTags, coverFileId, pipelineCategory, prices, ...fields } = body
  course.set(fields)
  if (skillTags) course.skillTags = skillEntries(skillTags, 'skillTags')
  if (pipelineCategory !== undefined) course.pipelineCategory = course.audience === 'recruiter' ? (pipelineCategory ?? undefined) : undefined
  if (prices) {
    const currencies = await courseCurrencies()
    const unknown = prices.find((price) => !currencies.includes(price.currency))
    if (unknown || new Set(prices.map((price) => price.currency)).size !== prices.length) throw fieldError({ prices: 'invalid' })
    course.prices = prices
  }
  const previousCover = course.coverFileId
  if (coverFileId !== undefined) course.coverFileId = (await uploadedFile(coverFileId, 'course_cover', 'coverFileId')) ?? undefined
  await save(course, admin)
  if (previousCover && String(previousCover) !== String(course.coverFileId)) await removeFiles([previousCover])
  await audit(admin, course, 'course_details_updated')
  return builderDto(course, admin)
}

/** Applies a lesson body; returns the files it replaced (deleted after the save). */
async function applyLesson(lesson, body) {
  const replaced = []
  const { videoFileId, documentFileId, textMarkdown, ...fields } = body
  Object.assign(lesson, fields)
  for (const [field, purpose] of Object.values(LESSON_FILES)) {
    const value = { videoFileId, documentFileId }[field]
    if (value === undefined) continue
    const next = await uploadedFile(value, purpose, field)
    if (lesson[field] && String(lesson[field]) !== String(next)) replaced.push(lesson[field])
    lesson[field] = next ?? undefined
  }
  if (textMarkdown !== undefined) {
    lesson.textMarkdown = textMarkdown
    lesson.textHtml = renderMarkdown(textMarkdown)
  }
  if (lesson.url === '') lesson.url = undefined
  return replaced
}

export async function addLesson(admin, id, body) {
  const course = await findCourse(id)
  assertUnlocked(course)
  if (course.lessons.length >= C.lessons.max) throw fieldError({ lessons: 'too_many' }, { max: C.lessons.max })
  course.lessons.push({ title: body.title, type: body.type })
  await applyLesson(course.lessons.at(-1), body)
  await save(course, admin)
  await audit(admin, course, 'lesson_added', { lesson: body.title })
  return builderDto(course, admin)
}

function findLesson(course, lessonId) {
  const lesson = course.lessons.id(lessonId)
  if (!lesson) throw new AppError('NOT_FOUND')
  return lesson
}

export async function updateLesson(admin, id, lessonId, body) {
  const course = await findCourse(id)
  assertUnlocked(course)
  const lesson = findLesson(course, lessonId)
  const replaced = await applyLesson(lesson, body)
  await save(course, admin)
  await removeFiles(replaced)
  await audit(admin, course, 'lesson_updated', { lesson: lesson.title })
  return builderDto(course, admin)
}

export async function deleteLesson(admin, id, lessonId) {
  const course = await findCourse(id)
  assertUnlocked(course)
  const lesson = findLesson(course, lessonId)
  const files = [lesson.videoFileId, lesson.documentFileId]
  course.lessons.pull(lesson._id)
  await save(course, admin)
  await removeFiles(files)
  await audit(admin, course, 'lesson_deleted', { lesson: lesson.title })
  return builderDto(course, admin)
}

/** The ids of every lesson, in the new order. */
export async function reorderLessons(admin, id, { lessonIds }) {
  const course = await findCourse(id)
  assertUnlocked(course)
  const current = course.lessons.map((lesson) => String(lesson._id))
  if (lessonIds.length !== current.length || new Set(lessonIds).size !== current.length || !lessonIds.every((lessonId) => current.includes(lessonId))) {
    throw fieldError({ lessonIds: 'invalid' })
  }
  course.lessons = lessonIds.map((lessonId) => course.lessons.id(lessonId).toObject())
  await save(course, admin)
  await audit(admin, course, 'lessons_reordered')
  return builderDto(course, admin)
}

/** M-104: the whole quiz; `correct` holds option indexes. */
export async function saveQuiz(admin, id, { passMark, questions }) {
  const course = await findCourse(id)
  assertUnlocked(course)
  course.quiz.passMark = passMark
  course.quiz.questions = questions.map(({ text, type, options }) => ({ text, type, options }))
  course.quiz.questions.forEach((question, index) => {
    question.correctOptionIds = questions[index].correct.map((optionIndex) => question.options[optionIndex]._id)
  })
  await save(course, admin)
  await audit(admin, course, 'quiz_saved', { questions: questions.length })
  return builderDto(course, admin)
}

/** Publish (U24 and the quiz rules) or unpublish (M-109: hidden, buyers keep access). */
export async function setStatus(admin, id, { status }) {
  const course = await findCourse(id)
  if (status === course.status) return builderDto(course, admin)
  if (status === 'unpublished' && course.status !== 'published') throw new AppError('CONFLICT')
  if (status === 'published') {
    await assertPublishable(course)
    course.publishedAt = new Date()
  }
  course.status = status
  await save(course, admin)
  await audit(admin, course, status === 'published' ? 'course_published' : 'course_unpublished')
  return builderDto(course, admin)
}

/** POST /admin/uploads?purpose=: a cover (re-encoded, M-185), a lesson video or a lesson PDF (moved from disk). */
export async function uploadCourseFile(admin, purpose, upload) {
  const source = purpose === 'course_cover' ? { buffer: await reencodeImage(upload.buffer, upload.ext) } : { tempPath: upload.path }
  const file = await storeFile({ ownerId: admin._id, purpose, ext: upload.ext, originalName: upload.originalname, ...source })
  return fileDto(file, admin._id, purpose === 'lesson_video' ? LIMITS.videoUrlTtlMs : undefined)
}

/** The builder's Markdown preview: the same renderer and sanitiser as the saved lesson (M-102). */
export function previewMarkdown({ markdown }) {
  return { html: renderMarkdown(markdown) }
}
