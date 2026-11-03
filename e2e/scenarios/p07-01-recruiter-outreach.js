import { completeCandidate } from '../lib/applicants.js'
import { clickText, pageApi, signInWithForm, waitForPath } from '../lib/flows.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P7-01 (M-085, M-088, M-094, M-118, P7-Q1): Sarah opens a discoverable candidate and sends the default template
 * in her language; the thread is in her inbox. The candidate (complete, on Free, never applied) sees the badge,
 * reads the thread, finds the upgrade prompt in place of the composer, and the badge clears.
 */
export default {
  name: 'P7-01 Recruiter outreach',
  viewports: ['D', 'M'],
  async run(ctx) {
    const reader = await completeCandidate(`Robin${ctx.viewport}`, { plus: false })
    const firstName = reader.fullName.split(' ')[0]

    const sarah = await ctx.newPage()
    await signInWithForm(sarah.page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    await sarah.page.goto(`${ctx.webUrl}/recruiter/find-candidates/${reader.id}`, { waitUntil: 'networkidle0' })
    await clickText(sarah.page, 'Message', '[data-start-conversation]')
    await sarah.page.waitForSelector('[role="dialog"] textarea[name="body"]', { visible: true })
    const template = await sarah.page.$eval('[role="dialog"] textarea[name="body"]', (area) => area.value)
    ctx.check(template.startsWith(`Hi ${firstName}, your profile stood out for our `), `the English template names the candidate and the job: ${template}`)
    await sarah.checkOverflow()
    await ctx.screenshot(sarah.page, '1-template')
    await clickText(sarah.page, 'Send message', '[role="dialog"] button')
    await waitForPath(sarah.page, () => /^\/recruiter\/messages\/\w+$/.test(location.pathname))
    const threadId = sarah.page.url().split('/').pop()
    await sarah.page.waitForSelector('[data-message="mine"]', { visible: true })
    await sarah.page.goto(`${ctx.webUrl}/recruiter/messages`, { waitUntil: 'networkidle0' })
    await sarah.page.waitForSelector(`[data-conversation="${threadId}"]`, { visible: true })
    await sarah.checkOverflow()
    await ctx.screenshot(sarah.page, '2-recruiter-inbox')
    ctx.assertClean(sarah.issues, 'recruiter outreach')

    const candidate = await ctx.newPage()
    const { page } = candidate
    await signInWithForm(page, ctx.webUrl, '/sign-in', reader.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate`, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.querySelector('[data-nav-badge="messages"]')?.textContent === '1', { timeout: 20_000 })
    await ctx.screenshot(page, '3-badge')
    await page.goto(`${ctx.webUrl}/candidate/messages`, { waitUntil: 'networkidle0' })
    await page.click(`[data-conversation="${threadId}"]`)
    await page.waitForSelector('[data-message="theirs"]', { visible: true })
    ctx.check((await page.$eval('[data-message="theirs"]', (item) => item.innerText)).includes(template), 'the candidate reads the message as sent')
    await page.waitForSelector('[data-upgrade-prompt]', { visible: true })
    ctx.check(!(await page.$('textarea[name="body"]')), 'no composer on Free (M-118)')
    await page.waitForFunction(() => !document.querySelector('[data-nav-badge="messages"]'), { timeout: 20_000 })
    ctx.check((await pageApi(page, '/me/counters')).body.unreadMessages === 0, 'reading clears the unread count')
    await candidate.checkOverflow()
    await ctx.screenshot(page, '4-free-reader')
    ctx.assertClean(candidate.issues, 'free reader')
  },
}
