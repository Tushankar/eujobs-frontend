import { readFileSync } from 'node:fs'
import { fixture } from '../fixtures/make.js'
import { clickText, fill, pageApi, signInWithForm, waitForPath, waitForText } from '../lib/flows.js'
import { registeredRecruiter } from '../lib/recruiters.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

const es = JSON.parse(readFileSync(new URL('../../client/src/i18n/locales/es/auth.json', import.meta.url), 'utf8')).onboarding

/**
 * P4-01 (M-149, M-151, M-134, G-1): a recruiter with Spanish chosen explicitly and the code entered fills step 2 with
 * a Berlin company (the header country becomes Germany, Spanish is kept), uploads an identity PDF and a registration
 * PNG, confirms the phone with the on-screen code and submits: "Under review". /recruiter leads back to the status
 * page and the API answers RECRUITER_NOT_APPROVED. At 375 px the step footer wraps without overflow.
 */
export default {
  name: 'P4-01 Recruiter onboarding',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { email } = await registeredRecruiter('Onboarding', { language: 'es', languageExplicit: true })
    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(403, '/api/v1/recruiter/company')
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', email, TEST_PASSWORD)
    await waitForPath(page, '/recruiter/onboarding/company')

    await fill(page, 'input[name="legalName"]', 'Nordlicht Studio GmbH')
    await fill(page, 'input[name="website"]', 'nordlicht.example.com')
    await fill(page, 'input[name="businessEmail"]', 'hello@nordlicht.example.com')
    await fill(page, 'input[name="industry"]', 'Diseño de producto')
    await page.select('select[name="size"]', '11_50')
    await page.type('input[name="companyCity"]', 'Berlin')
    await page.waitForSelector('[role="option"]')
    await clickText(page, 'Berl', '[role="option"]')
    await page.waitForFunction(() => document.querySelector('input[name="companyCity"]').value.includes(','))
    await fill(page, 'textarea[name="businessAddress"]', 'Torstraße 1, 10119 Berlin')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-company')
    await clickText(page, es.continue, 'button[type="submit"]')
    await waitForPath(page, '/recruiter/onboarding/kyc')

    const me = await pageApi(page, '/me')
    ctx.check(me.body.pickerCountry === 'DE', `the header country is Germany (got ${me.body.pickerCountry})`)
    ctx.check(me.body.language === 'es', `the explicit language is kept (got ${me.body.language})`)

    const inputs = await page.$$('input[type="file"]')
    await inputs[0].uploadFile(fixture('kyc-identity.pdf'))
    await waitForText(page, 'kyc-identity.pdf')
    await (await page.$$('input[type="file"]'))[1].uploadFile(fixture('kyc-registration.png'))
    await waitForText(page, 'kyc-registration.png')
    await ctx.screenshot(page, '2-kyc')
    await clickText(page, es.continue, 'button[type="submit"]')
    await waitForPath(page, '/recruiter/onboarding/verify')

    await clickText(page, es.verify.send, 'button')
    await page.waitForSelector('[role="status"]')
    const code = await page.$eval('[role="status"]', (element) => element.textContent.match(/\d{6}/)[0])
    await fill(page, 'input[name="phoneCode"]', code)
    await clickText(page, es.verify.confirm, 'button')
    await waitForText(page, es.verify.confirmed)
    await handle.checkOverflow()
    await ctx.screenshot(page, '3-verify')
    await clickText(page, es.verify.submit, 'button[type="submit"]')
    await waitForPath(page, '/recruiter/onboarding/review')
    await waitForText(page, es.review.badge.pending_review)
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-under-review')

    await page.goto(`${ctx.webUrl}/recruiter`, { waitUntil: 'networkidle0' })
    ctx.check(new URL(page.url()).pathname === '/recruiter/onboarding/review', `/recruiter led to ${new URL(page.url()).pathname}`)
    const blocked = await pageApi(page, '/recruiter/company')
    ctx.check(blocked.status === 403 && blocked.body.error.code === 'RECRUITER_NOT_APPROVED', `the workspace API is closed (got ${blocked.status} ${blocked.body?.error?.code})`)
    ctx.check(blocked.body.error.params.status === 'pending_review', 'the error names the status')
    ctx.assertClean(handle.issues, 'onboarding')
  },
}
