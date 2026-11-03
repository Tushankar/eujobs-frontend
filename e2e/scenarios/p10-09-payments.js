import { openAsAdmin } from '../lib/admins.js'
import { clickText, responseTo, waitForText } from '../lib/flows.js'
import { advanceClock, freeCandidate, rowsOf, stripe, subscribeThroughApi, TEST_DB, until, waitForPlan } from '../lib/payments.js'
import { ownerToken } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

// OQ-6b: an English-speaking admin formats as en-IE.
const money = ({ amountMinor, currency }) => new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amountMinor / 100)

/** U34: totals per currency, largest first; the card shows at most 3, then "+n more". */
function perCurrency(entries) {
  const totals = new Map()
  for (const { currency, amountMinor } of entries) totals.set(currency, (totals.get(currency) ?? 0) + amountMinor)
  return [...totals].map(([currency, amountMinor]) => ({ currency, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor)
}
const cardLines = (totals) => [...totals.slice(0, 3).map(money), ...(totals.length > 3 ? [`+${totals.length - 3} more`] : [])]

const cardValue = (page, label) =>
  page.$$eval('main section', (cards, wanted) => cards.find((card) => card.querySelector('p')?.innerText.trim() === wanted)?.querySelector('p span')?.innerText.trim(), label)
const rowsShown = (page) => page.$$eval('main table tbody tr', (rows) => rows.map((row) => row.innerText.replace(/\s+/g, ' ')))

let setup
/** Real Stripe rows, made once for both viewports: a first payment, a paid renewal and a failed renewal; a refund. */
async function makeRows() {
  const renewing = await freeCandidate('PayRenewal', 'GB')
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000), name: `localworkman ${TEST_DB} p10 renewal` })
  const { customer, subscription } = await subscribeThroughApi(renewing.user, { testClock: clock.id })
  await waitForPlan(renewing.token, 'plus')
  const firstEnd = subscription.items.data[0].current_period_end
  await advanceClock(clock.id, firstEnd + 3600)
  await until(() => rowsOf('payments', renewing.user.id, { status: 'paid' }), (rows) => rows.length === 2, { timeout: 120_000, label: 'the paid renewal' })
  const renewed = await stripe.subscriptions.retrieve(subscription.id)
  const failing = await stripe.paymentMethods.attach('pm_card_chargeCustomerFail', { customer: customer.id })
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: failing.id } })
  await advanceClock(clock.id, renewed.items.data[0].current_period_end + 3600)
  await until(() => rowsOf('payments', renewing.user.id, { status: 'failed' }), (rows) => rows.length === 1, { timeout: 120_000, label: 'the failed renewal' })

  const refunded = await freeCandidate('PayRefund', 'GB')
  await subscribeThroughApi(refunded.user, { currency: 'EUR' })
  await waitForPlan(refunded.token, 'plus')
  const [paid] = await until(() => rowsOf('payments', refunded.user.id), (rows) => rows.length === 1, { label: 'the EUR payment' })
  await stripe.refunds.create({ payment_intent: paid.stripe.paymentIntentId })
  await until(() => rowsOf('payments', refunded.user.id), ([row]) => row.status === 'refunded', { label: 'the refunded row' })
  return { renewing: renewing.user, refunded: refunded.user }
}

/**
 * P10-09 (M-122, M-123, U34, P10-Q5 … Q7): every Stripe and seeded payment row, including a renewal, a failed renewal
 * and a refund; the details show the subscription status and period; Active subscribers, MRR per currency (at most 3
 * lines, then "+n more"), Collected and Failed renewals equal independent counts from the database.
 */
export default {
  name: 'P10-09 Payments',
  viewports: ['D', 'M'],
  async run(ctx) {
    setup ??= await makeRows()
    const { renewing, refunded } = setup
    const handle = await ctx.newPage()
    const { page } = handle
    await openAsAdmin(ctx, handle, ctx.seedCredentials.email(null), '/admin/payments', ctx.seedCredentials.password)
    await page.waitForSelector('main table tbody tr')

    // The cards, against the database.
    const [payments, subscriptions] = await Promise.all([db('payments', 'find'), db('subscriptions', 'find')])
    const active = subscriptions.filter((row) => ['active', 'trialing'].includes(row.status) || (row.status === 'past_due' && row.retrying))
    const expected = {
      Collected: cardLines(perCurrency(payments.filter((row) => row.status === 'paid'))).join(' '),
      'Active subscribers': String(active.length),
      'Monthly recurring revenue': cardLines(perCurrency(active.map((row) => ({ currency: row.currency, amountMinor: row.amountMinor })))).join(' '),
      'Failed renewals': String(payments.filter((row) => row.status === 'failed' && row.kind === 'subscription').length),
    }
    for (const [label, value] of Object.entries(expected)) {
      await page.waitForFunction((text) => document.querySelector('main').innerText.includes(text.split(' ')[0]), {}, value)
      const shown = (await cardValue(page, label))?.replace(/\s+/g, ' ')
      ctx.check(shown === value, `${label}: ${value} (shown ${shown})`)
    }
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-cards')

    // A renewal, a failed renewal and a refund are rows.
    const search = async (text, count) => {
      const answered = responseTo(page, ['/api/v1/admin/payments?', `q=${encodeURIComponent(text).replace(/%20/g, '+')}`])
      await page.click('input[name="q"]', { clickCount: 3 })
      await page.type('input[name="q"]', text)
      await answered.catch(() => {})
      await page.waitForFunction((wanted, n) => [...document.querySelectorAll('main table tbody tr')].filter((row) => row.innerText.includes(wanted)).length === n, {}, text, count)
      return rowsShown(page)
    }
    const renewalRows = await search(renewing.fullName, 3)
    const statuses = await page.$$eval('main table [data-payment-status]', (badges) => badges.map((badge) => badge.dataset.paymentStatus).sort())
    ctx.check(JSON.stringify(statuses) === JSON.stringify(['failed', 'paid', 'paid']), `first payment, renewal and failed renewal (${statuses}; ${renewalRows.join(' | ')})`)
    await ctx.screenshot(page, '2-renewal-rows')

    // The failed renewal's details: the subscription status and period.
    await page.click('main table tbody tr:has([data-payment-status="failed"]) button')
    await page.waitForSelector('[role="dialog"] [data-detail="subscription"]')
    const [sub] = await rowsOf('subscriptions', renewing.id)
    const details = await page.$eval('[role="dialog"]', (dialog) => dialog.innerText)
    const label = { active: 'Active', past_due: 'Past due', canceled: 'Canceled', unpaid: 'Unpaid' }[sub.status]
    ctx.check(details.includes(label) && details.includes('Current period') && details.includes('Card declined'), `details show ${label}, the period and the failure (${details})`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '3-details')
    await clickText(page, 'Close', '[role="dialog"] button')

    await search(refunded.fullName, 1)
    ctx.check(await page.$('main table [data-payment-status="refunded"]'), 'the refund is a row')

    // Seeded rows carry their badge (P10-Q5).
    await page.click('input[name="q"]', { clickCount: 3 })
    await page.keyboard.press('Backspace')
    const seeded = responseTo(page, ['/api/v1/admin/payments?', 'source=seed'])
    await page.select('select[name="source"]', 'seed')
    await seeded
    const seedCount = payments.filter((row) => row.source === 'seed').length
    await page.waitForFunction((n) => document.querySelectorAll('main table [data-payment-source="seed"]').length === Math.min(n, 20), {}, seedCount)
    await ctx.screenshot(page, '4-seeded')

    // The country filter changes the cards to that country's payers, as the server counts them.
    await page.select('select[name="source"]', '')
    const gbStats = (await api('/admin/payments/stats?country=GB', { token: await ownerToken() })).body
    const statsAnswer = responseTo(page, ['/api/v1/admin/payments/stats', 'country=GB'])
    await page.select('select[name="country"]', 'GB')
    await statsAnswer
    await waitForText(page, cardLines(gbStats.collected)[0])
    ctx.check((await cardValue(page, 'Active subscribers')) === String(gbStats.activeSubscribers), 'Active subscribers for the United Kingdom')
    await handle.checkOverflow()
    await ctx.screenshot(page, '5-country')

    const exported = responseTo(page, '/api/v1/admin/payments/export')
    await clickText(page, 'Export CSV', 'button')
    const csv = await (await exported).text()
    ctx.check(csv.charCodeAt(0) === 0xfeff && csv.includes('Reference,Date,Payer'), 'the export')
    ctx.assertClean(handle.issues, 'payments')
  },
}
