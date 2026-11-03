import { signInWithForm } from '../lib/flows.js'

const HIDDEN_WINDOW_MS = 35_000
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * P7-07 (M-094): with another tab in front, the background tab sends no /me/counters requests; in front again,
 * polling resumes within one 15 s interval.
 */
export default {
  name: 'P7-07 Polling pause',
  viewports: ['D'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/candidate/messages`, { waitUntil: 'networkidle0' })
    const polls = []
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/me/counters') || request.url().endsWith('/api/v1/conversations')) polls.push(Date.now())
    })

    // CDP: activating another target puts this one in the background (visibilityState "hidden").
    const other = await ctx.newPage(page.browserContext())
    await other.page.goto(`${ctx.webUrl}/candidate/help`, { waitUntil: 'networkidle0' })
    await other.page.bringToFront()
    await page.waitForFunction(() => document.visibilityState === 'hidden', { timeout: 5_000 })
    const hiddenAt = Date.now()
    await sleep(HIDDEN_WINDOW_MS)
    const whileHidden = polls.filter((at) => at > hiddenAt + 1_000).length
    ctx.check(whileHidden === 0, `no polling for ${HIDDEN_WINDOW_MS / 1000} s in the background (${whileHidden} requests)`)

    await page.bringToFront()
    await page.waitForFunction(() => document.visibilityState === 'visible', { timeout: 5_000 })
    const visibleAt = Date.now()
    await page.waitForResponse((response) => response.url().includes('/api/v1/me/counters'), { timeout: 20_000 })
    ctx.note(`first counters request ${Math.round((Date.now() - visibleAt) / 1000)} s after the tab came back`)
    await ctx.screenshot(page, '1-visible-again')
    ctx.assertClean(handle.issues, 'polling pause')
  },
}
