import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chooseStage, clickApply, completeCandidate, MINUTE, recruiterWithJob, tickIn } from '../lib/applicants.js'
import { CLIENT_DIR } from '../lib/env.js'
import { clickText, responseTo, signInWithForm, toggleCheckbox, waitForPath, waitForText } from '../lib/flows.js'
import { openLessons, passQuiz, publishedCourse } from '../lib/learning.js'
import { createAlertApi, startApi } from '../lib/messages.js'
import { continueToStripe, openAs, payOnCheckout, rowsOf, subscribeThroughApi, until, waitForPlan } from '../lib/payments.js'
import { approvedRecruiter, jobBody, ownerToken, postJob } from '../lib/recruiters.js'
import { api, mailTo, TEST_PASSWORD } from '../lib/testApi.js'

/** A French UI label from the client's own fr files (the labels are not typed into the scenario). */
const fr = (namespace, path) => path.split('.').reduce((value, key) => value[key], JSON.parse(readFileSync(join(CLIENT_DIR, 'src', 'i18n', 'locales', 'fr', `${namespace}.json`), 'utf8')))

/**
 * P12-06: the cross-role journeys on the same accounts. Accounts, profiles and approvals are made through the API, as
 * in the phase scenarios that verified those screens (P2-01, P3-09, P4-03); every step below that a person takes on a
 * screen is done in the browser.
 * (1) A French candidate on Plus in EUR applies in French; the recruiter moves the stage; the French status email
 *     arrives; they message (the candidate replies in French); the recruiter rejects; the French rejection email
 *     arrives and the candidate sees "Non retenu".
 * (2) A new recruiter is approved and publishes; a Plus candidate gets the instant alert email and applies.
 * (3) The admin restricts that job → a candidate who opens it sees "no longer available".
 * (4) A course purchase on Stripe Checkout → quiz → certificate → the public verification page.
 * (5) The French candidate erases their data → the recruiter's, the admin's and the public views stay consistent.
 */
export default {
  name: 'P12-06 Cross-role journeys',
  viewports: ['D', 'M'],
  async run(ctx) {
    const v = ctx.viewport
    // (1) The French candidate, Plus in EUR.
    const candidate = await completeCandidate(`JourneyFr${v}`, { plus: false, language: 'fr' })
    await api('/me', { method: 'PATCH', token: candidate.token, body: { pickerCountry: 'FR' } })
    await subscribeThroughApi({ id: candidate.id, email: candidate.email, fullName: candidate.fullName }, { currency: 'EUR' })
    await waitForPlan(candidate.token, 'plus')
    const [subscription] = await rowsOf('subscriptions', candidate.id)
    ctx.check(subscription.currency === 'EUR', `Plus in EUR (${subscription.currency})`)
    const { recruiter, job } = await recruiterWithJob(`JourneyRec${v}`)

    const candidatePage = await ctx.newPage()
    const { page } = candidatePage
    await openAs(ctx, candidatePage, candidate.email, `/candidate/jobs/${job.id}`)
    await clickApply(page)
    await page.waitForSelector('[data-apply-dialog]', { visible: true })
    await toggleCheckbox(page, 'consent')
    await clickText(page, fr('applications', 'dialog.submit'), '[role="dialog"] button')
    await page.waitForSelector('[data-applied]', { visible: true })
    await ctx.screenshot(page, '1-fr-applied')
    const [application] = (await api('/candidate/applications', { token: candidate.token })).body.items

    const recruiterPage = await ctx.newPage()
    await signInWithForm(recruiterPage.page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await recruiterPage.page.goto(`${ctx.webUrl}/recruiter/applications`, { waitUntil: 'networkidle0' })
    const moved = responseTo(recruiterPage.page, [`/api/v1/recruiter/applications/${application.id}/stage`], 'PATCH')
    await chooseStage(recruiterPage.page, `[data-stage-select="${application.id}"] select`, 'Screening')
    ctx.check((await moved).status() === 200, 'the recruiter moved the stage')
    await ctx.screenshot(recruiterPage.page, '2-recruiter-stage')
    await tickIn(11 * MINUTE)
    const [status] = await until(() => mailTo(candidate.email, 'application_status'), (mails) => mails.length === 1, { label: 'the status email' })
    ctx.check(status.language === 'fr' && status.subject.startsWith('Du nouveau'), `the status email in French (${status.language}: ${status.subject})`)

    const thread = (await startApi(recruiter.token, { candidateId: candidate.id, jobId: job.id, body: 'Could we talk this week?' })).body.conversation
    await page.goto(`${ctx.webUrl}/candidate/messages/${thread.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('textarea[name="body"]', { visible: true })
    await page.type('textarea[name="body"]', 'Oui, avec plaisir.')
    await clickText(page, fr('messages', 'thread.send'), 'footer button')
    await page.waitForFunction(() => [...document.querySelectorAll('[data-message="mine"]')].some((item) => item.innerText.includes('Oui, avec plaisir.')), { timeout: 15_000 })
    await ctx.screenshot(page, '3-fr-reply')

    ctx.check((await api(`/recruiter/applications/${application.id}/reject`, { method: 'POST', token: recruiter.token, body: { notify: true } })).status === 200, 'the recruiter rejected')
    await tickIn(11 * MINUTE)
    const [rejection] = await until(() => mailTo(candidate.email, 'application_rejected'), (mails) => mails.length === 1, { label: 'the rejection email' })
    ctx.check(rejection.language === 'fr', `the rejection email in French (${rejection.subject})`)
    await page.goto(`${ctx.webUrl}/candidate/applications`, { waitUntil: 'networkidle0' })
    await waitForText(page, fr('enums', 'applicationStatus.not_selected'))
    await candidatePage.checkOverflow()
    await ctx.screenshot(page, '4-fr-not-selected')

    // (2) A new recruiter publishes; a Plus candidate with an instant alert gets the email and applies.
    const newcomer = await approvedRecruiter(`JourneyNew${v}`)
    const watcher = await completeCandidate(`JourneyAlert${v}`)
    const keyword = `Lighthouse${v}${Date.now() % 100000}`
    await createAlertApi(watcher.token, { name: `${keyword} alert`, keywords: keyword })
    const fresh = await postJob(newcomer.token, jobBody({ title: `${keyword} Designer` }))
    await tickIn(0)
    const [alert] = await until(() => mailTo(watcher.email, 'alert_instant'), (mails) => mails.length === 1, { label: 'the instant alert' })
    ctx.check(JSON.stringify(alert.params).includes(keyword), 'the instant alert names the new job')
    const watcherPage = await ctx.newPage()
    await openAs(ctx, watcherPage, watcher.email, `/candidate/jobs/${fresh.id}`)
    await clickApply(watcherPage.page)
    await watcherPage.page.waitForSelector('[data-apply-dialog]', { visible: true })
    await toggleCheckbox(watcherPage.page, 'consent')
    await clickText(watcherPage.page, 'Send application', '[role="dialog"] button')
    await watcherPage.page.waitForSelector('[data-applied]', { visible: true })
    await ctx.screenshot(watcherPage.page, '5-alert-applied')

    // (3) The admin restricts that job; a candidate who opens it sees "no longer available".
    const admin = await ownerToken()
    const opened = await api(`/admin/jobs/${fresh.id}/case`, { method: 'POST', token: admin, body: { reason: 'misleading' } })
    ctx.check(opened.status < 300, `case opened (${opened.status})`)
    const caseId = opened.body.id ?? opened.body.case?.id
    ctx.check((await api(`/admin/moderation/content/${caseId}/decision`, { method: 'POST', token: admin, body: { action: 'restrict', reason: 'Journey check' } })).status === 200, 'restricted')
    candidatePage.allow(404, `/api/v1/jobs/${fresh.id}`)
    await page.goto(`${ctx.webUrl}/candidate/jobs/${fresh.id}`, { waitUntil: 'networkidle0' })
    await waitForText(page, fr('findJobs', 'details.unavailable'))
    await ctx.screenshot(page, '6-fr-restricted-unavailable')

    // (4) A course bought on Stripe Checkout → certificate → the public page.
    const course = await publishedCourse(admin, { title: `Journey course ${v} ${Date.now() % 100000}` })
    const { page: learner } = watcherPage
    await learner.goto(`${ctx.webUrl}/candidate/learning/${course.id}`, { waitUntil: 'networkidle0' })
    await learner.click('[data-course-action="buy"]')
    await learner.waitForSelector('[data-checkout-summary]', { visible: true })
    await continueToStripe(learner, '£19.00')
    await payOnCheckout(learner)
    await waitForPath(learner, `/candidate/learning/${course.id}`)
    await learner.waitForSelector('[data-course-action="continue"]', { visible: true, timeout: 30_000 })
    await openLessons(watcher.token, course)
    const { certificate } = await passQuiz(watcher.token, admin, course.id)
    const publicPage = await ctx.newPage()
    await publicPage.page.goto(`${ctx.webUrl}/certificates/${certificate.code}`, { waitUntil: 'networkidle0' })
    await waitForText(publicPage.page, watcher.fullName)
    await waitForText(publicPage.page, 'Valid')
    await ctx.screenshot(publicPage.page, '7-certificate-valid')

    // (5) The French candidate erases their data; every other view stays consistent.
    ctx.check((await api('/me', { method: 'DELETE', token: candidate.token, body: { currentPassword: TEST_PASSWORD } })).status === 204, 'erased')
    const rp = recruiterPage.page
    await rp.goto(`${ctx.webUrl}/recruiter/applications`, { waitUntil: 'networkidle0' })
    ctx.check(!(await rp.evaluate((name) => document.body.innerText.includes(name), candidate.fullName)), 'the recruiter no longer sees the candidate')
    await rp.goto(`${ctx.webUrl}/recruiter/messages/${thread.id}`, { waitUntil: 'networkidle0' })
    await waitForText(rp, 'Deleted user')
    await rp.waitForSelector('[data-conversation-closed]')
    await recruiterPage.checkOverflow()
    await ctx.screenshot(rp, '8-recruiter-deleted-user')
    const ownerPage = await ctx.newPage()
    await signInWithForm(ownerPage.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    const [payment] = (await api(`/admin/payments?q=${encodeURIComponent('Plus')}&payer=candidate`, { token: admin })).body.items.filter((row) => row.payerName === null && row.currency === 'EUR')
    ctx.check(payment, "the French candidate's EUR payment is kept without a name")
    await ownerPage.page.goto(`${ctx.webUrl}/admin/payments?q=${payment.reference}`, { waitUntil: 'networkidle0' })
    await waitForText(ownerPage.page, 'Deleted user')
    await ctx.screenshot(ownerPage.page, '9-admin-deleted-user')
    for (const handle of [candidatePage, recruiterPage, watcherPage, publicPage, ownerPage]) ctx.assertClean(handle.issues, 'journeys')
  },
}
