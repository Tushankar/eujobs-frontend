import { signInWithForm } from '../lib/flows.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

const states = (page) => page.$$eval('[role="switch"]', (switches) => switches.map((element) => element.getAttribute('aria-checked')))

/** P3-12 (M-187): the three privacy flags are saved on the server and kept after a reload. */
export default {
  name: 'P3-12 Privacy',
  viewports: ['D'],
  async run(ctx) {
    const { email } = await onboardedCandidate('Privacy')
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/settings/privacy`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[role="switch"]')
    ctx.check(JSON.stringify(await states(page)) === JSON.stringify(['true', 'false', 'true']), 'defaults: discoverable, CV hidden, matching on')

    for (const element of await page.$$('[role="switch"]')) {
      const saved = page.waitForResponse((response) => response.url().endsWith('/candidate/settings/privacy') && response.request().method() === 'PATCH')
      await element.click()
      await saved
    }
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('[role="switch"]')
    ctx.check(JSON.stringify(await states(page)) === JSON.stringify(['false', 'true', 'false']), 'all three changes are kept after a reload')
    await ctx.screenshot(page, '1-privacy')
    ctx.assertClean(handle.issues, 'privacy')
  },
}
