import { clickText, signInWithForm, waitForText } from '../lib/flows.js'
import { inCountry, sarah } from '../lib/matching.js'
import { openAs } from '../lib/payments.js'
import { login } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

const aiStatus = async () => (await db('appconfigs', 'find', { filter: { key: 'ai' } }))[0]?.value ?? {}
const usageOf = async (userId) => (await db('aiusages', 'find', { filter: { userId: { $oid: userId } } }))[0]?.count ?? 0
const overviewText = (page) => page.$eval('[data-summary-overview]', (element) => element.textContent)

/**
 * P9-08 (M-058, M-059, P9-Q5): the AI job summary on a Plus candidate's card, on a recruiter's job row and on the admin
 * Jobs page. The second open is a cache hit: no OpenAI call and the cap unchanged. A Free candidate's button opens the
 * upgrade dialog without any request. The admin regenerates a real job's summary and sees the text change.
 */
export default {
  name: 'P9-08 Job summaries',
  viewports: ['D'],
  async run(ctx) {
    const emmaEmail = ctx.seedCredentials.email('emma')
    const emmaToken = await login(emmaEmail, 'candidate', ctx.seedCredentials.password)
    const emma = (await api('/me', { token: emmaToken })).body
    const handle = await ctx.newPage()
    const { page } = handle

    await inCountry(emmaToken, 'REMOTE', async () => {
      await openAs(ctx, handle, emmaEmail, '/candidate/jobs', ctx.seedCredentials.password)
      await page.waitForSelector('[data-job] [data-job-summary-button]', { visible: true })
      await page.click('[data-job] [data-job-summary-button]')
      await page.waitForSelector('[data-summary-overview]', { visible: true, timeout: 60_000 })
      const first = await overviewText(page)
      ctx.check(first.length > 20, `the summary is written (${first.slice(0, 80)}…)`)
      await ctx.screenshot(page, '1-candidate-summary')
      await clickText(page, 'Close', '[role="dialog"] button')

      // Reopening: a cache hit, so no OpenAI call (the last-success time stays) and the cap does not move.
      const [before, used] = [await aiStatus(), await usageOf(emma.id)]
      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-job] [data-job-summary-button]', { visible: true })
      await page.click('[data-job] [data-job-summary-button]')
      await page.waitForSelector('[data-summary-overview]', { visible: true })
      ctx.check((await overviewText(page)) === first, 'the same text from the cache')
      ctx.check(JSON.stringify(await aiStatus()) === JSON.stringify(before), 'no OpenAI call on the second open')
      ctx.check((await usageOf(emma.id)) === used, `the cap is unchanged (${used})`)
      ctx.assertClean(handle.issues, 'candidate summaries')
    })

    // Free: the button carries a lock and opens the upgrade dialog; nothing is requested.
    const alex = await ctx.newPage()
    const requests = []
    alex.page.on('request', (request) => request.url().includes('/ai-summary') && requests.push(request.url()))
    await openAs(ctx, alex, ctx.seedCredentials.email('alex'), '/candidate/jobs', ctx.seedCredentials.password)
    await alex.page.waitForSelector('[data-job] [data-ai-locked]', { visible: true })
    await alex.page.click('[data-job] [data-ai-locked]')
    await waitForText(alex.page, 'Plus')
    await alex.page.waitForSelector('[role="dialog"]', { visible: true })
    ctx.check(requests.length === 0, 'a Free candidate sends no AI request')
    await ctx.screenshot(alex.page, '2-free-upgrade')
    ctx.assertClean(alex.issues, 'Free card')

    // Recruiter: the summary on her own job row (free for approved recruiters, M-117).
    const { job } = await sarah(ctx)
    const recruiter = await ctx.newPage()
    await signInWithForm(recruiter.page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    await recruiter.page.goto(`${ctx.webUrl}/recruiter/jobs`, { waitUntil: 'networkidle0' })
    await recruiter.page.click(`[data-recruiter-job="${job.id}"] [data-job-summary-button]`)
    await recruiter.page.waitForSelector('[data-summary-overview]', { visible: true, timeout: 60_000 })
    await ctx.screenshot(recruiter.page, '3-recruiter-row')
    ctx.assertClean(recruiter.issues, 'recruiter summary')

    // Admin: a real job from GET /admin/jobs; Regenerate writes a new text (P9-Q5).
    const admin = await ctx.newPage()
    await signInWithForm(admin.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await admin.page.goto(`${ctx.webUrl}/admin/jobs`, { waitUntil: 'networkidle0' })
    await admin.page.click(`[data-admin-job="${job.id}"] a`)
    await admin.page.waitForSelector('[data-summary-overview]', { visible: true, timeout: 60_000 })
    const original = await overviewText(admin.page)
    await admin.page.click('[data-regenerate]')
    await admin.page.waitForFunction((previous) => {
      const text = document.querySelector('[data-summary-overview]')?.textContent
      return text && text !== previous
    }, { timeout: 60_000 }, original)
    ctx.note(`Regenerated: "${original.slice(0, 60)}…" → "${(await overviewText(admin.page)).slice(0, 60)}…"`)
    const owner = (await db('users', 'find', { filter: { isOwner: true } }))[0]
    ctx.check((await usageOf(owner._id.$oid)) === 0, 'an admin is not counted')
    await ctx.screenshot(admin.page, '4-admin-regenerated')
    ctx.assertClean(admin.issues, 'admin summary')
  },
}
