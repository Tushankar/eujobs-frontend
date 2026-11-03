import { inCountry, percent, resultsBy } from '../lib/matching.js'
import { openAs } from '../lib/payments.js'
import { login } from '../lib/recruiters.js'
import { api } from '../lib/testApi.js'

const LABELS = { strong: 'Strong match', good: 'Good match' }

/** The match badge text of every job card on the page, by job id. */
const badges = (page) =>
  page.$$eval('[data-job]', (cards) => cards.map((card) => [card.dataset.job, card.querySelector('[data-match-badge]')?.textContent ?? '']))

/**
 * P9-01, 9a part (M-047, M-050, C6): Emma (Plus, Remote view) sees each job's score and label exactly as stored; Alex (Free)
 * sees the skill-overlap label only, never a number. The explanation and its narrative come with 9b.
 */
export default {
  name: 'P9-01 Candidate scores',
  viewports: ['D', 'M'],
  async run(ctx) {
    const emmaEmail = ctx.seedCredentials.email('emma')
    const emmaToken = await login(emmaEmail, 'candidate', ctx.seedCredentials.password)
    const me = (await api('/me', { token: emmaToken })).body
    ctx.check(me.plan === 'plus', 'Emma is on Plus')
    const results = await resultsBy({ candidateId: me.id })
    ctx.check(results.size > 0, `Emma has match results (${results.size})`)

    // Emma prefers remote work, so her Good and Strong jobs are in the Remote view (OQ-6g caps the others at 49).
    const emma = await ctx.newPage()
    const shown = await inCountry(emmaToken, 'REMOTE', async () => {
      await openAs(ctx, emma, emmaEmail, '/candidate/jobs', ctx.seedCredentials.password)
      await emma.page.waitForSelector('[data-job]', { visible: true })
      await emma.checkOverflow()
      await ctx.screenshot(emma.page, '1-plus-scores')
      return badges(emma.page)
    })
    let labelled = 0
    for (const [jobId, text] of shown) {
      const result = results.get(jobId)
      ctx.check(result, `job ${jobId} has a stored score`)
      const expected = result.label ? `${percent(result.score)} · ${LABELS[result.label]}` : `${percent(result.score)} match`
      ctx.check(text === expected, `card ${jobId}: "${text}" = "${expected}"`)
      if (result.label) labelled += 1
    }
    ctx.check(labelled > 0, `at least one card is Strong or Good (${labelled} of ${shown.length})`)
    ctx.note(`Emma: ${shown.map(([jobId, text]) => `${jobId.slice(-4)} ${text}`).join('; ')}`)
    ctx.assertClean(emma.issues, 'Plus job cards')

    // Alex is Free: the overlap label on every card and no number anywhere in the list (M-050).
    const alexEmail = ctx.seedCredentials.email('alex')
    const alex = await ctx.newPage()
    await openAs(ctx, alex, alexEmail, '/candidate/jobs', ctx.seedCredentials.password)
    await alex.page.waitForSelector('[data-job]', { visible: true })
    const free = await badges(alex.page)
    ctx.check(free.length > 0 && free.every(([, text]) => /^\d+ of \d+ skills match$/.test(text)), `Free cards show the overlap label (${free.map(([, text]) => text).join('; ')})`)
    const listText = await alex.page.$eval('main', (main) => main.innerText)
    ctx.check(!/\d\s?%/.test(listText), 'no percentage on a Free candidate’s list')
    const { items } = (await api('/jobs', { token: await login(alexEmail, 'candidate', ctx.seedCredentials.password) })).body
    ctx.check(items.length > 0 && items.every((item) => item.match === null), 'the API sends a Free candidate no score')
    await alex.checkOverflow()
    await ctx.screenshot(alex.page, '2-free-overlap')
    ctx.assertClean(alex.issues, 'Free job cards')
  },
}
