import { bodyText, clickText, signInWithForm } from '../lib/flows.js'
import { db } from '../lib/testApi.js'

/** Opens the language or country choices: header dropdowns at 1440 px, the profile menu at 375 px. */
async function openChoices(page, viewport, which) {
  if (viewport === 'D') {
    await page.click(`header button[aria-label="${which.header}"]`)
  } else {
    await page.click(`header button[aria-label="${which.menu}"]`)
    await clickText(page, which.row, 'button')
  }
}

/**
 * P2-11 (M-134, M-135, M-140): Español applies to the shell and <html lang> and survives a reload (server);
 * Poland is kept as the country; an anonymous visitor's choice on a public page stays in this browser.
 */
export default {
  name: 'P2-11 Language and country',
  viewports: ['D', 'M'],
  async run(ctx) {
    const emma = ctx.seedCredentials.email('emma')
    const [before] = await db('users', 'find', { filter: { email: emma } })
    try {
      const handle = await ctx.newPage()
      const { page } = handle
      await signInWithForm(page, ctx.webUrl, '/sign-in', emma, ctx.seedCredentials.password)

      await openChoices(page, ctx.viewport, { header: 'Language', menu: 'Open profile menu', row: 'Language' })
      await clickText(page, 'Español', 'button')
      // The page title is translated at every width (the breadcrumb and sidebar are hidden at 375 px).
      await page.waitForFunction(() => document.documentElement.lang === 'es' && document.title.startsWith('Resumen'))
      await page.reload({ waitUntil: 'networkidle0' })
      ctx.check(await page.evaluate(() => document.documentElement.lang === 'es'), 'Spanish is kept after a reload')
      ctx.check(await page.evaluate(() => document.title.startsWith('Resumen')), 'the shell is in Spanish after a reload')
      await handle.checkOverflow()
      await ctx.screenshot(page, '1-spanish')

      await openChoices(page, ctx.viewport, { header: 'País', menu: 'Abrir el menú de perfil', row: 'País' })
      await clickText(page, 'Polonia', 'button')
      await page.waitForNetworkIdle()
      await page.reload({ waitUntil: 'networkidle0' })
      if (ctx.viewport === 'M') await page.click('header button[aria-label="Abrir el menú de perfil"]')
      ctx.check((await bodyText(page)).includes('Polonia'), 'Poland is kept after a reload')
      ctx.check(await page.evaluate(() => document.documentElement.lang === 'es'), 'an explicit language survives a country change')
      await ctx.screenshot(page, '2-poland')
      ctx.assertClean(handle.issues, 'signed-in choices')

      const anonymous = await ctx.newPage()
      await anonymous.page.goto(`${ctx.webUrl}/sign-in`, { waitUntil: 'networkidle0' })
      await anonymous.page.select('form select, label select', 'fr')
      await anonymous.page.waitForFunction(() => document.documentElement.lang === 'fr')
      await anonymous.page.reload({ waitUntil: 'networkidle0' })
      ctx.check(await anonymous.page.evaluate(() => document.documentElement.lang === 'fr'), 'the anonymous choice is kept after a reload')
      ctx.check((await bodyText(anonymous.page)).includes('Bon retour parmi nous.'), 'the sign-in page is in French')
      await ctx.screenshot(anonymous.page, '3-anonymous-french')
      ctx.assertClean(anonymous.issues, 'anonymous picker')
    } finally {
      const { language, languageExplicit, pickerCountry } = before
      await db('users', 'updateMany', { filter: { email: emma }, update: { $set: { language, languageExplicit, pickerCountry } } })
    }
  },
}
