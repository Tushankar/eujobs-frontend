import { completeCandidate } from '../lib/applicants.js'
import { signInWithForm, waitForText } from '../lib/flows.js'
import { jobBody, login, postJob } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

/**
 * P4-17 (M-044, M-151, P4-D11): an unapproved recruiter's workspace API calls answer 403; a hidden candidate's
 * profile URL is not found; a candidate opening a draft job URL sees "no longer available". Every seeded complete
 * candidate has applied to Acme since Phase 6 (an applicant's profile stays open, P6-C5), so the hidden candidate is
 * a complete Free candidate built through the API who never applied.
 */
export default {
  name: 'P4-17 Denials',
  viewports: ['D'],
  async run(ctx) {
    const jamesToken = await login(ctx.seedCredentials.email('james'), 'recruiter', ctx.seedCredentials.password)
    for (const path of ['/recruiter/jobs', '/recruiter/candidates', '/recruiter/company', '/recruiter/overview']) {
      const result = await api(path, { token: jamesToken })
      ctx.check(result.status === 403 && result.body.error.code === 'RECRUITER_NOT_APPROVED', `${path} answers 403 (got ${result.status})`)
    }

    const hidden = await completeCandidate('p417', { plus: false })
    await db('users', 'updateMany', { filter: { _id: { $oid: hidden.id } }, update: { $set: { 'privacy.discoverable': false } } })
    const sarah = await ctx.newPage()
    sarah.allow(404, `/api/v1/recruiter/candidates/${hidden.id}`)
    await signInWithForm(sarah.page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    await sarah.page.goto(`${ctx.webUrl}/recruiter/find-candidates/${hidden.id}`, { waitUntil: 'networkidle0' })
    await waitForText(sarah.page, 'Candidate not found')
    await ctx.screenshot(sarah.page, '1-hidden-candidate')
    ctx.assertClean(sarah.issues, 'hidden candidate')

    const draft = await postJob(await login(ctx.seedCredentials.email('sarah'), 'recruiter', ctx.seedCredentials.password), jobBody({ title: 'Unpublished draft' }), { draft: true })
    const emma = await ctx.newPage()
    emma.allow(404, `/api/v1/jobs/${draft.id}`)
    await signInWithForm(emma.page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    await emma.page.goto(`${ctx.webUrl}/candidate/jobs/${draft.id}`, { waitUntil: 'networkidle0' })
    await waitForText(emma.page, 'This job is no longer available')
    await ctx.screenshot(emma.page, '2-draft-job')
    ctx.assertClean(emma.issues, 'draft job')
  },
}
