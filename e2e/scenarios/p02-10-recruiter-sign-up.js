import { bodyText, clickText, fill, waitForPath } from '../lib/flows.js'
import { mailTo, TEST_PASSWORD, uniqueEmail } from '../lib/testApi.js'

async function fillSignUp(page, webUrl, email) {
  await page.goto(`${webUrl}/recruiter/sign-up`, { waitUntil: 'networkidle0' })
  await page.waitForFunction(() => document.querySelector('select[name="country"]')?.value)
  await fill(page, 'input[name="fullName"]', 'Rita Recruiter')
  await fill(page, 'input[name="jobTitle"]', 'Talent lead')
  await fill(page, 'input[name="email"]', email)
  await page.select('select[name="country"]', 'GB')
  await fill(page, 'input[name="phone"]', '020 7946 0958')
  await fill(page, 'input[name="password"]', TEST_PASSWORD)
  await fill(page, 'input[name="confirmPassword"]', TEST_PASSWORD)
  await page.$eval('input[name="acceptTerms"]', (box) => box.click())
  await page.click('button[type="submit"]')
}

const latestCode = async (email) => (await mailTo(email, 'recruiter_email_code')).at(-1).params.code
const wrong = (code) => String((Number(code) + 1) % 1e6).padStart(6, '0')

async function enterCode(page, code) {
  await fill(page, 'input[name="code"]', code)
  await page.click('button[type="submit"]')
}

/**
 * P2-10 (M-002, M-004, U37, OQ-6h): sign-up → code screen; wrong codes show attempts left and lock at 5;
 * Resend opens after 60 s; the right code opens onboarding, and /recruiter leads back to onboarding.
 * A registered email answers EMAIL_TAKEN with sign-in and reset links.
 */
export default {
  name: 'P2-10 Recruiter sign-up and code',
  viewports: ['D', 'M'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(422, '/api/v1/auth/email-code/verify')
    handle.allow(429, '/api/v1/auth/email-code/verify')

    const email = uniqueEmail('p210')
    await fillSignUp(page, ctx.webUrl, email)
    await waitForPath(page, '/recruiter/onboarding/email-code')
    await page.waitForNetworkIdle()
    ctx.check((await bodyText(page)).includes(email), 'the code screen names the address')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-code-screen')

    const code = await latestCode(email)
    await enterCode(page, wrong(code))
    await page.waitForFunction(() => document.body.innerText.includes('4 attempts left'))
    ctx.check(/Send a new code in \d+ seconds?/.test(await bodyText(page)), 'Resend shows a countdown')
    await ctx.screenshot(page, '2-attempts-left')

    let finalCode = code
    if (ctx.viewport === 'D') {
      // One attempt at a time: the button is busy while a code is checked.
      for (const left of [3, 2, 1]) {
        await enterCode(page, wrong(code))
        await page.waitForFunction((text) => document.body.innerText.includes(text), {}, `${left} attempt${left === 1 ? '' : 's'} left`)
      }
      await enterCode(page, wrong(code))
      await page.waitForFunction(() => document.body.innerText.includes('Too many wrong attempts. Send a new code.'))
      await ctx.screenshot(page, '3-locked')
      // Resend opens 60 s after the first code (the server counts from its send time too).
      await page.waitForFunction(() => document.body.innerText.includes('Send a new code') && !/in \d+ second/.test(document.body.innerText), {
        timeout: 75_000,
      })
      await clickText(page, 'Send a new code', 'button')
      await page.waitForFunction(() => document.body.innerText.includes('We sent a new code.'))
      finalCode = await latestCode(email)
      ctx.check(finalCode, 'a second code was emailed')
    }

    await enterCode(page, finalCode)
    await waitForPath(page, () => location.pathname.startsWith('/recruiter/onboarding/') && !location.pathname.endsWith('email-code'))
    await page.waitForNetworkIdle()
    await ctx.screenshot(page, '4-onboarding')
    await page.goto(`${ctx.webUrl}/recruiter`, { waitUntil: 'networkidle0' })
    ctx.check(new URL(page.url()).pathname.startsWith('/recruiter/onboarding'), `/recruiter led to ${new URL(page.url()).pathname}`)
    ctx.assertClean(handle.issues, 'recruiter sign-up')

    if (ctx.viewport === 'D') {
      const duplicate = await ctx.newPage()
      duplicate.allow(409, '/api/v1/auth/recruiter/register')
      await fillSignUp(duplicate.page, ctx.webUrl, ctx.seedCredentials.email('emma'))
      await duplicate.page.waitForFunction(() => document.body.innerText.includes('An account with this email address already exists.'))
      ctx.check(await duplicate.page.$('form a[href="/recruiter/sign-in"]'), 'EMAIL_TAKEN links to sign-in')
      ctx.check(await duplicate.page.$('form a[href="/forgot-password"]'), 'EMAIL_TAKEN links to reset')
      await ctx.screenshot(duplicate.page, '5-email-taken')
      ctx.assertClean(duplicate.issues, 'duplicate recruiter sign-up')
    }
  },
}
