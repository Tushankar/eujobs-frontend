import { signInWithForm } from '../lib/flows.js'
import { inCountry } from '../lib/matching.js'
import { openAs } from '../lib/payments.js'
import { login } from '../lib/recruiters.js'
import { api, date, db } from '../lib/testApi.js'

/**
 * P9-11 (OD13, U3): with 50 generations used today, Emma's next uncached AI text shows the on-screen limit message
 * (with the reset time) instead of a broken button; a text already in the cache still renders; admins are exempt.
 */
export default {
  name: 'P9-11 Cap',
  viewports: ['D'],
  async run(ctx) {
    const email = ctx.seedCredentials.email('emma')
    const token = await login(email, 'candidate', ctx.seedCredentials.password)
    const me = (await api('/me', { token })).body
    const day = new Date().toISOString().slice(0, 10)
    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(429, '/api/v1/')

    await inCountry(token, 'REMOTE', async () => {
      const [cachedJob, freshJob] = (await api('/jobs', { token })).body.items
      // One summary in the cache first, then the cap is set to 50 for today.
      await api(`/jobs/${cachedJob.id}/ai-summary`, { method: 'POST', token })
      await db('aiusages', 'deleteMany', { filter: { userId: { $oid: me.id } } })
      await db('aiusages', 'insertOne', { doc: { userId: { $oid: me.id }, day, count: 50, createdAt: date(Date.now()), updatedAt: date(Date.now()) } })

      await openAs(ctx, handle, email, '/candidate/jobs', ctx.seedCredentials.password)
      await page.waitForSelector(`[data-job="${freshJob.id}"] [data-job-summary-button]`, { visible: true })
      await page.click(`[data-job="${freshJob.id}"] [data-job-summary-button]`)
      await page.waitForSelector('[data-ai-state="limit"]', { visible: true, timeout: 30_000 })
      const message = await page.$eval('[data-ai-state="limit"]', (element) => element.textContent)
      ctx.check(/50 AI generations/.test(message), `the limit message: ${message}`)
      await ctx.screenshot(page, '1-limit')
      await page.keyboard.press('Escape')

      await page.click(`[data-job="${cachedJob.id}"] [data-job-summary-button]`)
      await page.waitForSelector('[data-summary-overview]', { visible: true })
      ctx.check((await db('aiusages', 'find', { filter: { userId: { $oid: me.id } } }))[0].count === 50, 'a cache hit is not counted and still renders')
      await ctx.screenshot(page, '2-cache-hit')
      ctx.assertClean(handle.issues, 'cap')
    })

    // Admins are exempt (OD13): a regenerate goes through whatever their usage.
    const owner = (await db('users', 'find', { filter: { isOwner: true } }))[0]
    await db('aiusages', 'insertOne', { doc: { userId: owner._id, day, count: 50, createdAt: date(Date.now()), updatedAt: date(Date.now()) } })
    const admin = await ctx.newPage()
    await signInWithForm(admin.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    const [job] = (await api('/jobs', { token })).body.items
    await admin.page.goto(`${ctx.webUrl}/admin/jobs/${job.id}/ai-summary`, { waitUntil: 'networkidle0' })
    await admin.page.waitForSelector('[data-summary-overview]', { visible: true, timeout: 60_000 })
    await ctx.screenshot(admin.page, '3-admin-exempt')
    ctx.assertClean(admin.issues, 'admin exempt')
    await db('aiusages', 'deleteMany', { filter: { userId: { $in: [{ $oid: me.id }, owner._id] } } })
  },
}
