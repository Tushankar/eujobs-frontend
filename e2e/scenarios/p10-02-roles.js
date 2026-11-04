import { invitedAdmin, openAsAdmin } from '../lib/admins.js'
import { clickText, fill, responseTo, waitForText } from '../lib/flows.js'
import { ownerToken } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

const dialogError = (page) => page.$eval('[role="dialog"]', (dialog) => dialog.innerText)
const card = (name) => `article[data-role="${name}"]`

/**
 * P10-02 (M-157, M-158): a 41-character name, a taken name in any case and no permission are each refused; a role is
 * created, duplicated and edited through the prefilled dialog. Archiving a role with an admin assigned is blocked;
 * an unused role is archived.
 */
export default {
  name: 'P10-02 Roles',
  viewports: ['D'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    await openAsAdmin(ctx, handle, ctx.seedCredentials.email(null), '/admin/access-management/roles/new', ctx.seedCredentials.password)
    await page.waitForSelector('[role="dialog"] input[name="name"]')

    // No permission: Save stays disabled and the hint asks for one; the API refuses it too.
    const save = '[role="dialog"] button[type="submit"]'
    ctx.check(await page.$eval(save, (button) => button.disabled), 'Save is disabled with 0 permissions')
    await waitForText(page, 'Choose at least one permission to save this role.')
    const none = await api('/admin/roles', { method: 'POST', token: await ownerToken(), body: { name: 'No permissions', scope: 'team', permissions: [] } })
    ctx.check(none.status === 422 && none.body.error.fields.permissions === 'too_few', `0 permissions → too_few (got ${JSON.stringify(none.body)})`)

    await page.click('[role="dialog"] input[data-permission="users.view"]')
    await fill(page, '[role="dialog"] input[name="name"]', 'x'.repeat(41))
    await page.click(save)
    await waitForText(page, 'Role name must be 40 characters or fewer.')
    await ctx.screenshot(page, '1-too-long')

    await fill(page, '[role="dialog"] input[name="name"]', 'mAnAgEr')
    const taken = responseTo(page, '/api/v1/admin/roles', 'POST')
    handle.allow(422, '/api/v1/admin/roles')
    await page.click(save)
    ctx.check((await taken).status() === 422, 'the server refuses a taken name')
    await waitForText(page, 'A role with this name already exists.')
    ctx.check((await dialogError(page)).includes('A role with this name already exists.'), 'the taken-name error shows')
    await ctx.screenshot(page, '2-taken')

    // A valid role.
    const name = `Ops desk ${Date.now() % 100000}`
    await fill(page, '[role="dialog"] input[name="name"]', name)
    await fill(page, '[role="dialog"] textarea[name="description"]', 'Supports the operations team with day-to-day reviews.')
    await page.click('[role="dialog"] input[data-permission="audit.view"]')
    await page.click(save)
    await waitForText(page, `Custom role “${name}” was created.`)
    await page.waitForSelector(card(name))
    ctx.check((await page.$eval(card(name), (element) => element.innerText)).includes('Custom'), 'the new role card is Custom')

    // Duplicate, then edit the copy through the prefilled dialog.
    await page.click(`${card(name)} button[aria-label="Duplicate ${name}"]`)
    const copy = `${name} (copy)`
    await page.waitForSelector(card(copy))
    await page.click(`${card(copy)} button[aria-label="Edit ${copy}"]`)
    await page.waitForSelector('[role="dialog"] input[name="name"]')
    ctx.check((await page.$eval('[role="dialog"] input[name="name"]', (input) => input.value)) === copy, 'the edit dialog is prefilled')
    ctx.check(await page.$eval('[role="dialog"] input[data-permission="audit.view"]', (input) => input.checked), 'the copy kept its permissions')
    const renamed = `${name} B`
    await fill(page, '[role="dialog"] input[name="name"]', renamed)
    await page.click('[role="dialog"] input[data-permission="finance.view"]')
    await ctx.screenshot(page, '3-edit')
    await page.click(save)
    await waitForText(page, `Role “${renamed}” was saved.`)
    const [stored] = await db('adminroles', 'find', { filter: { name: renamed } })
    ctx.check(JSON.stringify(stored.permissions.sort()) === JSON.stringify(['audit.view', 'finance.view', 'users.view']), `edited permissions saved (${stored.permissions})`)

    // Archive with an admin assigned → blocked; the unused copy → archived.
    const [original] = await db('adminroles', 'find', { filter: { name } })
    await invitedAdmin('Holder', original._id.$oid ?? String(original._id))
    await page.reload({ waitUntil: 'networkidle0' })
    handle.allow(409, '/archive')
    await page.click(`${card(name)} button[aria-label="Archive ${name}"]`)
    await clickText(page, 'Archive', '[role="dialog"] button')
    await waitForText(page, '1 admin still has this role. Assign them another role first.')
    await ctx.screenshot(page, '4-archive-blocked')
    await page.click(`${card(renamed)} button[aria-label="Archive ${renamed}"]`)
    await clickText(page, 'Archive', '[role="dialog"] button')
    await waitForText(page, `Role “${renamed}” was archived.`)
    await page.waitForFunction((selector) => document.querySelector(selector)?.innerText.includes('Archived'), {}, card(renamed))
    ctx.check(!(await page.$(`${card(renamed)} button`)), 'an archived role has no actions')
    await ctx.screenshot(page, '5-archived')
    ctx.assertClean(handle.issues, 'roles')
  },
}
