import { clickText, fill, signInWithForm } from '../lib/flows.js'
import { freeCandidate, openAs } from '../lib/payments.js'
import { approvedRecruiter } from '../lib/recruiters.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

// Temporary: screenshots of the redesigned job wizard and plan gate. Deleted after the check.
const pause = () => new Promise((resolve) => setTimeout(resolve, 300))
/** The top of each wizard column relative to the viewport, after scrolling the window by `by`. */
const columnTops = (page, by) =>
  page.evaluate((y) => {
    window.scrollTo(0, y)
    return [...document.querySelector('form').parentElement.children].map((element) => Math.round(element.getBoundingClientRect().top))
  }, by)

export default {
  name: 'TMP wizard look',
  viewports: ['D'],
  async run(ctx) {
    const recruiter = await approvedRecruiter('Look', { plus: false })
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)

    // The plan gate of a Free recruiter.
    await page.goto(`${ctx.webUrl}/recruiter/shortlists`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-plan-gate="discovery"]')
    const gate = await page.$eval('[data-plan-gate]', (element) => element.innerText)
    ctx.check(gate.includes('Free') && gate.includes('£0') && gate.includes('£49') && gate.includes('Upgrade to Recruiter Plus'), `the gate lists Free and Recruiter Plus (${gate.slice(0, 120)})`)
    const crossed = await page.$$eval('[data-plan="recruiter_free"] [data-missing]', (items) => items.length)
    ctx.check(crossed === 4, `the Free card crosses out the 4 Recruiter Plus features (got ${crossed})`)
    await ctx.screenshot(page, '0-gate-1440')
    await page.setViewport({ width: 1138, height: 560 })
    await pause()
    await ctx.screenshot(page, '0-gate-1138')
    await page.setViewport({ width: 375, height: 812 })
    await pause()
    await handle.checkOverflow()
    await ctx.screenshot(page, '0-gate-375')

    // The wizard in a short window (the owner's ~1138×560): a short step pins the form, the step list scrolls.
    await page.setViewport({ width: 1138, height: 560 })
    await page.goto(`${ctx.webUrl}/recruiter/jobs/new`, { waitUntil: 'networkidle0' })
    await fill(page, 'input[name="title"]', 'Senior Product Designer')
    const before = await columnTops(page, 0)
    const after = await columnTops(page, 400)
    await pause()
    ctx.check(after[1] >= 72, `the form stays pinned under the header (column tops ${before} → ${after})`)
    await ctx.screenshot(page, '1-step1-scrolled-1138')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.setViewport({ width: 1440, height: 900 })
    await clickText(page, 'Continue', 'button[type="submit"]')
    await page.waitForFunction(() => document.querySelector('form h2')?.textContent === 'Responsibilities', { timeout: 15000 })
    await fill(page, 'textarea[name="brief"]', 'Lead the design of our hiring tools, from research to shipped product, with a small and kind team in Warsaw.')
    await clickText(page, 'Continue', 'button[type="submit"]')
    await page.waitForFunction(() => document.querySelector('form h2')?.textContent === 'Required skills')
    for (const skill of ['Figma', 'Design Systems', 'Prototyping']) {
      await fill(page, 'input[placeholder="Type a skill and press Enter"]', skill)
      await page.keyboard.press('Enter')
    }
    await clickText(page, 'Continue', 'button[type="submit"]')
    await page.waitForFunction(() => document.querySelector('form h2')?.textContent === 'Preferred skills')
    await clickText(page, 'Continue', 'button[type="submit"]')
    await page.waitForFunction(() => document.querySelector('form h2')?.textContent === 'Experience & languages')
    await page.select('select[name="level"]', 'senior')
    await ctx.screenshot(page, '2-step5-1440')
    ctx.assertClean(handle.issues, 'wizard look')

    // The plan gate of a Free candidate.
    const candidate = await freeCandidate('LookCandidate', 'GB')
    const second = await ctx.newPage()
    await openAs(ctx, second, candidate.email, '/candidate/ai-insights')
    await second.page.waitForSelector('[data-plan-gate="ai"]')
    await ctx.screenshot(second.page, '3-candidate-gate-1440')
    ctx.assertClean(second.issues, 'candidate gate')
  },
}
