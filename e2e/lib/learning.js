import { uploadAs } from './candidates.js'
import { fixture } from '../fixtures/make.js'
import { api } from './testApi.js'

/** OD1's £19 course in the 8 currencies, in major units (the builder's price fields). */
export const PRICES_19 = { GBP: 19, EUR: 22, PLN: 95, SEK: 249, DKK: 169, CZK: 549, HUF: 8490, RON: 115 }

function check(response, label) {
  if (response.status >= 300) throw new Error(`${label} failed (${response.status}): ${JSON.stringify(response.body)}`)
  return response.body
}

/**
 * A published course built through the admin API (setups; P8-01 builds one through the screens): two text lessons,
 * the first a free preview, and a one-question quiz. Paid at OD1's £19 unless `isFree`.
 */
export async function publishedCourse(adminToken, { audience = 'candidate', title, isFree = false } = {}) {
  const admin = (path, method, body) => api(`/admin/courses${path}`, { method, token: adminToken, body })
  const course = check(await admin('', 'POST', { audience, title }), 'create course')
  const cover = check(await uploadAs(adminToken, '/admin/uploads?purpose=course_cover', fixture('cover.jpg'), 'image/jpeg'), 'cover')
  check(
    await admin(`/${course.id}`, 'PATCH', {
      category: 'Interaction Design',
      level: 'foundation',
      summary: 'A short course built by the browser checks to test the catalogue.',
      about: 'Two short reading lessons and a one-question quiz, written for the browser checks.',
      lead: 'Two short reading lessons and a one-question quiz, written for the browser checks.',
      tagline: 'Built by the browser checks.',
      designedFor: 'Recruiters running the browser checks',
      pipelineCategory: audience === 'recruiter' ? 'screening' : undefined,
      outcomes: ['Recognise how the catalogue shows a course.'],
      skillTags: ['Interaction Design'],
      coverFileId: cover.id,
      isFree,
      prices: Object.entries(PRICES_19).map(([currency, amount]) => ({ currency, amountMinor: amount * 100 })),
    }),
    'details',
  )
  check(await admin(`/${course.id}/lessons`, 'POST', { title: 'Welcome to the course', type: 'text', textMarkdown: '## Welcome\n\nThis preview opens without buying.', isPreview: true }), 'lesson 1')
  check(await admin(`/${course.id}/lessons`, 'POST', { title: 'Your first exercise', type: 'text', textMarkdown: '## Exercise\n\nMap one flow from start to goal.' }), 'lesson 2')
  check(
    await admin(`/${course.id}/quiz`, 'PUT', { passMark: 70, questions: [{ text: 'What opens without buying?', type: 'single', options: [{ text: 'The preview' }, { text: 'Every lesson' }], correct: [0] }] }),
    'quiz',
  )
  return check(await admin(`/${course.id}/status`, 'PATCH', { status: 'published' }), 'publish')
}
