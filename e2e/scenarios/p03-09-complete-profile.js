import { signInWithForm } from '../lib/flows.js'

/** P3-09 (§3.2, M-015): Emma's seeded profile is complete: "Complete" on My profile and 100% on the Overview card. */
export default {
  name: 'P3-09 Complete profile',
  viewports: ['D'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })
    const items = await page.$$eval('[data-item]', (rows) => rows.map((row) => [row.dataset.item, row.dataset.done]))
    ctx.check(items.length === 12 && items.every(([, done]) => done === 'true'), `all 12 items are done: ${JSON.stringify(items)}`)
    ctx.check(await page.evaluate(() => document.body.innerText.includes('Complete')), 'the checklist says Complete')
    await ctx.screenshot(page, '1-profile')

    await page.goto(`${ctx.webUrl}/candidate`, { waitUntil: 'networkidle0' })
    const strength = await page.$eval('[data-card="profile-strength"]', (card) => card.innerText)
    ctx.check(strength.includes('100%'), `the Overview card shows 100% (${strength.replace(/\s+/g, ' ')})`)
    const verification = await page.$eval('[data-card="verification"]', (card) => card.innerText)
    ctx.check(verification.includes('3 of 3') && verification.includes('Verified'), 'the verification card shows 3 of 3 and Verified')
    await ctx.screenshot(page, '2-overview')
    ctx.assertClean(handle.issues, 'complete profile')
  },
}
