// TEMPORARY check of the AI insights "no roles" empty state; deleted after the run.
import { onboardedCandidate } from '../lib/candidates.js'
import { openAs, subscribeThroughApi, waitForPlan } from '../lib/payments.js'
import { api } from '../lib/testApi.js'

export default {
  name: 'TMP empty roles',
  viewports: ['D', 'M'],
  async run(ctx) {
    const candidate = await onboardedCandidate('EmptyRoles')
    const me = (await api('/me', { token: candidate.token })).body
    await subscribeThroughApi({ ...me, email: candidate.email })
    await waitForPlan(candidate.token, 'plus')
    const handle = await ctx.newPage()
    const { page } = handle
    for (const [path, shot] of [
      ['/candidate/ai-insights/job-match', '1-job-match'],
      ['/candidate/ai-insights/skill-gap', '2-skill-gap'],
    ]) {
      await openAs(ctx, handle, candidate.email, path)
      const empty = await page.waitForFunction(() => document.body.innerText.includes('No roles to compare yet'), { timeout: 15_000 }).then(() => true, () => false)
      ctx.check(empty, `${path} shows the empty state`)
      await new Promise((resolve) => setTimeout(resolve, 500))
      await handle.checkOverflow()
      await ctx.screenshot(page, shot)
    }
  },
}
