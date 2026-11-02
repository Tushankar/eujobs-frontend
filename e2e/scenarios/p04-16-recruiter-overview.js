import { signInWithForm } from '../lib/flows.js'
import { db } from '../lib/testApi.js'

/**
 * P4-16 (§3.15, M-201, M-202): Open positions and Shortlisted equal the database; the talent cards have no Compare
 * checkbox; the greeting uses the browser's time of day and Sarah's first name.
 */
export default {
  name: 'P4-16 Recruiter Overview',
  viewports: ['D', 'M'],
  async run(ctx) {
    const [acme] = await db('companies', 'find', { filter: { displayName: 'Acme Studio' } })
    const open = await db('jobs', 'count', { filter: { companyId: acme._id, status: 'published' } })
    const shortlisted = await db('shortlistentries', 'count', { filter: { companyId: acme._id } })
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    await page.waitForSelector('[data-stat="shortlisted"]')
    await page.waitForFunction((count) => document.querySelector('[data-stat="openPositions"]').innerText.includes(String(count)), {}, open)
    await page.waitForFunction((count) => document.querySelector('[data-stat="shortlisted"]').innerText.includes(String(count)), {}, shortlisted)
    ctx.check(!(await page.$('article[data-candidate] input[type="checkbox"]')), 'no Compare checkbox on the talent cards')
    const greeting = await page.evaluate(() => {
      const hour = new Date().getHours()
      const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
      return { expected: `Good ${part}, Sarah`.toUpperCase(), shown: document.body.innerText.toUpperCase() }
    })
    ctx.check(greeting.shown.includes(greeting.expected), `the greeting "${greeting.expected}"`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-overview')
    ctx.assertClean(handle.issues, 'overview')
  },
}
