import { applyApi, completeCandidate } from '../lib/applicants.js'
import { signInWithForm, waitForText } from '../lib/flows.js'
import { startApi } from '../lib/messages.js'
import { openAs, rowsOf, stripe, subscribeThroughApi, until, waitForPlan } from '../lib/payments.js'
import { deleteThroughUi, filesOf, onDisk } from '../lib/privacy.js'
import { signInRecruiter } from '../lib/recruiterPlan.js'
import { approvedRecruiter, jobBody, postJob } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

/**
 * P12-03 (M-189, OD15, OQ-6k, P12-Q5, Phase 11c): a recruiter on Recruiter Plus (a real Stripe subscription) deletes the
 * account with the password. In Stripe the subscription is canceled and the Customer deleted. The jobs are closed; the
 * candidate's application and thread show the company display name (the thread closed for replies); the KYC files are
 * gone from disk; the Recruiter Plus payment is kept and admin Payments shows "Deleted user"; the company's notes,
 * shortlist and activity are gone.
 */
export default {
  name: 'P12-03 Recruiter deletion',
  viewports: ['D'],
  async run(ctx) {
    const recruiter = await approvedRecruiter('DeletedRec', { plus: false })
    const me = (await api('/me', { token: recruiter.token })).body
    await subscribeThroughApi({ id: me.id, email: recruiter.email, fullName: me.fullName }, { plan: 'recruiter_plus' })
    await waitForPlan(recruiter.token, 'recruiter_plus')
    const [planPayment] = await until(() => rowsOf('payments', me.id), (rows) => rows.length === 1, { label: 'the Recruiter Plus payment row' })
    const [subscription] = await rowsOf('subscriptions', me.id)
    const job = await postJob(recruiter.token, jobBody({ title: `Deleted company designer ${Date.now() % 100000}` }))
    const [company] = await db('companies', 'find', { filter: { ownerUserId: { $oid: me.id } } })
    const companyId = { $oid: company._id.$oid ?? company._id }

    const candidate = await completeCandidate('DeletedRecCandidate')
    ctx.check((await applyApi(candidate.token, job.id)).status === 201, 'applied')
    ctx.check((await api(`/recruiter/shortlist/${candidate.id}`, { method: 'PUT', token: recruiter.token })).status === 200, 'shortlisted')
    ctx.check((await api(`/recruiter/candidates/${candidate.id}/notes`, { method: 'POST', token: recruiter.token, body: { text: 'Call back' } })).status === 201, 'noted')
    const thread = (await startApi(recruiter.token, { candidateId: candidate.id, jobId: job.id, body: 'Hello from the company' })).body.conversation
    const kyc = await filesOf(me.id, 'kyc')
    ctx.check(kyc.length === 2 && (await Promise.all(kyc.map(onDisk))).every(Boolean), 'two KYC files on disk before')

    const handle = await ctx.newPage()
    await signInRecruiter(ctx, handle.page, recruiter.email, '/recruiter/settings/data-account')
    await deleteThroughUi(ctx, handle, { button: 'Delete account', signInPath: '/recruiter/sign-in' })
    await ctx.screenshot(handle.page, '1-signed-out')
    ctx.assertClean(handle.issues, 'deletion')

    // Recruiter Plus in Stripe: canceled at once, the Customer deleted (as candidate erasure).
    await until(() => stripe.subscriptions.retrieve(subscription.stripeSubscriptionId), (item) => item.status === 'canceled', { label: 'Recruiter Plus canceled' })
    ctx.check((await stripe.customers.retrieve(subscription.stripeCustomerId)).deleted === true, 'Stripe: Customer deleted')

    const [closed] = await db('jobs', 'find', { filter: { _id: { $oid: job.id } } })
    ctx.check(closed.status === 'closed' && closed.createdBy === null, `the job is closed and its author removed (${closed.status})`)
    ctx.check(!(await Promise.all(kyc.map(onDisk))).some(Boolean), 'the KYC files are gone from disk')
    ctx.check((await db('kycdocuments', 'find', { filter: { companyId } })).length === 0, 'the KYC records are gone')
    for (const collection of ['candidatenotes', 'shortlistentries', 'recruiteractivities']) {
      ctx.check((await db(collection, 'find', { filter: { companyId } })).length === 0, `the company's ${collection} are gone`)
    }
    const [kept] = await db('payments', 'find', { filter: { reference: planPayment.reference } })
    ctx.check(kept && kept.userId === null && kept.payerName === null && kept.payerRole === 'recruiter', 'the Recruiter Plus payment is kept, anonymised')

    // The candidate keeps the application and the thread under the company display name.
    const candidatePage = await ctx.newPage()
    const { page } = candidatePage
    await openAs(ctx, candidatePage, candidate.email, '/candidate/applications')
    await waitForText(page, company.displayName)
    await ctx.screenshot(page, '2-candidate-application')
    await page.goto(`${ctx.webUrl}/candidate/messages/${thread.id}`, { waitUntil: 'networkidle0' })
    await waitForText(page, company.displayName)
    await page.waitForSelector('[data-conversation-closed]')
    await waitForText(page, 'Hello from the company')
    await ctx.screenshot(page, '3-candidate-thread-closed')
    ctx.assertClean(candidatePage.issues, 'candidate')

    // Admin Payments: the row is kept with "Deleted user".
    const ownerPage = await ctx.newPage()
    await signInWithForm(ownerPage.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await ownerPage.page.goto(`${ctx.webUrl}/admin/payments?q=${planPayment.reference}`, { waitUntil: 'networkidle0' })
    await waitForText(ownerPage.page, planPayment.reference)
    const row = await ownerPage.page.$eval('main table tbody', (body) => body.innerText)
    ctx.check(row.includes('Deleted user') && row.includes('Recruiter') && !row.includes(me.fullName), `admin Payments: "Deleted user" (${row.replace(/\s+/g, ' ').slice(0, 160)})`)
    await ctx.screenshot(ownerPage.page, '4-admin-payments')
    ctx.assertClean(ownerPage.issues, 'admin')
  },
}
