import { invitedAdmin, openAsAdmin, systemRole } from '../lib/admins.js'
import { clickText, waitForText } from '../lib/flows.js'
import { api, db } from '../lib/testApi.js'

/**
 * P10-03 (M-160): the Owner cannot be revoked (no action in the table, OWNER_PROTECTED from the API), and an admin
 * with `roles.assign` cannot remove their own `roles.assign`; nothing changes in the database.
 */
export default {
  name: 'P10-03 Lock-out',
  viewports: ['D'],
  async run(ctx) {
    const manager = await systemRole('Manager')
    const admin = await invitedAdmin('Manager', manager.id)
    const [owner] = await db('users', 'find', { filter: { isOwner: true } })

    const ownerRevoke = await api(`/admin/access/users/${owner._id}`, { method: 'DELETE', token: admin.token })
    ctx.check(ownerRevoke.status === 409 && ownerRevoke.body.error.params.reason === 'owner', `revoking the Owner → OWNER_PROTECTED (got ${JSON.stringify(ownerRevoke.body)})`)

    const handle = await ctx.newPage()
    const { page } = handle
    await openAsAdmin(ctx, handle, admin.email, '/admin/access-management/users')
    await page.waitForSelector('main table')
    const ownerRow = await page.$$eval('main table tbody tr', (rows) => rows.find((row) => row.innerText.includes('Workspace admin'))?.innerText)
    ctx.check(ownerRow?.includes('Owner') && ownerRow.includes('All permissions'), `the Owner row reads Owner, All permissions (${ownerRow})`)
    ctx.check(!(await page.$('main table a[aria-label="Manage access for Workspace admin"]')), 'the Owner row has no Manage access')
    await ctx.screenshot(page, '1-owner-row')

    // Own access: untick "Assign roles" → the server refuses and the dialog says why.
    await page.click(`main table a[aria-label="Manage access for ${admin.fullName}"]`)
    await page.waitForSelector('[role="dialog"] input[data-permission="roles.assign"]')
    await page.click('[role="dialog"] input[data-permission="roles.assign"]')
    await clickText(page, 'Save assignment', '[role="dialog"] button')
    // The access dialog closes (its exit animation keeps it mounted a moment) and the confirm opens.
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].map((dialog) => dialog.innerText).join('|').startsWith('Save access for') && document.querySelectorAll('[role="dialog"]').length === 1)
    handle.allow(409, '/api/v1/admin/access/users/')
    await clickText(page, 'Save assignment', '[role="dialog"] button')
    await waitForText(page, 'You can’t remove your own “Assign roles” permission.')
    await ctx.screenshot(page, '2-own-roles-assign')
    const [stored] = await db('users', 'find', { filter: { email: admin.email } })
    ctx.check(stored.adminAccess.removed.length === 0, 'the access is unchanged')
    ctx.assertClean(handle.issues, 'lock-out')
  },
}
