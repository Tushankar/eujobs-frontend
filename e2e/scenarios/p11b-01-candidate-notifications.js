import { applyApi, completeCandidate, MINUTE, recruiterWithJob, tickIn } from '../lib/applicants.js'
import { clickText, responseTo, waitForPath } from '../lib/flows.js'
import { startApi, waitForMessagesBadge } from '../lib/messages.js'
import { bellCount, clickNotification, openBell, rowsOf, waitForBell, waitForSection } from '../lib/notifications.js'
import { meOf, openAs } from '../lib/payments.js'
import { api } from '../lib/testApi.js'

const switchState = (page) => page.$$eval('[data-email-switches] [role="switch"]', (items) => items.map((item) => item.getAttribute('aria-checked')))

/**
 * P11b-01 (P11b-Q1, Q2, Q3, Q8, Q9, Q10): a Plus candidate with an application. The recruiter moves it to Interview
 * (shown after the 10-minute window) and sends a message: the bell counts 2, the Applications item shows its own
 * accent count beside the active-applications number, the dropdown lists both (above the read payment row). Clicking the status opens that
 * application's activity dialog and clears its counts; clicking the message opens the conversation and clears the
 * rest. The Notifications page shows all three read and an empty Unread view. Settings → Notifications saves the Messages
 * email switch.
 */
export default {
  name: 'P11b-01 Candidate notifications',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob(`Bell${ctx.viewport}`)
    const candidate = await completeCandidate(`BellCandidate${ctx.viewport}`)
    const { body: application } = await applyApi(candidate.token, job.id)

    // The real Plus payment (Stripe webhook) is the first notification: payment received, opening Billing (P11b-Q11).
    const [paid] = (await api('/notifications', { token: candidate.token })).body.items
    ctx.check(paid?.type === 'payment_paid' && paid.path === '/candidate/settings/billing', `payment notification ${JSON.stringify(paid)}`)
    await api('/notifications/read-all', { method: 'POST', token: candidate.token })

    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, candidate.email, '/candidate')
    ctx.check((await bellCount(page)) === 0, 'no notification before any event')

    const stages = (await api('/recruiter/pipeline', { token: recruiter.token })).body.items
    await api(`/recruiter/applications/${application.id}/stage`, { method: 'PATCH', token: recruiter.token, body: { stageId: stages.find((stage) => stage.category === 'interview').id } })
    await tickIn(11 * MINUTE)
    await waitForBell(page, 1)
    await waitForSection(page, 'applications', 1)
    const active = await page.$eval('[data-nav-badge="applications"]', (badge) => badge.textContent)
    ctx.check(active === '1', `the active-applications badge still shows 1 (${active})`)

    await startApi(recruiter.token, { candidateId: candidate.id, jobId: job.id, body: 'Hello, are you free for a call on Monday?' })
    await waitForBell(page, 2)
    await waitForMessagesBadge(page, 1)
    ctx.check(!(await page.$('[data-notification-badge="messages"]')), 'Messages keeps only its unread-messages badge')

    await openBell(page)
    const rows = await rowsOf(page)
    ctx.check(JSON.stringify(rows.map((row) => [row.type, row.read])) === '[["message",false],["application_status",false],["payment_paid",true]]', `dropdown rows ${JSON.stringify(rows)}`)
    ctx.check(rows[0].text.includes('New message from') && rows[1].text.includes(`${job.title}: Interview`), `row texts ${JSON.stringify(rows.map((row) => row.text))}`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-dropdown')

    await clickNotification(page, 'application_status', `/candidate/applications/${application.id}`)
    await page.waitForSelector('[role="dialog"] [data-history]', { visible: true })
    await waitForBell(page, 1)
    await waitForSection(page, 'applications', 0)
    await ctx.screenshot(page, '2-application-opened')
    await page.keyboard.press('Escape')
    await waitForPath(page, () => location.pathname === '/candidate/applications')

    await openBell(page)
    await clickNotification(page, 'message', '/candidate/messages/')
    await waitForBell(page, 0)
    await waitForMessagesBadge(page, null)
    await ctx.screenshot(page, '3-conversation-opened')

    await page.goto(`${ctx.webUrl}/candidate/notifications`, { waitUntil: 'networkidle0' })
    const listed = await rowsOf(page, 'main')
    ctx.check(listed.length === 3 && listed.every((row) => row.read), `the page lists all three, read (${JSON.stringify(listed)})`)
    await clickText(page, 'Unread', 'main [role="group"] button')
    await page.waitForFunction(() => document.querySelector('main').innerText.includes('You are all caught up'))
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-page-unread-empty')

    await page.goto(`${ctx.webUrl}/candidate/settings/notifications`, { waitUntil: 'networkidle0' })
    // P11d-Q4: the fifth category is Interviews.
    ctx.check(JSON.stringify(await switchState(page)) === '["true","true","true","true","true"]', 'five categories, all on')
    const saved = responseTo(page, '/api/v1/me/notifications', 'PATCH')
    await page.click('[data-email-switches] li:nth-child(2) [role="switch"]')
    await saved
    await page.reload({ waitUntil: 'networkidle0' })
    ctx.check(JSON.stringify(await switchState(page)) === '["true","false","true","true","true"]', 'Messages stays off after a reload')
    ctx.check((await meOf(candidate.token)).emailSwitches.messages === false, 'saved on the account')
    await handle.checkOverflow()
    await ctx.screenshot(page, '5-settings')
    ctx.assertClean(handle.issues, 'candidate notifications')
  },
}
