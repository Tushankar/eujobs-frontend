import { responseTo } from '../lib/flows.js'
import { applyApi, completeCandidate, MINUTE, recruiterWithJob, tickIn } from '../lib/applicants.js'
import { openAs } from '../lib/payments.js'
import { api, db, mailTo } from '../lib/testApi.js'

/**
 * P6-10 (§2.8; switches per P11b-Q12): the candidate turns the Applications email switch (the first) off → a stage
 * change sends no email (EmailLog says `skipped_toggle`) and the in-app notification still comes (P11b-Q3).
 */
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
    const saved = responseTo(page, '/api/v1/me/notifications', 'PATCH')
    await page.click('main [role="switch"]')
    await page.waitForFunction(() => document.querySelector('main [role="switch"]').getAttribute('aria-checked') === 'false')
    await saved
    await ctx.screenshot(page, 'emails-off')

    const pipeline = (await api('/recruiter/pipeline', { token: recruiter.token })).body.items
    const interview = pipeline.find((stage) => stage.category === 'interview')
    await api(`/recruiter/applications/${application.id}/stage`, { method: 'PATCH', token: recruiter.token, body: { stageId: interview.id } })
    await tickIn(11 * MINUTE)
    ctx.check((await mailTo(candidate.email, 'application_status')).length === 0, 'no status email')
    const logs = await db('emaillogs', 'find', { filter: { userId: { $oid: candidate.id }, type: 'application_status' } })
    ctx.check(logs.length === 1 && logs[0].status === 'skipped_toggle', `logged skipped_toggle (${JSON.stringify(logs.map((log) => log.status))})`)
    const { items } = (await api('/notifications', { token: candidate.token })).body
    ctx.check(items.some((item) => item.type === 'application_status'), 'the in-app notification still shows')
    ctx.assertClean(handle.issues, 'toggle off')
  },
}
