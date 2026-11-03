import { signInWithForm, waitForPath } from '../lib/flows.js'
import { openLessons, passQuiz } from '../lib/learning.js'
import { continueToStripe, payOnCheckout, rowsOf } from '../lib/payments.js'
import { login, ownerToken } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

const id = (doc) => doc._id.$oid ?? doc._id
const STAGE_LABEL = { applied: 'Applied', screening: 'Screening', shortlisted: 'Shortlisted', interview: 'Interview', offer: 'Offer', hired: 'Hired' }

/** OQ-3 from the test database: Acme's active applications per stage category, and the courses that should follow. */
async function expectedSuggestions(sarahId, companyId) {
  const applications = await db('applications', 'find', { filter: { companyId: { $oid: companyId }, status: { $nin: ['withdrawn', 'not_selected'] } } })
  const stages = new Map((await db('pipelinestages', 'find', { filter: { companyId: { $oid: companyId } } })).map((stage) => [id(stage), stage.category]))
  const counts = {}
  for (const application of applications) counts[stages.get(id({ _id: application.stageId }))] = (counts[stages.get(id({ _id: application.stageId }))] ?? 0) + 1
  const enrolled = new Set((await db('enrollments', 'find', { filter: { userId: { $oid: sarahId } } })).map((enrollment) => id({ _id: enrollment.courseId })))
  const courses = await db('courses', 'find', { filter: { audience: 'recruiter', status: 'published' } })
  return courses
    .filter((course) => !enrolled.has(id(course)) && counts[course.pipelineCategory])
    .sort((a, b) => counts[b.pipelineCategory] - counts[a.pipelineCategory] || a.title.localeCompare(b.title))
    .slice(0, 3)
    .map((course) => ({ id: id(course), title: course.title, count: counts[course.pipelineCategory], stage: course.pipelineCategory, gbp: course.prices.find((price) => price.currency === 'GBP').amountMinor }))
}

/** A StatCard's shown value, once its count-up has settled on `expected`. */
const statIs = (page, label, expected) =>
  page.waitForFunction(
    (wanted, value) => [...document.querySelectorAll('main section')].find((card) => card.querySelector('p')?.textContent === wanted)?.querySelector(':scope > p span')?.textContent === value,
    { timeout: 10_000 },
    label,
    String(expected),
  )

/**
 * P8-09 (M-110, M-112, M-114, OQ-3): Sarah's suggestions follow Acme's active applications per pipeline category,
 * with the real numbers in the reason. She buys the first one for herself (Checkout in GBP), finishes it, and the
 * stats show in progress, certificates and streams.
 */
export default {
  name: 'P8-09 Recruiter learning',
  viewports: ['D'],
  async run(ctx) {
    const email = ctx.seedCredentials.email('sarah')
    const token = await login(email, 'recruiter', ctx.seedCredentials.password)
    const sarah = (await api('/me', { token })).body
    const expected = await expectedSuggestions(sarah.id, sarah.company.id)
    ctx.check(expected.length > 0, 'Acme has suggestions to show')
    const served = (await api('/learning/suggestions', { token })).body.items
    ctx.check(JSON.stringify(served.map((item) => [item.id, item.reason.count])) === JSON.stringify(expected.map((item) => [item.id, item.count])), `suggestions follow OQ-3: ${expected.map((item) => `${item.title} (${item.count} at ${item.stage})`).join('; ')}`)

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', email, ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/recruiter/learning`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-suggestion="${expected[0].id}"]`, { visible: true })
    const reason = await page.$eval(`[data-suggestion="${expected[0].id}"] [data-suggestion-reason]`, (element) => element.textContent)
    const wanted = `${expected[0].count} active application${expected[0].count === 1 ? '' : 's'} at ${STAGE_LABEL[expected[0].stage]}`
    ctx.check(reason === wanted, `the reason has the real numbers ("${reason}")`)
    const streams = new Set((await db('courses', 'find', { filter: { audience: 'recruiter', status: 'published' } })).map((course) => course.category)).size
    await statIs(page, 'Courses in progress', 1)
    await statIs(page, 'Certificates earned', 0)
    await statIs(page, 'Specialist streams', streams)
    await ctx.screenshot(page, '1-suggestions')

    // Sarah buys the first suggestion for herself (M-112).
    const [first] = expected
    await page.click(`[data-suggestion="${first.id}"] a`)
    await waitForPath(page, `/recruiter/learning/${first.id}`)
    await page.waitForSelector('[data-course-action="buy"]', { visible: true })
    await page.click('[data-course-action="buy"]')
    await page.waitForSelector('[data-checkout-summary]', { visible: true })
    await continueToStripe(page, `£${(first.gbp / 100).toFixed(2)}`)
    await payOnCheckout(page)
    await waitForPath(page, `/recruiter/learning/${first.id}`)
    await page.waitForSelector('[data-course-action="continue"]', { visible: true, timeout: 30_000 })
    const rows = await rowsOf('payments', sarah.id, { kind: 'course', source: 'stripe' })
    ctx.check(rows.length === 1 && rows[0].payerRole === 'recruiter' && rows[0].currency === 'GBP', 'one GBP course payment by Sarah')
    await ctx.screenshot(page, '2-bought')

    // She finishes it: the stats move, and the course leaves her suggestions.
    const course = (await api(`/courses/${first.id}`, { token })).body
    await openLessons(token, { lessons: course.curriculum })
    await passQuiz(token, await ownerToken(), first.id)
    await page.goto(`${ctx.webUrl}/recruiter/learning`, { waitUntil: 'networkidle0' })
    await statIs(page, 'Certificates earned', 1)
    await statIs(page, 'Courses in progress', 1)
    ctx.check(!(await page.$(`[data-suggestion="${first.id}"]`)), 'an enrolled course is no longer suggested')
    await ctx.screenshot(page, '3-stats')
    ctx.assertClean(handle.issues, 'recruiter learning')
  },
}
