import { randomInt } from 'node:crypto'
import { LIMITS } from '../../config/limits.js'
import { AppError } from '../../lib/errors.js'
import { User } from '../users/users.model.js'
import { certificateDto, issueCertificate } from './learning.certificates.js'
import { Certificate, Course, Enrollment, QuizAttempt } from './learning.model.js'

/*
 * Completion and the final quiz (M-099, M-103, M-104, U15). Only enrolled learners are tracked. Text, PDF and link
 * lessons complete when the client reports them opened (a link on click-through). A video completes once the
 * server has credited 90 % of its duration from heartbeats; a seek or a claimed speed above 2× earns nothing. The
 * quiz unlocks after every lesson, shows scores but never the correct answers, shuffles the options on every
 * request, keeps the best score, and its first pass completes the course and issues the certificate.
 */
const P = LIMITS.lessonProgress

async function enrolledCourse(user, filter) {
  const course = await Course.findOne({ ...filter, audience: user.role })
  if (!course) throw new AppError('NOT_FOUND')
  const enrollment = await Enrollment.findOne({ userId: user._id, courseId: course._id })
  if (!enrollment) throw new AppError('FORBIDDEN')
  return { course, enrollment }
}

const isDone = (enrollment, lessonId) => enrollment.lessons.some((entry) => entry.completedAt && String(entry.lessonId) === String(lessonId))
const allLessonsDone = (course, enrollment) => course.lessons.every((lesson) => isDone(enrollment, lesson._id))

/** U15: credits one heartbeat; the position must have moved forward no faster than real time at the capped rate. */
function creditHeartbeat(entry, durationSec, { positionSec, rate }, now) {
  if (entry.lastHeartbeatAt && entry.lastPositionSec != null) {
    const wallSec = (now - entry.lastHeartbeatAt) / 1000
    const speed = Math.min(Math.max(rate, 0), P.maxRate)
    const moved = positionSec - entry.lastPositionSec
    if (moved > 0 && moved <= wallSec * speed + P.seekToleranceSec) {
      entry.creditedSec = Math.min(durationSec, entry.creditedSec + Math.min(Math.min(wallSec, P.heartbeatSec) * speed, moved))
    }
  }
  entry.lastPositionSec = positionSec
  entry.lastHeartbeatAt = now
  if (entry.creditedSec >= durationSec * P.completeShare) entry.completedAt = now
}

function progressDto(course, enrollment, lessonId) {
  const entry = enrollment.lessons.find((item) => String(item.lessonId) === String(lessonId))
  return {
    lesson: { creditedSec: Math.round(entry?.creditedSec ?? 0), done: Boolean(entry?.completedAt) },
    course: { lessonsDone: course.lessons.filter((lesson) => isDone(enrollment, lesson._id)).length, lessons: course.lessons.length, quizUnlocked: allLessonsDone(course, enrollment) },
  }
}

/** POST /learning/lessons/:lessonId/progress { event: open | heartbeat, positionSec, rate }. */
export async function recordProgress(user, lessonId, body) {
  const { course, enrollment } = await enrolledCourse(user, { 'lessons._id': lessonId })
  const lesson = course.lessons.id(lessonId)
  let entry = enrollment.lessons.find((item) => String(item.lessonId) === lessonId)
  if (!entry) {
    enrollment.lessons.push({ lessonId: lesson._id })
    entry = enrollment.lessons.at(-1)
  }
  const now = new Date()
  if (!entry.completedAt) {
    if (lesson.type !== 'video' && body.event === 'open') entry.completedAt = now
    if (lesson.type === 'video' && body.event === 'heartbeat' && lesson.durationSec) creditHeartbeat(entry, lesson.durationSec, body, now)
  }
  await enrollment.save()
  return progressDto(course, enrollment, lessonId)
}

function shuffled(items) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const other = randomInt(index + 1)
    ;[copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy
}

async function ownCertificate(enrollment) {
  const certificate = enrollment.certificateId && (await Certificate.findById(enrollment.certificateId))
  return certificate ? certificateDto(certificate) : null
}

/** GET /learning/courses/:id/quiz: the questions with freshly shuffled options and no answers, once unlocked. */
export async function getQuiz(user, courseId) {
  const { course, enrollment } = await enrolledCourse(user, { _id: courseId })
  const unlocked = allLessonsDone(course, enrollment)
  return {
    courseId: String(course._id),
    courseTitle: course.title,
    unlocked,
    passMark: course.quiz.passMark,
    bestScore: enrollment.quizBestScore ?? null,
    passedAt: enrollment.quizPassedAt ?? null,
    attempts: await QuizAttempt.countDocuments({ userId: user._id, courseId: course._id }),
    questions: unlocked
      ? course.quiz.questions.map((question) => ({
          id: String(question._id),
          text: question.text,
          type: question.type,
          options: shuffled(question.options).map((option) => ({ id: String(option._id), text: option.text })),
        }))
      : [],
    certificate: await ownCertificate(enrollment),
  }
}

/** A question counts only when exactly its correct options were chosen (single and multiple choice alike). */
const isCorrect = (question, chosen) =>
  chosen.length === question.correctOptionIds.length && question.correctOptionIds.every((id) => chosen.includes(String(id)))

/** POST /learning/courses/:id/quiz/attempts { answers: [{ questionId, optionIds }] }: the score, never the answers. */
export async function submitAttempt(user, courseId, { answers }) {
  const { course, enrollment } = await enrolledCourse(user, { _id: courseId })
  if (!allLessonsDone(course, enrollment)) throw new AppError('LOCKED', { params: { reason: 'lessons' } })
  const chosen = new Map(answers.map((answer) => [answer.questionId, [...new Set(answer.optionIds)]]))
  const questions = course.quiz.questions
  const correct = questions.filter((question) => isCorrect(question, chosen.get(String(question._id)) ?? [])).length
  const scorePercent = Math.round((correct / questions.length) * 100)
  const passed = scorePercent >= course.quiz.passMark
  await QuizAttempt.create({
    userId: user._id,
    courseId: course._id,
    answers: questions.map((question) => ({ questionId: question._id, optionIds: chosen.get(String(question._id)) ?? [] })),
    scorePercent,
    passed,
  })
  enrollment.quizBestScore = Math.max(enrollment.quizBestScore ?? 0, scorePercent)
  // The first pass completes the course (M-110: completion = quiz passed = certificate issued).
  if (passed && !enrollment.quizPassedAt) {
    const now = new Date()
    enrollment.quizPassedAt = now
    enrollment.completedAt = now
    enrollment.certificateId = (await issueCertificate(await User.findById(user._id), course))._id
  }
  await enrollment.save()
  return { scorePercent, passed, passMark: course.quiz.passMark, bestScore: enrollment.quizBestScore, certificate: await ownCertificate(enrollment) }
}
