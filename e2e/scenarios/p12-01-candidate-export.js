import { applyApi, completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { clickText, responseTo, waitForText } from '../lib/flows.js'
import { enrolFree, openLessons, passQuiz, publishedCourse } from '../lib/learning.js'
import { createAlertApi, startApi } from '../lib/messages.js'
import { openAs } from '../lib/payments.js'
import { exportOf, zipJson } from '../lib/privacy.js'
import { ownerToken } from '../lib/recruiters.js'
import { api } from '../lib/testApi.js'

/**
 * P12-01 (M-190, OD15, U31): Data & account → Export data downloads a ZIP with JSON of the candidate's records (profile,
 * applications, messages, payments, alerts, learning) and their CV, photo and certificate files. The company's note
 * about the candidate is nowhere in it.
 */
export default {
  name: 'P12-01 Candidate export',
  viewports: ['D'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob('ExportRec')
    const candidate = await completeCandidate('Exporter')
    const application = await applyApi(candidate.token, job.id, { coverNote: 'Exported cover note' })
    ctx.check(application.status === 201, `applied (${application.status})`)
    const note = 'Exporter: call back in spring (recruiter only)'
    ctx.check((await api(`/recruiter/candidates/${candidate.id}/notes`, { method: 'POST', token: recruiter.token, body: { text: note } })).status === 201, 'the recruiter wrote a note')
    ctx.check((await startApi(recruiter.token, { candidateId: candidate.id, jobId: job.id, body: 'Would you like to talk?' })).status === 201, 'the recruiter wrote')
    await createAlertApi(candidate.token, { name: 'Export alert', keywords: 'designer' })
    const admin = await ownerToken()
    const course = await publishedCourse(admin, { title: `Export course ${Date.now()}`, isFree: true })
    await enrolFree(candidate.token, course.id)
    await openLessons(candidate.token, course)
    const { certificate } = await passQuiz(candidate.token, admin, course.id)

    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, candidate.email, '/candidate/settings/data-account')
    ctx.check(!(await page.$$eval('main button', (buttons) => buttons.some((button) => button.textContent.includes('Reset demo')))), 'no Reset demo')
    await ctx.screenshot(page, '1-data-account')
    const download = responseTo(page, '/api/v1/me/export')
    await clickText(page, 'Export data', 'main button')
    const response = await download
    ctx.check(response.status() === 200 && response.headers()['content-type'].startsWith('application/zip'), `the export is a ZIP (${response.status()} ${response.headers()['content-type']})`)
    await waitForText(page, 'Your data was downloaded.')
    await ctx.screenshot(page, '2-exported')
    ctx.assertClean(handle.issues, 'export')

    const zip = await exportOf(candidate.token)
    const names = Object.keys(zip)
    ctx.note(`ZIP: ${names.join(', ')}`)
    ctx.check(zipJson(zip, 'profile.json').headline === 'Product Designer', 'profile.json')
    ctx.check(zipJson(zip, 'applications.json')[0]?.coverNote === 'Exported cover note', 'applications.json')
    ctx.check(zipJson(zip, 'conversations.json')[0]?.messages[0]?.body === 'Would you like to talk?', 'conversations.json with the messages')
    ctx.check(zipJson(zip, 'payments.json').some((row) => row.kind === 'subscription' && row.status === 'paid'), 'payments.json with the Plus invoice')
    ctx.check(zipJson(zip, 'subscription.json').plan === 'plus', 'subscription.json: Plus')
    ctx.check(zipJson(zip, 'job-alerts.json')[0]?.name === 'Export alert', 'job-alerts.json')
    const learning = zipJson(zip, 'learning.json')
    ctx.check(learning.enrollments[0]?.course === course.title && learning.certificates[0]?.code === certificate.code, 'learning.json: the enrollment and certificate')
    ctx.check(names.some((name) => /^files\/cv\/v1-.+\.pdf$/.test(name)), 'the CV file')
    ctx.check(names.some((name) => name.startsWith('files/photo.')), 'the photo')
    ctx.check(names.includes(`files/certificates/${certificate.code}.pdf`) && zip[`files/certificates/${certificate.code}.pdf`].subarray(0, 4).toString() === '%PDF', 'the certificate PDF')
    ctx.check(Object.values(zip).every((content) => !content.toString('utf8').includes(note)), 'U31: no recruiter note in the export')
  },
}
