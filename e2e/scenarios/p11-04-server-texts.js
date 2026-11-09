import { readFileSync } from 'node:fs'
import { getDocument } from '../../server/node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import { ENUMS } from '../../server/config/enums.js'
import { renderEmail } from '../../server/lib/mail/templates.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { API_URL } from '../lib/env.js'
import { enrolFree, openLessons, passQuiz, publishedCourse } from '../lib/learning.js'
import { ownerToken } from '../lib/recruiters.js'
import { api } from '../lib/testApi.js'

const dictionary = (language) => JSON.parse(readFileSync(new URL(`../../server/i18n/${language}.json`, import.meta.url), 'utf8'))
const strings = (node) => (typeof node === 'string' ? [node] : Object.values(node).flatMap(strings))
const collapse = (text) => text.replace(/\s+/g, ' ').trim()

/** The certificate PDF of a learner who passed a free course, as text (as P8-07 reads it). */
async function certificateText(owner, language, viewport) {
  const course = await publishedCourse(owner, { title: `Accessible forms in practice (${language} ${viewport} ${Date.now() % 100000})`, isFree: true })
  const learner = await onboardedCandidate(`ServerTexts${language}${viewport}`)
  await api('/me', { method: 'PATCH', token: learner.token, body: { language, languageExplicit: true } })
  await enrolFree(learner.token, course.id)
  await openLessons(learner.token, course)
  await passQuiz(learner.token, owner, course.id)
  const [certificate] = (await api('/learning/certificates', { token: learner.token })).body.items
  const { url } = (await api(`/learning/certificates/${certificate.id}/pdf`, { token: learner.token })).body
  const bytes = new Uint8Array(await (await fetch(`${API_URL}${url}`)).arrayBuffer())
  const page = await (await getDocument({ data: bytes }).promise).getPage(1)
  return { url, text: collapse((await page.getTextContent()).items.map((item) => item.str).join(' ')) }
}

/**
 * P11-04: every email type, rendered by the server's templates with the mail:test samples for a Spanish and a French
 * recipient, shown in Chrome (screenshots to read): translated, every placeholder filled, and no English sentence of
 * the server dictionary left. Then a real certificate PDF in Spanish and in French with its chrome in that language.
 */
/**
 * The mail samples reach server/config/env.js (the interview emails, Phase 11d), which needs server/.env. It is loaded
 * here, in test mode with the e2e origin, into this process only and only when the scenario runs: the harness's API,
 * seed and Vite processes keep the environment they were given at start, and the other scenarios load without it.
 */
async function loadMailSamples(webUrl) {
  process.loadEnvFile(new URL('../../server/.env', import.meta.url))
  Object.assign(process.env, { NODE_ENV: 'test', CLIENT_ORIGIN: webUrl })
  return (await import('../../server/scripts/mailSamples.js')).mailSample
}

export default {
  name: 'P11-04 Server texts',
  viewports: ['D'],
  async run(ctx) {
    const mailSample = await loadMailSamples(ctx.webUrl)
    const english = dictionary('en')
    const englishSentences = (language) => {
      const own = new Set(strings(dictionary(language)))
      return strings(english).filter((text) => !/\{\{/.test(text) && text.split(/\s+/).length > 3 && !own.has(text))
    }
    const handle = await ctx.newPage()
    const { page } = handle
    for (const language of ['es', 'fr']) {
      const leftovers = englishSentences(language)
      for (const type of ENUMS.emailType) {
        const email = renderEmail(type, language, mailSample(type, language, ctx.webUrl))
        const inEnglish = renderEmail(type, 'en', mailSample(type, 'en', ctx.webUrl))
        ctx.check(email.subject !== inEnglish.subject && email.text !== inEnglish.text, `${type} ${language}: translated`)
        ctx.check(!/\{\{/.test(email.subject + email.text), `${type} ${language}: every placeholder is filled`)
        const left = leftovers.filter((text) => email.text.includes(text))
        ctx.check(!left.length, `${type} ${language}: English left: ${left.join(' | ')}`)
        await page.setContent(email.html, { waitUntil: 'load' })
        ctx.check((await page.evaluate(() => document.documentElement.lang)) === language, `${type} ${language}: lang`)
        await ctx.screenshot(page, `email-${language}-${type}`)
      }
      ctx.note(`${language}: ${ENUMS.emailType.length} email types rendered and checked`)
    }

    const owner = await ownerToken()
    for (const language of ['es', 'fr']) {
      const { certificate } = dictionary(language)
      const pdf = await certificateText(owner, language, ctx.viewport)
      const upper = pdf.text.toLocaleUpperCase(language)
      for (const expected of [certificate.title, certificate.intro, certificate.code]) {
        ctx.check(upper.includes(expected.toLocaleUpperCase(language)), `${language} certificate shows "${expected}" (${pdf.text.slice(0, 160)}…)`)
      }
      ctx.check(!upper.includes(english.certificate.title.toLocaleUpperCase('en')), `${language} certificate has no English title`)
      const viewer = await ctx.newPage()
      await viewer.page.goto(`${API_URL}${pdf.url}`).catch(() => {})
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await ctx.screenshot(viewer.page, `certificate-${language}`)
      ctx.note(`${language} certificate: ${pdf.text.slice(0, 140)}…`)
    }
    ctx.assertClean(handle.issues, 'server texts')
  },
}
