import { bodyText, clickText, fill, signInWithForm } from '../lib/flows.js'
import { api, db } from '../lib/testApi.js'

const NEW_PASSWORD = 'Velvet-Orchard-36'

/** P2-15 (M-010, M-199): a wrong current password is refused; the new one works at the next sign-in; admin Settings saves name and language. */
export default {
  name: 'P2-15 Change password',
  viewports: ['D'],
  async run(ctx) {
    const emma = ctx.seedCredentials.email('emma')
    const ownerEmail = ctx.seedCredentials.email(null)
    const [owner] = await db('users', 'find', { filter: { email: ownerEmail } })
    try {
      const handle = await ctx.newPage()
      handle.allow(422, '/api/v1/me/password')
      const { page } = handle
      await signInWithForm(page, ctx.webUrl, '/sign-in', emma, ctx.seedCredentials.password)
      await page.goto(`${ctx.webUrl}/candidate/settings/data-account`, { waitUntil: 'networkidle0' })
      await fill(page, 'input[name="currentPassword"]', 'Not-My-Password-1')
      await fill(page, 'input[name="newPassword"]', NEW_PASSWORD)
      await fill(page, 'input[name="confirmPassword"]', NEW_PASSWORD)
      await clickText(page, 'Change password', 'button')
      await page.waitForFunction(() => document.body.innerText.includes('This isn’t your current password.') || document.body.innerText.includes("This isn't your current password."))
      await ctx.screenshot(page, '1-wrong-current')

      await fill(page, 'input[name="currentPassword"]', ctx.seedCredentials.password)
      await fill(page, 'input[name="newPassword"]', NEW_PASSWORD)
      await fill(page, 'input[name="confirmPassword"]', NEW_PASSWORD)
      await clickText(page, 'Change password', 'button')
      await page.waitForFunction(() => document.body.innerText.includes('Your password has been changed.'))
      await ctx.screenshot(page, '2-changed')
      ctx.assertClean(handle.issues, 'candidate change password')

      const fresh = await ctx.newPage()
      await signInWithForm(fresh.page, ctx.webUrl, '/sign-in', emma, NEW_PASSWORD)
      ctx.check(new URL(fresh.page.url()).pathname === '/candidate', 'the new password signs in')

      const admin = await ctx.newPage()
      await signInWithForm(admin.page, ctx.webUrl, '/admin/sign-in', ownerEmail, ctx.seedCredentials.password)
      await admin.page.goto(`${ctx.webUrl}/admin/settings`, { waitUntil: 'networkidle0' })
      await fill(admin.page, 'input[name="fullName"]', 'Workspace admin E2E')
      await clickText(admin.page, 'Save name', 'button')
      await admin.page.waitForFunction(() => document.body.innerText.includes('Your name has been saved.'))
      ctx.check((await admin.page.$eval('aside', (aside) => aside.innerText)).includes('Workspace admin E2E'), 'the sidebar shows the new name')
      await admin.page.select('select[name="language"]', 'es')
      await admin.page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Configuración')
      await ctx.screenshot(admin.page, '3-admin-settings-spanish')
      ctx.check(!(await bodyText(admin.page)).match(/notificaciones por correo|email updates/i), 'no email preferences for admins')
      ctx.assertClean(admin.issues, 'admin settings')
    } finally {
      const signedIn = await api('/auth/login', { method: 'POST', body: { email: emma, password: NEW_PASSWORD, portal: 'candidate' } })
      if (signedIn.status === 200) {
        await api('/me/password', { method: 'POST', token: signedIn.body.token, body: { currentPassword: NEW_PASSWORD, newPassword: ctx.seedCredentials.password } })
      }
      await db('users', 'updateMany', { filter: { email: ownerEmail }, update: { $set: { fullName: owner.fullName, language: owner.language, languageExplicit: owner.languageExplicit } } })
    }
  },
}
