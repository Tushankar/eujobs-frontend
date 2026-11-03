import { uploadAs } from './candidates.js'
import { fixture } from '../fixtures/make.js'
import { api, db, uniqueEmail } from './testApi.js'

/** OD1's £19 course in the 8 currencies, in major units (the builder's price fields). */
export const PRICES_19 = { GBP: 19, EUR: 22, PLN: 95, SEK: 249, DKK: 169, CZK: 549, HUF: 8490, RON: 115 }

function check(response, label) {
  if (response.status >= 300) throw new Error(`${label} failed (${response.status}): ${JSON.stringify(response.body)}`)
  return response.body
}

const TEXT_LESSONS = [
  { title: 'Welcome to the course', type: 'text', textMarkdown: '## Welcome\n\nThis preview opens without buying.', isPreview: true },
  { title: 'Your first exercise', type: 'text', textMarkdown: '## Exercise\n\nMap one flow from start to goal.' },
]
const ONE_QUESTION = [{ text: 'What opens without buying?', type: 'single', options: [{ text: 'The preview' }, { text: 'Every lesson' }], correct: [0] }]
const UPLOAD = { video: ['lesson_video', 'videoFileId', 'video/mp4'], document: ['lesson_document', 'documentFileId', 'application/pdf'] }

/**
 * A published course built through the admin API (setups; P8-01 builds one through the screens). `lessons` are lesson
 * bodies; a `file` (a fixture name) is uploaded first for video and PDF lessons. Paid at OD1's £19 unless `isFree`.
 */
export async function publishedCourse(adminToken, { audience = 'candidate', title, isFree = false, lessons = TEXT_LESSONS, questions = ONE_QUESTION, category = 'Interaction Design', skillTags = ['Interaction Design'] } = {}) {
  const admin = (path, method, body) => api(`/admin/courses${path}`, { method, token: adminToken, body })
  const course = check(await admin('', 'POST', { audience, title }), 'create course')
  const cover = check(await uploadAs(adminToken, '/admin/uploads?purpose=course_cover', fixture('cover.jpg'), 'image/jpeg'), 'cover')
  check(
    await admin(`/${course.id}`, 'PATCH', {
      category,
      level: 'foundation',
      summary: 'A short course built by the browser checks to test the catalogue.',
      about: 'Short lessons and a final quiz, written for the browser checks.',
      lead: 'Short lessons and a final quiz, written for the browser checks.',
      tagline: 'Built by the browser checks.',
      designedFor: 'Recruiters running the browser checks',
      pipelineCategory: audience === 'recruiter' ? 'screening' : undefined,
      outcomes: ['Recognise how the catalogue shows a course.'],
      skillTags,
      coverFileId: cover.id,
      isFree,
      prices: Object.entries(PRICES_19).map(([currency, amount]) => ({ currency, amountMinor: amount * 100 })),
    }),
    'details',
  )
  for (const { file, ...lesson } of lessons) {
    const [purpose, field, type] = UPLOAD[lesson.type] ?? []
    const uploaded = file && check(await uploadAs(adminToken, `/admin/uploads?purpose=${purpose}`, fixture(file), type), `upload ${file}`)
    check(await admin(`/${course.id}/lessons`, 'POST', { ...lesson, ...(uploaded && { [field]: uploaded.id }) }), `lesson ${lesson.title}`)
  }
  check(await admin(`/${course.id}/quiz`, 'PUT', { passMark: 70, questions }), 'quiz')
  return check(await admin(`/${course.id}/status`, 'PATCH', { status: 'published' }), 'publish')
}

export const enrolFree = async (token, courseId) => check(await api('/learning/enrollments', { method: 'POST', token, body: { courseId } }), 'enrol')

/** Opens every non-video lesson through the API (M-103: they complete on open). */
export async function openLessons(token, course) {
  for (const lesson of course.lessons.filter((item) => item.type !== 'video')) {
    check(await api(`/learning/lessons/${lesson.id}/progress`, { method: 'POST', token, body: { event: 'open' } }), `open ${lesson.title}`)
  }
}

/** The answers that pass: the admin view of the course knows the correct options; `wrong` picks a wrong one each. */
export async function quizAnswers(adminToken, courseId, { wrong = false } = {}) {
  const course = check(await api(`/admin/courses/${courseId}`, { token: adminToken }), 'admin course')
  return course.quiz.questions.map((question) => ({
    questionId: question.id,
    optionIds: wrong ? [question.options.find((_, index) => !question.correct.includes(index)).id] : question.correct.map((index) => question.options[index].id),
  }))
}

export async function passQuiz(token, adminToken, courseId) {
  return check(await api(`/learning/courses/${courseId}/quiz/attempts`, { method: 'POST', token, body: { answers: await quizAnswers(adminToken, courseId) } }), 'quiz attempt')
}

/** A test-only admin with `permissions` (M-155) who signs in with SEED_PASSWORD, like the Owner (as P3-08). */
export async function limitedAdmin(ownerEmail, label, permissions) {
  const [owner] = await db('users', 'find', { filter: { email: ownerEmail } })
  const nameLower = `e2e ${label} ${Date.now()}`
  const { insertedId: roleId } = await db('adminroles', 'insertOne', { doc: { name: nameLower, nameLower, permissions, status: 'active', system: false, scope: 'team' } })
  const email = uniqueEmail(`admin-${label}`)
  const { _id, isOwner: _isOwner, ...fields } = owner
  await db('users', 'insertOne', { doc: { ...fields, email, fullName: `Test admin ${label}`, isOwner: false, adminAccess: { roleId, granted: [], removed: [] } } })
  return { email, roleId }
}
