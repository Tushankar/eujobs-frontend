import { openAsAdmin } from '../lib/admins.js'
import { waitForPath } from '../lib/flows.js'

// TEMPORARY (not part of `run.js all`): ScrollToTop after its move to app/ScrollToTop.jsx. A query-only change (a URL
// filter) keeps the scroll position; a new path opens at the top.
export default {
  name: 'ZZ scroll probe',
  viewports: ['M'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    await openAsAdmin(ctx, handle, ctx.seedCredentials.email(null), '/admin/candidates', ctx.seedCredentials.password)
    await page.evaluate(() => window.scrollTo(0, 400))
    const before = await page.evaluate(() => window.scrollY)
    ctx.check(before > 0, `the page scrolled (${before})`)
    const filter = await page.$$eval('main select[name]', (selects) => selects.map((select) => ({ name: select.name, value: select.options[1]?.value })).find((item) => item.value))
    ctx.check(Boolean(filter), 'a URL filter select exists')
    const search = await page.evaluate(() => location.search)
    await page.select(`main select[name="${filter.name}"]`, filter.value)
    await page.waitForFunction((old) => location.search !== old, {}, search)
    await new Promise((resolve) => setTimeout(resolve, 500))
    const after = await page.evaluate(() => [location.search, window.scrollY])
    ctx.note(`filter ${filter.name}=${filter.value}: ${after[0]}, scrollY ${before} -> ${after[1]}`)
    ctx.check(after[1] > 0, `a query change keeps the scroll (${after[1]})`)
    await page.click('[aria-controls="workspace-sidebar"]')
    await page.waitForSelector('#workspace-sidebar a[href="/admin/recruiters"]', { visible: true })
    await page.click('#workspace-sidebar a[href="/admin/recruiters"]')
    await waitForPath(page, '/admin/recruiters')
    await new Promise((resolve) => setTimeout(resolve, 500))
    const top = await page.evaluate(() => window.scrollY)
    ctx.note(`new path /admin/recruiters: scrollY ${top}`)
    ctx.check(top === 0, `a new path opens at the top (${top})`)
  },
}
