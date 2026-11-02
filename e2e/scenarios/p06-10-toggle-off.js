import { applyApi, completeCandidate, MINUTE, recruiterWithJob, tickIn } from '../lib/applicants.js'
import { openAs } from '../lib/payments.js'
import { api, db, mailTo } from '../lib/testApi.js'

/** P6-10 (M-095, §2.8): the candidate turns emails off → a stage change sends nothing; EmailLog says `skipped_toggle`. */
export default {
  name: 'P6-10 Toggle off',
  viewports: ['D'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob('Quiet')
    const candidate = await completeCandidate('QuietCandidate')
    const { body: application } = await applyApi(candidate.token, job.id)

    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, candidate.email, '/candidate/settings/notifications')
    await page.click('main [role="switch"]')
    await page.waitForFunction(() => document.querySelector('main [role="switch"]').getAttribute('aria-checked') === 'false')
    await page.waitForNetworkIdle()
    await ctx.screenshot(page, 'emails-off')

    const pipeline = (await api('/recruiter/pipeline', { token: recruiter.token })).body.items
    const interview = pipeline.find((stage) => stage.category === 'interview')
    await api(`/recruiter/applications/${application.id}/stage`, { method: 'PATCH', token: recruiter.token, body: { stageId: interview.id } })
    await tickIn(11 * MINUTE)
    ctx.check((await mailTo(candidate.email, 'application_status')).length === 0, 'no status email')
    const logs = await db('emaillogs', 'find', { filter: { userId: { $oid: candidate.id }, type: 'application_status' } })
    ctx.check(logs.length === 1 && logs[0].status === 'skipped_toggle', `logged skipped_toggle (${JSON.stringify(logs.map((log) => log.status))})`)
    ctx.assertClean(handle.issues, 'toggle off')
  },
}
