import { bodyText, clickText, fill, waitForPath } from '../lib/flows.js'
import { mailTo, TEST_PASSWORD, uniqueEmail } from '../lib/testApi.js'

/** P2-01: a French browser signs up in French, gets the French link, verifies and lands on onboarding. */
export default {
  name: 'P2-01 Candidate sign-up',
  viewports: ['D', 'M'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr' })
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'language', { get: () => 'fr-FR' })
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr'] })
    })

    await page.goto(`${ctx.webUrl}/sign-up`, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.querySelector('select[name="country"]')?.value)
    const form = await page.evaluate(() => ({ lang: document.documentElement.lang, country: document.querySelector('select[name="country"]').value }))
    ctx.check(form.lang === 'fr', `<html lang> is ${form.lang}, expected fr`)
    ctx.check(form.country === 'FR', `country defaults to ${form.country}, expected FR`)
    ctx.check((await bodyText(page)).includes('Créez votre compte.'), 'the form is in French')

    const email = uniqueEmail('p201')
    await fill(page, 'input[name="fullName"]', 'Camille Martin')
    await fill(page, 'input[name="email"]', email)
    await fill(page, 'input[name="password"]', TEST_PASSWORD)
    await fill(page, 'input[name="confirmPassword"]', TEST_PASSWORD)
    await page.$eval('input[name="acceptTerms"]', (box) => box.click())
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-form-fr')
    await page.click('button[type="submit"]')

    await waitForPath(page, '/sign-up/check-email')
    await page.waitForNetworkIdle()
    ctx.check((await bodyText(page)).includes(email), 'check-email shows the address')
    await handle.checkOverflow()
    await ctx.screenshot(page, '2-check-email')

    const [mail] = await mailTo(email, 'verify_email')
    ctx.check(mail?.language === 'fr' && mail.subject === 'Confirmez votre adresse e-mail', 'a French verification email was captured')
    await page.goto(mail.params.link, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.body.innerText.includes('Adresse e-mail vérifiée'))
    await ctx.screenshot(page, '3-verified')

    await clickText(page, 'Se connecter', 'a')
    await waitForPath(page, '/sign-in')
    await fill(page, 'input[name="email"]', email)
    await fill(page, 'input[name="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await waitForPath(page, '/candidate/onboarding/story')
    await page.waitForNetworkIdle()
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-onboarding')
    ctx.assertClean(handle.issues, 'sign-up flow')
  },
}
