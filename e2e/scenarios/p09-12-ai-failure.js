import { inCountry } from '../lib/matching.js'
import { openAs } from '../lib/payments.js'
import { login } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

/**
 * P9-12 (§2.9): the next OpenAI call fails (/_test/ai/fail-next). Job match shows its code evidence anyway, the AI
 * narrative shows a clear error with Try again, and Try again writes it.
 */
export default {
  name: 'P9-12 AI failure',
  viewports: ['D'],
  async run(ctx) {
    const email = ctx.seedCredentials.email('emma')
    const token = await login(email, 'candidate', ctx.seedCredentials.password)
    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(503, '/api/v1/candidate/insights/narrative')

    await inCountry(token, 'REMOTE', async () => {
      // A role whose narrative is not cached yet: the last of the role picker.
      const roles = (await api('/candidate/insights/roles', { token })).body.items
      const job = roles.at(-1)
      // The cache outlives a reseed, so the explanations are cleared: the page must really call OpenAI, which then fails.
      await db('aicaches', 'deleteMany', { filter: { kind: 'match_explanation', language: 'en' } })
      await api('/_test/ai/fail-next', { method: 'POST' })
      await openAs(ctx, handle, email, `/candidate/ai-insights/job-match?jobId=${job.id}`, ctx.seedCredentials.password)
      await page.waitForSelector('[data-narrative="job_match"] [data-ai-state="error"]', { visible: true, timeout: 30_000 })
      const message = await page.$eval('[data-narrative="job_match"] [data-ai-state="error"]', (element) => element.innerText)
      ctx.check(/didn't answer/.test(message) && /Try again/.test(message), `a clear error with Try again (${message.replace(/\s+/g, ' ')})`)
      const evidence = await page.$eval('main', (main) => main.innerText)
      ctx.check(evidence.includes('The evidence, side by side') && job.requiredSkills.every((skill) => evidence.includes(skill)), 'the code evidence still shows')
      await handle.checkOverflow()
      await ctx.screenshot(page, '1-failure')

      await page.click('[data-narrative="job_match"] [data-ai-state="error"] button')
      await page.waitForFunction(() => !document.querySelector('[data-narrative="job_match"] [data-ai-state]') && document.querySelector('[data-narrative="job_match"]').innerText.trim().length > 20, { timeout: 60_000 })
      await ctx.screenshot(page, '2-retried')
      ctx.assertClean(handle.issues, 'AI failure')
    })
  },
}
