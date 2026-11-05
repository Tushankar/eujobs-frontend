// TEMPORARY: screenshots of the redesigned checkout return page (confirming + failure). Deleted after the run.
import { continueToStripe, freeCandidate, openAs, openUpgrade, payOnCheckout } from '../lib/payments.js'

export default {
  name: 'TMP return page UI',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { email } = await freeCandidate('ReturnUi', 'DE')
    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, email, '/candidate/checkout/return')
    await page.waitForSelector('[role="alert"]')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-missing-reference')

    await page.goto(`${ctx.webUrl}/candidate/ai-insights`, { waitUntil: 'networkidle0' })
    await openUpgrade(page, 'Upgrade to Plus')
    await continueToStripe(page, '€')
    await payOnCheckout(page)
    const summary = await page
      .waitForSelector('aside dl', { timeout: 10_000 })
      .then(() => page.$eval('aside', (element) => element.innerText.replace(/\s+/g, ' ')))
      .catch(() => 'left before the summary loaded')
    ctx.note(`summary: ${summary}`)
    const states = []
    for (let index = 0; index < 6 && page.url().includes('/checkout/return'); index += 1) {
      states.push(await page.evaluate(() => [...document.querySelectorAll('li')].map((li) => `${li.className.match(/(done|active|waiting)/)?.[1]}`).join(',')))
      await handle.checkOverflow()
      await ctx.screenshot(page, `2-confirming-${index}`)
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
    ctx.note(`step states seen: ${states.join(' | ') || 'left before the first shot'}`)
    await page.waitForFunction(() => location.pathname === '/candidate/ai-insights', { timeout: 90_000 })
    ctx.note(`ended on ${new URL(page.url()).pathname}`)
    ctx.assertClean(handle.issues, 'return page')
  },
}
