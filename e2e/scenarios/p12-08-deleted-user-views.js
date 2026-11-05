import { applyApi, completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { signInWithForm, waitForPath, waitForText } from '../lib/flows.js'
import { openBell, rowsOf } from '../lib/notifications.js'
import { api, db, TEST_PASSWORD } from '../lib/testApi.js'

const DELETED = 'Deleted user'
const UNAVAILABLE = 'This item is no longer available.'

/**
 * P12-08 (OD15, P12-Q3, P12-C10): the screens Phase 12 changed that P12-01 … 07 do not open. After a candidate who
 * applied and reported a job erases their data: the recruiter's "applied" notification reads "Deleted user applied to …"
 * (the name is gone) and opens as "no longer available"; the admin's case shows the report by "Deleted user"; the
 * recruiter's Sign out then leaves no failed request behind (the shell queries skip while signed out).
 */
export default {
  name: 'P12-08 Deleted user views',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob(`DeletedViews${ctx.viewport}`)
    const candidate = await completeCandidate(`DeletedViewsCand${ctx.viewport}`)
    ctx.check((await applyApi(candidate.token, job.id)).status === 201, 'applied')
    ctx.check((await api('/reports', { method: 'POST', token: candidate.token, body: { targetType: 'job', targetId: job.id, reason: 'spam' } })).status < 300, 'reported the job')
    const [jobCase] = await db('moderationcases', 'find', { filter: { targetId: { $oid: job.id } } })
    const caseId = jobCase._id.$oid ?? jobCase._id
    ctx.check((await api('/me', { method: 'DELETE', token: candidate.token, body: { currentPassword: TEST_PASSWORD } })).status === 204, 'erased')

    // The recruiter's bell: the row without the name, opening says no longer available.
    const recruiterPage = await ctx.newPage()
    const { page } = recruiterPage
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.waitForSelector('header [data-bell] [data-bell-count]', { timeout: 20_000 })
    await openBell(page)
    const [row] = (await rowsOf(page)).filter((item) => item.type === 'application_new')
    ctx.check(row?.text.includes(`${DELETED} applied to ${job.title}`) && !row.text.includes(candidate.fullName), `the row reads "Deleted user applied to …" (${row?.text})`)
    await recruiterPage.checkOverflow()
    await ctx.screenshot(page, '1-recruiter-bell')
    await page.click('[data-notifications-panel] [data-notification="application_new"]')
    await page.waitForFunction((text) => document.querySelector('[data-notifications-panel]')?.innerText.includes(text), {}, UNAVAILABLE)
    await ctx.screenshot(page, '2-no-longer-available')

    // Sign out: no 401 from the counters poll or the shell's /me (P12-C10).
    await page.keyboard.press('Escape')
    // At 375 px the Sign out button is in the sidebar drawer.
    if (ctx.viewport === 'M') await page.click('[aria-controls="workspace-sidebar"]')
    await page.waitForSelector('[aria-label="Sign out"]', { visible: true })
    await page.click('[aria-label="Sign out"]')
    await waitForPath(page, '/recruiter/sign-in')
    await new Promise((resolve) => setTimeout(resolve, 2000))
    ctx.assertClean(recruiterPage.issues, 'recruiter and sign-out')

    // The admin's case: the report by "Deleted user".
    const ownerPage = await ctx.newPage()
    await signInWithForm(ownerPage.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await ownerPage.page.goto(`${ctx.webUrl}/admin/moderation/content/${caseId}`, { waitUntil: 'networkidle0' })
    await ownerPage.page.waitForSelector('[role="dialog"]')
    await waitForText(ownerPage.page, `${DELETED} ·`)
    ctx.check(!(await ownerPage.page.evaluate((name) => document.body.innerText.includes(name), candidate.fullName)), 'the reporter name is gone')
    await ownerPage.checkOverflow()
    await ctx.screenshot(ownerPage.page, '3-admin-case-deleted-reporter')
    ctx.assertClean(ownerPage.issues, 'admin case')
  },
}
