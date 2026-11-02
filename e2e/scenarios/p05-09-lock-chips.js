import { signInWithForm } from '../lib/flows.js'
import { freeCandidate } from '../lib/payments.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

/** Sidebar nav links that carry a plan chip, by href. */
const sidebarChips = (page) =>
  page.$$eval('#workspace-sidebar nav a', (links) => links.filter((link) => link.querySelector('[data-plan-chip]')).map((link) => link.getAttribute('href')))

/** Search results that carry a plan chip, by label (Ctrl K opens the search, M-194). */
async function searchChips(page) {
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyK')
  await page.keyboard.up('Control')
  await page.waitForSelector('#global-search-input')
  const labels = await page.$$eval('[role="dialog"] li button', (buttons) => buttons.filter((button) => button.querySelector('[data-plan-chip]')).map((button) => button.innerText))
  await page.keyboard.press('Escape')
  return labels
}

/** P5-09 (M-118): Free sees plan chips on AI insights and Job alerts in the sidebar and in search; Plus sees none. */
export default {
  name: 'P5-09 Lock chips',
  viewports: ['D', 'M'],
  async run(ctx) {
    const free = await freeCandidate('Chips', 'GB')
    const freeHandle = await ctx.newPage()
    await signInWithForm(freeHandle.page, ctx.webUrl, '/sign-in', free.email, TEST_PASSWORD)
    const freeSidebar = await sidebarChips(freeHandle.page)
    ctx.check(JSON.stringify(freeSidebar.sort()) === JSON.stringify(['/candidate/ai-insights', '/candidate/job-alerts']), `Free sidebar chips: ${freeSidebar}`)
    const freeSearch = await searchChips(freeHandle.page)
    ctx.check(freeSearch.length === 2 && freeSearch.some((label) => label.includes('AI insights')) && freeSearch.some((label) => label.includes('Job alerts')), `Free search chips: ${freeSearch}`)
    if (ctx.viewport === 'M') await freeHandle.page.click('button[aria-controls="workspace-sidebar"]')
    await freeHandle.checkOverflow()
    await ctx.screenshot(freeHandle.page, '1-free')
    ctx.assertClean(freeHandle.issues, 'Free')

    const emmaHandle = await ctx.newPage()
    await signInWithForm(emmaHandle.page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    ctx.check((await sidebarChips(emmaHandle.page)).length === 0, 'Plus: no chips in the sidebar')
    ctx.check((await searchChips(emmaHandle.page)).length === 0, 'Plus: no chips in search')
    if (ctx.viewport === 'M') await emmaHandle.page.click('button[aria-controls="workspace-sidebar"]')
    await ctx.screenshot(emmaHandle.page, '2-plus')
    ctx.assertClean(emmaHandle.issues, 'Plus')
  },
}
