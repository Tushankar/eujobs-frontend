import { waitForText } from '../lib/flows.js'
import { publishedCourse } from '../lib/learning.js'
import { freeCandidate, openAs } from '../lib/payments.js'
import { ownerToken } from '../lib/recruiters.js'

/**
 * P8-03 (M-100, M-106, M-130): a candidate in the Poland view sees prices in PLN, "Free" on free courses and no
 * Included / Plus tiers. A paid course's free preview lesson opens without buying; its other lessons are locked.
 */
export default {
  name: 'P8-03 Catalogue',
  viewports: ['D', 'M'],
  async run(ctx) {
    const token = await ownerToken()
    const paid = await publishedCourse(token, { title: `Catalogue paid ${ctx.viewport} ${Date.now()}` })
    const free = await publishedCourse(token, { title: `Catalogue free ${ctx.viewport} ${Date.now()}`, isFree: true })
    const candidate = await freeCandidate(`catalogue-${ctx.viewport}`, 'PL')

    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(403, `/lessons/${paid.lessons[1].id}`)
    await openAs(ctx, handle, candidate.email, '/candidate/learning')
    await page.waitForSelector(`[data-course-card="${paid.id}"]`, { visible: true })
    const priceOf = (id) => page.$eval(`[data-course-card="${id}"] [data-course-price]`, (element) => element.innerText.replace(/\s/g, ' '))
    const paidPrice = await priceOf(paid.id)
    ctx.check(paidPrice.includes('PLN') && paidPrice.includes('95'), `the paid course shows PLN 95 (${paidPrice})`)
    ctx.check((await priceOf(free.id)) === 'Free', 'the free course says Free')
    const seeded = await page.$$eval('[data-course-price]', (prices) => prices.map((price) => price.innerText.replace(/\s/g, ' ')))
    ctx.check(seeded.every((price) => price === 'Free' || price.includes('PLN')), `every price is Free or in PLN (${seeded.join(', ')})`)
    const pills = await page.$$eval('main [data-course-card] span', (spans) => spans.map((span) => span.textContent.trim()))
    ctx.check(!pills.includes('Included') && !pills.includes('Plus'), 'no Included or Plus tier badges')
    ctx.check(!(await page.$eval('main', (main) => main.innerText)).includes('Learning Plus'), 'no "Learning Plus" pill')
    await ctx.screenshot(page, '1-catalogue-pln')

    // The free preview opens without buying; the next lesson is locked.
    await page.goto(`${ctx.webUrl}/candidate/learning/${paid.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-lesson-row="${paid.lessons[1].id}"][data-state="locked"]`)
    ctx.check(await page.$('[data-course-action="buy"]'), 'the course offers Buy course')
    await ctx.screenshot(page, '2-details')
    await page.click('[data-open-preview]')
    await page.waitForSelector('[data-lesson-text]', { visible: true })
    ctx.check((await page.$eval('[data-lesson-text]', (element) => element.innerText)).includes('This preview opens without buying.'), 'the preview lesson text shows')
    await ctx.screenshot(page, '3-preview-lesson')
    await page.goto(`${ctx.webUrl}/candidate/learning/${paid.id}/lessons/${paid.lessons[1].id}`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'This lesson is locked')
    await ctx.screenshot(page, '4-locked-lesson')
    ctx.assertClean(handle.issues, 'catalogue')
  },
}
