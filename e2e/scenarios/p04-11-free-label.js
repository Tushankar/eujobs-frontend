import { clickText, pageApi, signInWithForm } from '../lib/flows.js'

/**
 * P4-11 (M-050, M-052, M-053 with U8): job cards show the skill-overlap label and never a percentage; For you lists
 * jobs sharing at least one required skill, by overlap and then recency.
 */
export default {
  name: 'P4-11 Free label',
  viewports: ['D'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/candidate/jobs`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('article[data-job]')
    const cards = await page.$$eval('article[data-job]', (items) => items.map((item) => item.innerText))
    ctx.check(cards.every((text) => /\d+ of \d+ skills match/.test(text)), 'every card has the overlap label')
    ctx.check(cards.every((text) => !text.includes('%')), 'no card shows a percentage')
    await ctx.screenshot(page, '1-labels')

    const recommended = (await pageApi(page, '/jobs/recommended')).body.items
    const profile = (await pageApi(page, '/candidate/profile')).body
    const skills = new Set(profile.skills.map((skill) => skill.toLocaleLowerCase()))
    ctx.check(recommended.length > 0, 'Emma has recommendations')
    ctx.check(
      recommended.every((job) => job.requiredSkills.some((skill) => skills.has(skill.toLocaleLowerCase()))),
      'every For you job shares a required skill',
    )
    ctx.check(
      recommended.every((job, index) => index === 0 || recommended[index - 1].overlap.count > job.overlap.count || (recommended[index - 1].overlap.count === job.overlap.count && recommended[index - 1].publishedAt >= job.publishedAt)),
      'ordered by overlap, then recency',
    )

    await page.goto(`${ctx.webUrl}/candidate`, { waitUntil: 'networkidle0' })
    await clickText(page, 'For you', 'button')
    await page.waitForSelector('article[data-job]')
    const shown = await page.$$eval('article[data-job]', (items) => items.map((item) => item.dataset.job))
    ctx.check(JSON.stringify(shown) === JSON.stringify(recommended.slice(0, 3).map((job) => job.id)), 'the Overview For you tab shows the top three')
    const overview = (await pageApi(page, '/candidate/overview')).body
    // The KPI counts up to its value, so wait for it.
    await page.waitForFunction((count) => document.querySelector('[data-stat="recommended"]').innerText.includes(String(count)), {}, overview.recommended.count)
    await ctx.screenshot(page, '2-for-you')
    ctx.assertClean(handle.issues, 'free label')
  },
}
