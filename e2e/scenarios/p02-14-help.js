import { bodyText, clickText, fill, signInWithForm } from '../lib/flows.js'
import { db } from '../lib/testApi.js'

const CANDIDATE_FAQ = 'What do I need before I can apply to a job?'
const ADMIN_FAQ = 'How do roles and permissions work?'

/** P2-14 (M-200, M-194): FAQs differ per role and follow the language; search ignores accents. */
export default {
  name: 'P2-14 Help',
  viewports: ['D'],
  async run(ctx) {
    const emma = ctx.seedCredentials.email('emma')
    const [before] = await db('users', 'find', { filter: { email: emma } })
    try {
      const handle = await ctx.newPage()
      const { page } = handle
      await signInWithForm(page, ctx.webUrl, '/sign-in', emma, ctx.seedCredentials.password)
      await page.goto(`${ctx.webUrl}/candidate/help`, { waitUntil: 'networkidle0' })
      let text = await bodyText(page)
      ctx.check(text.includes(CANDIDATE_FAQ) && !text.includes(ADMIN_FAQ), 'candidate FAQs only')
      await ctx.screenshot(page, '1-candidate-help')

      await page.click('header button[aria-label="Language"]')
      await clickText(page, 'Español', 'button')
      await page.waitForFunction(() => document.body.innerText.includes('¿Qué necesito para postularme a una oferta?'))
      await fill(page, 'input[type="search"]', 'QUE NECESITO')
      text = await bodyText(page)
      ctx.check(text.includes('¿Qué necesito para postularme a una oferta?'), 'accent-insensitive search finds “Qué necesito”')
      ctx.check(!text.includes('¿Qué incluye Plus?'), 'search filters the other questions')
      await ctx.screenshot(page, '2-spanish-search')
      ctx.assertClean(handle.issues, 'candidate help')

      const owner = await ctx.newPage()
      await signInWithForm(owner.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(null), ctx.seedCredentials.password)
      await owner.page.goto(`${ctx.webUrl}/admin/help`, { waitUntil: 'networkidle0' })
      text = await bodyText(owner.page)
      ctx.check(text.includes(ADMIN_FAQ) && !text.includes(CANDIDATE_FAQ), 'admin FAQs only')
      await ctx.screenshot(owner.page, '3-admin-help')
      ctx.assertClean(owner.issues, 'admin help')
    } finally {
      const { language, languageExplicit } = before
      await db('users', 'updateMany', { filter: { email: emma }, update: { $set: { language, languageExplicit } } })
    }
  },
}
