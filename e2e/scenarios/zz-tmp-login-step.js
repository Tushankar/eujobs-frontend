// TEMPORARY check of the sign-in second step and two-step verification (2026-11-18); deleted after the run.
import { invitedAdmin, systemRole } from '../lib/admins.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { bodyText, clickText, fill, finishLoginStep, responseTo, waitForPath, waitForSettled, waitForText } from '../lib/flows.js'
import { mailTo, TEST_PASSWORD } from '../lib/testApi.js'
import { nextAppCode, rememberSecret } from '../lib/totp.js'

async function submitPassword(page, webUrl, path, email, password) {
  await page.goto(`${webUrl}${path}`, { waitUntil: 'networkidle0' })
  await fill(page, 'input[name="email"]', email)
  await fill(page, 'input[name="password"]', password)
  const login = responseTo(page, '/api/v1/auth/login', 'POST')
  await page.click('button[type="submit"]')
  return (await (await login).json()).verification
}

const landed = async (page, prefix) => {
  await waitForPath(page, prefix)
  await page.waitForFunction(() => !document.querySelector('input[name="password"]'), { timeout: 15_000 })
  await waitForSettled(page)
}

export default {
  name: 'TMP login step',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { email } = await onboardedCandidate('Stepper')

    // 1. A new browser: the emailed code. A wrong code is refused, the right one signs in.
    const handle = await ctx.newPage()
    handle.allow(422, '/api/v1/auth/login/verify')
    const { page } = handle
    let step = await submitPassword(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    ctx.check(step?.method === 'email', `a new browser gets the email step (got ${step?.method})`)
    await page.waitForSelector('[data-login-step="email"]')
    const text = await bodyText(page)
    ctx.check(text.includes('Check your email') && text.includes('We’ll remember this browser for 90 days'), 'the email step explains itself')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-email-code')
    const code = (await mailTo(email, 'login_code')).at(-1).params.code
    await fill(page, 'input[name="code"]', code === '000000' ? '111111' : '000000')
    await page.click('[data-login-step] button[type="submit"]')
    await waitForText(page, 'That code isn')
    await ctx.screenshot(page, '2-wrong-code')
    await finishLoginStep(page, email, 'email')
    await landed(page, '/candidate')

    // 2. The same browser is remembered: signing out and in again asks nothing.
    await page.evaluate(() => localStorage.removeItem('lwm-auth-token'))
    step = await submitPassword(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    ctx.check(!step, 'the remembered browser signs straight in')
    await landed(page, '/candidate')

    // 3. Settings: turn on the authenticator app; the backup codes show once.
    await page.goto(`${ctx.webUrl}/candidate/settings/data-account`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Two-step verification')
    await page.click('[data-setting="two-factor"] button')
    await page.waitForFunction(() => document.querySelector('[data-setup-key]')?.textContent.trim(), { timeout: 15_000 })
    rememberSecret(email, await page.$eval('[data-setup-key]', (key) => key.textContent))
    await page.evaluate(() => document.querySelector('[data-setting="two-factor"]').scrollIntoView({ block: 'start' }))
    await ctx.screenshot(page, '3-settings-setup')
    await fill(page, '[data-setting="two-factor"] input[name="code"]', await nextAppCode(email))
    await page.click('[data-setting="two-factor"] form button[type="submit"]')
    await page.waitForSelector('[data-backup-codes]')
    const backupCodes = await page.$$eval('[data-backup-codes] li', (items) => items.map((item) => item.textContent.trim()))
    ctx.check(backupCodes.length === 10, `ten backup codes (got ${backupCodes.length})`)
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-settings-backup-codes')
    await clickText(page, 'Done', '[data-setting="two-factor"] button')
    await page.waitForFunction(() => document.querySelector('[data-setting="two-factor"]').innerText.includes('10 backup codes left'))
    await ctx.screenshot(page, '5-settings-on')

    // 4. Another browser: the app replaces the email; a backup code works.
    const other = await ctx.newPage()
    step = await submitPassword(other.page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    ctx.check(step?.method === 'totp', `with 2FA on, a new browser asks for the app (got ${step?.method})`)
    await other.page.waitForSelector('[data-login-step="totp"]')
    await other.checkOverflow()
    await ctx.screenshot(other.page, '6-app-code')
    await clickText(other.page, 'Use a backup code instead', '[data-login-step] button')
    await fill(other.page, 'input[name="code"]', backupCodes[0])
    await other.page.click('[data-login-step] button[type="submit"]')
    await landed(other.page, '/candidate')
    ctx.check((await mailTo(email, 'new_device_sign_in')).length >= 1, 'the app sign-in on a new browser sends the alert email')

    if (ctx.viewport !== 'D') return

    // 5. Admins: the Owner sets the app up at sign-in, saves the backup codes, then lands on the Overview.
    const owner = await ctx.newPage()
    const ownerEmail = ctx.seedCredentials.email(null)
    step = await submitPassword(owner.page, ctx.webUrl, '/admin/sign-in', ownerEmail, ctx.seedCredentials.password)
    ctx.check(['totp_setup', 'totp'].includes(step?.method), `the Owner is asked for the app (got ${step?.method})`)
    const form = `[data-login-step="${step.method}"]`
    await owner.page.waitForSelector(form)
    if (step.method === 'totp_setup') {
      await owner.page.waitForFunction(() => document.querySelector('[data-setup-key]')?.textContent.trim(), { timeout: 15_000 })
      rememberSecret(ownerEmail, await owner.page.$eval('[data-setup-key]', (key) => key.textContent))
      await owner.checkOverflow()
      await ctx.screenshot(owner.page, '7-admin-setup')
    }
    await fill(owner.page, `${form} input[name="code"]`, await nextAppCode(ownerEmail))
    await owner.page.click(`${form} button[type="submit"]`)
    if (step.method === 'totp_setup') {
      await owner.page.waitForSelector('[data-backup-continue]')
      await ctx.screenshot(owner.page, '8-admin-backup-codes')
      await owner.page.click('[data-backup-continue]')
    }
    await landed(owner.page, '/admin')

    // 6. The Owner resets another admin's 2FA from Access management.
    const staffRole = await systemRole('Staff')
    const staff = await invitedAdmin('Twofa', staffRole.id)
    await owner.page.goto(`${ctx.webUrl}/admin/access-management/users/${staff.id}`, { waitUntil: 'networkidle0' })
    await owner.page.waitForSelector('[data-two-factor]')
    ctx.check((await owner.page.$eval('[data-two-factor]', (row) => row.innerText)).includes('On'), 'the staff admin shows 2FA on')
    await ctx.screenshot(owner.page, '9-access-two-factor')
    await clickText(owner.page, 'Reset 2FA', '[data-two-factor] button')
    await owner.page.waitForFunction(() => document.body.innerText.includes('Reset two-step verification for'))
    await ctx.screenshot(owner.page, '10-reset-confirm')
    await owner.page.$$eval('[role="dialog"] button', (buttons) => buttons.findLast((button) => button.innerText.includes('Reset 2FA')).click())
    await waitForText(owner.page, 'Two-step verification reset for')
    await ctx.screenshot(owner.page, '11-reset-done')
  },
}
