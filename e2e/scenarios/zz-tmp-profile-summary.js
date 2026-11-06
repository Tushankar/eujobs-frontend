import { onboardedCandidate } from '../lib/candidates.js'
import { signInWithForm, waitForText } from '../lib/flows.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

async function showCard(page) {
  const card = await page.waitForSelector('[data-profile-summary-button]', { visible: true, timeout: 15_000 })
  await card.evaluate((element) => element.closest('section').scrollIntoView({ block: 'center' }))
  await new Promise((resolve) => setTimeout(resolve, 400))
  return card
}

/** The AI job summary card in My profile's side column: Free sees the crown and a locked button, Plus the action. */
export default {
  name: 'ZZ Profile summary card',
  viewports: ['D', 'M'],
  async run(ctx) {
    const free = await onboardedCandidate(`Summary${ctx.viewport}`)
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', free.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })
    if (ctx.viewport === 'D') {
      // The owner's window (~1366×620): the folded checklist and the summary button both fit without scrolling.
      const size = page.viewport()
      await page.setViewport({ width: 1366, height: 620 })
      await page.waitForSelector('[data-profile-summary-button]', { visible: true })
      await new Promise((resolve) => setTimeout(resolve, 500))
      // Scrolled into the profile (as in the owner's screenshot) the side column is pinned under the header.
      const pageTop = await page.$eval('main aside', (aside) => ({ top: aside.getBoundingClientRect().top, bottom: document.querySelector('[data-profile-summary-button]').getBoundingClientRect().bottom }))
      ctx.note?.(`unscrolled: aside top ${Math.round(pageTop.top)}px, button bottom ${Math.round(pageTop.bottom)}px`)
      console.log(`unscrolled: aside top ${Math.round(pageTop.top)}px, button bottom ${Math.round(pageTop.bottom)}px`)
      await page.evaluate((by) => window.scrollTo(0, by), Math.max(0, pageTop.top - 96))
      await new Promise((resolve) => setTimeout(resolve, 400))
      const fit = await page.evaluate(() => ({
        checklistTop: document.querySelector('[data-item]').closest('section, div[class]').closest('aside').getBoundingClientRect().top,
        bottom: document.querySelector('[data-profile-summary-button]').getBoundingClientRect().bottom,
      }))
      ctx.check(fit.checklistTop >= 72 && fit.bottom <= 620, `checklist and summary button both on screen (aside top ${Math.round(fit.checklistTop)}px, button bottom ${Math.round(fit.bottom)}px)`)
      ctx.check((await page.$$eval('[data-item]:not([hidden])', (rows) => rows.length)) === 3, 'the checklist shows 3 rows folded')
      await ctx.screenshot(page, '0-fits-1366x620')
      await page.click('button[aria-expanded="false"]:is([aria-controls="profile-summary-points"])')
      await ctx.screenshot(page, '0b-what-it-does')
      await page.setViewport(size)
    }
    const button = await showCard(page)
    ctx.check(await button.evaluate((element) => element.hasAttribute('data-plan-locked')), 'Free: the button is locked')
    ctx.check(Boolean(await page.$('main aside [data-plan-chip]')), 'Free: the card shows the Plus crown')
    ctx.check(!(await page.$('main h1 ~ * [data-profile-summary-button], header [data-profile-summary-button]')), 'the header no longer has the pill')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-free-card')
    await button.click()
    await waitForText(page, 'Plus')
    await page.waitForSelector('[role="dialog"]', { visible: true })
    await ctx.screenshot(page, '2-free-upgrade')
    ctx.assertClean(handle.issues, 'free')

    const plus = await ctx.newPage()
    await signInWithForm(plus.page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await plus.page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })
    const plusButton = await showCard(plus.page)
    ctx.check(!(await plusButton.evaluate((element) => element.hasAttribute('data-plan-locked'))), 'Plus: the button is the action')
    await ctx.screenshot(plus.page, '3-plus-card')
    ctx.assertClean(plus.issues, 'plus')
  },
}
