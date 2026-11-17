// TEMPORARY (2026-11-17): Admin › AI & matching › Usage, the "uses left" hint, budget alerts and the pause, with the
// real OpenAI and Google Places. Deleted after the run.
import { signInWithForm } from '../lib/flows.js'
import { inCountry } from '../lib/matching.js'
import { openAs } from '../lib/payments.js'
import { login, ownerToken } from '../lib/recruiters.js'
import { api, db, resetTestState } from '../lib/testApi.js'

// The API caches the settings for 30 s; the reset clears that cache.
async function clearSettings() {
  await db('appconfigs', 'deleteMany', { filter: { key: { $in: ['aiUsage', 'aiUsageAlerts'] } } })
  await resetTestState()
}

export default {
  name: 'TMP AI usage',
  viewports: ['D', 'M'],
  async run(ctx) {
    await clearSettings()
    const email = ctx.seedCredentials.email('emma')
    const token = await login(email, 'candidate', ctx.seedCredentials.password)
    const admin = await ownerToken()
    const me = (await api('/me', { token })).body
    await db('aiusages', 'deleteMany', { filter: { userId: { $oid: me.id } } })

    // One real Google city search, so Places has a counted call.
    const search = await api(`/places/autocomplete?input=Berl&sessionToken=${crypto.randomUUID()}`, { token })
    ctx.check(search.status === 200 && search.body.items.length > 0, `a real city search (${search.status})`)

    await inCountry(token, 'REMOTE', async () => {
      const [job] = (await api('/jobs', { token })).body.items
      // A fresh summary: the cached one of an earlier run would not reach OpenAI.
      await db('aicaches', 'deleteMany', { filter: { kind: 'job_summary' } })

      const handle = await ctx.newPage()
      const { page } = handle
      await openAs(ctx, handle, email, '/candidate/jobs', ctx.seedCredentials.password)
      await page.waitForSelector(`[data-job="${job.id}"] [data-job-summary-button]`, { visible: true })
      await page.click(`[data-job="${job.id}"] [data-job-summary-button]`)
      await page.waitForSelector('[data-summary-overview]', { visible: true, timeout: 60_000 })
      await page.waitForFunction(() => /^39 of 40 AI uses left today$/.test(document.querySelector('[data-ai-uses-left]')?.textContent ?? ''), { timeout: 15_000 })
      ctx.check(true, 'the dialog shows 39 of 40 uses left after one summary (Plus monthly)')
      await ctx.screenshot(page, '1-summary-uses-left')
      await page.keyboard.press('Escape')
      await page.goto(`${ctx.webUrl}/candidate/ai-insights`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-ai-uses-left]', { visible: true })
      await ctx.screenshot(page, '2-insights-uses-left')
      // Billing: the plan lists its daily AI uses, and today's count sits under the plans.
      await page.goto(`${ctx.webUrl}/candidate/settings/billing`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-ai-usage-today]', { visible: true })
      const billing = await page.$eval('[data-ai-usage-today]', (element) => element.innerText)
      ctx.check(/1 of 40 used/.test(billing), `Billing shows today's AI uses (${billing.replace(/\n/g, ' | ')})`)
      const features = await page.$eval('[data-plan-features="plus"]', (element) => element.innerText)
      ctx.check(features.includes('40 AI uses a day (80 with yearly billing)'), 'the Plus card lists its daily AI uses')
      await page.evaluate(() => document.querySelector('[data-ai-usage-today]').scrollIntoView({ block: 'center' }))
      await ctx.screenshot(page, '2b-billing-ai-uses')
      await handle.checkOverflow()
      ctx.assertClean(handle.issues, 'candidate uses left')

      // The admin's Usage tab with the real tokens.
      const adminHandle = await ctx.newPage()
      const adminPage = adminHandle.page
      await signInWithForm(adminPage, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
      await adminPage.goto(`${ctx.webUrl}/admin/ai-matching/usage`, { waitUntil: 'networkidle0' })
      await adminPage.waitForSelector('[data-usage-provider="openai"]', { visible: true })
      const overview = (await api('/admin/ai/usage', { token: admin })).body
      const summaryRow = overview.breakdown.find((row) => row.kind === 'job_summary')
      ctx.check(summaryRow?.inputTokens > 0 && summaryRow.outputTokens > 0, `real tokens counted (${summaryRow?.inputTokens} in / ${summaryRow?.outputTokens} out, ${summaryRow?.model})`)
      ctx.check(overview.providers.places.calls >= 1, `Places calls counted (${overview.providers.places.calls})`)
      ctx.check(overview.topUsers.some((row) => row.id === me.id && row.today.limit === 40), 'Emma in the top users with her 40/day limit')
      ctx.check(Boolean(await adminPage.$(`[data-usage-user="${me.id}"]`)), 'Emma in the top users table')
      await ctx.screenshot(adminPage, '3-usage-unpriced')

      // Prices typed into the form and saved: the spend becomes non-zero.
      const fast = summaryRow.model
      const type = async (selector, value) => {
        await adminPage.click(selector, { clickCount: 3 })
        await adminPage.type(selector, value)
      }
      const [input, output] = await adminPage.$$(`[data-price-model="${fast}"] input`)
      await input.click({ clickCount: 3 })
      await input.type('0.75')
      await output.click({ clickCount: 3 })
      await output.type('4.5')
      await type('[data-price-sku="autocomplete"]', '2.83')
      await adminPage.click('[data-usage-settings] button[type="submit"]')
      await adminPage.waitForFunction(() => document.querySelector('[data-usage-settings]')?.textContent.includes('Usage settings saved.'), { timeout: 15_000 })
      await adminPage.waitForFunction(() => document.querySelector('[data-usage-provider="openai"] [data-usage-spend]')?.textContent !== '$0.00', { timeout: 15_000 })
      const spend = await adminPage.$eval('[data-usage-provider="openai"] [data-usage-spend]', (element) => element.textContent)
      ctx.check(/^\$0\.0\d+|^\$\d/.test(spend), `OpenAI spend shown after pricing (${spend})`)
      await ctx.screenshot(adminPage, '4-usage-priced')
      await adminHandle.checkOverflow()

      // A budget below this month's spend: alert + pause at once.
      await type('[data-budget="openai"]', '0.0001')
      await type('[data-budget="places"]', '0.0001')
      await adminPage.click('[data-usage-settings] button[type="submit"]')
      await adminPage.waitForSelector('[data-usage-provider="openai"] [data-usage-status="paused"]', { visible: true, timeout: 15_000 })
      ctx.check(Boolean(await adminPage.$('[data-usage-provider="places"] [data-usage-status="paused"]')), 'Places paused too')
      const bell = (await api('/notifications', { token: admin })).body.items.filter((item) => item.type === 'admin_ai_budget')
      ctx.check(bell.length >= 2, `budget alerts in the bell (${bell.length})`)
      await ctx.screenshot(adminPage, '5-usage-paused')
      await adminPage.goto(`${ctx.webUrl}/admin/notifications`, { waitUntil: 'networkidle0' })
      await ctx.screenshot(adminPage, '6-admin-notifications')
      ctx.assertClean(adminHandle.issues, 'admin usage')

      // The candidate: an uncached text says AI is paused; the public job search hides "Use my location".
      const jobs = (await api('/jobs', { token })).body.items
      const other = jobs.find((item) => item.id !== job.id)
      await page.goto(`${ctx.webUrl}/candidate/jobs`, { waitUntil: 'networkidle0' })
      handle.allow(503, '/api/v1/')
      await page.waitForSelector(`[data-job="${other.id}"] [data-job-summary-button]`, { visible: true })
      await page.click(`[data-job="${other.id}"] [data-job-summary-button]`)
      await page.waitForSelector('[data-ai-state="paused"]', { visible: true, timeout: 30_000 })
      ctx.check(true, 'the paused message instead of a broken button')
      await ctx.screenshot(page, '7-candidate-paused')
      await page.keyboard.press('Escape')

      const config = (await api('/meta/config')).body
      ctx.check(config.placesManual === true, 'city lookups manual while the Places budget is used up')
      const visitor = await ctx.newPage()
      await visitor.page.goto(`${ctx.webUrl}/jobs`, { waitUntil: 'networkidle0' })
      const [, where] = await visitor.page.$$('input[role="combobox"]')
      await where.click()
      await new Promise((resolve) => setTimeout(resolve, 400))
      const offered = await visitor.page.evaluate(() => document.body.innerText.includes('Use my current location'))
      ctx.check(!offered, '"Use my current location" is hidden')
      await ctx.screenshot(visitor.page, '8-jobs-no-locate')
    })

    // The recruiter's company page: the city field explains the typed "City, Country".
    const recruiter = await ctx.newPage()
    await signInWithForm(recruiter.page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    await recruiter.page.goto(`${ctx.webUrl}/recruiter/company`, { waitUntil: 'networkidle0' })
    const hint = await recruiter.page.evaluate(() => document.body.innerText.includes('Type the city and its country'))
    ctx.check(hint, 'the city field shows the manual-entry hint')
    await ctx.screenshot(recruiter.page, '9-company-manual-city')

    await clearSettings()
    ctx.check((await api('/meta/config')).body.placesManual === false, 'settings cleared again')
  },
}
