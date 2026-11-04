import { applyApi, completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { clickText, responseTo, signInWithForm, waitForPath } from '../lib/flows.js'
import { clickNotification, openBell, rowsOf, waitForBell, waitForSection } from '../lib/notifications.js'
import { meOf } from '../lib/payments.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

const switchState = (page) => page.$$eval('[data-email-switches] [role="switch"]', (items) => items.map((item) => item.getAttribute('aria-checked')))

/**
 * P11b-02 (P11b-Q1, Q2, Q3, Q9, Q10): a new recruiter finds "account approved" in the bell (it opens the Overview and
 * clears the Overview count). A candidate applies: the bell and the Applications item count 1; the notification opens
 * the Applications list filtered to that job with the row highlighted. The candidate withdraws: the Notifications page
 * lists it unread, and "Mark all as read" clears the bell. Settings → Notifications saves the New applications switch.
 */
export default {
  name: 'P11b-02 Recruiter notifications',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob(`BellRec${ctx.viewport}`)
    const candidate = await completeCandidate(`BellApplicant${ctx.viewport}`)

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/recruiter/jobs`, { waitUntil: 'networkidle0' })
    await waitForBell(page, 1)
    await waitForSection(page, 'overview', 1)
    await openBell(page)
    const [approved] = await rowsOf(page)
    ctx.check(approved.type === 'account_decided' && approved.text.includes('Your recruiter account was approved'), `approval row ${JSON.stringify(approved)}`)
    await clickNotification(page, 'account_decided', null)
    await waitForPath(page, () => location.pathname === '/recruiter')
    await waitForBell(page, 0)
    await waitForSection(page, 'overview', 0)

    const { body: application } = await applyApi(candidate.token, job.id)
    await waitForBell(page, 1)
    await waitForSection(page, 'applications', 1)
    await openBell(page)
    const [row] = await rowsOf(page)
    ctx.check(row.type === 'application_new' && row.text.includes(`${candidate.fullName} applied to ${job.title}`), `application row ${JSON.stringify(row)}`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-dropdown')

    await clickNotification(page, 'application_new', `/recruiter/applications/${application.id}`)
    await page.waitForSelector(`tr[aria-current="true"][data-application-row="${application.id}"]`)
    ctx.check(new URL(page.url()).searchParams.get('jobId') === job.id, `filtered to the job (${page.url()})`)
    await waitForBell(page, 0)
    await waitForSection(page, 'applications', 0)
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-application-highlighted')

    await api(`/candidate/applications/${application.id}/withdraw`, { method: 'POST', token: candidate.token })
    await waitForBell(page, 1)
    await page.goto(`${ctx.webUrl}/recruiter/notifications`, { waitUntil: 'networkidle0' })
    const listed = await rowsOf(page, 'main')
    ctx.check(
      JSON.stringify(listed.map((item) => [item.type, item.read])) === '[["application_withdrawn",false],["application_new",true],["account_decided",true]]',
      `page rows ${JSON.stringify(listed)}`,
    )
    await ctx.screenshot(page, '3-page')
    const readAll = responseTo(page, '/api/v1/notifications/read-all', 'POST')
    await clickText(page, 'Mark all as read', 'main button')
    await readAll
    await waitForBell(page, 0)
    await page.waitForFunction(() => document.querySelectorAll('main [data-notification]:not([data-read])').length === 0)

    await page.goto(`${ctx.webUrl}/recruiter/settings/notifications`, { waitUntil: 'networkidle0' })
    ctx.check(JSON.stringify(await switchState(page)) === '["true","true"]', 'two categories, both on')
    const saved = responseTo(page, '/api/v1/me/notifications', 'PATCH')
    await page.click('[data-email-switches] li:nth-child(1) [role="switch"]')
    await saved
    await page.reload({ waitUntil: 'networkidle0' })
    ctx.check(JSON.stringify(await switchState(page)) === '["false","true"]', 'New applications stays off after a reload')
    ctx.check((await meOf(recruiter.token)).emailSwitches.new_applications === false, 'saved on the account')
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-settings')
    ctx.assertClean(handle.issues, 'recruiter notifications')
  },
}
