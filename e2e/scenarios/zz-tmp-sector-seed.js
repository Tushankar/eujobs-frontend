import { bodyText, signInWithForm } from '../lib/flows.js'

/** Temporary (2026-11-26): looks at the seeded sector jobs and agencies in the real UI. Delete after the check. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 1500))

export default {
  name: 'TMP sector seed look',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { email, password } = { email: ctx.seedCredentials.email, password: ctx.seedCredentials.password }

    // Public: landing sectors and agency jobs, /jobs with a sector and the Agency tab.
    const visitor = await ctx.newPage(null)
    const { page } = visitor
    await page.goto(ctx.webUrl, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-landing-sectors] [data-sector-link]')
    const sectors = await page.$$eval('[data-sector-link]', (links) => links.map((link) => link.innerText.replace(/\s+/g, ' ')))
    ctx.note(`landing sectors (${sectors.length}): ${sectors.join(' | ')}`)
    ctx.check(sectors.length === 18, 'the landing lists all 18 sectors')
    await page.$eval('[data-landing-sectors]', (section) => section.scrollIntoView({ block: 'start' }))
    await settle()
    await ctx.screenshot(page, '1-landing-sectors')
    for (const sector of ['charity_nonprofit', 'construction_trades']) {
      await page.goto(`${ctx.webUrl}/jobs?sector=${sector}`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-row]')
      const rows = await page.$$eval('[data-row]', (items) => items.map((item) => item.innerText.split('\n')[0]))
      ctx.note(`/jobs ${sector}: ${rows.join(' | ')}`)
      ctx.check(rows.length >= 3, `${sector} lists at least 3 jobs`)
      await settle()
      await ctx.screenshot(page, `2-jobs-${sector}`)
    }
    await page.goto(`${ctx.webUrl}/jobs?employmentType=agency`, { waitUntil: 'networkidle0' })
    await settle()
    await ctx.screenshot(page, '3-jobs-agency')
    await visitor.checkOverflow()
    ctx.assertClean(visitor.issues, 'public pages')

    // Priya, Northbridge Staffing.
    const agency = await ctx.newPage()
    await signInWithForm(agency.page, ctx.webUrl, '/agencies/login', email('priya'), password)
    for (const [path, wanted, shot] of [
      ['/agency', 'Northbridge', '4-agency-overview'],
      ['/agency/jobs', 'Agency Nurse, Acute Medicine', '5-agency-jobs'],
      ['/agency/clients', 'Halden Digital', '6-agency-clients'],
      ['/agency/talent', 'Oliver Park', '7-agency-talent'],
      ['/agency/talent?tab=requests', 'Aisha Patel', '8-agency-requests'],
      ['/agency/placements', 'Interim Lead Product Designer', '9-agency-placements'],
    ]) {
      await agency.page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
      await settle()
      ctx.check((await bodyText(agency.page)).includes(wanted), `${path} shows ${wanted}`)
      await ctx.screenshot(agency.page, shot)
    }
    await agency.checkOverflow()
    ctx.assertClean(agency.issues, 'agency pages')

    // Emma: her upcoming Northbridge placement.
    const emma = await ctx.newPage()
    await signInWithForm(emma.page, ctx.webUrl, '/sign-in', email('emma'), password)
    await emma.page.goto(`${ctx.webUrl}/candidate/agencies`, { waitUntil: 'networkidle0' })
    await settle()
    ctx.check((await bodyText(emma.page)).includes('Contract Senior Product Designer'), 'Emma sees her upcoming placement')
    await ctx.screenshot(emma.page, '10-candidate-agencies')
    await emma.page.goto(`${ctx.webUrl}/candidate/jobs?sector=healthcare`, { waitUntil: 'networkidle0' })
    await settle()
    await ctx.screenshot(emma.page, '11-candidate-find-healthcare')
    await emma.checkOverflow()
    ctx.assertClean(emma.issues, 'candidate pages')
  },
}
