import { signInWithForm, waitForSettled, waitForText } from '../lib/flows.js'
import { checkLayout, textsFor } from '../lib/i18nChecks.js'
import { db } from '../lib/testApi.js'

const NAMES = {
  es: ['Responsable de equipo', 'Responsable de cuentas', 'Personal'],
  fr: ['Responsable d’équipe', 'Responsable comptable', 'Collaborateur'],
}

/**
 * P11-06 (P11-Q6): an es and an fr admin see the three seeded system roles translated on Access management (cards and
 * the invite dialog's role list), with no English role text left and a clean layout; the stored roles are unchanged.
 */
export default {
  name: 'P11-06 System roles',
  viewports: ['D', 'M'],
  async run(ctx) {
    const email = ctx.seedCredentials.email()
    const [owner] = await db('users', 'find', { filter: { email } })
    try {
      for (const language of ['es', 'fr']) {
        await db('users', 'updateMany', { filter: { email }, update: { $set: { language, languageExplicit: true } } })
        const handle = await ctx.newPage()
        const { page } = handle
        await signInWithForm(page, ctx.webUrl, '/admin/sign-in', email, ctx.seedCredentials.password)
        await page.goto(`${ctx.webUrl}/admin/access-management`, { waitUntil: 'networkidle0' })
        await waitForSettled(page)
        for (const name of NAMES[language]) await waitForText(page, name)
        const text = await page.evaluate(() => document.body.innerText)
        for (const english of ['Accounts Head', 'Oversees finance information', 'Provides limited operational access']) {
          ctx.check(!text.includes(english), `${language}: no "${english}"`)
        }
        await new Promise((resolve) => setTimeout(resolve, 450))
        const { problems } = await checkLayout(page, { ...textsFor(language), language })
        ctx.check(!problems.length, `${language} layout:\n  ${problems.join('\n  ')}`)
        await handle.checkOverflow()
        await ctx.screenshot(page, `1-roles-${language}`)

        await page.goto(`${ctx.webUrl}/admin/access-management/users/invite`, { waitUntil: 'networkidle0' })
        await page.waitForSelector('[role="dialog"] select', { visible: true })
        const options = await page.$$eval('[role="dialog"] select option', (items) => items.map((item) => item.textContent))
        ctx.check(NAMES[language].every((name) => options.includes(name)), `${language} invite roles: ${options.join(', ')}`)
        await ctx.screenshot(page, `2-invite-${language}`)
        ctx.assertClean(handle.issues, `${language} access management`)
      }
      const stored = (await db('adminroles', 'find', { filter: { system: true } })).map((role) => role.name).sort()
      ctx.check(JSON.stringify(stored) === JSON.stringify(['Accounts Head', 'Manager', 'Staff']), `stored names unchanged (${stored})`)
    } finally {
      await db('users', 'updateMany', { filter: { email }, update: { $set: { language: owner.language, languageExplicit: owner.languageExplicit ?? false } } })
    }
  },
}
