import { onboardedCandidate } from '../lib/candidates.js'
import { enrolFree, openLessons, passQuiz, publishedCourse } from '../lib/learning.js'
import { ownerToken } from '../lib/recruiters.js'

/** Temporary (2026-11-25): the public certificate check in the light theme and in French, for a visual check. */
export default {
  name: 'TMP certificate check light',
  viewports: ['D', 'M'],
  async run(ctx) {
    const owner = await ownerToken()
    const course = await publishedCourse(owner, { title: 'Talent Strategy & Workforce Planning for growing European companies', isFree: true })
    const learner = await onboardedCandidate(`CertLight${ctx.viewport}`, { fullName: 'Tanmoy Saha' })
    await enrolFree(learner.token, course.id)
    await openLessons(learner.token, course)
    const { certificate } = await passQuiz(learner.token, owner, course.id)

    const { page, issues } = await ctx.newPage()
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
    await page.goto(`${ctx.webUrl}/certificates/${certificate.code}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-certificate-status="valid"]', { visible: true })
    await ctx.screenshot(page, '1-light')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await ctx.screenshot(page, '2-light-bottom')
    await page.goto(`${ctx.webUrl}/certificates/EUJ-2222-2222`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-certificate-check="not_found"]', { visible: true })
    await ctx.screenshot(page, '3-not-found')
    ctx.assertClean(issues, 'public page')
  },
}
