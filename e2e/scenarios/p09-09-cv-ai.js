import { fixture } from '../fixtures/make.js'
import { completeCandidate } from '../lib/applicants.js'
import { chooseFile, clickText, waitForText } from '../lib/flows.js'
import { openAs } from '../lib/payments.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

const profileOf = (token) => api('/candidate/profile', { token }).then((result) => result.body)
const versionsOf = (token) => api('/candidate/cv', { token }).then((result) => result.body.items)

/**
 * P9-09 (M-027, M-061, P9-Q3, P3-Q3): a Plus upload gets a snapshot proposal at once and the profile is unchanged until
 * Confirm; the dialog lists the changes; Confirm sets the headline and years and adds the missing skills up to 12. An
 * assisted draft gives suggestions and a revised snapshot with no new file and can be deleted. Compare shows two
 * versions' snapshots. A Free candidate sees the AI actions locked.
 */
export default {
  name: 'P9-09 CV AI',
  viewports: ['D'],
  async run(ctx) {
    const candidate = await completeCandidate('CvAi')
    const before = await profileOf(candidate.token)
    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, candidate.email, '/candidate/cv-versions', TEST_PASSWORD)

    await chooseFile(page, 'input[type="file"]', fixture('cv-text.pdf'))
    await page.waitForSelector('[data-version="2"] [data-pending-snapshot]', { visible: true, timeout: 90_000 })
    const after = await profileOf(candidate.token)
    ctx.check(after.headline === before.headline && JSON.stringify(after.skills) === JSON.stringify(before.skills), 'the profile is unchanged until Confirm')
    await ctx.screenshot(page, '1-proposal')

    const [latest] = await versionsOf(candidate.token)
    const proposal = latest.pendingSnapshot
    await page.click('[data-version="2"] [data-review-snapshot]')
    await page.waitForSelector('[data-snapshot-changes]', { visible: true })
    const changes = await page.$eval('[data-snapshot-changes]', (element) => element.innerText)
    ctx.check(changes.includes(proposal.role) && changes.includes(String(proposal.years)), `the dialog lists the changes (${changes.replace(/\s+/g, ' ').slice(0, 160)})`)
    await ctx.screenshot(page, '2-confirm-dialog')
    await page.click('[data-confirm-snapshot]')
    await waitForText(page, 'Your profile was updated from version 2.')
    const confirmed = await profileOf(candidate.token)
    const listed = new Set(before.skills.map((skill) => skill.toLocaleLowerCase()))
    const expectedSkills = [...before.skills, ...proposal.skills.filter((skill) => !listed.has(skill.toLocaleLowerCase()))].slice(0, 12)
    ctx.check(confirmed.headline === proposal.role && confirmed.yearsExperience === proposal.years, `headline "${proposal.role}" and ${proposal.years} years`)
    ctx.check(JSON.stringify(confirmed.skills) === JSON.stringify(expectedSkills), `skills kept and added up to 12 (${confirmed.skills.join(', ')})`)

    // Assisted draft: no new file, suggestions and a revised snapshot; then deleted.
    const files = (await versionsOf(candidate.token)).length
    await page.click('[data-version="2"] [data-create-draft]')
    await page.waitForSelector('[data-version="2"] [data-draft]', { visible: true, timeout: 90_000 })
    ctx.check((await versionsOf(candidate.token)).length === files, 'no new CV version')
    await ctx.screenshot(page, '3-draft')
    await clickText(page, 'Delete draft', '[data-version="2"] [data-draft] button')
    await page.waitForFunction(() => !document.querySelector('[data-version="2"] [data-draft]'))
    ctx.check((await versionsOf(candidate.token))[0].drafts.length === 0, 'the draft is deleted')

    // Compare: version 1 gets its own proposal, then both snapshots side by side.
    await page.click('[data-version="1"] [data-propose-snapshot]')
    await page.waitForSelector('[data-version="1"] [data-pending-snapshot]', { visible: true, timeout: 90_000 })
    await page.click('[data-compare="1"]')
    await page.click('[data-compare="2"]')
    await page.waitForSelector('[data-compare-panel] [data-compare-version="1"]', { visible: true })
    await page.waitForSelector('[data-compare-panel] [data-compare-version="2"]', { visible: true })
    await page.waitForSelector('[data-compare-difference]', { visible: true })
    await ctx.screenshot(page, '4-compare')
    ctx.assertClean(handle.issues, 'CV AI')

    // Free: the AI actions are visible with a lock and open the upgrade dialog.
    const alex = await ctx.newPage()
    await openAs(ctx, alex, ctx.seedCredentials.email('alex'), '/candidate/cv-versions', ctx.seedCredentials.password)
    await alex.page.waitForSelector('[data-version] [data-ai-locked]', { visible: true })
    await alex.page.click('[data-version] [data-ai-locked]')
    await alex.page.waitForSelector('[role="dialog"]', { visible: true })
    await ctx.screenshot(alex.page, '5-free-locked')
    ctx.assertClean(alex.issues, 'Free CV')
  },
}
