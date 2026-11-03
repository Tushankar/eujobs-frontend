import { completeCandidate } from '../lib/applicants.js'
import { responseTo, waitForText } from '../lib/flows.js'
import { embeddingOf, expectedRelevant, resultsBy, sarah, tick } from '../lib/matching.js'
import { openAs } from '../lib/payments.js'
import { api, db, TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P9-13 (M-187, M-054, C6): a complete London candidate on Plus is embedded, scored and listed in Sarah's Find
 * candidates. Turning matching consent off in Settings removes them from Find candidates at once and from the scores,
 * the embeddings and every relevant count on the next tick; their own job cards stop showing a score.
 */
export default {
  name: 'P9-13 Consent off',
  viewports: ['D'],
  async run(ctx) {
    const candidate = await completeCandidate('Consent')
    await tick()
    ctx.check(await embeddingOf(candidate.id), 'the candidate is embedded')
    ctx.check((await resultsBy({ candidateId: candidate.id })).size > 0, 'and scored')
    const { token: sarahToken, job } = await sarah(ctx)
    const listed = async () => (await api('/recruiter/candidates', { token: sarahToken })).body.items.some((item) => item.id === candidate.id)
    ctx.check(await listed(), 'Sarah finds the candidate')
    const scored = (await api('/jobs', { token: candidate.token })).body.items.filter((item) => item.match)
    ctx.check(scored.length > 0, `the candidate's cards show scores (${scored.length})`)

    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, candidate.email, '/candidate/settings/privacy', TEST_PASSWORD)
    const consent = 'button[role="switch"][aria-label="Matching consent"]'
    await page.waitForSelector(consent, { visible: true })
    const saved = responseTo(page, '/api/v1/candidate/settings/privacy', 'PATCH')
    await page.click(consent)
    await page.waitForFunction((selector) => document.querySelector(selector).getAttribute('aria-checked') === 'false', {}, consent)
    await saved
    ctx.check((await db('users', 'find', { filter: { email: candidate.email } }))[0].privacy.matchingConsent === false, 'consent is off')
    await ctx.screenshot(page, '1-consent-off')

    ctx.check(!(await listed()), 'gone from Find candidates at once')
    await page.goto(`${ctx.webUrl}/candidate/jobs`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-job]', { visible: true })
    ctx.check(!/\d\s?%/.test(await page.$eval('main', (main) => main.innerText)), 'the job cards show no score')
    await waitForText(page, 'skills match')
    await ctx.screenshot(page, '2-cards-without-score')

    await tick()
    ctx.check(!(await embeddingOf(candidate.id)), 'the embedding is deleted')
    ctx.check((await resultsBy({ candidateId: candidate.id })).size === 0, 'the scores are deleted')
    const refreshed = (await api(`/recruiter/jobs/${job.id}`, { token: sarahToken })).body
    ctx.check(refreshed.relevantCount === (await expectedRelevant(sarahToken, refreshed)), `"${job.title}" counts ${refreshed.relevantCount} relevant without the candidate`)
    ctx.assertClean(handle.issues, 'consent off')
  },
}
