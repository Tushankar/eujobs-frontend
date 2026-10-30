import { fixture } from '../fixtures/make.js'
import { chooseFile, signInWithForm, waitForText } from '../lib/flows.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P3-04 (M-013, M-185): a 4 MB PNG becomes the photo in the sidebar, header and profile; 6 MB, a GIF and an
 * .exe renamed .jpg are refused with translated messages.
 */
export default {
  name: 'P3-04 Photo',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { email } = await onboardedCandidate('Photo')
    const handle = await ctx.newPage()
    handle.allow(422, '/api/v1/candidate/profile/photo')
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })

    await chooseFile(page, 'input[name="photo"]', fixture('photo-4mb.png'))
    await waitForText(page, 'Profile saved.')
    await page.waitForFunction(() => document.querySelectorAll('img[src*="/api/v1/files/"]').length >= 2, { timeout: 20_000 })
    const places = await page.evaluate(() => ({
      profile: Boolean(document.querySelector('main img[src*="/api/v1/files/"]')),
      sidebar: Boolean(document.querySelector('aside img[src*="/api/v1/files/"]')),
      header: Boolean(document.querySelector('header img[src*="/api/v1/files/"]')),
    }))
    ctx.check(places.profile && places.header, `the photo shows on the profile and in the header (${JSON.stringify(places)})`)
    if (ctx.viewport === 'D') ctx.check(places.sidebar, 'the photo shows in the sidebar')
    await ctx.screenshot(page, '1-photo')

    await chooseFile(page, 'input[name="photo"]', fixture('photo-6mb.png'))
    await waitForText(page, 'photo-6mb.png is larger than 5 MB.')
    await chooseFile(page, 'input[name="photo"]', fixture('photo.gif'))
    await waitForText(page, 'photo.gif is not a')
    await chooseFile(page, 'input[name="photo"]', fixture('program.jpg'))
    await waitForText(page, "This file type isn't accepted.")
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-refused')
    ctx.assertClean(handle.issues, 'photo')
  },
}
