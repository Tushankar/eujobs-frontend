import { signInWithForm } from '../lib/flows.js'
import { keysOf, resultsBy, sarah } from '../lib/matching.js'

const SCORE_KEYS = ['score', 'percent', 'sim', 'skillShare', 'match']

/**
 * P9-03 (M-047, M-057, C6): Sarah's Find candidates ranks Recommended by the stored scores for her match job; the talent
 * cards and Match insights show evidence (skills, years); no percentage anywhere in the recruiter screens, and no
 * recruiter API answer carries a score field. The AI narrative of Match insights comes with 9b.
 */
export default {
  name: 'P9-03 Recruiter view',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { job } = await sarah(ctx)
    const results = await resultsBy({ jobId: job.id })

    const handle = await ctx.newPage()
    const { page } = handle
    const answers = []
    page.on('response', async (response) => {
      if (!response.url().includes('/api/v1/recruiter/') || !response.headers()['content-type']?.includes('json')) return
      answers.push({ url: response.url(), body: await response.json().catch(() => null) })
    })
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)

    await page.goto(`${ctx.webUrl}/recruiter/find-candidates`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-candidate]', { visible: true })
    const order = await page.$$eval('[data-candidate]', (cards) => cards.map((card) => card.dataset.candidate))
    const scores = order.map((id) => results.get(id)?.score ?? -1)
    ctx.check(order.length > 1, `several candidates listed (${order.length})`)
    ctx.check(scores.every((score, index) => index === 0 || score <= scores[index - 1]), `Recommended follows the scores for "${job.title}" (${scores.join(', ')})`)

    // Match insights on the best candidate: skills evidence and years, computed in code (M-057).
    // The first card opens its Match insights by default; open it when closed.
    if ((await page.$eval('[data-candidate] button[aria-expanded]', (button) => button.getAttribute('aria-expanded'))) === 'false') await page.click('[data-candidate] button[aria-expanded]')
    await page.waitForFunction(() => document.querySelector('[data-candidate]').innerText.toLowerCase().includes('skills evidence'), { timeout: 10_000 })
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-find-candidates')
    const listText = await page.$eval('main', (main) => main.innerText)
    ctx.check(!/\d\s?%/.test(listText), 'no percentage on Find candidates')

    await page.goto(`${ctx.webUrl}/recruiter/find-candidates/${order[0]}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('main h1', { visible: true })
    ctx.check(!/\d\s?%/.test(await page.$eval('main', (main) => main.innerText)), 'no percentage on the candidate profile')
    await ctx.screenshot(page, '2-profile')

    await page.goto(`${ctx.webUrl}/recruiter/overview`, { waitUntil: 'networkidle0' })
    const talent = await page.$$eval('[data-candidate]', (cards) => cards.map((card) => card.innerText))
    ctx.check(talent.every((text) => !/\d\s?%/.test(text)), `no percentage on the ${talent.length} talent cards`)
    await ctx.screenshot(page, '3-overview')

    ctx.check(answers.length >= 3, `recruiter answers captured (${answers.length})`)
    for (const { url, body } of answers) {
      const found = SCORE_KEYS.filter((key) => keysOf(body).has(key))
      ctx.check(found.length === 0, `${new URL(url).pathname} carries no score field (${found.join(', ')})`)
    }
    ctx.assertClean(handle.issues, 'recruiter view')
  },
}
