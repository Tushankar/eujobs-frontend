import { onboardedCandidate } from '../lib/candidates.js'
import { clickText, signInWithForm, waitForPath, waitForText } from '../lib/flows.js'
import { approvedRecruiter } from '../lib/recruiters.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const openMenu = async (page) => {
  const trigger = await page.waitForSelector('button[aria-label="Open profile menu"]', { visible: true, timeout: 15_000 })
  await trigger.click()
  await pause(350)
}

/** Temporary (2026-11-19): the expanded avatar menu and the redesigned form alert. */
export default {
  name: 'ZZ Profile menu',
  viewports: ['D', 'M'],
  async run(ctx) {
    const candidate = await onboardedCandidate(`Menu${ctx.viewport}`)

    // The form alert on a wrong password, light and dark.
    const alertPage = await ctx.newPage()
    const ap = alertPage.page
    for (const theme of ['light', 'dark']) {
      await ap.goto(`${ctx.webUrl}/sign-in`, { waitUntil: 'networkidle0' })
      await ap.evaluate((value) => localStorage.setItem('lwm-pref-theme', value), theme)
      await ap.reload({ waitUntil: 'networkidle0' })
      await ap.type('input[name="email"]', candidate.email)
      await ap.type('input[name="password"]', 'wrong-password-1')
      await ap.keyboard.press('Enter')
      const alert = await ap.waitForSelector('[role="alert"]', { visible: true, timeout: 10_000 })
      const text = await alert.evaluate((element) => element.innerText)
      ctx.check(/sign you in/i.test(text), `the ${theme} alert has the title (${text.replace(/\n/g, ' | ')})`)
      await ctx.screenshot(ap, `alert-${theme}`)
    }

    const handle = await ctx.newPage()
    const { page } = handle
    await page.evaluateOnNewDocument(() => localStorage.setItem('lwm-pref-theme', 'light'))
    await signInWithForm(page, ctx.webUrl, '/sign-in', candidate.email, TEST_PASSWORD)
    await openMenu(page)
    const rows = await page.evaluate(() => document.querySelector('[class*="menu"]')?.innerText ?? '')
    for (const label of ['Profile', 'Saved jobs', 'My courses', 'Settings', 'Billing & plan', 'Take the product tour', 'Country', 'Language', 'Dark mode', 'Help', 'Sign out']) {
      ctx.check(rows.includes(label), `candidate menu has "${label}"`)
    }
    await ctx.screenshot(page, 'candidate-menu')

    await clickText(page, 'Saved jobs', '[class*="menu"] a')
    await waitForPath(page, '/candidate')
    await pause(900)
    ctx.check((await page.evaluate(() => location.search)) === '?tab=saved', 'Saved jobs opens ?tab=saved')
    const savedActive = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent ?? '')
    ctx.check(/saved/i.test(savedActive), `the Saved tab is selected (${savedActive})`)
    await ctx.screenshot(page, 'candidate-saved-tab')

    await openMenu(page)
    await page.click('[data-menu-theme]')
    await pause(300)
    ctx.check((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'the Dark mode row switches to dark')
    await ctx.screenshot(page, 'candidate-menu-dark')
    await page.click('[data-menu-theme]')
    await pause(200)

    await clickText(page, 'My courses', '[class*="menu"] a')
    await waitForPath(page, '/candidate/learning')

    await openMenu(page)
    await page.click('[data-menu-sign-out]')
    await waitForText(page, 'Sign out?')
    await clickText(page, 'Sign out', '[role="dialog"] button')
    await waitForPath(page, '/sign-in')
    ctx.assertClean(handle.issues, 'candidate')

    const recruiter = await approvedRecruiter(`MenuRec${ctx.viewport}`, { plus: false })
    const second = await ctx.newPage()
    await second.page.evaluateOnNewDocument(() => localStorage.setItem('lwm-pref-theme', 'light'))
    await signInWithForm(second.page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await openMenu(second.page)
    const recRows = await second.page.evaluate(() => document.querySelector('[class*="menu"]')?.innerText ?? '')
    for (const label of ['Company profile', 'Shortlists', 'My courses', 'Settings', 'Billing & plan', 'Dark mode', 'Help', 'Sign out']) {
      ctx.check(recRows.includes(label), `recruiter menu has "${label}"`)
    }
    await ctx.screenshot(second.page, 'recruiter-menu')
    await clickText(second.page, 'My courses', '[class*="menu"] a')
    await waitForPath(second.page, '/recruiter/settings/courses')
    ctx.assertClean(second.issues, 'recruiter')
  },
}
