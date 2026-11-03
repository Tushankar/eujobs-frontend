import { responseTo, signInWithForm, waitForText } from '../lib/flows.js'
import { inCountry, resultsBy } from '../lib/matching.js'
import { openAs } from '../lib/payments.js'
import { login } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

/**
 * P9-06 (M-067, M-068): the admin picks a job and sees its top 4 candidates with % and the code evidence; Emma marks a
 * recommendation "Helpful" and the admin's feedback summary counts it.
 */
export default {
  name: 'P9-06 Oversight and feedback',
  viewports: ['D'],
  async run(ctx) {
    const email = ctx.seedCredentials.email('emma')
    const token = await login(email, 'candidate', ctx.seedCredentials.password)
    const candidate = await ctx.newPage()
    let jobId
    await inCountry(token, 'REMOTE', async () => {
      jobId = (await api('/candidate/insights/roles', { token })).body.items[0].id
      await db('explanationfeedbacks', 'deleteMany', { filter: { jobId: { $oid: jobId } } })
      await openAs(ctx, candidate, email, `/candidate/ai-insights/why-recommended?jobId=${jobId}`, ctx.seedCredentials.password)
      await candidate.page.waitForSelector('[data-feedback="helpful"]', { visible: true })
      await candidate.page.click('[data-feedback="helpful"]')
      await waitForText(candidate.page, 'Thanks, your answer is saved.')
    })
    const [stored] = await db('explanationfeedbacks', 'find', { filter: { jobId: { $oid: jobId } } })
    ctx.check(stored?.value === 'helpful', 'the feedback is stored')
    await ctx.screenshot(candidate.page, '1-helpful')
    ctx.assertClean(candidate.issues, 'feedback')

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/admin/ai-matching`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-feedback-job="${jobId}"]`, { visible: true })
    const row = await page.$eval(`[data-feedback-job="${jobId}"]`, (element) => element.innerText)
    ctx.check(/1 helpful/i.test(row), `the summary counts it (${row.replace(/\s+/g, ' ')})`)

    // Oversight: the chosen job's top 4 by stored score, with %.
    const select = 'select[name="oversightJob"]'
    await page.waitForSelector(select)
    const options = await page.$$eval(`${select} option`, (items) => items.map((item) => item.value))
    const picked = options[1] ?? options[0]
    const oversight = responseTo(page, ['/api/v1/admin/matching/oversight', `jobId=${picked}`])
    await page.select(select, picked)
    await oversight
    await page.waitForFunction((id) => document.querySelector('select[name="oversightJob"]').value === id && document.querySelector('[data-candidate]'), {}, picked)
    const cards = await page.$$eval('[data-candidate]', (items) => items.map((item) => ({ id: item.dataset.candidate, text: item.innerText })))
    const results = await resultsBy({ jobId: picked })
    ctx.check(cards.length > 0 && cards.length <= 4, `top ${cards.length} shown`)
    ctx.check(cards.every(({ id, text }) => text.includes(`${results.get(id).score}%`)), 'each card shows its stored %')
    const scores = cards.map(({ id }) => results.get(id).score)
    ctx.check(scores.every((score, index) => index === 0 || score <= scores[index - 1]), `best first (${scores.join(', ')})`)
    await page.click(`[data-candidate="${cards.at(-1).id}"]`)
    await page.waitForFunction(() => document.querySelector('[data-evidence]')?.innerText.toLowerCase().includes('skills listed for this job'))
    await ctx.screenshot(page, '2-oversight')
    ctx.assertClean(handle.issues, 'oversight')
  },
}
