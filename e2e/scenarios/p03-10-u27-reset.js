import { clickText, signInWithForm, waitForText } from '../lib/flows.js'
import { db } from '../lib/testApi.js'

/**
 * P3-10 (U27): editing the education entry linked to Emma's approved academic check resets the check, and the
 * profile is incomplete again. The seeded entry is restored afterwards.
 */
export default {
  name: 'P3-10 U27 reset',
  viewports: ['D'],
  async run(ctx) {
    const email = ctx.seedCredentials.email('emma')
    const [user] = await db('users', 'find', { filter: { email } })
    const [before] = await db('candidateprofiles', 'find', { filter: { userId: user._id } })
    const handle = await ctx.newPage()
    const { page } = handle
    try {
      await signInWithForm(page, ctx.webUrl, '/sign-in', email, ctx.seedCredentials.password)
      await page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })
      ctx.check(await page.$eval('[data-item="check_academic"]', (item) => item.dataset.done === 'true'), 'the academic check is approved at first')

      await page.click('[data-section="education"] button[aria-label^="Edit "]')
      await page.waitForSelector('input[name="degree"]')
      await page.type('input[name="degree"]', ' (Hons)')
      await clickText(page, 'Save', '[role="dialog"] button')
      await waitForText(page, 'Profile saved.')
      await page.waitForFunction(() => document.querySelector('[data-item="check_academic"]').dataset.done === 'false')
      await waitForText(page, '11 of 12 complete')
      await ctx.screenshot(page, '1-reset')
      ctx.assertClean(handle.issues, 'U27 reset')
    } finally {
      // Other scenarios read Emma's seeded profile.
      await db('candidateprofiles', 'updateMany', { filter: { userId: user._id }, update: { $set: { education: before.education, completeness: before.completeness } } })
      await db('verificationsubmissions', 'updateMany', { filter: { userId: user._id, category: 'academic' }, update: { $unset: { resetAt: '' } } })
    }
  },
}
