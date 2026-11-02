import { login } from '../lib/recruiters.js'
import { freeCandidate, openAs, subscribeThroughApi, waitForPlan } from '../lib/payments.js'
import { api } from '../lib/testApi.js'

const promoText = (page) => page.$eval('[data-promo]', (element) => element.textContent)

/** On a phone the sidebar is a drawer: open it before clicking inside. */
async function openDrawer(ctx, page) {
  if (ctx.viewport !== 'M') return
  await page.click('button[aria-controls="workspace-sidebar"]')
  // Wait until the drawer has slid fully in.
  await page.waitForFunction(() => document.getElementById('workspace-sidebar').getBoundingClientRect().left === 0)
}

/**
 * P5-07 (M-196, C14, P5-Q5): Free → the Plus upsell with the local price, which opens the upgrade dialog; Plus but
 * incomplete → "Complete your profile" to the checklist; Plus and complete → hidden. A subscriber whose header
 * country changed still sees the subscription's own currency in Billing.
 */
export default {
  name: 'P5-07 Promo card',
  viewports: ['D', 'M'],
  async run(ctx) {
    const free = await freeCandidate('PromoFree', 'PL')
    const freeHandle = await ctx.newPage()
    const { page } = freeHandle
    await openAs(ctx, freeHandle, free.email, '/candidate')
    await page.waitForSelector('[data-promo="upsell"]')
    const price = new Intl.NumberFormat('en-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(45)
    const upsell = await promoText(page)
    ctx.check(upsell.includes('Get more with Plus') && upsell.includes(price), `Free: the upsell with ${price} (${upsell})`)
    await openDrawer(ctx, page)
    await page.click('[data-promo="upsell"] button')
    await page.waitForSelector('[data-checkout-summary]', { visible: true })
    ctx.check((await page.$eval('[data-checkout-summary]', (element) => element.innerText)).includes(price), 'the upsell opens the upgrade dialog')
    await freeHandle.checkOverflow()
    await ctx.screenshot(page, '1-free-upsell')
    await page.keyboard.press('Escape')
    ctx.assertClean(freeHandle.issues, 'Free')

    const incomplete = await freeCandidate('PromoPlus', 'GB')
    await subscribeThroughApi(incomplete.user)
    await waitForPlan(incomplete.token, 'plus')
    const plusHandle = await ctx.newPage()
    await openAs(ctx, plusHandle, incomplete.email, '/candidate')
    await plusHandle.page.waitForSelector('[data-promo="complete"]')
    ctx.check((await promoText(plusHandle.page)).includes('Complete your profile'), 'Plus but incomplete: "Complete your profile"')
    ctx.check(await plusHandle.page.$('[data-promo="complete"] a[href="/candidate/profile"]'), 'it links to the checklist')
    await ctx.screenshot(plusHandle.page, '2-plus-incomplete')
    ctx.assertClean(plusHandle.issues, 'Plus incomplete')

    // Emma: Plus with a complete profile, subscribed in GBP; she switches her header country to Poland.
    const emmaEmail = ctx.seedCredentials.email('emma')
    const emmaToken = await login(emmaEmail, 'candidate', ctx.seedCredentials.password)
    await api('/me', { method: 'PATCH', token: emmaToken, body: { pickerCountry: 'PL' } })
    try {
      const emmaHandle = await ctx.newPage()
      await openAs(ctx, emmaHandle, emmaEmail, '/candidate/settings/billing', ctx.seedCredentials.password)
      await emmaHandle.page.waitForSelector('[data-billing-state="active"]')
      ctx.check(!(await emmaHandle.page.$('[data-promo]')), 'Plus and complete: no promo card')
      const billing = await emmaHandle.page.$eval('main', (main) => main.innerText)
      // GBP, formatted for the new format locale en-PL (M-133).
      const gbp = new Intl.NumberFormat('en-PL', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(9)
      ctx.check(billing.replace(/\s/g, ' ').includes(gbp.replace(/\s/g, ' ')) && !billing.includes('PLN'), `Billing keeps the subscription currency (${gbp}) after the country change`)
      await emmaHandle.checkOverflow()
      await ctx.screenshot(emmaHandle.page, '3-emma-billing-in-poland')
      ctx.assertClean(emmaHandle.issues, 'Emma')
    } finally {
      await api('/me', { method: 'PATCH', token: emmaToken, body: { pickerCountry: 'GB' } })
    }
  },
}
