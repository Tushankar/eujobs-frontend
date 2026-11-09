import { completeCandidate } from '../lib/applicants.js'
import { signInWithForm } from '../lib/flows.js'
import { approvedRecruiter } from '../lib/recruiters.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Temporary: Settings › Billing (Free / Plus comparison) and the sidebar Plus card, at the owner's 1366px window. */
async function shoot(ctx, email, signIn, path, name) {
  const handle = await ctx.newPage()
  const { page } = handle
  if (ctx.viewport === 'D') await page.setViewport({ width: 1366, height: 768 })
  await signInWithForm(page, ctx.webUrl, signIn, email, TEST_PASSWORD)
  await page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-billing-state]', { visible: true, timeout: 20_000 })
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), { timeout: 15_000 }).catch(() => {})
  await pause(900)
  await handle.checkOverflow()
  await page.$eval('[data-billing-state]', (element) => element.scrollIntoView({ block: 'start' }))
  await page.evaluate(() => window.scrollBy(0, -200))
  await pause(300)
  await ctx.screenshot(page, `${name}-plans`)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await pause(300)
  await ctx.screenshot(page, `${name}-history`)
  if (ctx.viewport === 'D' && (await page.$('[data-promo="upsell"]'))) {
    await page.$eval('#workspace-sidebar', (element) => element.scrollTo(0, element.scrollHeight))
    await pause(300)
    const box = await (await page.$('[data-promo="upsell"]')).boundingBox()
    await page.screenshot({ path: `${ctx.shotsDir ?? 'e2e/artifacts'}/zz-promo.png`, clip: { x: 0, y: Math.max(0, box.y - 40), width: 240, height: box.height + 60 } }).catch(() => {})
    await ctx.screenshot(page, `${name}-sidebar`)
  }
  ctx.assertClean(handle.issues, name)
}

export default {
  name: 'ZZ billing look',
  viewports: ['D', 'M'],
  async run(ctx) {
    const free = await completeCandidate(`BillFree${ctx.viewport}`, { plus: false })
    await shoot(ctx, free.email, '/sign-in', '/candidate/settings/billing', '1-free')
    const plus = await completeCandidate(`BillPlus${ctx.viewport}`)
    await shoot(ctx, plus.email, '/sign-in', '/candidate/settings/billing', '2-plus')
    if (ctx.viewport !== 'D') return
    const recruiter = await approvedRecruiter(`BillRec${ctx.viewport}`, { plus: false })
    await shoot(ctx, recruiter.email, '/recruiter/sign-in', '/recruiter/settings/billing', '3-recruiter-free')
  },
}
