import { recruiterWithJob } from '../lib/applicants.js'
import { clickText, waitForText } from '../lib/flows.js'
import { freeCandidate, openAs } from '../lib/payments.js'
import { decide } from '../lib/recruiters.js'
import { api } from '../lib/testApi.js'

const TICK = '[data-verified-company]'

/** True when the tick and the last word of the name sit on one line (the joined span did not break). */
const tickJoined = (page, scope) =>
  page.$eval(`${scope} ${TICK}`, (tick) => tick.parentElement.getClientRects().length === 1 && tick.getAttribute('aria-label') === 'Verified company')

/**
 * P10-12 (owner decision P10-Q8): candidates see a "Verified company" tick next to an approved, active company on the
 * job card and on job details (header and company section). After the admin suspends the recruiter, the job leaves Find
 * jobs (M-044) and where the candidate still sees it (saved: job details and the Saved list) the tick is gone.
 */
export default {
  name: 'P10-12 Verified company badge',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob(`Tick ${ctx.viewport}`)
    const candidate = await freeCandidate('TickCandidate', 'GB')
    await api(`/candidate/saved-jobs/${job.id}`, { method: 'PUT', token: candidate.token })
    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, candidate.email, `/candidate/jobs?q=${encodeURIComponent(job.title)}`)

    const card = `article[data-job="${job.id}"]`
    await page.waitForSelector(`${card} ${TICK}`)
    ctx.check(await tickJoined(page, card), 'the card tick stays with the company name and has its label')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-card-verified')

    await page.goto(`${ctx.webUrl}/candidate/jobs/${job.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`main ${TICK}`)
    ctx.check((await page.$$(`main ${TICK}`)).length === 2, 'job details: the tick in the header and in the company section')
    ctx.check(await tickJoined(page, 'main'), 'the details tick stays with the name')
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-details-verified')

    // The admin suspends the recruiter.
    await decide(recruiter.userId, 'suspended', 'Phase 10 check of the verified badge.')
    await page.reload({ waitUntil: 'networkidle0' })
    await waitForText(page, 'No longer accepting applications')
    ctx.check(!(await page.$(`main ${TICK}`)), 'job details: no tick after the suspension')
    await ctx.screenshot(page, '3-details-suspended')

    await page.goto(`${ctx.webUrl}/candidate/jobs?q=${encodeURIComponent(job.title)}`, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => !document.querySelector('[role="status"][class*="loading"]'))
    ctx.check(!(await page.$(card)), 'the job left Find jobs (M-044)')

    await page.goto(`${ctx.webUrl}/candidate`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Saved', 'main button')
    await page.waitForSelector(card)
    ctx.check(!(await page.$(`${card} ${TICK}`)), 'the saved card has no tick')
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-saved-suspended')
    ctx.assertClean(handle.issues, 'verified company badge')
  },
}
