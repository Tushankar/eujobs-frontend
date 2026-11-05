import { applyApi, completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { clickText, signInWithForm, waitForText } from '../lib/flows.js'
import { enrolFree, openLessons, passQuiz, publishedCourse } from '../lib/learning.js'
import { startApi } from '../lib/messages.js'
import { openAs, rowsOf, stripe, until } from '../lib/payments.js'
import { deleteThroughUi, filesOf, onDisk } from '../lib/privacy.js'
import { ownerToken } from '../lib/recruiters.js'
import { api, db, TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P12-02 (M-188, OD15, P12-Q2, Q3, Q7): a Plus candidate deletes their data with the password → signed out, and signing
 * in fails. In Stripe the subscription is canceled and the Customer deleted. The recruiter: the application is gone,
 * the thread shows "Deleted user" and is closed, the shortlist count drops, the notes are gone. The certificate page says
 * "No longer valid". Admin Payments and the audit log show "Deleted user", and the erasure has its own audit entry.
 */
export default {
  name: 'P12-02 Candidate erasure',
  viewports: ['D', 'M'],
  async run(ctx) {
    const label = `Erased${ctx.viewport}`
    const { recruiter, job } = await recruiterWithJob(`${label}Rec`)
    const candidate = await completeCandidate(label)
    ctx.check((await applyApi(candidate.token, job.id)).status === 201, 'applied')
    ctx.check((await api(`/recruiter/shortlist/${candidate.id}`, { method: 'PUT', token: recruiter.token })).status === 200, 'shortlisted')
    ctx.check((await api(`/recruiter/candidates/${candidate.id}/notes`, { method: 'POST', token: recruiter.token, body: { text: 'Strong portfolio' } })).status === 201, 'noted')
    const thread = (await startApi(recruiter.token, { candidateId: candidate.id, jobId: job.id, body: 'Would you like to talk?' })).body.conversation
    const admin = await ownerToken()
    const course = await publishedCourse(admin, { title: `Erasure course ${ctx.viewport} ${Date.now()}`, isFree: true })
    await enrolFree(candidate.token, course.id)
    await openLessons(candidate.token, course)
    const { certificate } = await passQuiz(candidate.token, admin, course.id)
    const [subscription] = await rowsOf('subscriptions', candidate.id)
    const [plusPayment] = await until(() => rowsOf('payments', candidate.id), (rows) => rows.length === 1, { label: 'the Plus payment row' })
    const files = await filesOf(candidate.id)
    const shortlistBefore = (await api('/recruiter/shortlist', { token: recruiter.token })).body.total

    const handle = await ctx.newPage()
    await openAs(ctx, handle, candidate.email, '/candidate/settings/data-account')
    await deleteThroughUi(ctx, handle, { button: 'Delete my data', signInPath: '/sign-in' })
    await ctx.screenshot(handle.page, '1-signed-out')
    ctx.assertClean(handle.issues, 'erasure')
    const signIn = await api('/auth/login', { method: 'POST', body: { email: candidate.email, password: TEST_PASSWORD, portal: 'candidate' } })
    ctx.check(signIn.status === 401, `signing in fails (${signIn.status})`)

    // OD15 in Stripe: the subscription canceled at once, the Customer deleted.
    const canceled = await until(() => stripe.subscriptions.retrieve(subscription.stripeSubscriptionId), (item) => item.status === 'canceled', { label: 'subscription canceled' })
    ctx.check(canceled.status === 'canceled', 'Stripe: subscription canceled')
    ctx.check((await stripe.customers.retrieve(subscription.stripeCustomerId)).deleted === true, 'Stripe: Customer deleted')
    for (const file of files) ctx.check(!(await onDisk(file)), `${file.purpose} file deleted from disk`)

    // The recruiter's views.
    ctx.check((await db('applications', 'find', { filter: { candidateId: { $oid: candidate.id } } })).length === 0, 'the application is gone')
    ctx.check((await api('/recruiter/shortlist', { token: recruiter.token })).body.total === shortlistBefore - 1, 'the shortlist count drops by one')
    ctx.check((await db('candidatenotes', 'find', { filter: { candidateId: { $oid: candidate.id } } })).length === 0, 'the notes are gone')
    const recruiterPage = await ctx.newPage()
    const { page } = recruiterPage
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/recruiter/messages`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Deleted user')
    await ctx.screenshot(page, '2-inbox-deleted-user')
    await page.goto(`${ctx.webUrl}/recruiter/messages/${thread.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-conversation-closed]')
    ctx.check(!(await page.$('textarea')), 'no composer in the closed thread')
    await recruiterPage.checkOverflow()
    await ctx.screenshot(page, '3-thread-closed')
    ctx.assertClean(recruiterPage.issues, 'recruiter')

    // The public certificate page: a tombstone.
    const publicPage = await ctx.newPage()
    await publicPage.page.goto(`${ctx.webUrl}/certificates/${certificate.code}`, { waitUntil: 'networkidle0' })
    await waitForText(publicPage.page, 'No longer valid')
    ctx.check(!(await publicPage.page.evaluate((name) => document.body.innerText.includes(name), candidate.fullName)), 'the holder name is gone')
    await ctx.screenshot(publicPage.page, '4-certificate-tombstone')
    ctx.assertClean(publicPage.issues, 'certificate page')

    // Admin: Payments and the audit log say "Deleted user"; the erasure is logged without a name.
    const ownerPage = await ctx.newPage()
    await signInWithForm(ownerPage.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await ownerPage.page.goto(`${ctx.webUrl}/admin/payments?q=${plusPayment.reference}`, { waitUntil: 'networkidle0' })
    await waitForText(ownerPage.page, plusPayment.reference)
    const row = await ownerPage.page.$eval('main table tbody', (body) => body.innerText)
    ctx.check(row.includes('Deleted user') && !row.includes('enums:') && !row.includes(candidate.fullName), `admin Payments: "Deleted user" (${row.replace(/\s+/g, ' ').slice(0, 160)})`)
    await ownerPage.checkOverflow()
    await ctx.screenshot(ownerPage.page, '5-admin-payments')
    await clickText(ownerPage.page, 'Details', 'main table button')
    await ownerPage.page.waitForFunction(() => document.querySelector('[role="dialog"]')?.innerText.includes('Deleted user'), { timeout: 15_000 })
    const details = await ownerPage.page.$eval('[role="dialog"]', (dialog) => dialog.innerText)
    ctx.check(details.includes('Deleted user') && !details.includes('enums:'), 'payment details: "Deleted user"')
    await ctx.screenshot(ownerPage.page, '6-payment-details')
    await ownerPage.page.goto(`${ctx.webUrl}/admin/audit-logs?q=${plusPayment.reference}`, { waitUntil: 'networkidle0' })
    await waitForText(ownerPage.page, `Payment ${plusPayment.reference}: Deleted user`)
    await ctx.screenshot(ownerPage.page, '7-audit-deleted-user')
    const events = (await api('/admin/audit-events?category=access', { token: admin })).body.items
    ctx.check(events.some((event) => event.type === 'access.account_deleted' && event.params.accountRole === 'candidate' && event.actor.name === null), 'P12-Q7: one erasure entry without a name')
    ctx.assertClean(ownerPage.issues, 'admin')
  },
}
