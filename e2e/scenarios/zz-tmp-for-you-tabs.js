import { freeCandidate, openAs } from '../lib/payments.js'

/** Temporary (2026-11-25): Overview For you → Recently added → For you; what each tab shows. Delete after the fix. */
async function panel(page) {
  await new Promise((resolve) => setTimeout(resolve, 2500))
  return page.$eval('[role="tabpanel"]', (box) => ({
    cards: box.querySelectorAll('[data-job]').length,
    empty: box.querySelector('[data-for-you]')?.dataset.forYou ?? null,
    skeleton: Boolean(box.querySelector('[aria-busy="true"], [class*="skeleton"]')),
    text: box.innerText.replace(/\s+/g, ' ').slice(0, 160),
  }))
}

async function clickTab(page, name) {
  const tabs = await page.$$('[role="tab"]')
  for (const tab of tabs) if ((await tab.evaluate((el) => el.innerText.trim())) === name) return tab.click()
  throw new Error(`no tab ${name}`)
}

export default {
  name: 'TMP For you tabs',
  viewports: ['D'],
  async run(ctx) {
    const people = [['emma', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password]]
    const fresh = await freeCandidate('tabs', 'GB')
    people.push(['fresh', fresh.email, undefined])
    for (const [who, email, password] of people) {
      const handle = await ctx.newPage()
      const { page } = handle
      const calls = []
      page.on('response', (response) => {
        const url = response.url()
        if (url.includes('/api/v1/jobs')) calls.push(`${response.status()} ${url.replace(/^.*\/api\/v1/, '')}`)
      })
      await openAs(ctx, handle, email, '/candidate', password)
      ctx.note(`${who} load: ${JSON.stringify(await panel(page))}`)
      await clickTab(page, 'Recently added')
      ctx.note(`${who} recent: ${JSON.stringify(await panel(page))}`)
      await clickTab(page, 'For you')
      ctx.note(`${who} for you again: ${JSON.stringify(await panel(page))}`)
      ctx.note(`${who} calls: ${calls.join(' | ')}`)
      await ctx.screenshot(page, `${who}-for-you-again`)
    }
  },
}
