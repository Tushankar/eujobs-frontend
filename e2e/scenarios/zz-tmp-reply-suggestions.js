// TEMPORARY: the message thread's suggested replies (Plus) and the locked chip (Free), with the real OpenAI. Deleted after the run.
import { completeCandidate } from '../lib/applicants.js'
import { signInWithForm } from '../lib/flows.js'
import { startApi } from '../lib/messages.js'
import { login } from '../lib/recruiters.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

export default {
  name: 'TMP Reply suggestions',
  viewports: ['D', 'M'],
  async run(ctx) {
    const sarahToken = await login(ctx.seedCredentials.email('sarah'), 'recruiter', ctx.seedCredentials.password)
    const plus = await completeCandidate('Suggest')
    const free = await completeCandidate('SuggestFree', { plus: false })
    const body = 'Hi, your profile stood out for a role we are hiring for. I’d like to learn more about your work. Would you be open to a short conversation?'
    const thread = (await startApi(sarahToken, { candidateId: plus.id, body })).body.conversation.id
    const freeThread = (await startApi(sarahToken, { candidateId: free.id, body })).body.conversation.id

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/candidate/sign-in', plus.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/messages/${thread}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-reply-suggestions] button', { visible: true, timeout: 60_000 })
    const replies = await page.$$eval('[data-reply-suggestions] button', (buttons) => buttons.map((button) => button.innerText))
    console.log('replies', JSON.stringify(replies))
    ctx.check(replies.length === 3 && replies.every((reply) => reply.length > 10 && !/\[|\]/.test(reply)), `three replies without placeholders (${replies.length})`)
    await ctx.screenshot(page, '0-suggestions')
    await page.click('[data-reply-suggestions] li:nth-child(2) button')
    const value = await page.$eval('textarea', (field) => field.value)
    ctx.check(value === replies[1], 'a picked reply fills the message box')
    ctx.check(await page.$eval('textarea', (field) => field === document.activeElement), 'the message box gets the focus')
    await ctx.screenshot(page, '1-picked')
    await handle.checkOverflow()
    ctx.assertClean(handle.issues, 'reply suggestions')

    const freeHandle = await ctx.newPage()
    await signInWithForm(freeHandle.page, ctx.webUrl, '/candidate/sign-in', free.email, TEST_PASSWORD)
    await freeHandle.page.goto(`${ctx.webUrl}/candidate/messages/${freeThread}`, { waitUntil: 'networkidle0' })
    ctx.check(Boolean(await freeHandle.page.$('[data-upgrade-prompt]')) && !(await freeHandle.page.$('[data-reply-suggestions]')), 'Free candidate: the upgrade prompt, no suggestions requested')
    await ctx.screenshot(freeHandle.page, '2-free')
    ctx.assertClean(freeHandle.issues, 'reply suggestions free')
  },
}
