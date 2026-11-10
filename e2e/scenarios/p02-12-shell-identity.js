import { bodyText, clickText, pageApi, signInWithForm } from '../lib/flows.js'

/**
 * P2-12 (M-195, M-197, M-138; the bell per P11b-Q2): identity from /me (name, email, plan or role subtitle, photo or
 * initials), no workspace switch, the bell as a dropdown button whose count is the account's unread notifications (Emma's
 * seeded unread messages, P11b-Q13), the footer, and a
 * scrolling country list at 375 px.
 */
export default {
  name: 'P2-12 Shell identity',
  viewports: ['D', 'M'],
  async run(ctx) {
    const emma = ctx.seedCredentials.email('emma')
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', emma, ctx.seedCredentials.password)

    await page.click('header button[aria-label="Open profile menu"]')
    const menu = await bodyText(page)
    // §3.20: Emma is the seeded Plus subscriber (a real Stripe subscription since Phase 5).
    ctx.check(menu.includes('Emma Wilson') && menu.includes(emma) && menu.includes('Plus'), 'profile menu: name, email and the Plus plan')
    // M-195: Emma has had a seeded photo since Phase 3 (P3-D12); the Owner below shows initials.
    ctx.check(await page.$('header img[alt="Emma Wilson"][src*="/api/v1/files/"]'), 'photo avatar in the header')
    if (ctx.viewport === 'D') {
      const sidebar = await page.$eval('aside', (aside) => aside.innerText)
      ctx.check(sidebar.includes('Emma Wilson') && sidebar.includes('Plus'), 'sidebar identity block')
    } else {
      await clickText(page, 'Country', 'button')
      const scrolls = await page.$$eval('[class*="scroll"]', (lists) => lists.some((list) => list.scrollHeight > list.clientHeight + 10))
      ctx.check(scrolls, 'the country list scrolls inside the menu at 375 px')
    }
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-candidate-menu')

    ctx.check(!(await page.$('[aria-label="Switch workspace"]')), 'no workspace switch')
    // P11b-Q2 (supersedes M-093, OD6): the bell opens the notifications dropdown and shows the unread count.
    const { unread } = (await pageApi(page, '/me/counters')).body.notifications
    await page.waitForFunction((wanted) => Number(document.querySelector('header [data-bell] [data-bell-count]')?.textContent ?? 0) === wanted, { timeout: 20_000 }, unread)
    const bell = await page.$eval('header [data-bell]', (button) => ({ tag: button.tagName, popup: button.getAttribute('aria-haspopup') }))
    ctx.check(bell.tag === 'BUTTON' && bell.popup === 'true', `bell ${JSON.stringify(bell)}: a dropdown button showing ${unread} unread`)
    const footer = await page.$eval('footer', (element) => ({
      text: element.innerText,
      links: [...element.querySelectorAll('a')].map((link) => link.getAttribute('href')),
    }))
    ctx.check(footer.text.includes(`© ${new Date().getFullYear()} EU Jobs`), `footer text: ${footer.text}`)
    ctx.check(JSON.stringify(footer.links) === JSON.stringify(['/legal/terms', '/legal/privacy', '/legal/imprint']), `footer links ${footer.links}`)
    ctx.check(!/demo|saved on this device/i.test(footer.text), 'no demo footer note')
    ctx.assertClean(handle.issues, 'candidate shell')

    const owner = await ctx.newPage()
    await signInWithForm(owner.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(null), ctx.seedCredentials.password)
    await owner.page.click('header button[aria-label="Open profile menu"]')
    const ownerMenu = await owner.page.$eval('header', (header) => header.innerText)
    ctx.check(ownerMenu.includes('Workspace admin') && ownerMenu.includes('Owner'), 'the Owner subtitle')
    ctx.check(!(await owner.page.$('header button[aria-label="Country"]')), 'admins have no country picker')
    const initials = await owner.page.$eval('header [role="img"][aria-label="Workspace admin"]', (avatar) => avatar.textContent)
    ctx.check(initials === 'WA', `the Owner's initials avatar ${initials}`)
    await ctx.screenshot(owner.page, '2-owner-menu')
    ctx.assertClean(owner.issues, 'owner shell')
  },
}
