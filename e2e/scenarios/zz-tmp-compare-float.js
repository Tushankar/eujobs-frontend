// TEMPORARY check of the floating compare bar and the "no more than 3" message; deleted after the run.
import { signInWithForm, waitForText } from '../lib/flows.js'
import { approvedRecruiter } from '../lib/recruiters.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

export default {
  name: 'TMP compare float',
  viewports: ['D', 'M'],
  async run(ctx) {
    const recruiter = await approvedRecruiter('CompareFloat', { city: 'berlin' })
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/recruiter/find-candidates`, { waitUntil: 'networkidle0' })
    await waitForText(page, '5 candidates')

    const boxes = await page.$$('input[aria-label^="Compare "]')
    ctx.check(boxes.length === 5, `five compare checkboxes (got ${boxes.length})`)
    const tick = (index) => page.$$eval('input[aria-label^="Compare "]', (inputs, i) => inputs[i].closest('label').click(), index)
    for (const index of [0, 1, 2]) await tick(index)
    await waitForText(page, '3 selected')

    // A fourth pick is refused with a message; the box stays unticked.
    await tick(3)
    await page.waitForSelector('[data-compare-limit]', { timeout: 5000 }).catch(() => null)
    const limit = await page.$eval('[data-compare-bar]', (bar) => bar.innerText)
    ctx.check(limit.includes('You can’t compare more than 3 candidates'), `the limit message shows (got "${limit}")`)
    ctx.check(!(await page.$$eval('input[aria-label^="Compare "]', (inputs) => inputs[3].checked)), 'the fourth box stays unticked')

    // Floating: at the top of the page the bar sits on the bottom edge of the screen, over the cards.
    await page.evaluate(() => window.scrollTo(0, 0))
    await new Promise((resolve) => setTimeout(resolve, 300))
    const placed = await page.$eval('[data-compare-bar]', (bar) => {
      const box = bar.getBoundingClientRect()
      return { top: Math.round(box.top), bottom: Math.round(box.bottom), height: window.innerHeight, left: Math.round(box.left), right: Math.round(box.right), width: window.innerWidth }
    })
    ctx.check(placed.bottom <= placed.height && placed.bottom >= placed.height - 40, `the bar floats on the bottom edge (${JSON.stringify(placed)})`)
    ctx.check(placed.left >= 0 && placed.right <= placed.width, 'the bar fits the screen width')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-limit-floating')

    // Halfway down it still floats.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 3))
    await new Promise((resolve) => setTimeout(resolve, 300))
    const middle = await page.$eval('[data-compare-bar]', (bar) => Math.round(bar.getBoundingClientRect().bottom))
    ctx.check(middle <= placed.height && middle >= placed.height - 40, `still floating while scrolling (bottom ${middle})`)
    await ctx.screenshot(page, '2-scrolled')

    // Removing one clears the message.
    await tick(0)
    await waitForText(page, '2 selected')
    ctx.check(!(await page.$('[data-compare-limit]')), 'the message clears when the selection changes')
  },
}
