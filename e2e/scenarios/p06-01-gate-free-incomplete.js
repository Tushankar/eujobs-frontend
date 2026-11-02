import { clickApply } from '../lib/applicants.js'
import { clickText, pageApi, signInWithForm } from '../lib/flows.js'

/**
 * P6-01 (§3.4, M-118, D2): Alex (Free, incomplete) clicks Apply on a job card → the gate lists every missing checklist
 * item with a link and offers "Upgrade to apply"; Apply is disabled. The upgrade opens the plan checkout step.
 */
export default {
  name: 'P6-01 Gate, Free and incomplete',
  viewports: ['D', 'M'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('alex'), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/candidate/jobs`, { waitUntil: 'networkidle0' })
    await clickApply(page)
    await page.waitForSelector('[data-apply-gate]', { visible: true })

    const me = (await pageApi(page, '/me')).body
    const expected = me.completeness.items.filter((item) => !item.done)
    const shown = await page.$$eval('[data-missing-item]', (items) => items.map((item) => [item.dataset.missingItem, item.querySelector('a').getAttribute('href')]))
    ctx.check(me.plan === 'free' && expected.length > 0, `Alex is Free and incomplete (${me.plan}, ${expected.length} missing)`)
    ctx.check(JSON.stringify(shown) === JSON.stringify(expected.map((item) => [item.key, item.route])), `the gate lists the missing items with links: ${JSON.stringify(shown)}`)
    ctx.check(Boolean(await page.$('[data-plan-required]')), 'the gate names the Plus plan')
    const buttons = await page.$$eval('[role="dialog"] button', (items) => items.map((item) => [item.textContent.trim(), item.disabled]))
    ctx.check(buttons.some(([text, disabled]) => text === 'Apply' && disabled), `Apply is disabled: ${JSON.stringify(buttons)}`)
    ctx.check(buttons.some(([text, disabled]) => text.includes('Upgrade to apply') && !disabled), 'Upgrade to apply is offered')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-gate')

    await clickText(page, 'Upgrade to apply', '[role="dialog"] button')
    await page.waitForSelector('[data-checkout-summary]', { visible: true })
    ctx.check((await page.$eval('[data-checkout-summary]', (element) => element.innerText)).includes('Plus'), 'the upgrade opens the Plus checkout step')
    await ctx.screenshot(page, '2-upgrade')
    ctx.assertClean(handle.issues, 'gate')
  },
}
