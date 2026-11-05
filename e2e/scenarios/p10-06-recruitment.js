import { openAsAdmin } from '../lib/admins.js'
import { clickText, responseTo, waitForPath } from '../lib/flows.js'
import { db } from '../lib/testApi.js'

const CATEGORIES = ['applied', 'screening', 'shortlisted', 'interview', 'offer', 'hired']
const LABELS = { applied: 'Applied', screening: 'Screening', shortlisted: 'Shortlisted', interview: 'Interview', offer: 'Offer', hired: 'Hired' }
const idOf = (value) => value?.$oid ?? value

/** Independent counts from /_test/db: current category per non-withdrawn application, and categories ever reached. */
async function expected() {
  const [applications, stages] = await Promise.all([db('applications', 'find', { filter: { status: { $ne: 'withdrawn' } } }), db('pipelinestages', 'find', { filter: {} })])
  const categoryOf = new Map(stages.map((stage) => [idOf(stage._id), stage.category]))
  const current = Object.fromEntries(CATEGORIES.map((category) => [category, 0]))
  const reached = Object.fromEntries(CATEGORIES.map((category) => [category, 0]))
  for (const application of applications) {
    current[categoryOf.get(idOf(application.stageId))] += 1
    for (const category of new Set(application.history.map((step) => step.category).filter(Boolean))) reached[category] += 1
  }
  return { current, reached, total: applications.length }
}

/**
 * P10-06 (M-178, M-179, OD5, P10-Q13): the data view shows the applications per category at their current stage; the
 * funnel shows the applications that ever reached each category, withdrawn ones excluded, in the fixed Figma shapes;
 * choosing a category filters the movement rows to it.
 */
export default {
  name: 'P10-06 Recruitment',
  viewports: ['D'],
  async run(ctx) {
    const want = await expected()
    ctx.check(want.total > 0 && Object.values(want.reached).filter(Boolean).length > 1, `the seed has applications across stages (${JSON.stringify(want.reached)})`)
    const handle = await ctx.newPage()
    const { page } = handle
    await openAsAdmin(ctx, handle, ctx.seedCredentials.email(null), '/admin/recruitment', ctx.seedCredentials.password)
    await page.waitForSelector('[data-stage="applied"]')

    const cards = await page.$$eval('[data-stage]', (items) => items.map((item) => [item.dataset.stage, Number(item.lastElementChild.textContent)]))
    ctx.check(JSON.stringify(Object.fromEntries(cards)) === JSON.stringify(want.current), `stage counts ${JSON.stringify(Object.fromEntries(cards))} = ${JSON.stringify(want.current)}`)
    const rows = await page.$$('[data-movement-row]')
    ctx.check(rows.length === want.total, `one movement row per non-withdrawn application (${rows.length} of ${want.total})`)
    await ctx.screenshot(page, '1-data-view')

    // A category filters the movement rows.
    const busiest = CATEGORIES.reduce((best, category) => (want.current[category] > want.current[best] ? category : best), 'applied')
    await page.click(`[data-stage="${busiest}"]`)
    await page.waitForFunction((count) => document.querySelectorAll('[data-movement-row]').length === count, {}, want.current[busiest])
    ctx.check((await page.$eval('main', (main) => main.innerText)).includes(`Showing applications at the ${LABELS[busiest]} stage`), 'the filter is announced')
    await ctx.screenshot(page, '2-filtered')

    const funnel = responseTo(page, '/api/v1/admin/recruitment')
    await clickText(page, 'Funnel view', 'main button, main a')
    await waitForPath(page, '/admin/recruitment/funnel')
    await funnel.catch(() => null)
    await page.waitForSelector('[data-funnel="applied"]')
    const steps = await page.$$eval('[data-funnel]', (items) => items.map((item) => [item.dataset.funnel, Number(item.querySelectorAll('text')[1].textContent)]))
    ctx.check(JSON.stringify(Object.fromEntries(steps)) === JSON.stringify(want.reached), `funnel ${JSON.stringify(Object.fromEntries(steps))} = ${JSON.stringify(want.reached)}`)
    // M-179: the Figma shapes do not scale with the numbers.
    const radii = await page.$$eval('[data-funnel]', (items) => items.map((item) => Number(item.querySelector('ellipse').getAttribute('rx')).toFixed(2)))
    ctx.check(radii.join() === '81.20,87.90,66.55,51.95,39.95,32.00', `the funnel keeps its fixed shapes (${radii})`)
    await page.click('[data-funnel="applied"]')
    await page.waitForFunction((count) => document.querySelectorAll('[data-movement-row]').length === count, {}, want.current.applied)
    await ctx.screenshot(page, '3-funnel')
    ctx.assertClean(handle.issues, 'recruitment')
  },
}
