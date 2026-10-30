import { bodyText, clickText, signInWithForm } from '../lib/flows.js'

/**
 * P2-12 (M-195, M-093, M-197, M-138): identity from /me (name, email, plan or role subtitle, photo or initials),
 * no workspace switch, a bell without a dot that opens notification settings, the footer, and a
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
    ctx.check(menu.includes('Emma Wilson') && menu.includes(emma) && menu.includes('Free'), 'profile menu: name, email and the Free plan')
    // M-195: Emma has had a seeded photo since Phase 3 (P3-D12); the Owner below shows initials.
    ctx.check(await page.$('header img[alt="Emma Wilson"][src*="/api/v1/files/"]'), 'photo avatar in the header')
    if (ctx.viewport === 'D') {
      const sidebar = await page.$eval('aside', (aside) => aside.innerText)
      ctx.check(sidebar.includes('Emma Wilson') && sidebar.includes('Free'), 'sidebar identity block')
    } else {
      await clickText(page, 'Country', 'button')
      const scrolls = await page.$$eval('[class*="scroll"]', (lists) => lists.some((list) => list.scrollHeight > list.clientHeight + 10))
      ctx.check(scrolls, 'the country list scrolls inside the menu at 375 px')
    }
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-candidate-menu')

    ctx.check(!(await page.$('[aria-label="Switch workspace"]')), 'no workspace switch')
    const bell = await page.$eval('header a[aria-label="Notification settings"]', (link) => ({
      href: link.getAttribute('href'),
      extras: link.parentElement.children.length,
    }))
    ctx.check(bell.href === '/candidate/settings/notifications' && bell.extras === 1, `bell ${JSON.stringify(bell)}: links to settings, no dot`)
    const footer = await page.$eval('footer', (element) => ({
      text: element.innerText,
      links: [...element.querySelectorAll('a')].map((link) => link.getAttribute('href')),
    }))
    ctx.check(footer.text.includes(`© ${new Date().getFullYear()} Local WorkMan`), `footer text: ${footer.text}`)
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
