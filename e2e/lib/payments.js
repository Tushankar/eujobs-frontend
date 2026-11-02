import { createRequire } from 'node:module'
import { join } from 'node:path'
import { onboardedCandidate } from './candidates.js'
import { clickText, signInWithForm } from './flows.js'
import { SERVER_DIR, stripeSecretKey, WEB_URL } from './env.js'
import { api, db, TEST_PASSWORD } from './testApi.js'

/*
 * Phase 5 helpers: Stripe test mode through the server's own package and pinned API version (§2.10), so nothing is
 * installed in e2e/ (as P3-D13). Every customer made here carries metadata.db, so seed:demo removes it (P5-Q3).
 */
const Stripe = createRequire(join(SERVER_DIR, 'package.json'))('stripe')
export const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-10-28.endive' })
export const TEST_DB = 'eujobs_test'

// Stripe test cards: 4242 pays; 0341 attaches, then every charge fails (P5-04).
export const CARDS = { visa: '4242424242424242', chargeFail: '4000000000000341' }

/** Polls `read` until `test(value)` holds (webhooks and test clocks are asynchronous). */
export async function until(read, test, { timeout = 60_000, label = 'condition' } = {}) {
  const deadline = Date.now() + timeout
  let value
  while (Date.now() < deadline) {
    value = await read()
    if (test(value)) return value
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`timed out waiting for ${label}`)
}

export const meOf = async (token) => (await api('/me', { token })).body
export const waitForPlan = (token, plan, timeout) => until(() => meOf(token), (me) => me.plan === plan, { timeout, label: `plan ${plan}` })

/** Rows of a collection for one user id (EJSON ids). */
export const rowsOf = (collection, userId, filter = {}) => db(collection, 'find', { filter: { userId: { $oid: userId }, ...filter } })

/** A Free candidate who finished onboarding, with the header country `country`; returns { email, token, user }. */
export async function freeCandidate(label, country) {
  const candidate = await onboardedCandidate(label)
  const { body } = await api('/me', { method: 'PATCH', token: candidate.token, body: { pickerCountry: country } })
  return { ...candidate, user: body }
}

/** Signs a candidate in through the form and opens `path`. */
export async function openAs(ctx, handle, email, path, password = TEST_PASSWORD) {
  await signInWithForm(handle.page, ctx.webUrl, '/sign-in', email, password)
  await handle.page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
}

/** Stripe's hosted Checkout: waits for the card form, then returns its text and language. */
export async function checkoutPage(page) {
  await page.waitForFunction(() => location.hostname === 'checkout.stripe.com', { timeout: 30_000 })
  await page.waitForSelector('#cardNumber', { visible: true, timeout: 45_000 })
  return page.evaluate(() => ({ text: document.body.innerText, lang: document.documentElement.lang }))
}

/** Pays on the hosted Checkout with a test card and waits until Stripe sends the browser back to the app. */
export async function payOnCheckout(page, card = CARDS.visa) {
  await page.waitForSelector('#cardNumber', { visible: true, timeout: 45_000 })
  await page.type('#cardNumber', card)
  await page.type('#cardExpiry', '1234')
  await page.type('#cardCvc', '123')
  await page.type('#billingName', 'Test Buyer')
  await page.select('#billingCountry', 'DE')
  const postal = await page.$('#billingPostalCode')
  if (postal && (await postal.isVisible())) await page.type('#billingPostalCode', '10115')
  await page.click('[data-testid="hosted-payment-submit-button"]')
  await page.waitForFunction((origin) => location.origin === origin, { timeout: 90_000 }, WEB_URL)
}

/** Opens the confirm step (M-124) from the current page's upgrade button and returns its summary text. */
export async function openUpgrade(page, buttonText) {
  await clickText(page, buttonText)
  await page.waitForSelector('[data-checkout-summary]', { visible: true })
  return page.$eval('[data-checkout-summary]', (element) => element.innerText)
}

/** Continue to secure payment → Stripe Checkout. */
export async function continueToStripe(page) {
  await clickText(page, 'Continue to secure payment')
  return checkoutPage(page)
}

/**
 * A Stripe customer and Plus subscription for `user`, made through the API instead of Checkout (P5-03 … P5-08 setups):
 * linked the way Checkout links them, so the webhooks write the rows. `testClock` puts the customer on a test clock.
 */
export async function subscribeThroughApi(user, { currency = 'GBP', testClock } = {}) {
  const [price] = (await stripe.prices.list({ lookup_keys: [`plus_monthly_${currency.toLowerCase()}`] })).data
  const metadata = { db: TEST_DB, userId: user.id }
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.fullName,
    metadata,
    payment_method: 'pm_card_visa',
    invoice_settings: { default_payment_method: 'pm_card_visa' },
    ...(testClock && { test_clock: testClock }),
  })
  await db('users', 'updateMany', { filter: { _id: { $oid: user.id } }, update: { $set: { stripeCustomerId: customer.id } } })
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.id }],
    metadata: { kind: 'subscription', itemId: 'plus', userId: user.id },
  })
  return { customer, subscription }
}

/** Advances a test clock and waits until Stripe has finished processing it. */
export async function advanceClock(clockId, frozenTime) {
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: frozenTime })
  await until(() => stripe.testHelpers.testClocks.retrieve(clockId), (clock) => clock.status === 'ready', { timeout: 300_000, label: 'test clock ready' })
}
