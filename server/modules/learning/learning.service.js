import { LIMITS } from '../../config/limits.js'
import { AppError } from '../../lib/errors.js'
import { signedUrl } from '../../lib/files.js'
import { File } from '../files/files.model.js'
import { userCurrency } from '../meta/meta.service.js'
import { Payment } from '../payments/payments.model.js'
import { certificateDto } from './learning.certificates.js'
import { Certificate, Course, Enrollment } from './learning.model.js'

/*
 * Learner side (§3.9): candidates see candidate courses, approved recruiters recruiter courses (M-112: purchases
 * belong to the user). The catalogue lists published courses, plus unpublished ones the user is enrolled in
 * (M-109: buyers keep access). Prices are in the header country's currency (M-130); there are no tiers (M-100).
 * A lesson opens when the user is enrolled, or it is a free preview of a published course (M-106).
 */
const sum = (lessons) => lessons.reduce((total, lesson) => total + (lesson.durationSec ?? 0), 0)

/** Enrolls once (free, purchase or seed); the first enrollment locks lessons and quiz (M-108). */
export async function enroll({ userId, courseId, source, paymentId, enrolledAt = new Date() }) {
  await Enrollment.updateOne({ userId, courseId }, { $setOnInsert: { source, paymentId, enrolledAt } }, { upsert: true })
  await Course.updateOne({ _id: courseId, lockedAt: null }, { lockedAt: enrolledAt })
  return Enrollment.findOne({ userId, courseId })
}

async function enrollmentsOf(user, courseIds) {
  const enrollments = await Enrollment.find({ userId: user._id, ...(courseIds && { courseId: { $in: courseIds } }) })
  return new Map(enrollments.map((enrollment) => [String(enrollment.courseId), enrollment]))
}

/** A course of the user's audience that is published, or that the user is enrolled in. */
async function visibleCourse(user, id) {
  const course = await Course.findOne({ _id: id, audience: user.role })
  if (!course) throw new AppError('NOT_FOUND')
  const enrollment = (await enrollmentsOf(user, [course._id])).get(String(course._id))
  if (course.status !== 'published' && !enrollment) throw new AppError('NOT_FOUND')
  return { course, enrollment }
}

const doneIds = (enrollment) => new Set((enrollment?.lessons ?? []).filter((lesson) => lesson.completedAt).map((lesson) => String(lesson.lessonId)))

function enrollmentDto(course, enrollment) {
  if (!enrollment) return null
  const done = doneIds(enrollment)
  return {
    enrolledAt: enrollment.enrolledAt,
    source: enrollment.source,
    lessonsDone: course.lessons.filter((lesson) => done.has(String(lesson._id))).length,
    quizBestScore: enrollment.quizBestScore ?? null,
    completedAt: enrollment.completedAt ?? null,
  }
}

async function coverUrls(courses, viewerId) {
  const files = await File.find({ _id: { $in: courses.map((course) => course.coverFileId).filter(Boolean) } })
  return new Map(files.map((file) => [String(file._id), signedUrl(file, viewerId)]))
}

function cardDto(course, { currency, covers, enrollment }) {
  return {
    id: String(course._id),
    audience: course.audience,
    language: course.language,
    title: course.title,
    category: course.category,
    level: course.level,
    summary: course.summary,
    lead: course.lead ?? '',
    coverUrl: covers.get(String(course.coverFileId)) ?? null,
    lessons: course.lessons.length,
    durationSec: sum(course.lessons),
    isFree: course.isFree,
    price: course.isFree ? null : (course.prices.find((price) => price.currency === currency) ?? null),
    status: course.status,
    skillTags: course.skillTags.map((skill) => skill.name),
    enrollment: enrollmentDto(course, enrollment),
  }
}

async function cardContext(user, courses) {
  return {
    currency: (await userCurrency(user)) ?? 'EUR',
    covers: await coverUrls(courses, user._id),
    enrollments: await enrollmentsOf(user, courses.map((course) => course._id)),
  }
}

/** Catalogue cards of `courses` for this user (also the suggestions, OQ-3). */
export async function courseCards(user, courses) {
  const context = await cardContext(user, courses)
  return courses.map((course) => cardDto(course, { ...context, enrollment: context.enrollments.get(String(course._id)) }))
}

/** GET /courses: the user's catalogue. */
export async function listCourses(user) {
  const enrolled = await Enrollment.find({ userId: user._id }, 'courseId')
  const courses = await Course.find({
    audience: user.role,
    $or: [{ status: 'published' }, { _id: { $in: enrolled.map((enrollment) => enrollment.courseId) } }],
  }).sort({ publishedAt: -1 })
  const items = await courseCards(user, courses)
  return { items, total: items.length, page: 1, pageSize: items.length }
}

/** GET /courses/:id: details, the derived "Included" counts and the curriculum states. */
export async function getCourse(user, id) {
  const { course, enrollment } = await visibleCourse(user, id)
  const context = await cardContext(user, [course])
  const done = doneIds(enrollment)
  const countOf = (type) => course.lessons.filter((lesson) => lesson.type === type).length
  return {
    ...cardDto(course, { ...context, enrollment }),
    about: course.about ?? '',
    tagline: course.tagline ?? '',
    designedFor: course.designedFor ?? '',
    outcomes: course.outcomes,
    included: { video: countOf('video'), text: countOf('text'), document: countOf('document'), link: countOf('link'), quizQuestions: course.quiz.questions.length },
    curriculum: course.lessons.map((lesson) => ({
      id: String(lesson._id),
      title: lesson.title,
      type: lesson.type,
      durationSec: lesson.durationSec ?? null,
      isPreview: lesson.isPreview,
      contentLanguage: lesson.contentLanguage ?? null,
      state: done.has(String(lesson._id)) ? 'done' : enrollment || (lesson.isPreview && course.status === 'published') ? 'open' : 'locked',
    })),
    quiz: { questions: course.quiz.questions.length, passMark: course.quiz.passMark },
    certificate: enrollment?.certificateId ? certificateDto(await Certificate.findById(enrollment.certificateId)) : null,
  }
}

/** GET /learning/courses/:id/lessons/:lessonId: the content, with a signed media URL (U39; video 6 h). */
export async function getLesson(user, id, lessonId) {
  const { course, enrollment } = await visibleCourse(user, id)
  const index = course.lessons.findIndex((lesson) => String(lesson._id) === lessonId)
  const lesson = course.lessons[index]
  if (!lesson) throw new AppError('NOT_FOUND')
  if (!enrollment && !(lesson.isPreview && course.status === 'published')) throw new AppError('FORBIDDEN')
  const fileId = lesson.videoFileId ?? lesson.documentFileId
  const file = fileId && (await File.findById(fileId))
  const neighbour = (offset) => (course.lessons[index + offset] ? String(course.lessons[index + offset]._id) : null)
  return {
    id: String(lesson._id),
    courseId: String(course._id),
    courseTitle: course.title,
    number: index + 1,
    total: course.lessons.length,
    title: lesson.title,
    type: lesson.type,
    durationSec: lesson.durationSec ?? null,
    contentLanguage: lesson.contentLanguage ?? null,
    html: lesson.type === 'text' ? lesson.textHtml : null,
    url: lesson.type === 'link' ? lesson.url : null,
    media: file ? { url: signedUrl(file, user._id, { ttlMs: lesson.type === 'video' ? LIMITS.videoUrlTtlMs : undefined }), mime: file.mime } : null,
    isPreview: lesson.isPreview,
    enrolled: Boolean(enrollment),
    done: doneIds(enrollment).has(String(lesson._id)),
    previousId: neighbour(-1),
    nextId: neighbour(1),
  }
}

/** POST /learning/enrollments: a free course only; paid courses go through Checkout (M-124). */
export async function enrollFree(user, { courseId }) {
  const course = await Course.findOne({ _id: courseId, audience: user.role, status: 'published' })
  if (!course) throw new AppError('NOT_FOUND')
  if (!course.isFree) throw new AppError('FORBIDDEN')
  if (await Enrollment.exists({ userId: user._id, courseId })) throw new AppError('CONFLICT')
  await enroll({ userId: user._id, courseId: course._id, source: 'free' })
  return getCourse(user, courseId)
}

/** The user's enrollments, newest first, each with its course (enrollments of a deleted course are left out). */
async function enrolledCourses(userId, courseFields) {
  const enrollments = await Enrollment.find({ userId }).sort({ enrolledAt: -1 })
  const courses = new Map((await Course.find({ _id: { $in: enrollments.map((enrollment) => enrollment.courseId) } }, courseFields)).map((course) => [String(course._id), course]))
  return enrollments.filter((enrollment) => courses.has(String(enrollment.courseId))).map((enrollment) => ({ enrollment, course: courses.get(String(enrollment.courseId)) }))
}

/** GET /learning/enrollments: "My courses" (owner 2026-11-05): own progress per course, with its purchase and certificate. */
export async function listEnrollments(user) {
  const rows = await enrolledCourses(user._id)
  const [covers, payments, certificates] = await Promise.all([
    coverUrls(rows.map(({ course }) => course), user._id),
    Payment.find({ _id: { $in: rows.map(({ enrollment }) => enrollment.paymentId).filter(Boolean) } }),
    Certificate.find({ _id: { $in: rows.map(({ enrollment }) => enrollment.certificateId).filter(Boolean) } }),
  ])
  const paymentOf = new Map(payments.map((payment) => [String(payment._id), payment]))
  const certificateOf = new Map(certificates.map((certificate) => [String(certificate._id), certificate]))
  const items = rows.map(({ enrollment, course }) => {
    const payment = paymentOf.get(String(enrollment.paymentId))
    const certificate = certificateOf.get(String(enrollment.certificateId))
    return {
      courseId: String(course._id),
      lessonsTotal: course.lessons.length,
      ...enrollmentDto(course, enrollment),
      course: { title: course.title, category: course.category, level: course.level, coverUrl: covers.get(String(course.coverFileId)) ?? null, durationSec: sum(course.lessons) },
      payment: payment ? { reference: payment.reference, amountMinor: payment.amountMinor, currency: payment.currency, receiptUrl: payment.receiptUrl ?? null, paidAt: payment.paidAt } : null,
      certificate: certificate ? { code: certificate.code, status: certificate.status } : null,
    }
  })
  return { items, total: items.length, page: 1, pageSize: items.length }
}

/** The courses a candidate takes or finished, for recruiters viewing the profile (owner 2026-11-05); no payment details. */
export async function profileCourses(userId) {
  return (await enrolledCourses(userId, 'title category level lessons')).map(({ enrollment, course }) => {
    const { lessonsDone, completedAt, enrolledAt } = enrollmentDto(course, enrollment)
    return { courseId: String(course._id), title: course.title, category: course.category, level: course.level, lessonsTotal: course.lessons.length, lessonsDone, completedAt, enrolledAt }
  })
}
