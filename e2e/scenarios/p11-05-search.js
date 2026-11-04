import { onboardedCandidate } from '../lib/candidates.js'
import { fill, responseTo, signInWithForm, waitForSettled, waitForText } from '../lib/flows.js'
import { db } from '../lib/testApi.js'

const shown = (page, selector) => page.$$eval(selector, (elements) => elements.map((element) => element.innerText.trim()))

/**
 * P11-05 (M-194, Phase 11 task 2): searches ignore accents. A French candidate finds "Paramètres" in the global search
 * by typing "parametres" (Enter opens it); Help finds the French answers by "parametres" and "verification"; an
 * admin finds "Zoë Ångström" in Candidates by "zoe angstrom" (the server filter).
 */
export default {
  name: 'P11-05 Search',
  viewports: ['D'],
  async run(ctx) {
    const alexEmail = ctx.seedCredentials.email('alex')
    const [alex] = await db('users', 'find', { filter: { email: alexEmail } })
    await db('users', 'updateMany', { filter: { email: alexEmail }, update: { $set: { language: 'fr', languageExplicit: true } } })
    try {
      const handle = await ctx.newPage()
      const { page } = handle
      await signInWithForm(page, ctx.webUrl, '/sign-in', alexEmail, ctx.seedCredentials.password)
      await page.keyboard.down('Control')
      await page.keyboard.press('k')
      await page.keyboard.up('Control')
      await page.waitForSelector('#global-search-input', { visible: true })
      await page.type('#global-search-input', 'parametres')
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] li button')].some((button) => button.innerText.includes('Paramètres')))
      const results = await shown(page, '[role="dialog"] li button')
      ctx.check(results.length === 1 && results[0].startsWith('Paramètres'), `"parametres" finds only Paramètres (${results.join(', ')})`)
      await ctx.screenshot(page, '1-global-search')
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => location.pathname.startsWith('/candidate/settings'))
      ctx.note(`global search → ${await page.evaluate(() => location.pathname)}`)

      await page.goto(`${ctx.webUrl}/candidate/help`, { waitUntil: 'networkidle0' })
      await waitForSettled(page)
      for (const [query, expected] of [
        ['parametres', 'Paramètres'],
        ['verification', 'vérification'],
      ]) {
        await fill(page, 'main input', query)
        await waitForText(page, expected)
        const text = await page.$eval('main', (main) => main.innerText)
        ctx.check(!text.includes('Aucun sujet d’aide'), `Help "${query}" finds answers with "${expected}"`)
        await ctx.screenshot(page, `2-help-${query}`)
      }
      ctx.assertClean(handle.issues, 'candidate search')
    } finally {
      await db('users', 'updateMany', { filter: { email: alexEmail }, update: { $set: { language: alex.language, languageExplicit: alex.languageExplicit ?? false } } })
    }

    // The admin Candidates search runs on the server.
    const zoe = await onboardedCandidate(`Accents${ctx.viewport}`, { fullName: 'Zoë Ångström' })
    const admin = await ctx.newPage()
    await signInWithForm(admin.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await admin.page.goto(`${ctx.webUrl}/admin/candidates`, { waitUntil: 'networkidle0' })
    await waitForSettled(admin.page)
    const searched = responseTo(admin.page, ['/admin/users', 'q=zoe'])
    await fill(admin.page, 'main input[type="search"], main input', 'zoe angstrom')
    const body = await (await searched).json()
    ctx.check(body.items?.some((row) => row.email === zoe.email || row.fullName === 'Zoë Ångström'), `"zoe angstrom" finds Zoë Ångström (${body.items?.length} rows)`)
    await waitForText(admin.page, 'Zoë Ångström')
    await ctx.screenshot(admin.page, '3-admin-candidates')
    ctx.assertClean(admin.issues, 'admin search')
  },
}
