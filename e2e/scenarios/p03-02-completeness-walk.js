import { clickText, pickMonth, signInWithForm, toggleCheckbox, waitForText } from '../lib/flows.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

/** Saves the open dialog and waits for the checklist to read `progress` ("x of N complete"). */
async function saveAndExpect(page, progress) {
  await clickText(page, 'Save', '[role="dialog"] button')
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
  await waitForText(page, progress)
}

/**
 * P3-02 (§3.2, M-015, M-018, M-019, M-023): each section editor raises "x"; the opt-out marks work history done
 * without the employment check; a work entry and an education entry change N from 10 to 12.
 */
export default {
  name: 'P3-02 Completeness walk',
  viewports: ['D'],
  async run(ctx) {
    const { email } = await onboardedCandidate('Walk')
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })
    await waitForText(page, '0 of 10 complete')

    await clickText(page, 'Edit profile', 'button')
    await page.waitForSelector('input[name="headline"]')
    await page.type('input[name="headline"]', 'Product Designer')
    await page.type('textarea[name="about"]', 'I design calm, accessible products for complex domains.')
    await page.type('input[name="yearsExperience"]', '6')
    await page.type('input[name="skillDraft"]', 'Figma')
    await page.keyboard.press('Enter')
    await saveAndExpect(page, '1 of 10 complete')

    await clickText(page, 'Edit languages', 'button')
    // The language field is a searchable list: type, then pick the option.
    await page.waitForSelector('input[name="language-0"]')
    await page.click('input[name="language-0"]')
    await page.type('input[name="language-0"]', 'Engl')
    const names = await page.$$eval('[role="option"]', (options) => options.map((option) => option.textContent))
    ctx.check(names[0] === 'English' && names.every((name) => !/^[a-z]{2}$/.test(name)), `typing filters to named languages: ${JSON.stringify(names.slice(0, 5))}`)
    await page.click('[role="option"][data-value="en"]')
    await page.select('select[name="level-0"]', 'c1')
    await ctx.screenshot(page, '0-languages')
    await saveAndExpect(page, '2 of 10 complete')

    await clickText(page, 'Edit right to work', 'button')
    await clickText(page, 'Add EU', '[role="dialog"] button')
    await page.select('select[name="status-eu"]', 'citizen_settled')
    await saveAndExpect(page, '3 of 10 complete')

    await clickText(page, 'Edit links', 'button')
    await page.waitForSelector('input[name="portfolio"]')
    await page.type('input[name="portfolio"]', 'https://walk.example.com')
    await saveAndExpect(page, '4 of 10 complete')

    await toggleCheckbox(page, 'work-history-none')
    await waitForText(page, '5 of 10 complete')
    await ctx.screenshot(page, '1-opt-out')

    await clickText(page, 'Add a role', 'button')
    await page.waitForSelector('input[name="title"]')
    await page.type('input[name="title"]', 'Designer')
    await page.type('input[name="employer"]', 'Studio North')
    await pickMonth(page, 'start', '2021-03')
    await toggleCheckbox(page, 'ongoing')
    await saveAndExpect(page, '5 of 11 complete')

    await clickText(page, 'Add education', 'button')
    await page.waitForSelector('input[name="institution"]')
    await page.type('input[name="institution"]', 'University of Leeds')
    await page.type('input[name="degree"]', 'BA Graphic Design')
    await pickMonth(page, 'start', '2016-09')
    await pickMonth(page, 'end', '2019-06')
    await ctx.screenshot(page, '1b-education-dates')
    await saveAndExpect(page, '6 of 12 complete')
    await ctx.screenshot(page, '2-twelve-items')
    ctx.assertClean(handle.issues, 'completeness walk')
  },
}
