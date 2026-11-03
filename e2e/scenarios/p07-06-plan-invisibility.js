import { completeCandidate } from '../lib/applicants.js'
import { pageApi, signInWithForm } from '../lib/flows.js'
import { startApi } from '../lib/messages.js'
import { login } from '../lib/recruiters.js'

const PLAN_WORDS = /\bplus\b|\bfree\b|upgrade|subscri|\bplan\b/i

/** P7-06 (M-087, P7-Q1): the recruiter's inbox and thread with a Free candidate show nothing about the plan. */
export default {
  name: 'P7-06 Plan invisibility',
  viewports: ['D'],
  async run(ctx) {
    const reader = await completeCandidate('Morgan', { plus: false })
    const sarahToken = await login(ctx.seedCredentials.email('sarah'), 'recruiter', ctx.seedCredentials.password)
    const { body } = await startApi(sarahToken, { candidateId: reader.id, body: 'Hi, would you like to talk about a role?' })

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    // Only this candidate's row and thread: other threads' text is free-form (a seeded reply says "I am free").
    const id = body.conversation.id
    for (const [path, selector] of [
      ['/recruiter/messages', `[data-conversation="${id}"]`],
      [`/recruiter/messages/${id}`, 'main'],
    ]) {
      await page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
      const text = await page.$eval(selector, (element) => element.innerText)
      ctx.check(!PLAN_WORDS.test(text), `${path} says nothing about a plan: ${text.match(PLAN_WORDS)?.[0]}`)
    }
    ctx.check(!(await page.$('[data-upgrade-prompt]')), 'no upgrade prompt for the recruiter')
    const row = (await pageApi(page, '/conversations')).body.items.find((item) => item.id === id)
    const answers = JSON.stringify([row, (await pageApi(page, `/conversations/${id}/messages`)).body])
    ctx.check(!PLAN_WORDS.test(answers), 'the API answers to the recruiter carry no plan')
    await ctx.screenshot(page, '1-recruiter-thread')
    ctx.assertClean(handle.issues, 'plan invisibility')
  },
}
