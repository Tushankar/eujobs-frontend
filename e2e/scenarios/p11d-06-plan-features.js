import { PLANS } from '../../server/seed/data/catalog.js'
import { seedCredentials } from '../lib/env.js'
import { signInWithForm } from '../lib/flows.js'
import { approvedRecruiter, login } from '../lib/recruiters.js'
import { api } from '../lib/testApi.js'

// P11d-Q9: the lines added to each paid plan (the last ones of its feature list in the catalogue).
const NEW_LINES = { plus: 3, recruiter_plus: 4 }
const linesOf = (key, language) => PLANS.find((plan) => plan.key === key).features.slice(-NEW_LINES[key]).map((feature) => feature[language])

/** The visible feature lines under `scope`. */
const shown = (page, scope) => page.$$eval(`${scope} li`, (items) => items.map((item) => item.innerText.trim()))

/** Every expected line is on screen in `scope`. */
async function expectLines(ctx, page, scope, lines, label) {
  await page.waitForSelector(scope, { timeout: 15_000 })
  const texts = await shown(page, scope)
  const missing = lines.filter((line) => !texts.some((text) => text.includes(line)))
  ctx.check(!missing.length, `${label}: missing ${missing.join(' | ')}`)
}

/**
 * P11d-06 (P11d-Q9): in en, es and fr, candidate Billing and the candidate upgrade dialog list the three new Plus lines,
 * recruiter Billing and the recruiter upgrade dialog the four new Recruiter Plus lines, and the Free side of the plan
 * gate shows them as not included. AI interview notes is not a Plus line.
 */
export default {
  name: 'P11d-06 Plan features in en, es and fr',
  viewports: ['D', 'M'],
  async run(ctx) {
    const alex = await login(seedCredentials.email('alex'), 'candidate', seedCredentials.password)
    const recruiter = await approvedRecruiter(`Planes${ctx.viewport}`, { plus: false })
    ctx.check(!linesOf('plus', 'en').some((line) => line.includes('AI interview notes')), 'AI interview notes is not on candidate Plus')
    try {
      for (const language of ['en', 'es', 'fr']) {
        await api('/me', { method: 'PATCH', token: alex, body: { language, languageExplicit: true } })
        await api('/me', { method: 'PATCH', token: recruiter.token, body: { language, languageExplicit: true } })

        const candidate = await ctx.newPage()
        const page = candidate.page
        await signInWithForm(page, ctx.webUrl, '/sign-in', seedCredentials.email('alex'), seedCredentials.password)
        await page.goto(`${ctx.webUrl}/candidate/settings/billing`, { waitUntil: 'networkidle0' })
        await expectLines(ctx, page, 'main [data-plan-features="plus"]', linesOf('plus', language), `${language} candidate Billing`)
        await page.$$eval('main [data-billing-state="free"] button', (buttons) => buttons.at(-1).click())
        await expectLines(ctx, page, '[role="dialog"] [data-plan-features="plus"]', linesOf('plus', language), `${language} candidate upgrade dialog`)
        await candidate.checkOverflow()
        await ctx.screenshot(page, `${language}-1-candidate-dialog`)
        await page.keyboard.press('Escape')
        // The Free side of the gate (Job alerts is a Plus page): the new lines are not included.
        await page.goto(`${ctx.webUrl}/candidate/job-alerts`, { waitUntil: 'networkidle0' })
        await expectLines(ctx, page, '[data-plan="free"]', linesOf('plus', language), `${language} candidate gate, Free side`)
        const crossed = await page.$$eval('[data-plan="free"] [data-missing]', (items) => items.map((item) => item.innerText.trim()))
        ctx.check(linesOf('plus', language).every((line) => crossed.some((text) => text.includes(line))), `${language}: the Free side crosses the new lines out`)
        await ctx.screenshot(page, `${language}-2-candidate-gate`)
        ctx.assertClean(candidate.issues, `${language} candidate`)

        const recruiterHandle = await ctx.newPage()
        const rpage = recruiterHandle.page
        await signInWithForm(rpage, ctx.webUrl, '/recruiter/sign-in', recruiter.email, 'Harbour-Lantern-58')
        await rpage.goto(`${ctx.webUrl}/recruiter/settings/billing`, { waitUntil: 'networkidle0' })
        await expectLines(ctx, rpage, 'main [data-plan-features="recruiter_plus"]', linesOf('recruiter_plus', language), `${language} recruiter Billing`)
        await rpage.$$eval('main [data-billing-state="free"] button', (buttons) => buttons.at(-1).click())
        await expectLines(ctx, rpage, '[role="dialog"] [data-plan-features="recruiter_plus"]', linesOf('recruiter_plus', language), `${language} recruiter upgrade dialog`)
        await recruiterHandle.checkOverflow()
        await ctx.screenshot(rpage, `${language}-3-recruiter-dialog`)
        await rpage.keyboard.press('Escape')
        await rpage.goto(`${ctx.webUrl}/recruiter/shortlists`, { waitUntil: 'networkidle0' })
        await expectLines(ctx, rpage, '[data-plan="recruiter_free"]', linesOf('recruiter_plus', language), `${language} recruiter gate, Free side`)
        ctx.assertClean(recruiterHandle.issues, `${language} recruiter`)
      }
    } finally {
      await api('/me', { method: 'PATCH', token: alex, body: { language: 'en', languageExplicit: true } })
    }
  },
}
