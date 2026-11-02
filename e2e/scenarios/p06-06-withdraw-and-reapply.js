import { applyApi, completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { clickText, signInWithForm, toggleCheckbox } from '../lib/flows.js'
import { openAs } from '../lib/payments.js'
import { TEST_PASSWORD, db } from '../lib/testApi.js'

const statuses = (page) => page.$$eval('[data-status]', (items) => items.map((item) => item.dataset.status))

/**
 * P6-06 (M-074, M-076): the candidate withdraws → the recruiter sees it under the Withdrawn filter with its badge, and
 * not on the board. Apply again → a new record; the old one stays withdrawn.
 */
export default {
  name: 'P6-06 Withdraw and re-apply',
  viewports: ['D'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob('Withdraw')
    const candidate = await completeCandidate('Withdrawer')
    const { body: first } = await applyApi(candidate.token, job.id)

    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, candidate.email, '/candidate/applications')
    await page.click(`[data-application="${first.id}"]`)
    await clickText(page, 'Withdraw application', '[role="dialog"] button')
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 1 && document.querySelector('[role="dialog"]').innerText.includes('Withdraw this application?'))
    await clickText(page, 'Withdraw application', '[role="dialog"] button')
    await page.waitForFunction(() => document.querySelector('[data-status]')?.dataset.status === 'withdrawn')
    await ctx.screenshot(page, '1-withdrawn')

    const recruiterHandle = await ctx.newPage()
    const recruiterPage = recruiterHandle.page
    await signInWithForm(recruiterPage, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await recruiterPage.goto(`${ctx.webUrl}/recruiter/applications`, { waitUntil: 'networkidle0' })
    const filter = await recruiterPage.$eval('select[name="stage"]', (select) => [...select.options].map((option) => option.textContent))
    ctx.check(filter.includes('Withdrawn (1)'), `the Withdrawn filter counts it: ${JSON.stringify(filter)}`)
    await recruiterPage.select('select[name="stage"]', 'withdrawn')
    await recruiterPage.waitForFunction((name) => document.querySelector('main table')?.innerText.includes(name) && document.querySelector('main table').innerText.includes('Withdrawn'), {}, candidate.fullName)
    await ctx.screenshot(recruiterPage, '2-recruiter-withdrawn')
    await recruiterPage.goto(`${ctx.webUrl}/recruiter/hiring-pipeline`, { waitUntil: 'networkidle0' })
    ctx.check(!(await recruiterPage.$(`[data-application="${first.id}"]`)), 'off the board')

    await page.click(`[data-application="${first.id}"]`)
    await clickText(page, 'Apply again', '[role="dialog"] button')
    await page.waitForSelector('[data-apply-dialog]', { visible: true })
    await toggleCheckbox(page, 'consent')
    await clickText(page, 'Send application', '[role="dialog"] button')
    await page.waitForFunction(() => document.querySelectorAll('[data-status]').length === 2)
    ctx.check(JSON.stringify(await statuses(page)) === '["applied","withdrawn"]', `a new "Applied" row and the old withdrawn one (${await statuses(page)})`)
    await ctx.screenshot(page, '3-reapplied')
    const records = await db('applications', 'find', { filter: { jobId: { $oid: job.id } } })
    ctx.check(records.length === 2 && records.some((record) => record._id.$oid === first.id && record.status === 'withdrawn'), 'two records; the first stays withdrawn')
    ctx.assertClean(handle.issues, 'candidate')
    ctx.assertClean(recruiterHandle.issues, 'recruiter')
  },
}
