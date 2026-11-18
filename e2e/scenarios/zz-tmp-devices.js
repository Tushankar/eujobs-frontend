// TEMPORARY check of Settings › Where you're signed in (devices + sign-in activity); deleted after the run.
import { onboardedCandidate } from '../lib/candidates.js'
import { API_URL } from '../lib/env.js'
import { bodyText, clickText, signInWithForm, waitForText } from '../lib/flows.js'
import { api, mailTo, TEST_PASSWORD } from '../lib/testApi.js'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const FIREFOX_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:132.0) Gecko/20100101 Firefox/132.0'

// The API trusts X-Forwarded-For from loopback, so these sign-ins come "from" a UK and a US address.
async function loginFrom(email, password, ua, ip) {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': ua, 'X-Forwarded-For': ip },
    body: JSON.stringify({ email, password, portal: 'candidate' }),
  })
  return { status: response.status, body: await response.json() }
}

const deviceRows = (page) => page.$$eval('[data-card="devices"] ul[aria-label="Signed-in devices"] > li', (rows) => rows.map((row) => row.innerText.replace(/\s+/g, ' ')))

export default {
  name: 'TMP devices',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { email } = await onboardedCandidate('Devices')
    ctx.check((await loginFrom(email, 'Wrong-Password-9', IPHONE, '81.2.69.160')).status === 401, 'wrong password refused')
    const phone = await loginFrom(email, TEST_PASSWORD, IPHONE, '81.2.69.160')
    await loginFrom(email, TEST_PASSWORD, FIREFOX_MAC, '8.8.8.8')
    const mails = await mailTo(email, 'new_device_sign_in')
    ctx.check(mails.length === 2, `a new-device email per new device (got ${mails.length})`)
    ctx.note(`email: ${mails[0].params.device} · ${mails[0].params.location} · ${mails[0].params.time}`)

    const { page } = await ctx.newPage()
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/settings/data-account#devices`, { waitUntil: 'networkidle0' })
    await waitForText(page, "Where you're signed in")
    let rows = await deviceRows(page)
    ctx.check(rows.length === 4, `four signed-in devices (got ${rows.length}: ${rows.join(' | ')})`)
    ctx.check(rows[0].includes('This device') && rows[0].includes('Chrome on Windows'), `this device first (got ${rows[0]})`)
    ctx.check(rows.some((row) => row.includes('Safari on iOS') && row.includes('United Kingdom') && row.includes('81.2.69.160')), 'the iPhone with its place and IP')
    ctx.check(rows.some((row) => row.includes('Unknown device')), 'the API-only sign-in reads Unknown device')
    const text = await bodyText(page)
    ctx.check(/All\s*5/.test(text) && /Failed\s*1/.test(text), 'activity tabs count 5 sign-ins, 1 failed')
    await ctx.screenshot(page, '1-devices')
    await page.evaluate(() => document.querySelector('[data-card="devices"]').scrollIntoView())
    await ctx.screenshot(page, '2-devices-card')

    // Sign out the iPhone: its token stops working.
    await page.$$eval('[data-card="devices"] li', (items) => items.find((item) => item.innerText.includes('Safari on iOS')).querySelector('button').click())
    await waitForText(page, 'Safari on iOS has been signed out.')
    ctx.check((await api('/me/sessions', { token: phone.body.token })).status === 401, 'the iPhone token is refused')
    // The list refetches after the notice shows.
    await page.waitForFunction(() => document.querySelectorAll('[data-card="devices"] ul[aria-label="Signed-in devices"] > li').length === 3, { timeout: 10_000 }).catch(() => null)
    rows = await deviceRows(page)
    ctx.check(rows.length === 3, `three devices left (got ${rows.length})`)
    await ctx.screenshot(page, '2b-after-one-sign-out')

    // Sign out of every other device, then reload: this device stays signed in with its new token.
    await clickText(page, 'Sign out of all other devices')
    await page.waitForSelector('[role="dialog"]')
    await ctx.screenshot(page, '3-confirm')
    await page.$$eval('[role="dialog"] button', (buttons) => buttons.find((button) => button.innerText.includes('Sign out of all other devices')).click())
    await waitForText(page, '2 other devices have been signed out.')
    await page.reload({ waitUntil: 'networkidle0' })
    await waitForText(page, 'Sign-in activity')
    rows = await deviceRows(page)
    ctx.check(rows.length === 1 && rows[0].includes('This device'), `only this device left after reload (got ${rows.join(' | ')})`)

    await clickText(page, 'Failed', '[data-card="devices"] [role="group"] button')
    await waitForText(page, 'Failed attempt')
    await ctx.screenshot(page, '4-failed-tab')
    await clickText(page, 'All', '[data-card="devices"] [role="group"] button')
    await page.evaluate(() => document.querySelector('[data-card="devices"]').scrollIntoView())
    await ctx.screenshot(page, '5-after-sign-out')

    if (ctx.viewport === 'D') {
      const admin = (await ctx.newPage()).page
      await signInWithForm(admin, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
      await admin.goto(`${ctx.webUrl}/admin/settings`, { waitUntil: 'networkidle0' })
      await waitForText(admin, 'Sign-in activity')
      const adminRows = await deviceRows(admin)
      ctx.check(adminRows[0]?.includes('This device'), `admin sees this device (got ${adminRows.join(' | ')})`)
      await admin.evaluate(() => document.querySelector('[data-card="devices"]').scrollIntoView())
      await ctx.screenshot(admin, '6-admin')
    }
  },
}
