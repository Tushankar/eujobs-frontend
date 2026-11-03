import { applyApi, recruiterWithJob } from '../lib/applicants.js'
import { clickText, signInWithForm, waitForPath } from '../lib/flows.js'
import { startApi, unreadOf } from '../lib/messages.js'
import { login } from '../lib/recruiters.js'
import { api } from '../lib/testApi.js'

/**
 * P7-04 (M-084): Emma (Plus) messages a company she applied to, from her application; the API refuses a company she
 * never applied to with 403. P7-A1: after withdrawing her only application to a company, she cannot start a thread
 * with it (no button on the job, 403 from the API).
 */
export default {
  name: 'P7-04 Candidate start rule',
  viewports: ['D'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob('StartRule')
    const { job: otherJob } = await recruiterWithJob('NotApplied')
    const { job: withdrawnJob } = await recruiterWithJob('Withdrawn')
    const emmaToken = await login(ctx.seedCredentials.email('emma'), 'candidate', ctx.seedCredentials.password)
    const applied = await applyApi(emmaToken, job.id)
    ctx.check(applied.status === 201, `Emma applies (${applied.status})`)

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/candidate/applications`, { waitUntil: 'networkidle0' })
    await page.click(`[data-application="${applied.body.id}"]`)
    await clickText(page, 'Message the company', '[role="dialog"] [data-start-conversation]')
    await page.waitForSelector('[role="dialog"] textarea[name="body"]', { visible: true })
    await page.type('[role="dialog"] textarea[name="body"]', 'Hello, could you tell me more about the team I would join?')
    await ctx.screenshot(page, '1-start-dialog')
    await clickText(page, 'Send message', '[role="dialog"] button')
    await waitForPath(page, () => /^\/candidate\/messages\/\w+$/.test(location.pathname))
    await page.waitForSelector('[data-message="mine"]', { visible: true })
    await ctx.screenshot(page, '2-thread')
    ctx.check((await unreadOf(recruiter.token)) === 1, 'the recruiter has one unread message')

    // The job page now opens the same thread instead of starting a new one.
    await page.goto(`${ctx.webUrl}/candidate/jobs/${job.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-open-conversation]', { visible: true })

    const refused = await startApi(emmaToken, { jobId: otherJob.id, body: 'Hello' })
    ctx.check(refused.status === 403 && refused.body.error.code === 'FORBIDDEN', `a company Emma never applied to is refused (${refused.status})`)
    // P7-A1: a withdrawn application does not allow a new thread.
    const withdrawn = await applyApi(emmaToken, withdrawnJob.id)
    ctx.check((await api(`/candidate/applications/${withdrawn.body.id}/withdraw`, { method: 'POST', token: emmaToken })).status === 200, 'Emma withdraws')
    await page.goto(`${ctx.webUrl}/candidate/jobs/${withdrawnJob.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('main h1', { visible: true })
    ctx.check(!(await page.$('[data-start-conversation]')) && !(await page.$('[data-open-conversation]')), 'no Message the company button after withdrawing')
    await ctx.screenshot(page, '3-withdrawn-job')
    const afterWithdraw = await startApi(emmaToken, { jobId: withdrawnJob.id, body: 'Hello' })
    ctx.check(afterWithdraw.status === 403, `the API refuses a company whose only application is withdrawn (${afterWithdraw.status})`)
    ctx.assertClean(handle.issues, 'candidate start')
  },
}
