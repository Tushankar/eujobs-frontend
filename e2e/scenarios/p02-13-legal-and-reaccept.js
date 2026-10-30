import { bodyText, clickText, signInWithForm } from '../lib/flows.js'
import { date, db } from '../lib/testApi.js'

const NEXT_VERSION = '2026-12-e2e'

/**
 * P2-13 (M-191, OD12, U22): /legal/terms shows the draft banner and follows the language; a newer Terms
 * version blocks the next sign-in with a dialog that only Accept (or sign-out) closes.
 */
export default {
  name: 'P2-13 Legal and re-accept',
  viewports: ['D', 'M'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    await page.goto(`${ctx.webUrl}/legal/terms`, { waitUntil: 'networkidle0' })
    ctx.check((await bodyText(page)).includes('Draft: this text is not final'), 'draft banner shown')
    await page.select('header select', 'es')
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Condiciones del servicio')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-terms-spanish')
    ctx.assertClean(handle.issues, 'legal page')

    const emma = ctx.seedCredentials.email('emma')
    const [before] = await db('users', 'find', { filter: { email: emma } })
    await db('legaldocuments', 'insertOne', {
      doc: { doc: 'terms', version: NEXT_VERSION, language: 'en', title: 'Terms of Service', bodyHtml: '<p>Updated.</p>', isDraft: true, publishedAt: date(Date.now()) },
    })
    try {
      const member = await ctx.newPage()
      await signInWithForm(member.page, ctx.webUrl, '/sign-in', emma, ctx.seedCredentials.password)
      await member.page.waitForFunction(() => document.querySelector('[role="dialog"]')?.innerText.includes('updated our terms'))
      ctx.check(!(await member.page.$('[role="dialog"] button[aria-label="Close dialog"]')), 'the dialog has no close button')
      await member.page.keyboard.press('Escape')
      ctx.check(await member.page.$('[role="dialog"]'), 'Escape does not close it')
      await member.checkOverflow()
      await ctx.screenshot(member.page, '2-reaccept-dialog')
      await clickText(member.page, 'Accept and continue', 'button')
      await member.page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
      const [after] = await db('users', 'find', { filter: { email: emma } })
      ctx.check(after.legal.termsVersion === NEXT_VERSION, `accepted version ${after.legal.termsVersion}`)
      await ctx.screenshot(member.page, '3-accepted')
      ctx.assertClean(member.issues, 're-accept')
    } finally {
      await db('legaldocuments', 'deleteMany', { filter: { version: NEXT_VERSION } })
      await db('users', 'updateMany', { filter: { email: emma }, update: { $set: { legal: before.legal } } })
    }
  },
}
