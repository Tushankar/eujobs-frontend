import { fixture } from '../fixtures/make.js'
import { chooseFile, clickText, fill, pageApi, signInWithForm, waitForPath, waitForText } from '../lib/flows.js'
import { db, TEST_PASSWORD, uniqueEmail, verifiedCandidate } from '../lib/testApi.js'

/**
 * P3-01 (M-014, M-136, G-1): a new candidate uploads a CV (version 1, live), picks Remote and Warsaw through the
 * real Places proxy with 12,000 PLN a month, continues with Free and lands on the Overview with Poland as the
 * header country. The next sign-in goes straight to /candidate.
 */
export default {
  name: 'P3-01 Onboarding',
  viewports: ['D', 'M'],
  async run(ctx) {
    const email = uniqueEmail('onboarding')
    await verifiedCandidate(email, TEST_PASSWORD)
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await waitForPath(page, '/candidate/onboarding/story')

    await chooseFile(page, 'input[type="file"]', fixture('cv-text.pdf'))
    await waitForText(page, 'is version 1 and your live CV')
    await ctx.screenshot(page, '1-story')
    await clickText(page, 'Continue', 'button')
    await waitForPath(page, '/candidate/onboarding/preferences')

    await page.waitForSelector('input[name="workPreference"]')
    await page.click('label:has(input[name="workPreference"][value="remote"])')
    await page.type('input[role="combobox"]', 'Warsaw')
    await page.waitForSelector('[role="option"]')
    await ctx.screenshot(page, '2-city-suggestions')
    await clickText(page, 'Warsaw', '[role="option"]')
    await waitForText(page, 'Minimum salary in PLN')
    await fill(page, 'input[name="salaryAmount"]', '12000')
    await page.select('select[name="salaryPeriod"]', 'month')
    await ctx.screenshot(page, '3-preferences')
    await clickText(page, 'Find my next chapter', 'button')
    await waitForPath(page, '/candidate/onboarding/plan')
    await waitForText(page, 'Continue with Free')
    await handle.checkOverflow()
    await ctx.screenshot(page, '4-plan')
    await clickText(page, 'Continue with Free', 'button')
    await waitForPath(page, () => location.pathname === '/candidate')
    await page.waitForNetworkIdle()
    await ctx.screenshot(page, '5-overview')

    const me = await pageApi(page, '/me')
    ctx.check(me.body.pickerCountry === 'PL', `the header country is Poland (got ${me.body.pickerCountry})`)
    ctx.check(me.body.onboardingCompleted, 'onboarding is complete')
    if (ctx.viewport === 'D') ctx.check(await page.$eval('header', (header) => header.innerText.includes('Poland')), 'the header shows Poland')
    const [user] = await db('users', 'find', { filter: { email } })
    const [profile] = await db('candidateprofiles', 'find', { filter: { userId: user._id } })
    ctx.check(profile.location.countryCode === 'PL' && profile.location.city === 'Warsaw', 'the profile city is Warsaw, PL')
    ctx.check(JSON.stringify(profile.salaryMin) === JSON.stringify({ amount: 12000, currency: 'PLN', period: 'month' }), 'the salary is 12,000 PLN a month')
    ctx.check(profile.workPreference === 'remote' && profile.liveCvVersionId, 'remote work and a live CV')
    ctx.assertClean(handle.issues, 'onboarding')

    const again = await ctx.newPage()
    await signInWithForm(again.page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    ctx.check(new URL(again.page.url()).pathname === '/candidate', 'the next sign-in opens /candidate')
    ctx.assertClean(again.issues, 'next sign-in')
  },
}
