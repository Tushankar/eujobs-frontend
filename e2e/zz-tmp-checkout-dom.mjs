// Temporary (2026-11-13): what Stripe's hosted Checkout renders now. Delete after use.
import { launchChrome } from './lib/browser.js'
import { stripe } from './lib/payments.js'
const [price] = (await stripe.prices.list({ lookup_keys: ['plus_monthly_eur'] })).data
const session = await stripe.checkout.sessions.create({ mode: 'subscription', line_items: [{ price: price.id, quantity: 1 }], success_url: 'https://example.com/ok', cancel_url: 'https://example.com/no', customer_email: 'dom-check@example.com' })
const browser = await launchChrome()
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto(session.url, { waitUntil: 'networkidle0' })
await new Promise((resolve) => setTimeout(resolve, 3000))
const inputs = await page.$$eval('button, select', (els) => els.map((el) => `${el.tagName} id=${el.id} testid=${el.dataset.testid ?? ''} type=${el.type} text=${el.textContent.trim().slice(0, 30)}`))
console.log('top-level:', inputs.join('\n  '))
for (const frame of page.frames()) {
  if (frame === page.mainFrame()) continue
  const fields = await frame.$$eval('select, button', (els) => els.map((el) => `${el.tagName}#${el.id}|${el.name}|${el.textContent.trim().slice(0, 30)}`)).catch(() => [])
  if (fields.length) console.log('frame', frame.url().slice(0, 80), fields.join(', '))
}
await browser.close()
await stripe.checkout.sessions.expire(session.id)
