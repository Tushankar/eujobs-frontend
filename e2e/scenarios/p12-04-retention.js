import { fixture } from '../fixtures/make.js'
import { uploadAs } from '../lib/candidates.js'
import { signInWithForm, waitForText } from '../lib/flows.js'
import { enrolFree, openLessons, passQuiz, publishedCourse } from '../lib/learning.js'
import { freeCandidate, openAs } from '../lib/payments.js'
import { filesOf, onDisk } from '../lib/privacy.js'
import { ownerToken } from '../lib/recruiters.js'
import { api, date, db } from '../lib/testApi.js'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * P12-04 (M-186, U32, C18): approved identity evidence whose 30 days after the decision are over (its `deleteAfter`,
 * set at the decision, shifted back 31 days) → the scheduler tick at 03:00 runs the retention sweep → the file is
 * deleted from disk, the decision stays (Verified for the candidate, the admin item opens without the file). A
 * certificate PDF with a past date is exempt and stays.
 */
export default {
  name: 'P12-04 Retention',
  viewports: ['D'],
  async run(ctx) {
    const candidate = await freeCandidate('Retention', 'GB')
    const submitted = await uploadAs(candidate.token, '/candidate/verification/submissions', fixture('passport.jpg'), 'image/jpeg', { category: 'identity', evidenceType: 'passport' })
    ctx.check(submitted.status === 201, `evidence submitted (${submitted.status})`)
    const [submission] = await db('verificationsubmissions', 'find', { filter: { userId: { $oid: candidate.user.id } } })
    const submissionId = submission._id.$oid ?? submission._id
    const admin = await ownerToken()
    ctx.check((await api(`/admin/moderation/verification/${submissionId}/decision`, { method: 'POST', token: admin, body: { decision: 'approved' } })).status === 200, 'approved')
    const course = await publishedCourse(admin, { title: `Retention course ${Date.now()}`, isFree: true })
    await enrolFree(candidate.token, course.id)
    await openLessons(candidate.token, course)
    await passQuiz(candidate.token, admin, course.id)

    const [evidence] = await filesOf(candidate.user.id, 'evidence')
    const [certificatePdf] = await filesOf(candidate.user.id, 'certificate_pdf')
    const decidedPlus30 = new Date(evidence.deleteAfter.$date ?? evidence.deleteAfter)
    ctx.check(Math.abs(decidedPlus30 - Date.now() - 30 * DAY_MS) < DAY_MS, `the decision set deleteAfter 30 days ahead (${decidedPlus30.toISOString()})`)
    const shifted = date(decidedPlus30.getTime() - 31 * DAY_MS)
    await db('files', 'updateMany', { filter: { _id: { $in: [evidence._id, certificatePdf._id] } }, update: { $set: { deleteAfter: shifted } } })
    ctx.check((await onDisk(evidence)) && (await onDisk(certificatePdf)), 'both files on disk before the tick')

    // The 03:00 slot: only the sweep is due (the nightly relevance run is marked as done for this slot).
    const threeAm = new Date()
    threeAm.setHours(3, 1, 0, 0)
    await db('jobruns', 'deleteMany', { filter: { name: { $in: ['retention-sweep', 'relevance-nightly'] } } })
    await db('jobruns', 'insertOne', { doc: { name: 'relevance-nightly', lastRunAt: date(threeAm) } })
    ctx.check((await api('/_test/scheduler/tick', { method: 'POST', body: { now: threeAm.toISOString() } })).status < 300, 'tick at 03:00')

    ctx.check(!(await onDisk(evidence)), 'the evidence file is deleted from disk')
    ctx.check((await db('files', 'find', { filter: { _id: evidence._id } })).length === 0, 'its file record is gone')
    const [kept] = await db('verificationsubmissions', 'find', { filter: { _id: submission._id } })
    ctx.check(kept.status === 'approved' && kept.fileId === null, 'the decision is kept without the file')
    ctx.check(await onDisk(certificatePdf), 'C18: the certificate PDF is untouched')

    const handle = await ctx.newPage()
    await openAs(ctx, handle, candidate.email, '/candidate/verification')
    await waitForText(handle.page, 'Verified')
    await ctx.screenshot(handle.page, '1-candidate-verified')
    ctx.assertClean(handle.issues, 'candidate')

    const ownerPage = await ctx.newPage()
    await signInWithForm(ownerPage.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await ownerPage.page.goto(`${ctx.webUrl}/admin/moderation/verification/${submissionId}`, { waitUntil: 'networkidle0' })
    await ownerPage.page.waitForSelector('[role="dialog"]')
    await waitForText(ownerPage.page, candidate.user.fullName)
    await ctx.screenshot(ownerPage.page, '2-admin-item-without-file')
    ctx.assertClean(ownerPage.issues, 'admin')
  },
}
