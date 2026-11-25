import { clickText, signInWithForm, waitForText } from '../lib/flows.js'
import { approvedRecruiter } from '../lib/recruiters.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

// Temporary: screenshots of the Find candidates filter panel (2026-11-25). Delete after use.
export default {
  name: 'ZZ filter panel screenshots',
  viewports: ['D', 'M'],
  async run(ctx) {
    const recruiter = await approvedRecruiter('FilterUi', { city: 'berlin' })
    const handle = await ctx.newPage()
    const { page } = handle
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/recruiter/find-candidates`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'candidates')
    await clickText(page, 'Filters', 'button')
    await page.waitForSelector('#candidate-filters')
    await ctx.screenshot(page, '1-dark-empty')
    await page.select('select[name="language"]', 'de')
    await page.select('select[name="languageLevel"]', 'b2')
    await page.click('label:has(input[name="verified"])')
    await waitForText(page, 'Clear filters')
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-dark-applied')
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
    await ctx.screenshot(page, '3-light-applied')
    await clickText(page, 'Clear filters', 'button')
    ctx.check(!(await page.$eval('#candidate-filters', (node) => node.textContent.includes('Clear filters'))), 'Clear filters hides once nothing is applied')
  },
}
