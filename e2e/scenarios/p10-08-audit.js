import { exportText, openAsAdmin } from '../lib/admins.js'
import { completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { clickText, responseTo } from '../lib/flows.js'
import { API_URL } from '../lib/env.js'
import { freeCandidate, rowsOf, stripe, subscribeThroughApi, until, waitForPlan } from '../lib/payments.js'
import { ownerToken, submittedRecruiter } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

const rows = (page) => page.$$eval('main li[data-audit-type]', (items) => items.map((item) => ({ type: item.dataset.auditType, actor: item.dataset.actorType, text: item.innerText })))

/**
 * P10-08 (M-162, M-163, M-206): the category chips include Learning, Payments and Jobs; actor types are admin, user and
 * system. A recruiter's job status change, a CV download and a KYC submission are listed (user events), a Stripe refund
 * as a system event, and the export is audited as an admin event.
 */
export default {
  name: 'P10-08 Audit',
  viewports: ['D'],
  async run(ctx) {
    // User events: a job published and paused, a CV downloaded by that recruiter, a KYC submission.
    const { recruiter, job } = await recruiterWithJob('Audit')
    await api(`/recruiter/jobs/${job.id}/status`, { method: 'PATCH', token: recruiter.token, body: { status: 'paused' } })
    const candidate = await completeCandidate('AuditCv', { plus: false })
    await api('/candidate/settings/privacy', { method: 'PATCH', token: candidate.token, body: { resumeVisible: true } })
    const cv = (await api(`/recruiter/candidates/${candidate.id}/cv`, { token: recruiter.token })).body
    ctx.check(cv.live?.url, `the recruiter sees the live CV (${JSON.stringify(cv)})`)
    ctx.check((await fetch(`${API_URL}${cv.live.url}`)).status === 200, 'the CV downloads')
    const kyc = await submittedRecruiter('AuditKyc')
    // A system event: Stripe refunds a candidate's first Plus payment.
    const payer = await freeCandidate('AuditRefund', 'GB')
    await subscribeThroughApi(payer.user)
    await waitForPlan(payer.token, 'plus')
    const [paid] = await until(() => rowsOf('payments', payer.user.id), (list) => list.length === 1, { label: 'the paid row' })
    await stripe.refunds.create({ payment_intent: paid.stripe.paymentIntentId })
    await until(() => db('auditevents', 'find', { filter: { type: 'payments.payment_refunded', 'params.reference': paid.reference } }), (list) => list.length === 1, { label: 'refund audit event' })

    const handle = await ctx.newPage()
    const { page } = handle
    await openAsAdmin(ctx, handle, ctx.seedCredentials.email(null), '/admin/audit-logs', ctx.seedCredentials.password)
    await page.waitForSelector('main li[data-audit-type]')
    const chips = await page.$$eval('main [aria-label="Filter by category"] button', (buttons) => buttons.map((button) => button.innerText.trim()))
    for (const chip of ['All events', 'Learning', 'Payments', 'Jobs', 'Moderation', 'Access']) ctx.check(chips.includes(chip), `chip ${chip} (got ${chips.join(', ')})`)
    const actorOptions = await page.$$eval('select[name="actorType"] option', (options) => options.map((option) => option.value))
    ctx.check(JSON.stringify(actorOptions) === JSON.stringify(['', 'admin', 'user', 'system']), `actor types (got ${actorOptions})`)
    await ctx.screenshot(page, '1-all-events')

    // Jobs: the status changes and the CV download, by the recruiter.
    const jobsAnswer = responseTo(page, ['/api/v1/admin/audit-events?', 'category=jobs'])
    await clickText(page, 'Jobs', 'main button')
    await jobsAnswer
    await page.waitForFunction(() => [...document.querySelectorAll('main li[data-audit-type]')].every((item) => item.dataset.auditType.startsWith('jobs.')))
    const jobRows = await rows(page)
    ctx.check(jobRows.some((row) => row.type === 'jobs.status_changed' && row.text.includes(job.title) && row.text.includes('Published → Paused') && row.actor === 'user'), 'the recruiter’s status change is listed')
    ctx.check(jobRows.some((row) => row.type === 'jobs.cv_downloaded' && row.text.includes(candidate.fullName) && row.actor === 'user'), 'the CV download is listed')
    await page.click('main li[data-audit-type="jobs.cv_downloaded"] button')
    await page.waitForSelector('main li[data-audit-type="jobs.cv_downloaded"] dl')
    await ctx.screenshot(page, '2-jobs')

    // Moderation: the KYC submission.
    const moderation = responseTo(page, ['/api/v1/admin/audit-events?', 'category=moderation'])
    await clickText(page, 'Moderation', 'main button')
    await moderation
    await page.waitForFunction((name) => [...document.querySelectorAll('main li[data-audit-type="moderation.account_submitted"]')].some((item) => item.innerText.includes(name)), {}, kyc.fullName)
    await ctx.screenshot(page, '3-kyc-submission')

    // System: the refund; the actor filter keeps only system events.
    await clickText(page, 'All events', 'main button')
    const system = responseTo(page, ['/api/v1/admin/audit-events?', 'actorType=system'])
    await page.select('select[name="actorType"]', 'system')
    await system
    await page.waitForFunction(() => {
      const items = [...document.querySelectorAll('main li[data-audit-type]')]
      return items.length > 0 && items.every((item) => item.dataset.actorType === 'system')
    })
    ctx.check((await rows(page)).some((row) => row.type === 'payments.payment_refunded' && row.text.includes(paid.reference)), 'the refund is a system event')
    await ctx.screenshot(page, '4-system')

    // The export is audited as an admin event.
    await page.select('select[name="actorType"]', '')
    const exported = responseTo(page, '/api/v1/admin/audit-events/export')
    await clickText(page, 'Export CSV', 'button')
    const csv = await exportText((await exported).url(), await ownerToken())
    ctx.check(csv.charCodeAt(0) === 0xfeff && csv.slice(1).startsWith('Date,Category,Actor type,Actor,Event'), `the export (${csv.slice(1, 60)})`)
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('main li[data-audit-type="reports.audit_exported"][data-actor-type="admin"]')
    ctx.check((await db('auditevents', 'count', { filter: { type: 'reports.audit_exported' } })) >= 1, 'the export is in the audit log')
    await ctx.screenshot(page, '5-export-audited')
    ctx.assertClean(handle.issues, 'audit logs')
  },
}
