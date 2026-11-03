import { completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { signInWithForm, waitForText } from '../lib/flows.js'
import { sendApi, startApi } from '../lib/messages.js'
import { login } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

const setDiscoverable = (id, discoverable) => db('users', 'updateMany', { filter: { _id: { $oid: id } }, update: { $set: { 'privacy.discoverable': discoverable } } })

/**
 * P7-05 (M-085, U28): a hidden candidate who never applied has no profile and so no Message button, and the API
 * refuses 403. After Emma hides, her existing Acme thread works both ways; a company without a thread cannot start one.
 */
export default {
  name: 'P7-05 Recruiter limits',
  viewports: ['D'],
  async run(ctx) {
    const sarahToken = await login(ctx.seedCredentials.email('sarah'), 'recruiter', ctx.seedCredentials.password)
    const hidden = await completeCandidate('Hidden', { plus: false })
    await setDiscoverable(hidden.id, false)

    const sarah = await ctx.newPage()
    sarah.allow(404, `/api/v1/recruiter/candidates/${hidden.id}`)
    await signInWithForm(sarah.page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    await sarah.page.goto(`${ctx.webUrl}/recruiter/find-candidates/${hidden.id}`, { waitUntil: 'networkidle0' })
    await waitForText(sarah.page, 'Candidate not found')
    ctx.check(!(await sarah.page.$('[data-start-conversation]')), 'no Message button')
    await ctx.screenshot(sarah.page, '1-no-message-button')
    const refused = await startApi(sarahToken, { candidateId: hidden.id, body: 'Hello' })
    ctx.check(refused.status === 403, `the API refuses a hidden non-applicant (${refused.status})`)

    // U28: Emma hides; the thread with Acme stays open for both sides.
    const emmaToken = await login(ctx.seedCredentials.email('emma'), 'candidate', ctx.seedCredentials.password)
    const emma = (await api('/me', { token: emmaToken })).body
    const thread = (await api('/conversations', { token: sarahToken })).body.items.find((item) => item.counterpart.id === emma.id)
    await setDiscoverable(emma.id, false)
    try {
      ctx.check((await sendApi(sarahToken, thread.id, 'Checking in after your update.')).status === 201, 'Sarah still writes in the thread')
      ctx.check((await sendApi(emmaToken, thread.id, 'Thanks, still interested.')).status === 201, 'Emma still replies')
      await sarah.page.goto(`${ctx.webUrl}/recruiter/messages/${thread.id}`, { waitUntil: 'networkidle0' })
      await waitForText(sarah.page, 'Thanks, still interested.')
      await ctx.screenshot(sarah.page, '2-thread-after-hiding')
      const { recruiter: other } = await recruiterWithJob('NoThread')
      const blocked = await startApi(other.token, { candidateId: emma.id, body: 'Hello' })
      ctx.check(blocked.status === 403, `a new thread with a hidden candidate is refused (${blocked.status})`)
    } finally {
      await setDiscoverable(emma.id, true)
    }
    ctx.assertClean(sarah.issues, 'recruiter limits')
  },
}
