// TEMPORARY: the premium plan badge in the profile menu (Recruiter Plus, candidate Plus, Free). Deleted after the run.
import { completeCandidate } from '../lib/applicants.js'
import { signInWithForm } from '../lib/flows.js'
import { approvedRecruiter } from '../lib/recruiters.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

const cases = [
  ['recruiter plus', () => approvedRecruiter('BadgePlus'), '/recruiter/sign-in', 'Recruiter Plus'],
  ['recruiter free', () => approvedRecruiter('BadgeFree', { plus: false }), '/recruiter/sign-in', null],
  ['candidate plus', () => completeCandidate('BadgePlus'), '/candidate/sign-in', 'Plus'],
  ['candidate free', () => completeCandidate('BadgeFree', { plus: false }), '/candidate/sign-in', null],
]

export default {
  name: 'TMP Plan badge',
  viewports: ['D'],
  async run(ctx) {
    for (const [index, [label, make, signIn, badge]] of cases.entries()) {
      const user = await make()
      const handle = await ctx.newPage()
      const { page } = handle
      await signInWithForm(page, ctx.webUrl, signIn, user.email, TEST_PASSWORD)
      const side = await page.$eval('aside [data-plan-badge]', (el) => el.innerText).catch(() => null)
      ctx.check(side === badge, `${label}: sidebar badge ${JSON.stringify(side)}`)
      const sideBox = await page.$eval('aside [data-plan-badge]', (el) => el.scrollWidth <= el.parentElement.clientWidth).catch(() => true)
      ctx.check(sideBox, `${label}: sidebar badge fits`)
      await ctx.screenshot(page, `${index}-${label.replace(' ', '-')}-sidebar`)
      await page.click('header button[aria-label="Open profile menu"]')
      await page.waitForSelector('[role="menu"], [class*="identity"]', { visible: true })
      const text = await page.$eval('header [data-plan-badge]', (el) => el.innerText).catch(() => null)
      ctx.check(text === badge, `${label}: badge ${JSON.stringify(text)}`)
      await ctx.screenshot(page, `${index}-${label.replace(' ', '-')}`)
      ctx.assertClean(handle.issues, label)
    }
  },
}
