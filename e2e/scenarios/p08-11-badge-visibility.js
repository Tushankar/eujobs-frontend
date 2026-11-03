import { applyApi, completeCandidate } from '../lib/applicants.js'
import { signInWithForm, waitForText } from '../lib/flows.js'
import { enrolFree, openLessons, passQuiz, publishedCourse } from '../lib/learning.js'
import { openAs } from '../lib/payments.js'
import { approvedRecruiter, ownerToken } from '../lib/recruiters.js'
import { db, TEST_PASSWORD } from '../lib/testApi.js'

const id = (doc) => doc._id.$oid ?? doc._id

/**
 * P8-11 (M-026, C24): a course certificate shows on My profile and on Sarah's view of the candidate. After the
 * candidate hides from discovery, Sarah still sees it because the candidate applied to Acme; a company the candidate
 * never applied to cannot open the profile at all.
 */
export default {
  name: 'P8-11 Badge visibility',
  viewports: ['D'],
  async run(ctx) {
    const owner = await ownerToken()
    const course = await publishedCourse(owner, { title: `Badge course ${Date.now()}`, isFree: true })
    const candidate = await completeCandidate('Badge')
    await enrolFree(candidate.token, course.id)
    await openLessons(candidate.token, course)
    const { certificate } = await passQuiz(candidate.token, owner, course.id)

    const own = await ctx.newPage()
    await openAs(ctx, own, candidate.email, '/candidate/profile')
    await own.page.waitForSelector(`[data-course-certificate="${certificate.code}"]`, { visible: true })
    await own.page.$eval('[data-section="course-certificates"]', (element) => element.scrollIntoView({ block: 'center' }))
    await ctx.screenshot(own.page, '1-my-profile')
    ctx.assertClean(own.issues, 'my profile')

    // Sarah sees it while the candidate is discoverable, and after hiding, because the candidate applied to Acme.
    const [acme] = await db('companies', 'find', { filter: { displayName: 'Acme Studio' } })
    const [job] = await db('jobs', 'find', { filter: { companyId: acme._id, status: 'published' } })
    const applied = await applyApi(candidate.token, id(job))
    ctx.check(applied.status === 201, `the candidate applies to Acme (${applied.status})`)
    const sarah = await ctx.newPage()
    await signInWithForm(sarah.page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    const skillsTab = `${ctx.webUrl}/recruiter/find-candidates/${candidate.id}/skills`
    await sarah.page.goto(skillsTab, { waitUntil: 'networkidle0' })
    await sarah.page.waitForSelector(`[data-course-certificate="${certificate.code}"]`, { visible: true })
    await ctx.screenshot(sarah.page, '2-recruiter-view')
    await db('users', 'updateMany', { filter: { _id: { $oid: candidate.id } }, update: { $set: { 'privacy.discoverable': false } } })
    await sarah.page.goto(skillsTab, { waitUntil: 'networkidle0' })
    await sarah.page.waitForSelector(`[data-course-certificate="${certificate.code}"]`, { visible: true })
    await ctx.screenshot(sarah.page, '3-hidden-applicant')
    ctx.assertClean(sarah.issues, 'recruiter view')

    const other = await approvedRecruiter('NoBadge')
    const stranger = await ctx.newPage()
    stranger.allow(404, `/api/v1/recruiter/candidates/${candidate.id}`)
    await signInWithForm(stranger.page, ctx.webUrl, '/recruiter/sign-in', other.email, TEST_PASSWORD)
    await stranger.page.goto(skillsTab, { waitUntil: 'networkidle0' })
    await waitForText(stranger.page, 'Candidate not found')
    ctx.check(!(await stranger.page.$('[data-course-certificate]')), 'another company sees neither the profile nor the badge')
    ctx.assertClean(stranger.issues, 'other company')
  },
}
