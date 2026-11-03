import { applyApi, recruiterWithJob } from '../lib/applicants.js'
import { clickText, signInWithForm, waitForPath } from '../lib/flows.js'
import { startApi, unreadOf } from '../lib/messages.js'
import { login } from '../lib/recruiters.js'

/**
 * P7-04 (M-084): Emma (Plus) messages a company she applied to, from her application; the API refuses a company she
 * never applied to with 403.
 */
export default {
  name: 'P7-04 Candidate start rule',
  viewports: ['D'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob('StartRule')
    const { job: otherJob } = await recruiterWithJob('NotApplied')
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
    ctx.assertClean(handle.issues, 'candidate start')
  },
}
