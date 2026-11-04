import { readFileSync } from 'node:fs'
import { onboardedCandidate } from '../lib/candidates.js'
import { clickText, signInWithForm, waitForSettled } from '../lib/flows.js'
import { checkLayout, textsFor } from '../lib/i18nChecks.js'
import { openAs } from '../lib/payments.js'
import { registeredRecruiter } from '../lib/recruiters.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

const fr = (namespace) => JSON.parse(readFileSync(new URL(`../../client/src/i18n/locales/fr/${namespace}.json`, import.meta.url), 'utf8'))
const settle = () => new Promise((resolve) => setTimeout(resolve, 450))

/** Every tab or toggle tray on the page either fits or scrolls; none is wider than its box without scrolling. */
const trays = (page) =>
  page.$$eval('[role="tablist"], [role="radiogroup"]', (elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element)
      return {
        label: element.getAttribute('aria-label') ?? element.className,
        fits: element.scrollWidth <= element.clientWidth + 1,
        scrolls: ['auto', 'scroll'].includes(style.overflowX),
        wraps: style.flexWrap === 'wrap' || style.display.includes('grid'),
      }
    }),
  )

/**
 * P11-03 at 375 px in French: the checkout confirm dialog's long buttons wrap inside the dialog; sidebar labels carry
 * an ellipsis but none is cut; tab and toggle trays fit, wrap or scroll; the recruiter onboarding footer wraps. Each
 * screen passes the layout check (no text out of its box, clipped or overlapping) and the page does not scroll sideways.
 */
export default {
  name: 'P11-03 Long labels',
  viewports: ['M'],
  async run(ctx) {
    const texts = { ...textsFor('fr'), language: 'fr' }
    const candidate = await onboardedCandidate('LongLabels')
    await api('/me', { method: 'PATCH', token: candidate.token, body: { language: 'fr', languageExplicit: true, pickerCountry: 'FR' } })
    const handle = await ctx.newPage()
    const { page } = handle
    const assertLayout = async (label, root) => {
      await settle()
      await handle.checkOverflow()
      const { problems } = await checkLayout(page, texts, root)
      ctx.check(!problems.length, `${label}:\n  ${problems.join('\n  ')}`)
    }

    // The checkout confirm (M-125): "Continuer vers le paiement sécurisé" and "Annuler" in a 375 px dialog.
    await openAs(ctx, handle, candidate.email, '/candidate/settings/billing')
    await clickText(page, fr('billing').upgradeTo.replace('{{plan}}', 'Plus'), 'main button')
    await page.waitForSelector('[data-checkout-summary]', { visible: true })
    await assertLayout('checkout dialog', '[role="dialog"]')
    const footer = await page.$eval('[role="dialog"]', (dialog) => {
      const box = dialog.getBoundingClientRect()
      return [...dialog.querySelectorAll('button')].every((button) => {
        const rect = button.getBoundingClientRect()
        return rect.left >= box.left - 1 && rect.right <= box.right + 1
      })
    })
    ctx.check(footer, 'every dialog button stays inside the dialog')
    await ctx.screenshot(page, '1-checkout-dialog')
    await page.keyboard.press('Escape')

    // Sidebar (the drawer at 375 px): every label has the ellipsis style and none is actually truncated.
    await page.goto(`${ctx.webUrl}/candidate`, { waitUntil: 'networkidle0' })
    await waitForSettled(page)
    await page.click(`header button[aria-label="${fr('shell').openNavigation}"]`)
    await page.waitForFunction(() => document.querySelector('aside nav a'), { timeout: 5000 })
    await settle()
    const labels = await page.$$eval('aside nav a span[class*="linkLabel"]', (spans) =>
      spans.map((span) => ({ text: span.textContent, ellipsis: getComputedStyle(span).textOverflow === 'ellipsis', cut: span.scrollWidth > span.clientWidth + 1 })),
    )
    ctx.check(labels.length > 5 && labels.every((label) => label.ellipsis), `sidebar labels carry an ellipsis (${labels.length})`)
    const cut = labels.filter((label) => label.cut).map((label) => label.text)
    ctx.check(!cut.length, `no French sidebar label is cut: ${cut.join(', ')}`)
    await ctx.screenshot(page, '2-sidebar')
    await page.keyboard.press('Escape')

    // Tabs and toggles: the Overview tabs row (task 7), Find jobs' view toggle, Learning and AI insights.
    for (const [path, name] of [
      ['/candidate', '3-overview-tabs'],
      ['/candidate/jobs', '4-find-jobs-toggle'],
      ['/candidate/learning', '5-learning-tabs'],
      ['/candidate/ai-insights', '6-ai-insights'],
    ]) {
      await page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
      await waitForSettled(page)
      await assertLayout(path, 'main')
      const bad = (await trays(page)).filter((tray) => !tray.fits && !tray.scrolls)
      ctx.check(!bad.length, `${path}: trays wider than their box without scrolling: ${bad.map((tray) => tray.label).join(', ')}`)
      await ctx.screenshot(page, name)
    }
    ctx.assertClean(handle.issues, 'candidate screens')

    // The recruiter onboarding footer: Back and the long primary action wrap at 375 px.
    const recruiter = await registeredRecruiter('LongLabels', { language: 'fr', country: 'FR' })
    const onboarding = await ctx.newPage()
    await signInWithForm(onboarding.page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await onboarding.page.goto(`${ctx.webUrl}/recruiter/onboarding/company`, { waitUntil: 'networkidle0' })
    await onboarding.page.waitForSelector('button[type="submit"]', { visible: true })
    await settle()
    await onboarding.checkOverflow()
    const result = await checkLayout(onboarding.page, texts, 'main')
    ctx.check(!result.problems.length, `onboarding:\n  ${result.problems.join('\n  ')}`)
    const wrapped = await onboarding.page.$eval('button[type="submit"]', (button) => {
      const footer = button.parentElement.getBoundingClientRect()
      const rect = button.getBoundingClientRect()
      return rect.left >= footer.left - 1 && rect.right <= footer.right + 1
    })
    ctx.check(wrapped, 'the onboarding primary button stays inside the footer')
    await ctx.screenshot(onboarding.page, '7-onboarding-footer')
    ctx.assertClean(onboarding.issues, 'recruiter onboarding')
  },
}
