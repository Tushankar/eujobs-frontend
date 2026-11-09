import { clickText } from '../lib/flows.js'
import { checkLayout, findLeftovers, textsFor } from '../lib/i18nChecks.js'
import { approvedRecruiter, jobBody, postJob } from '../lib/recruiters.js'
import { clickWithin, expectLock, signInRecruiter, trackRequests } from '../lib/recruiterPlan.js'
import { api } from '../lib/testApi.js'

/** No English left and a clean long-text layout in `root`. */
async function checkTranslated(ctx, page, language, root, label) {
  const texts = textsFor(language)
  const leftovers = await findLeftovers(page, texts)
  ctx.check(!leftovers.length, `${label}: ${leftovers.join('; ')}`)
  const { problems } = await checkLayout(page, { ...texts, language }, root)
  ctx.check(!problems.length, `${label} layout:\n  ${problems.join('\n  ')}`)
}

const COPY = {
  es: { manage: 'Gestionar', search: 'Buscar candidatos', publish: 'Publicar oferta', notice: 'Con el plan gratuito ves a las personas', gate: 'Crea tu preselección', upsell: 'Pasar a Recruiter Plus' },
  fr: { manage: 'Gérer', search: 'Rechercher des candidats', publish: 'Publier l’offre', notice: 'Avec l’offre gratuite, vous voyez', gate: 'Constituez votre short-list', upsell: 'Passer à Recruiter Plus' },
}

/**
 * P11c-03 (§3.22, P11c-Q1, Q5): a Free recruiter in Spanish, then one in French. Find candidates' locked search, the
 * Shortlists gate, Publish of a 2nd job and Billing's upsell read in the language with no English left and a clean
 * layout; the upgrade dialog names Recruiter Plus (not translated) and no request is sent.
 */
export default {
  name: 'P11c-03 Recruiter locks in es and fr',
  viewports: ['D', 'M'],
  async run(ctx) {
    for (const language of ['es', 'fr']) {
      const copy = COPY[language]
      const label = `Idioma${language}${ctx.viewport}`
      const recruiter = await approvedRecruiter(label, { plus: false, city: language === 'es' ? 'madrid' : 'paris' })
      await api('/me', { method: 'PATCH', token: recruiter.token, body: { language, languageExplicit: true } })
      await postJob(recruiter.token, jobBody({ title: `${label} Primera`, city: language === 'es' ? 'madrid' : 'paris' }))
      const draft = await postJob(recruiter.token, jobBody({ title: `${label} Segunda`, city: language === 'es' ? 'madrid' : 'paris' }), { draft: true })

      const handle = await ctx.newPage()
      const { page } = handle
      const requests = trackRequests(page)
      await signInRecruiter(ctx, page, recruiter.email, '/recruiter/find-candidates')
      await page.waitForFunction((text) => document.body.innerText.includes(text), { timeout: 15_000 }, copy.notice)
      await checkTranslated(ctx, page, language, 'main', `${language} Find candidates`)
      await expectLock(ctx, page, requests, { label: `${language} search`, click: () => clickWithin(page, 'main [data-plan-locked="discovery"]', copy.search), forbidden: /\/recruiter\/candidates\?/ })
      await clickWithin(page, 'main [data-plan-locked="discovery"]', copy.search)
      await page.waitForSelector('[role="dialog"] [data-checkout-summary]', { visible: true })
      await checkTranslated(ctx, page, language, '[role="dialog"]', `${language} upgrade dialog`)
      await handle.checkOverflow()
      await ctx.screenshot(page, `${language}-1-dialog`)
      await page.keyboard.press('Escape')

      await page.goto(`${ctx.webUrl}/recruiter/shortlists`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-plan-gate="discovery"]')
      ctx.check((await page.$eval('main', (main) => main.innerText)).includes(copy.gate), `${language}: the gate title`)
      await checkTranslated(ctx, page, language, 'main', `${language} Shortlists gate`)
      await ctx.screenshot(page, `${language}-2-gate`)

      await page.goto(`${ctx.webUrl}/recruiter/jobs`, { waitUntil: 'networkidle0' })
      await page.click(`button[aria-label="${copy.manage} ${draft.title}"]`)
      await expectLock(ctx, page, requests, { label: `${language} publish`, click: () => clickText(page, copy.publish, 'button'), forbidden: /\/status/ })
      await checkTranslated(ctx, page, language, 'main', `${language} Jobs`)

      await page.goto(`${ctx.webUrl}/recruiter/settings/billing`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-billing-state="free"]')
      ctx.check((await page.$eval('main', (main) => main.innerText)).includes(copy.upsell), `${language}: Billing upsell`)
      await checkTranslated(ctx, page, language, 'main', `${language} Billing`)
      await handle.checkOverflow()
      await ctx.screenshot(page, `${language}-3-billing`)
      ctx.assertClean(handle.issues, `${language} recruiter`)
    }
  },
}
