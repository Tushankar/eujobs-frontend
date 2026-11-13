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

/** The Stripe customer id stored on a user (set by the first Checkout). */
export const stripeCustomerOf = async (userId) => (await db('users', 'find', { filter: { _id: { $oid: userId } } }))[0]?.stripeCustomerId

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

/*
 * Stripe's hosted Checkout renders its form one of two ways: on the page (#cardNumber, the hosted submit button) or,
 * as this sandbox does since 2026-11-13, inside a Payment Element iframe (#payment-numberInput … with its own
 * Subscribe / Pay button). checkoutForm finds whichever is shown.
 */
const FORMS = {
  page: {
    number: '#cardNumber',
    expiry: '#cardExpiry',
    cvc: '#cardCvc',
    name: '#billingName',
    country: '#billingCountry',
    postal: '#billingPostalCode',
    submit: '[data-testid="hosted-payment-submit-button"]',
  },
  element: {
    number: '#payment-numberInput',
    expiry: '#payment-expiryInput',
    cvc: '#payment-cvcInput',
    name: '#payment-nameInput',
    country: '#payment-countryInput',
    postal: '#payment-postalCodeInput',
    submit: null,
  },
}

async function checkoutForm(page, timeout = 45_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await page.$(FORMS.page.number)) return { target: page, fields: FORMS.page }
    for (const frame of page.frames()) {
      if (frame !== page.mainFrame() && (await frame.$(FORMS.element.number).catch(() => null))) return { target: frame, fields: FORMS.element }
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('Stripe Checkout showed no card form')
}

/** Stripe's hosted Checkout: waits until it shows `amount` (it renders a skeleton first), then returns its text and language. */
export async function checkoutPage(page, amount) {
  await page.waitForFunction(() => location.hostname === 'checkout.stripe.com', { timeout: 30_000 })
  await checkoutForm(page)
  // Stripe puts a no-break space between the currency and the amount.
  await page.waitForFunction((text) => document.body.innerText.replace(/\s/g, ' ').includes(text), { timeout: 45_000 }, amount)
  return page.evaluate(() => ({ text: document.body.innerText.replace(/\s/g, ' '), lang: document.documentElement.lang }))
}

/** The Payment Element's own button, which reads "Subscribe" or "Pay …" (never Link's "Pay securely with Link"). */
async function clickSubmit(frame) {
  for (const button of await frame.$$('button')) {
    const text = await button.evaluate((element) => element.textContent.trim())
    if ((text === 'Subscribe' || /^Pay(\s|$)/.test(text)) && !/\bwith\b/i.test(text) && (await button.isVisible())) return button.click()
  }
  throw new Error('Stripe Checkout showed no Subscribe or Pay button')
}

/** Pays on the hosted Checkout with a test card and waits until Stripe sends the browser back to the app. */
export async function payOnCheckout(page, card = CARDS.visa) {
  const { target, fields } = await checkoutForm(page)
  await target.waitForSelector(fields.number, { visible: true, timeout: 45_000 })
  await target.type(fields.number, card)
  await target.type(fields.expiry, '1234')
  await target.type(fields.cvc, '123')
  await target.type(fields.name, 'Test Buyer')
  await target.select(fields.country, 'DE')
  const postal = await target.$(fields.postal)
  if (postal && (await postal.isVisible())) await target.type(fields.postal, '10115')
  if (fields.submit) await target.click(fields.submit)
  else await clickSubmit(target)
  await page.waitForFunction((origin) => location.origin === origin, { timeout: 90_000 }, WEB_URL)
}

/** Opens the confirm step (M-124) from an upgrade button of the page content and returns its summary text. */
export async function openUpgrade(page, buttonText) {
  await clickText(page, buttonText, 'main button')
  await page.waitForSelector('[data-checkout-summary]', { visible: true })
  return page.$eval('[data-checkout-summary]', (element) => element.innerText)
}

/** Continue to secure payment → Stripe Checkout showing `amount` (e.g. "PLN 45.00"). */
export async function continueToStripe(page, amount) {
  await clickText(page, 'Continue to secure payment', '[role="dialog"] button')
  return checkoutPage(page, amount)
}

/**
 * A Stripe customer and Plus (or `plan` = recruiter_plus) subscription for `user`, made through the API instead of
 * Checkout (P5-03 … P5-08 setups): linked the way Checkout links them, so the webhooks write the rows. `testClock` puts
 * the customer on a test clock.
 */
export async function subscribeThroughApi(user, { currency = 'GBP', testClock, plan = 'plus' } = {}) {
  const [price] = (await stripe.prices.list({ lookup_keys: [`${plan}_monthly_${currency.toLowerCase()}`] })).data
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
    metadata: { kind: 'subscription', itemId: plan, userId: user.id },
  })
  return { customer, subscription }
}

/** Advances a test clock and waits until Stripe has finished processing it. */
export async function advanceClock(clockId, frozenTime) {
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: frozenTime })
  await until(() => stripe.testHelpers.testClocks.retrieve(clockId), (clock) => clock.status === 'ready', { timeout: 300_000, label: 'test clock ready' })
}
