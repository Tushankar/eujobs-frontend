import { openAsAdmin, sidebarLabels, systemRole } from '../lib/admins.js'
import { clickText, fill, responseTo, signInWithForm, waitForPath, waitForSettled, waitForText } from '../lib/flows.js'
import { api, linkToken, TEST_PASSWORD, uniqueEmail } from '../lib/testApi.js'

// The Staff role: users.view and candidates.view (§3.13), so these pages and nothing else.
const STAFF_PAGES = ['Candidates', 'Recruiters', 'Applications', 'Recruitment']

/**
 * P10-01 (M-155, M-159, U21, OD16): the Owner invites a Staff admin from User access → the captured invite opens
 * /admin/set-password → the new admin signs in and lands on their first page; the sidebar and the search show only
 * the permitted pages. A direct URL to Payments shows the 403 page and the API answers PERMISSION_DENIED.
 */
export default {
  name: 'P10-01 Invite and permissions',
  viewports: ['D', 'M'],
  async run(ctx) {
    const owner = await ctx.newPage()
    await openAsAdmin(ctx, owner, ctx.seedCredentials.email(null), '/admin/access-management/users', ctx.seedCredentials.password)
    const { page } = owner
    await clickText(page, 'Invite admin', 'a')
    await page.waitForSelector('[role="dialog"] input[name="email"]')
    const email = uniqueEmail(`p1001${ctx.viewport.toLowerCase()}`)
    const fullName = `Nia Staff ${ctx.viewport}`
    await fill(page, '[role="dialog"] input[name="fullName"]', fullName)
    await fill(page, '[role="dialog"] input[name="email"]', email)
    const staff = await systemRole('Staff')
    await page.select('[role="dialog"] select[name="roleId"]', staff.id)
    await owner.checkOverflow()
    await ctx.screenshot(page, '1-invite-dialog')
    const sent = responseTo(page, '/api/v1/admin/invitations', 'POST')
    await clickText(page, 'Send invitation', '[role="dialog"] button')
    ctx.check((await sent).status() === 201, 'the invite is created')
    await waitForText(page, `An invitation was sent to ${email}`)
    await page.waitForFunction((name) => document.querySelector('main table').innerText.includes(name) && document.querySelector('main table').innerText.includes('Invited'), {}, fullName)
    await ctx.screenshot(page, '2-invited-row')
    ctx.assertClean(owner.issues, 'invite')

    // The invite link, in a fresh browser session.
    const link = await linkToken(email, 'admin_invite')
    ctx.check(link.pathname === '/admin/set-password', `the link opens /admin/set-password (${link.pathname})`)
    const invitee = await ctx.newPage()
    await invitee.page.goto(`${ctx.webUrl}${link.pathname}${link.search}`, { waitUntil: 'networkidle0' })
    await waitForText(invitee.page, email)
    await fill(invitee.page, 'input[name="password"]', TEST_PASSWORD)
    await fill(invitee.page, 'input[name="confirmPassword"]', TEST_PASSWORD)
    await invitee.checkOverflow()
    await ctx.screenshot(invitee.page, '3-set-password')
    await clickText(invitee.page, 'Set password', 'button')
    await waitForText(invitee.page, 'Your admin account is ready.')
    await clickText(invitee.page, 'Sign in', 'a')
    await waitForPath(invitee.page, '/admin/sign-in')

    await signInWithForm(invitee.page, ctx.webUrl, '/admin/sign-in', email, TEST_PASSWORD)
    ctx.check(new URL(invitee.page.url()).pathname === '/admin/candidates', `lands on the first permitted page (${invitee.page.url()})`)
    const labels = await sidebarLabels(invitee.page)
    ctx.check(JSON.stringify(labels) === JSON.stringify(STAFF_PAGES), `the sidebar shows only ${STAFF_PAGES.join(', ')} (got ${labels.join(', ')})`)
    await invitee.checkOverflow()
    await ctx.screenshot(invitee.page, '4-staff-workspace')

    // Search lists the same pages (plus Settings and Help).
    await invitee.page.keyboard.down('Control')
    await invitee.page.keyboard.press('k')
    await invitee.page.keyboard.up('Control')
    await invitee.page.waitForSelector('#global-search-input')
    const found = await invitee.page.$$eval('[role="dialog"] ul button', (buttons) => buttons.map((button) => button.textContent.trim()))
    ctx.check(JSON.stringify(found) === JSON.stringify([...STAFF_PAGES, 'Settings', 'Help']), `search shows only permitted pages (got ${found.join(', ')})`)
    await ctx.screenshot(invitee.page, '5-search')
    await invitee.page.keyboard.press('Escape')

    // A direct URL to Payments → the 403 page; the API refuses the data too.
    await invitee.page.goto(`${ctx.webUrl}/admin/payments`, { waitUntil: 'networkidle0' })
    await invitee.page.waitForSelector('[data-forbidden="finance.view"]')
    await waitForSettled(invitee.page)
    ctx.check((await invitee.page.$eval('[data-forbidden]', (panel) => panel.innerText)).includes('View finance'), 'the 403 page names the permission')
    await invitee.checkOverflow()
    await ctx.screenshot(invitee.page, '6-forbidden')
    const { token } = (await api('/auth/login', { method: 'POST', body: { email, password: TEST_PASSWORD, portal: 'admin' } })).body
    const refused = await api('/admin/payments', { token })
    ctx.check(refused.status === 403 && refused.body.error.code === 'PERMISSION_DENIED' && refused.body.error.params.permission === 'finance.view', `the API answers PERMISSION_DENIED (got ${refused.status} ${JSON.stringify(refused.body)})`)
    ctx.assertClean(invitee.issues, 'invited admin')
  },
}
