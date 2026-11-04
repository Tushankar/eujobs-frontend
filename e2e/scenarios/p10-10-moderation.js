import { openAsAdmin } from '../lib/admins.js'
import { completeCandidate, recruiterWithJob, setTextarea } from '../lib/applicants.js'
import { clickText, responseTo, signInWithForm, toggleCheckbox, waitForText } from '../lib/flows.js'
import { sendApi, startApi } from '../lib/messages.js'
import { freeCandidate, openAs } from '../lib/payments.js'
import { api, db, mailTo, TEST_PASSWORD } from '../lib/testApi.js'

const oid = (id) => ({ $oid: id })
const caseOf = async (targetId, status = 'open') => (await db('moderationcases', 'find', { filter: { targetId: oid(targetId), status } }))[0]

/** Opens the report dialog of a Report button, picks a reason, sets the details and sends; returns the POST response. */
async function report(page, targetType, reason, details = '', within = 'main') {
  await page.click(`${within} [data-report="${targetType}"]`)
  await page.waitForSelector('[data-report-form]')
  await page.select('[data-report-form] select[name="reason"]', reason)
  await setTextarea(page, '[data-report-form] textarea[name="details"]', details)
  const sent = responseTo(page, '/api/v1/reports', 'POST')
  await clickText(page, 'Send report', '[role="dialog"] button[type="submit"]')
  return sent
}

/** An admin decision in the open case dialog: the action, the reason, optionally the photo removal, then confirm. */
async function decideCase(page, action, reason, { removePhoto = false } = {}) {
  await page.click(`[data-action="${action}"]`)
  await page.waitForSelector(`[data-decision-step="${action}"]`)
  await setTextarea(page, '[data-decision-step] textarea[name="reason"]', reason)
  if (removePhoto) await toggleCheckbox(page, 'removePhoto')
  const decided = responseTo(page, ['/api/v1/admin/moderation/content/', '/decision'], 'POST')
  await page.click('[data-decision-step] button:last-of-type')
  const response = await decided
  if (response.status() !== 200) throw new Error(`decision ${action}: ${response.status()}`)
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
}

/**
 * P10-10 (M-013, M-164, M-167, U20, OQ-1, P10-Q10, P10-Q12): a candidate reports a job (scam_or_fraud; 501 characters of
 * details → error) and a case opens; a second report on the same job by the same user and an 11th report in one day are
 * refused. Restrict → the job is paused and locked, the recruiter sees the reason, cannot republish and is emailed;
 * Dismiss lifts it (still paused, emailed). A message report shows only the 6-message excerpt and offers Dismiss only.
 * A profile report → Restrict hides the profile from discovery and removes the photo. A company case offers Dismiss only.
 */
export default {
  name: 'P10-10 Moderation',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob(`Moderated${ctx.viewport}`)
    const reporter = await freeCandidate(`Reporter${ctx.viewport}`, 'GB')
    const candidate = await completeCandidate(`Reported${ctx.viewport}`)

    // 1. The candidate reports the job: details over 500 characters are refused in the form, then the report is sent.
    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, reporter.email, `/candidate/jobs/${job.id}`)
    await page.waitForSelector('main [data-report="job"]')
    await page.click('main [data-report="job"]')
    await page.waitForSelector('[data-report-form]')
    await page.select('[data-report-form] select[name="reason"]', 'scam_or_fraud')
    await setTextarea(page, '[data-report-form] textarea[name="details"]', 'x'.repeat(501))
    await clickText(page, 'Send report', '[role="dialog"] button[type="submit"]')
    await waitForText(page, 'Use at most 500 characters.')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-details-too-long')
    await setTextarea(page, '[data-report-form] textarea[name="details"]', 'They ask for a fee before the interview.')
    const sent = responseTo(page, '/api/v1/reports', 'POST')
    await clickText(page, 'Send report', '[role="dialog"] button[type="submit"]')
    ctx.check((await sent).status() === 201, 'the report is accepted')
    await page.waitForFunction(() => document.querySelector('main [data-report="job"]')?.disabled && document.querySelector('main [data-report="job"]').textContent.includes('Reported'))
    const jobCase = await caseOf(job.id)
    ctx.check(jobCase?.reports[0].reason === 'scam_or_fraud', 'a job case is open')

    // 2. The same person again → refused with an explanation.
    await page.reload({ waitUntil: 'networkidle0' })
    handle.allow(409, '/api/v1/reports')
    ctx.check((await report(page, 'job', 'spam')).status() === 409, 'a second report on the same job is refused')
    await waitForText(page, 'You have already reported this.')
    await ctx.screenshot(page, '2-already-reported')
    await page.keyboard.press('Escape')

    // 3. The 11th report in a day: nine more through the API (seeded jobs), then the company in the browser → limited.
    const others = (await db('jobs', 'find', { filter: { status: 'published', _id: { $ne: oid(job.id) } } })).slice(0, 9)
    for (const other of others) {
      const result = await api('/reports', { method: 'POST', token: reporter.token, body: { targetType: 'job', targetId: other._id.$oid, reason: 'spam' } })
      ctx.check(result.status === 201 || result.status === 409, `report ${other.title}: ${result.status}`)
    }
    const reportsToday = (await db('moderationcases', 'find', { filter: { 'reports.reporterId': oid(reporter.user.id) } })).length
    ctx.check(reportsToday === 10, `ten reports today (${reportsToday})`)
    handle.allow(429, '/api/v1/reports')
    ctx.check((await report(page, 'company', 'misleading')).status() === 429, 'the 11th report in a day is limited')
    await waitForText(page, 'You can send up to 10 reports a day.')
    await handle.checkOverflow()
    await ctx.screenshot(page, '3-daily-limit')
    await page.keyboard.press('Escape')

    // 4. The admin restricts the job.
    const adminHandle = await ctx.newPage()
    const admin = adminHandle.page
    await openAsAdmin(ctx, adminHandle, ctx.seedCredentials.email(null), '/admin/moderation', ctx.seedCredentials.password)
    await admin.waitForFunction((title) => [...document.querySelectorAll('main li')].some((row) => row.innerText.includes(title) && row.innerText.includes('High priority')), {}, job.title)
    await adminHandle.checkOverflow()
    await ctx.screenshot(admin, '4-queue')
    await admin.goto(`${ctx.webUrl}/admin/moderation/content/${jobCase._id.$oid}`, { waitUntil: 'networkidle0' })
    await admin.waitForSelector('[data-action="restrict"]')
    await waitForText(admin, 'They ask for a fee before the interview.')
    await ctx.screenshot(admin, '5-job-case')
    await decideCase(admin, 'restrict', 'Asks candidates for a fee.')
    let stored = (await db('jobs', 'find', { filter: { _id: oid(job.id) } }))[0]
    ctx.check(stored.status === 'paused' && stored.restricted?.reason === 'Asks candidates for a fee.', 'the job is paused and locked')
    ctx.check((await mailTo(recruiter.email, 'content_restricted')).length === 1, 'the recruiter is emailed (content_restricted)')

    // 5. The recruiter sees the reason and cannot republish.
    const recruiterHandle = await ctx.newPage()
    const recruiterPage = recruiterHandle.page
    await signInWithForm(recruiterPage, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await recruiterPage.goto(`${ctx.webUrl}/recruiter/jobs/${job.id}`, { waitUntil: 'networkidle0' })
    await waitForText(recruiterPage, 'Restricted by moderation: Asks candidates for a fee.')
    await recruiterHandle.checkOverflow()
    await ctx.screenshot(recruiterPage, '6-recruiter-restricted')
    const republish = await api(`/recruiter/jobs/${job.id}/status`, { method: 'PATCH', token: recruiter.token, body: { status: 'published' } })
    ctx.check(republish.status === 409 && republish.body.error.code === 'LOCKED', 'republishing is refused (LOCKED)')

    // 6. Dismiss lifts the lock; the job stays paused and the recruiter is emailed.
    await admin.goto(`${ctx.webUrl}/admin/moderation/content/${jobCase._id.$oid}`, { waitUntil: 'networkidle0' })
    await admin.waitForSelector('[data-action="dismiss"]')
    ctx.check(!(await admin.$('[data-action="restrict"]')), 'a restricted case offers only Dismiss (lift)')
    await decideCase(admin, 'dismiss', 'The recruiter removed the fee.')
    stored = (await db('jobs', 'find', { filter: { _id: oid(job.id) } }))[0]
    ctx.check(stored.status === 'paused' && !stored.restricted, 'the lock is lifted and the job stays paused')
    ctx.check((await mailTo(recruiter.email, 'content_restriction_lifted')).length === 1, 'the recruiter is emailed (content_restriction_lifted)')

    // 7. Messages: eight alternating messages; the candidate reports the recruiter's 7th → a six-message excerpt, Dismiss only.
    const thread = await startApi(recruiter.token, { candidateId: candidate.id, body: 'Message 1' })
    ctx.check(thread.status === 201, `conversation started (${thread.status})`)
    const conversationId = thread.body.id ?? thread.body.conversation?.id
    for (let n = 2; n <= 8; n += 1) await sendApi(n % 2 ? recruiter.token : candidate.token, conversationId, `Message ${n}`)
    const candidateHandle = await ctx.newPage()
    const candidatePage = candidateHandle.page
    await openAs(ctx, candidateHandle, candidate.email, `/candidate/messages/${conversationId}`)
    await candidatePage.waitForFunction(() => document.querySelectorAll('li[data-message]').length === 8)
    const seventh = 'li[data-message="theirs"]:nth-last-child(2)'
    ctx.check((await candidatePage.$eval(seventh, (item) => item.innerText)).includes('Message 7'), 'the 7th message is the recruiter’s')
    ctx.check(!(await candidatePage.$('li[data-message="mine"] [data-report]')), 'no Report button on your own messages')
    ctx.check((await report(candidatePage, 'message', 'offensive', '', seventh)).status() === 201, 'the message report is accepted')
    await candidateHandle.checkOverflow()
    await ctx.screenshot(candidatePage, '7-message-reported')
    const messageCase = (await db('moderationcases', 'find', { filter: { targetType: 'message', status: 'open', 'reports.reporterId': oid(candidate.id) } }))[0]
    await admin.goto(`${ctx.webUrl}/admin/moderation/content/${messageCase._id.$oid}`, { waitUntil: 'networkidle0' })
    await admin.waitForSelector('[data-excerpt-reported]')
    const excerpt = await admin.$$eval('[role="dialog"] ol li', (items) => items.map((item) => item.innerText))
    ctx.check(excerpt.length === 6 && excerpt[0].includes('Message 2') && excerpt[5].includes('Message 7'), `the excerpt is messages 2–7 (${excerpt.length})`)
    ctx.check((await admin.$$('[data-action]')).length === 1 && (await admin.$('[data-action="dismiss"]')), 'a message case offers Dismiss only')
    await adminHandle.checkOverflow()
    await ctx.screenshot(admin, '8-message-case')

    // 8. The recruiter reports the candidate's profile; Restrict hides it from discovery and removes the photo.
    await recruiterPage.goto(`${ctx.webUrl}/recruiter/find-candidates/${candidate.id}`, { waitUntil: 'networkidle0' })
    await recruiterPage.waitForSelector('[data-report="candidate_profile"]')
    ctx.check((await report(recruiterPage, 'candidate_profile', 'misleading', 'Claims a degree that does not exist.', 'aside')).status() === 201, 'the profile report is accepted')
    const listed = async () => (await api(`/recruiter/candidates?q=${encodeURIComponent(candidate.fullName)}`, { token: recruiter.token })).body.items.some((item) => item.id === candidate.id)
    ctx.check(await listed(), 'the profile is in discovery before the decision')
    const profileCase = await caseOf(candidate.id)
    await admin.goto(`${ctx.webUrl}/admin/moderation/content/${profileCase._id.$oid}`, { waitUntil: 'networkidle0' })
    await admin.waitForSelector('[data-action="restrict"]')
    await decideCase(admin, 'restrict', 'False education claim.', { removePhoto: true })
    const profile = (await db('candidateprofiles', 'find', { filter: { userId: oid(candidate.id) } }))[0]
    ctx.check(profile.restricted?.reason === 'False education claim.' && !profile.photo?.fileId, 'the profile is restricted and its photo removed')
    ctx.check(!(await listed()), 'the profile is hidden from discovery')
    const [mail] = await mailTo(candidate.email, 'content_restricted')
    ctx.check(mail?.text.includes('photo was removed'), 'the candidate is emailed, with the photo note')

    // 9. A company case offers Dismiss only.
    await candidatePage.goto(`${ctx.webUrl}/candidate/jobs/${others[0]._id.$oid}`, { waitUntil: 'networkidle0' })
    ctx.check((await report(candidatePage, 'company', 'misleading')).status() === 201, 'the company report is accepted')
    const companyCase = await caseOf(others[0].companyId.$oid)
    await admin.goto(`${ctx.webUrl}/admin/moderation/content/${companyCase._id.$oid}`, { waitUntil: 'networkidle0' })
    await admin.waitForSelector('[data-action="dismiss"]')
    ctx.check((await admin.$$('[data-action]')).length === 1, 'a company case offers Dismiss only')
    await ctx.screenshot(admin, '9-company-case')
    await decideCase(admin, 'dismiss', '')

    for (const each of [handle, adminHandle, recruiterHandle, candidateHandle]) ctx.assertClean(each.issues, 'moderation')
  },
}
