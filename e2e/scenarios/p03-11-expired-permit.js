import { clickText, setValue, signInWithForm, waitForText } from '../lib/flows.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

/** P3-11 (U27): a UK visa or permit with a past expiry date shows "Permit expired"; the item still counts. */
export default {
  name: 'P3-11 Expired permit',
  viewports: ['D'],
  async run(ctx) {
    const { email } = await onboardedCandidate('Permit')
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })

    await clickText(page, 'Edit right to work', 'button')
    await clickText(page, 'Add UK', '[role="dialog"] button')
    await page.select('select[name="status-uk"]', 'visa_permit')
    await setValue(page, 'input[name="expires-uk"]', '2024-01-31')
    await clickText(page, 'Save', '[role="dialog"] button')
    await waitForText(page, 'Permit expired')
    ctx.check(await page.$eval('[data-item="right_to_work"]', (item) => item.dataset.done === 'true'), 'right to work still counts')
    await ctx.screenshot(page, '1-expired')
    ctx.assertClean(handle.issues, 'expired permit')
  },
}
