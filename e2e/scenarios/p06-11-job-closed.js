import { applyApi, completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { openAs } from '../lib/payments.js'
import { api } from '../lib/testApi.js'

/** P6-11 (M-043): the recruiter closes the job → the applicant's job page says "No longer accepting applications"; the application stays listed. */
export default {
  name: 'P6-11 Job closed',
  viewports: ['D'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob('Closing')
    const candidate = await completeCandidate('ClosedApplicant')
    const { body: application } = await applyApi(candidate.token, job.id)
    const closed = await api(`/recruiter/jobs/${job.id}/status`, { method: 'PATCH', token: recruiter.token, body: { status: 'closed' } })
    ctx.check(closed.status === 200, `the recruiter closes the job (${closed.status})`)

    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, candidate.email, `/candidate/jobs/${job.id}`)
    await page.waitForSelector('[role="status"]')
    const banner = await page.$eval('[role="status"]', (element) => element.innerText)
    ctx.check(banner.includes('No longer accepting applications'), `the job page says so (${banner})`)
    ctx.check(Boolean(await page.$('[data-applied]')), 'the job still shows the application')
    await ctx.screenshot(page, '1-job-page')

    await page.goto(`${ctx.webUrl}/candidate/applications`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-application="${application.id}"]`)
    ctx.check((await page.$eval('[data-status]', (element) => element.dataset.status)) === 'applied', 'still listed as Applied')
    await page.click(`[data-application="${application.id}"]`)
    await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.innerText.includes('no longer accepts applications'))
    await ctx.screenshot(page, '2-applications')
    ctx.assertClean(handle.issues, 'job closed')
  },
}
