import { inCountry, percent, resultsBy } from '../lib/matching.js'
import { openAs } from '../lib/payments.js'
import { login } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

const LABELS = { strong: 'Strong match', good: 'Good match' }

/** Opens the first card's "matching skills" disclosure and waits for the AI explanation (M-057). */
async function explanation(page) {
  await page.click('[data-job] button[aria-controls^="why-"]')
  await page.waitForSelector('[data-job] [data-explanation] [data-narrative-text]', { visible: true, timeout: 60_000 })
  return page.$eval('[data-job] [data-explanation]', (element) => element.innerText)
}

/** The match badge text of every job card on the page, by job id. */
const badges = (page) =>
  page.$$eval('[data-job]', (cards) => cards.map((card) => [card.dataset.job, card.querySelector('[data-match-badge]')?.textContent ?? '']))

/**
 * P9-01 (M-047, M-050, M-057, C6): Emma (Plus, Remote view) sees each job's score and label exactly as stored, and the
 * explanation (code evidence plus an AI narrative in her language); switching to French writes a French narrative (a new
 * cache entry). Alex (Free) sees the skill-overlap label only, never a number.
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
      const shownBadges = await badges(emma.page)

      // The explanation: the overlap evidence in code plus the narrative in English.
      const english = await explanation(emma.page)
      ctx.check(/Matching skills on your profile|None of this role/.test(english), 'the code evidence shows')
      ctx.note(`English narrative: ${english.replace(/\s+/g, ' ').slice(0, 140)}…`)
      await ctx.screenshot(emma.page, '2-explanation-en')
      ctx.assertClean(emma.issues, 'Plus job cards')

      // French: a new cache entry in French, on a screen with every key in French (Phase 11 removed the P9-Q6 exception).
      // The cache outlives a reseed (it saves OpenAI calls between runs), so earlier French explanations are cleared first.
      await db('aicaches', 'deleteMany', { filter: { kind: 'match_explanation', language: 'fr' } })
      const frenchBefore = 0
      await api('/me', { method: 'PATCH', token: emmaToken, body: { language: 'fr', languageExplicit: true } })
      try {
        const french = await ctx.newPage()
        await openAs(ctx, french, emmaEmail, '/candidate/jobs', ctx.seedCredentials.password)
        await french.page.waitForSelector('[data-job]', { visible: true })
        const text = await explanation(french.page)
        const narrative = await french.page.$eval('[data-job] [data-narrative-text]', (element) => element.textContent)
        ctx.check(/\b(vous|votre|vos|les|des|pour|est)\b/i.test(narrative), `the narrative is French: ${narrative.slice(0, 120)}`)
        ctx.check((await db('aicaches', 'count', { filter: { kind: 'match_explanation', language: 'fr' } })) > frenchBefore, 'a new French cache entry')
        ctx.check(text !== english, 'not the English text')
        await french.checkOverflow()
        await ctx.screenshot(french.page, '3-explanation-fr')
        ctx.assertClean(french.issues, 'French explanation')
      } finally {
        await api('/me', { method: 'PATCH', token: emmaToken, body: { language: 'en', languageExplicit: true } })
      }
      return shownBadges
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
    await ctx.screenshot(alex.page, '4-free-overlap')
    ctx.assertClean(alex.issues, 'Free job cards')
  },
}
