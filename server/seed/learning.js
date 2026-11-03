import { readFile } from 'node:fs/promises'
import { storeFile } from '../lib/files.js'
import { reencodeImage } from '../lib/images.js'
import { renderMarkdown } from '../lib/markdown.js'
import { skillEntries } from '../lib/skills.js'
import { Course, Enrollment } from '../modules/learning/learning.model.js'
import { enroll } from '../modules/learning/learning.service.js'
import { Payment } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { COURSE_PRICES, COURSES, LESSONS_DONE } from './data/courses.js'

/*
 * Courses of seed:demo (§6 Phase 8, task 4; M-207, M-209, OD1): the 12 published courses with their covers, text
 * lessons and quizzes, then one enrollment per seed course payment (its row gets the course id). A text lesson's
 * duration is its reading time at 200 words a minute, rounded up to a minute (P8-C2).
 */
const WORDS_PER_MINUTE = 200
const DAY_MS = 24 * 60 * 60 * 1000
const readingSec = (markdown) => Math.ceil(markdown.split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE) * 60

export async function seedLearning({ emailOf, owner, now }) {
  for (const { key: _key, cover, price, lessons, quiz, skillTags, ...fields } of COURSES) {
    const buffer = await reencodeImage(await readFile(new URL(`../../${cover}`, import.meta.url)), 'jpg')
    const file = await storeFile({ ownerId: owner._id, purpose: 'course_cover', buffer, ext: 'jpg', originalName: cover.split('/').pop() })
    const course = new Course({
      ...fields,
      language: 'en',
      coverFileId: file._id,
      skillTags: skillEntries(skillTags, 'skillTags'),
      prices: Object.entries(COURSE_PRICES[price]).map(([currency, amount]) => ({ currency, amountMinor: amount * 100 })),
      lessons: lessons.map(({ title, markdown }) => ({ title, type: 'text', textMarkdown: markdown, textHtml: renderMarkdown(markdown), durationSec: readingSec(markdown), contentLanguage: 'en' })),
      status: 'published',
      publishedAt: new Date(now - 60 * DAY_MS),
      createdBy: owner._id,
      updatedBy: owner._id,
    })
    course.quiz.questions = quiz.map(({ text, options }) => ({ text, type: 'single', options: options.map((option) => ({ text: option })) }))
    course.quiz.questions.forEach((question, index) => {
      question.correctOptionIds = [question.options[quiz[index].correct]._id]
    })
    await course.save()
  }

  const tags = Object.fromEntries(await Promise.all(['alex', 'sarah', 'emma'].map(async (tag) => [String((await User.findOne({ email: emailOf({ tag }) }, '_id'))._id), tag])))
  for (const payment of await Payment.find({ kind: 'course', source: 'seed' })) {
    const course = await Course.findOne({ title: payment.itemName })
    payment.itemId = String(course._id)
    await payment.save()
    const enrollment = await enroll({ userId: payment.userId, courseId: course._id, source: 'seed', paymentId: payment._id, enrolledAt: payment.paidAt })
    const done = LESSONS_DONE[tags[String(payment.userId)]] ?? 0
    enrollment.lessons = course.lessons.slice(0, done).map((lesson) => ({ lessonId: lesson._id, completedAt: new Date(payment.paidAt.getTime() + DAY_MS) }))
    await enrollment.save()
  }
  return Enrollment.countDocuments()
}
