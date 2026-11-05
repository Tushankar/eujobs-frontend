// TEMPORARY: checks "My courses" (owner 2026-11-05) for candidates and recruiters. Deleted after the run.
import { applyApi, completeCandidate } from '../lib/applicants.js'
import { clickText, signInWithForm } from '../lib/flows.js'
import { enrolFree, openLessons, passQuiz, publishedCourse } from '../lib/learning.js'
import { checkoutPage, openAs, payOnCheckout } from '../lib/payments.js'
import { ownerToken } from '../lib/recruiters.js'
import { db } from '../lib/testApi.js'

const id = (doc) => doc._id.$oid ?? doc._id
const text = (page, selector) => page.$eval(selector, (element) => element.innerText.replace(/\s+/g, ' ').trim())

/** Buys `course` on its details page through Stripe's hosted Checkout and waits until the app brings the buyer back. */
async function buy(ctx, page, base, course) {
  await page.goto(`${ctx.webUrl}${base}/${course.id}`, { waitUntil: 'networkidle0' })
  await page.click('[data-course-action="buy"]')
  await page.waitForSelector('[data-checkout-summary]', { visible: true })
  await new Promise((resolve) => setTimeout(resolve, 400)) // the dialog's entrance
  await clickText(page, 'Continue to secure payment', '[role="dialog"] button')
  await checkoutPage(page, course.title)
  await payOnCheckout(page)
  await page.waitForFunction((path) => location.pathname === path, { timeout: 90_000 }, `${base}/${course.id}`)
  await page.waitForSelector('main [data-course-price]', { visible: true })
}

export default {
  name: 'TMP My courses',
  viewports: ['D', 'M'],
  async run(ctx) {
    const owner = await ownerToken()
    const stamp = `${ctx.viewport} ${Date.now()}`
    const paid = await publishedCourse(owner, { title: `Bought course ${stamp}` })
    const free = await publishedCourse(owner, { title: `Finished course ${stamp}`, isFree: true })
    const candidate = await completeCandidate(`MyCourses${ctx.viewport}`)
    await enrolFree(candidate.token, free.id)
    await openLessons(candidate.token, free)
    await passQuiz(candidate.token, owner, free.id)

    // Candidate: buys, then sees the course in My courses and "Purchased" on the catalogue card.
    const own = await ctx.newPage()
    const { page } = own
    await openAs(ctx, own, candidate.email, '/candidate/learning')
    await buy(ctx, page, '/candidate/learning', paid)
    await page.waitForSelector('main [data-course-price]', { visible: true })
    ctx.check((await text(page, 'main [data-course-price]')) === 'Purchased', 'the details page says Purchased instead of the price')
    await ctx.screenshot(page, '0-details-purchased')
    await page.goto(`${ctx.webUrl}/candidate/learning`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-my-courses] [data-my-course="${paid.id}"]`, { visible: true })
    const bought = await text(page, `[data-my-course="${paid.id}"]`)
    const finished = await text(page, `[data-my-course="${free.id}"]`)
    ctx.check(bought.includes('Purchased') && bought.includes('0 of') && bought.includes('Start'), `bought row: Purchased, 0 of n lessons, Start (${bought})`)
    ctx.check(finished.includes('Enrolled') && finished.includes('Completed') && finished.includes('Certificate') && finished.includes('Review'), `finished row (${finished})`)
    ctx.check((await text(page, `[data-course-card="${paid.id}"] [data-course-price]`)) === 'Purchased', 'the catalogue card says Purchased')
    await own.checkOverflow()
    await ctx.screenshot(page, '1-learning-my-courses')
    await page.$eval(`[data-course-card="${paid.id}"]`, (element) => element.scrollIntoView({ block: 'center' }))
    await ctx.screenshot(page, '2-purchased-card')

    await page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-section="courses"] [data-my-course="${paid.id}"]`, { visible: true })
    ctx.check(await page.$(`[data-section="courses"] [data-my-course="${free.id}"]`), 'the profile lists both courses')
    await page.$eval('[data-section="courses"]', (element) => element.scrollIntoView({ block: 'start' }))
    await own.checkOverflow()
    await ctx.screenshot(page, '3-candidate-profile')
    ctx.assertClean(own.issues, 'candidate')

    // Recruiter: Sarah sees the candidate's courses (progress only) on the Skills tab.
    const [acme] = await db('companies', 'find', { filter: { displayName: 'Acme Studio' } })
    const [job] = await db('jobs', 'find', { filter: { companyId: acme._id, status: 'published' } })
    ctx.check((await applyApi(candidate.token, id(job))).status === 201, 'the candidate applies to Acme')
    const sarah = await ctx.newPage()
    await signInWithForm(sarah.page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    await sarah.page.goto(`${ctx.webUrl}/recruiter/find-candidates/${candidate.id}/skills`, { waitUntil: 'networkidle0' })
    await sarah.page.waitForSelector(`[data-candidate-course="${paid.id}"]`, { visible: true })
    const courses = await text(sarah.page, '[data-candidate-courses]')
    ctx.check(courses.includes('0 of') && courses.includes('Completed') && !courses.includes('€') && !courses.includes('Purchased'), `recruiter view: progress, no payment (${courses})`)
    await sarah.page.$eval('[data-candidate-courses]', (element) => element.scrollIntoView({ block: 'center' }))
    await sarah.checkOverflow()
    await ctx.screenshot(sarah.page, '4-recruiter-view-of-candidate')

    // Recruiter's own courses: buys a recruiter course, then Learning › My courses and Settings › My courses.
    const recruiterCourse = await publishedCourse(owner, { audience: 'recruiter', title: `Recruiter course ${stamp}` })
    await buy(ctx, sarah.page, '/recruiter/learning', recruiterCourse)
    await sarah.page.goto(`${ctx.webUrl}/recruiter/learning`, { waitUntil: 'networkidle0' })
    await sarah.page.waitForSelector(`[data-my-courses] [data-my-course="${recruiterCourse.id}"]`, { visible: true })
    await sarah.checkOverflow()
    await ctx.screenshot(sarah.page, '5-recruiter-learning')
    await sarah.page.goto(`${ctx.webUrl}/recruiter/settings/courses`, { waitUntil: 'networkidle0' })
    await sarah.page.waitForSelector(`[data-my-course="${recruiterCourse.id}"]`, { visible: true })
    const row = await text(sarah.page, `[data-my-course="${recruiterCourse.id}"]`)
    ctx.check(row.includes('Purchased') && row.includes('Receipt') && /\d/.test(row), `settings row: Purchased, amount, Receipt (${row})`)
    ctx.check((await text(sarah.page, 'main nav')).includes('My courses'), 'Settings has a My courses tab')
    await sarah.checkOverflow()
    await ctx.screenshot(sarah.page, '6-recruiter-settings-my-courses')
    ctx.assertClean(sarah.issues, 'recruiter')
  },
}
