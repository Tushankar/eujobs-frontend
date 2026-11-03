import { inCountry, resultsBy } from '../lib/matching.js'
import { openAs } from '../lib/payments.js'
import { login } from '../lib/recruiters.js'
import { api } from '../lib/testApi.js'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * P9-02 (M-053, U5): Emma's For you (Remote view) lists the jobs of her picker country with a score ≥ Good, best first, exactly the
 * set and order the stored scores give; the Recommended KPI counts them and "+N this week" those published in 7 days.
 */
export default {
  name: 'P9-02 For you',
  viewports: ['D'],
  async run(ctx) {
    const email = ctx.seedCredentials.email('emma')
    const token = await login(email, 'candidate', ctx.seedCredentials.password)
    // Emma prefers remote work: her Good and Strong jobs are in the Remote view (OQ-6g).
    await inCountry(token, 'REMOTE', async () => {
      const me = (await api('/me', { token })).body
      const results = await resultsBy({ candidateId: me.id })
      // Every job of her view (the picker country), from Find jobs, filtered and ranked by the stored scores.
      const view = (await api('/jobs', { token })).body
      ctx.check(view.view.country === me.pickerCountry, `the view is ${me.pickerCountry}`)
      const expected = view.items
        .filter((job) => results.get(job.id)?.label)
        .sort((a, b) => results.get(b.id).score - results.get(a.id).score)
        .map((job) => job.id)
      ctx.check(expected.length > 0, `Emma has jobs at Good or above (${expected.length})`)
      const newThisWeek = view.items.filter((job) => expected.includes(job.id) && Date.now() - new Date(job.publishedAt) <= WEEK_MS).length

      const handle = await ctx.newPage()
      const { page } = handle
      await openAs(ctx, handle, email, '/candidate', ctx.seedCredentials.password)
      await page.waitForSelector('[role="tabpanel"] [data-job]', { visible: true })
      const shown = await page.$$eval('[role="tabpanel"] [data-job]', (cards) => cards.map((card) => card.dataset.job))
      // The Overview shows the first 3; the API list is the whole ranking. Ties keep the server's secondary order
      // (overlap, then recency), so the scores are compared in order and the set as a whole.
      const ranked = (await api('/jobs/recommended', { token })).body.items.map((job) => job.id)
      const scores = ranked.map((id) => results.get(id)?.score)
      ctx.check(JSON.stringify([...ranked].sort()) === JSON.stringify([...expected].sort()), `For you holds the ${expected.length} jobs at Good or above`)
      ctx.check(scores.every((score, index) => index === 0 || score <= scores[index - 1]), `ranked by score (${scores.join(', ')})`)
      ctx.check(JSON.stringify(shown) === JSON.stringify(ranked.slice(0, 3)), `the Overview shows the top 3 (${shown.map((id) => results.get(id).score).join(', ')})`)

      const stat = await page.$eval('[data-stat="recommended"]', (link) => link.innerText)
      ctx.check(stat.includes(String(expected.length)), `the Recommended KPI shows ${expected.length} (${stat.replace(/\s+/g, ' ')})`)
      if (newThisWeek) ctx.check(stat.includes(`+${newThisWeek}`), `"+${newThisWeek} this week"`)
      ctx.note(`For you: ${expected.length} jobs, ${newThisWeek} new this week`)
      await ctx.screenshot(page, '1-for-you')
      ctx.assertClean(handle.issues, 'For you')
    })
  },
}
