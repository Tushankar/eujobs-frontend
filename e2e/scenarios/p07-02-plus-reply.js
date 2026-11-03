import { clickText, signInWithForm } from '../lib/flows.js'
import { unreadOf, waitForMessagesBadge } from '../lib/messages.js'
import { login } from '../lib/recruiters.js'

/** P7-02 (M-084, M-094): Emma (Plus) replies in her Acme thread; Sarah's badge goes up, and reading clears it. */
export default {
  name: 'P7-02 Plus reply',
  viewports: ['D'],
  async run(ctx) {
    const sarahToken = await login(ctx.seedCredentials.email('sarah'), 'recruiter', ctx.seedCredentials.password)
    const before = await unreadOf(sarahToken)

    const sarah = await ctx.newPage()
    await signInWithForm(sarah.page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    await waitForMessagesBadge(sarah.page, before || null)

    const emma = await ctx.newPage()
    const { page } = emma
    await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/candidate/messages`, { waitUntil: 'networkidle0' })
    await page.click('[data-conversation]')
    await page.waitForSelector('textarea[name="body"]', { visible: true })
    const reply = `Thursday at 15:00 works for me. (${Date.now()})`
    await page.type('textarea[name="body"]', reply)
    await clickText(page, 'Send', 'footer button')
    await page.waitForFunction((text) => [...document.querySelectorAll('[data-message="mine"]')].some((item) => item.innerText.includes(text)), {}, reply)
    ctx.check((await page.$eval('textarea[name="body"]', (area) => area.value)) === '', 'the composer clears after sending')
    await ctx.screenshot(page, '1-emma-replied')
    ctx.assertClean(emma.issues, 'reply')

    await waitForMessagesBadge(sarah.page, before + 1)
    await ctx.screenshot(sarah.page, '2-recruiter-badge')
    await sarah.page.goto(`${ctx.webUrl}/recruiter/messages`, { waitUntil: 'networkidle0' })
    await sarah.page.click('[data-conversation] [data-unread]')
    await sarah.page.waitForFunction((text) => document.body.innerText.includes(text), {}, reply)
    await waitForMessagesBadge(sarah.page, null)
    await ctx.screenshot(sarah.page, '3-read')
    ctx.assertClean(sarah.issues, 'recruiter reads')
  },
}
