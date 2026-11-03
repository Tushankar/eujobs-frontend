import { onboardedCandidate } from '../lib/candidates.js'
import { openAs } from '../lib/payments.js'
import { api, db } from '../lib/testApi.js'

const id = (doc) => doc._id.$oid ?? doc._id

/**
 * P8-10 (M-114, OQ-3): a candidate with no listed skills saves a fintech job; "Suggested for you" lists the published
 * candidate courses tagged with that job's required skills, ranked by matches, and "Skills to explore" counts them.
 */
export default {
  name: 'P8-10 Candidate suggestions',
  viewports: ['D'],
  async run(ctx) {
    const [job] = await db('jobs', 'find', { filter: { status: 'published', country: 'GB', 'requiredSkills.key': 'fintech' } })
    const learner = await onboardedCandidate('Suggestions')
    const saved = await api(`/candidate/saved-jobs/${id(job)}`, { method: 'PUT', token: learner.token })
    ctx.check(saved.status < 300, `the candidate saves "${job.title}"`)

    // OQ-3 from the database: no profile skills, no applications and no For-you jobs, so the gaps are this job's skills.
    const gaps = new Set(job.requiredSkills.map((skill) => skill.key))
    const courses = await db('courses', 'find', { filter: { audience: 'candidate', status: 'published' } })
    const expected = courses
      .map((course) => ({ id: id(course), title: course.title, matches: course.skillTags.filter((tag) => gaps.has(tag.key)).length }))
      .filter((course) => course.matches > 0)
      .sort((a, b) => b.matches - a.matches || a.title.localeCompare(b.title))
    ctx.check(expected.length > 0, `courses match ${[...gaps].join(', ')}`)

    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, learner.email, '/candidate/learning')
    await page.waitForSelector('[data-suggestions] [data-course-card]', { visible: true })
    const shown = await page.$$eval('[data-suggestions] [data-course-card]', (cards) => cards.map((card) => card.dataset.courseCard))
    ctx.check(JSON.stringify(shown) === JSON.stringify(expected.map((course) => course.id)), `suggested: ${expected.map((course) => course.title).join(', ')}`)
    const lead = await page.$eval('[data-suggestions] p', (element) => element.textContent)
    ctx.check(job.requiredSkills.every((skill) => lead.includes(skill.name)), `the lead names the gap skills (${lead})`)
    await page.waitForFunction(
      (count) => [...document.querySelectorAll('main section')].find((card) => card.querySelector('p')?.textContent === 'Skills to explore')?.querySelector(':scope > p span')?.textContent === count,
      { timeout: 10_000 },
      String(gaps.size),
    )
    await ctx.screenshot(page, '1-suggested')
    ctx.assertClean(handle.issues, 'candidate suggestions')
  },
}
