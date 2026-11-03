import { waitForPath } from '../lib/flows.js'
import { continueToStripe, freeCandidate, openAs, payOnCheckout, rowsOf, until } from '../lib/payments.js'
import { api, db } from '../lib/testApi.js'

const TITLE = 'Designing trusted fintech journeys'

/**
 * P8-04 (M-124, M-125, M-122, OD1): a candidate in the Germany view buys a seeded course: the confirm step shows
 * €22, Stripe's hosted Checkout charges EUR, the return page brings them back enrolled, and Billing lists the
 * payment with its receipt link.
 */
export default {
  name: 'P8-04 Purchase',
  viewports: ['D'],
  async run(ctx) {
    const [course] = await db('courses', 'find', { filter: { title: TITLE } })
    const courseId = course._id.$oid ?? course._id
    const buyer = await freeCandidate('course-buyer', 'DE')
    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, buyer.email, `/candidate/learning/${courseId}`)
    await page.waitForSelector('[data-course-action="buy"]', { visible: true })
    const shown = await page.$eval('main [data-course-price]', (element) => element.innerText)
    ctx.check(shown.includes('22'), `the course shows €22 (${shown})`)

    await page.click('[data-course-action="buy"]')
    await page.waitForSelector('[data-checkout-summary]', { visible: true })
    const summary = await page.$eval('[data-checkout-summary]', (element) => element.innerText)
    ctx.check(summary.includes(TITLE) && summary.includes('€22'), `the confirm step names the course and €22 (${summary})`)
    await ctx.screenshot(page, '1-confirm')
    const checkout = await continueToStripe(page, '€22.00')
    ctx.check(checkout.text.includes(TITLE), 'Stripe Checkout names the course')
    await ctx.screenshot(page, '2-checkout')
    await payOnCheckout(page)

    await waitForPath(page, `/candidate/learning/${courseId}`)
    await page.waitForSelector('[data-course-action="continue"]', { visible: true, timeout: 30_000 })
    await ctx.screenshot(page, '3-enrolled')
    const enrollments = await api('/learning/enrollments', { token: buyer.token })
    ctx.check(enrollments.body.items.some((item) => item.courseId === courseId && item.source === 'purchase'), 'one purchase enrollment')
    const [row] = await until(() => rowsOf('payments', buyer.user.id, { kind: 'course' }), (rows) => rows.length === 1, { label: 'course payment' })
    ctx.check(row.currency === 'EUR' && row.amountMinor === 2200 && row.status === 'paid' && row.receiptUrl, 'a paid EUR 22.00 row with a receipt link')

    await page.goto(`${ctx.webUrl}/candidate/settings/billing`, { waitUntil: 'networkidle0' })
    await page.waitForFunction((title) => document.querySelector('main').innerText.includes(title), {}, TITLE)
    ctx.check(await page.$(`a[href="${row.receiptUrl}"]`), 'Billing links the receipt')
    await ctx.screenshot(page, '4-billing')
    ctx.assertClean(handle.issues, 'purchase')
  },
}
