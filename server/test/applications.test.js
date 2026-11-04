import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { DateTime } from 'luxon'
import { ScheduledTask } from '../jobs/models.js'
import { EmailLog } from '../lib/mail/emailLog.model.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { momentum } from '../modules/applications/applications.stats.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { CvVersion } from '../modules/cv/cv.model.js'
import { RecruiterActivity, ShortlistEntry } from '../modules/discovery/discovery.model.js'
import { File } from '../modules/files/files.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { api, auth, createUser, mailTo, useTestDb } from './helpers/index.js'
import { applicantCandidate, approvedRecruiter } from './helpers/market.js'

useTestDb([User, Company, Job, CandidateProfile, CvVersion, File, VerificationSubmission, Subscription, PipelineStage, Application, ScheduledTask, EmailLog, RecruiterActivity, ShortlistEntry])
before(() => seedCatalog())

const MINUTE = 60 * 1000
const v1 = '/api/v1'

/** An approved recruiter with one published London job. */
async function market(overrides = {}) {
  const { user: recruiter, company } = await approvedRecruiter()
  const job = await publish(company, recruiter, overrides)
  return { recruiter, company, job }
}

const publish = (company, recruiter, overrides = {}) =>
  Job.create({
    companyId: company._id,
    createdBy: recruiter._id,
    title: 'Senior Product Designer',
    employmentType: 'full_time',
    brief: 'Lead the design of our hiring tools, from research to shipped product, with a small and kind team.',
    requiredSkills: [{ name: 'Figma', key: 'figma' }],
    level: 'senior',
    experienceYears: 5,
    workPreference: 'hybrid',
    country: 'GB',
    location: PLACES.london,
    status: 'published',
    publishedAt: new Date(),
    firstPublishedAt: new Date(),
    ...overrides,
  })

const apply = (user, job, body = {}) => api().post(`${v1}/candidate/applications`).set(auth(user)).send({ jobId: String(job._id), consent: true, ...body })
const applied = async (user, job, body) => (await apply(user, job, body)).body
const stageOf = async (company, name) => String((await PipelineStage.findOne({ companyId: company._id, name }))._id)
const move = (recruiter, application, stageId) => api().patch(`${v1}/recruiter/applications/${application.id}/stage`).set(auth(recruiter)).send({ stageId })
const moveTo = async (recruiter, company, application, name) => move(recruiter, application, await stageOf(company, name))
const reject = (recruiter, application, notify) => api().post(`${v1}/recruiter/applications/${application.id}/reject`).set(auth(recruiter)).send({ notify })
const tickAt = (ms) => api().post(`${v1}/_test/scheduler/tick`).send({ now: new Date(Date.now() + ms).toISOString() })
const code = (res) => res.body.error?.code

describe('the apply gate (§3.4, M-043, M-073)', () => {
  it('answers plan, then profile, then job state, in one request', async () => {
    const { recruiter, company, job } = await market()
    const freeComplete = await applicantCandidate({ plus: false })
    const res = await apply(freeComplete, job)
    assert.equal(res.status, 402)
    assert.deepEqual([code(res), res.body.error.params.entitlement], ['PLAN_REQUIRED', 'apply'])

    const plusIncomplete = await applicantCandidate()
    await CandidateProfile.updateOne({ userId: plusIncomplete._id }, { $unset: { links: 1 } })
    await User.updateOne({ _id: plusIncomplete._id }, { $unset: { phone: 1 } })
    const incomplete = await apply(plusIncomplete, job)
    assert.equal(incomplete.status, 403)
    assert.equal(code(incomplete), 'PROFILE_INCOMPLETE')
    assert.deepEqual(incomplete.body.error.params.missing.sort(), ['links', 'phone'])

    // Free and incomplete: the plan comes first, as the entitlement is the route's check.
    const freeIncomplete = await applicantCandidate({ plus: false })
    await CandidateProfile.updateOne({ userId: freeIncomplete._id }, { $unset: { links: 1 } })
    assert.equal((await apply(freeIncomplete, job)).status, 402)

    const ready = await applicantCandidate()
    for (const [status, extra] of [['paused', {}], ['closed', {}], ['published', { restricted: { reason: 'x', at: new Date() } }]]) {
      const closed = await publish(company, recruiter, { status, ...extra })
      const res = await apply(ready, closed)
      assert.deepEqual([res.status, code(res)], [410, 'JOB_NOT_ACCEPTING'], `${status}${extra.restricted ? ' (restricted)' : ''}`)
    }
    assert.equal((await apply(ready, await publish(company, recruiter, { status: 'draft' }))).status, 404)
    // M-044: a suspended recruiter's jobs are hidden from candidates.
    await User.updateOne({ _id: recruiter._id }, { status: 'suspended' })
    assert.equal((await apply(ready, job)).status, 410)
  })

  it('applies with the live CV, a cover note and consent, and records history, activity and the new-applications task', async () => {
    const { company, job } = await market()
    const user = await applicantCandidate()
    const res = await apply(user, job, { coverNote: 'I would love to join.' })
    assert.equal(res.status, 201)
    assert.deepEqual([res.body.status, res.body.history.map((step) => step.status), res.body.coverNote], ['applied', ['applied'], 'I would love to join.'])
    assert.equal(res.body.cv.number, 1)
    assert.equal(res.body.job.company.displayName, company.displayName)
    const stored = await Application.findById(res.body.id)
    assert.equal(String(stored.stageId), await stageOf(company, 'Applied'))
    assert.equal(stored.history[0].stageName, 'Applied')
    assert.ok(stored.consentAt)
    assert.equal(await RecruiterActivity.countDocuments({ companyId: company._id, candidateId: user._id, type: 'applied' }), 1)
    assert.equal(await ScheduledTask.countDocuments({ type: 'email.new-applications', status: 'pending' }), 1)
  })

  it('checks the cover note (2,000), the consent box and the CV version', async () => {
    const { job } = await market()
    const user = await applicantCandidate()
    const long = await apply(user, job, { coverNote: 'x'.repeat(2001) })
    assert.deepEqual([long.status, long.body.error.fields.coverNote, long.body.error.params.max], [422, 'too_long', 2000])
    assert.equal((await apply(user, job, { coverNote: 'x'.repeat(2000) })).status, 201)

    const other = await applicantCandidate()
    const noConsent = await apply(other, job, { consent: false })
    assert.deepEqual([noConsent.status, noConsent.body.error.fields.consent], [422, 'required'])
    const foreignCv = await CvVersion.findOne({ userId: user._id })
    const wrongCv = await apply(other, job, { cvVersionId: String(foreignCv._id) })
    assert.deepEqual([wrongCv.status, wrongCv.body.error.fields.cvVersionId], [422, 'invalid'])
    assert.equal(await Application.countDocuments({ candidateId: other._id }), 0)
  })

  it('allows one active application per job, enforced by the partial unique index, and re-applying after a withdrawal (M-074)', async () => {
    const { recruiter, company, job } = await market()
    const user = await applicantCandidate()
    const first = await applied(user, job)
    const duplicate = await apply(user, job)
    assert.deepEqual([duplicate.status, code(duplicate)], [409, 'CONFLICT'])
    await assert.rejects(
      Application.create({ candidateId: user._id, jobId: job._id, companyId: company._id, stageId: (await PipelineStage.findOne({ isEntry: true }))._id, consentAt: new Date(), appliedAt: new Date() }),
      { code: 11000 },
    )

    const withdrawn = await api().post(`${v1}/candidate/applications/${first.id}/withdraw`).set(auth(user))
    assert.deepEqual([withdrawn.status, withdrawn.body.status, withdrawn.body.history.map((step) => step.status)], [200, 'withdrawn', ['applied', 'withdrawn']])
    assert.equal((await api().post(`${v1}/candidate/applications/${first.id}/withdraw`).set(auth(user))).status, 409)

    const again = await apply(user, job)
    assert.equal(again.status, 201)
    assert.notEqual(again.body.id, first.id)
    const list = (await api().get(`${v1}/candidate/applications`).set(auth(user))).body.items
    assert.deepEqual(list.map((item) => item.status), ['applied', 'withdrawn'])

    // A rejected candidate cannot apply again: not selected is not withdrawn.
    await reject(recruiter, again, false)
    assert.equal((await apply(user, job)).status, 409)
  })

  it('lists and shows only the candidate\'s own applications', async () => {
    const { job } = await market()
    const mine = await applicantCandidate()
    const theirs = await applicantCandidate()
    const application = await applied(mine, job)
    assert.equal((await api().get(`${v1}/candidate/applications/${application.id}`).set(auth(mine))).status, 200)
    assert.equal((await api().get(`${v1}/candidate/applications/${application.id}`).set(auth(theirs))).status, 404)
    assert.equal((await api().post(`${v1}/candidate/applications/${application.id}/withdraw`).set(auth(theirs))).status, 404)
  })
})

describe('job pages for applicants (M-043)', () => {
  it('shows the candidate\'s application on the job and keeps a closed job readable for them only', async () => {
    const { recruiter, job } = await market()
    const user = await applicantCandidate()
    const before = (await api().get(`${v1}/jobs/${job._id}`).set(auth(user))).body
    assert.equal(before.application, null)
    const application = await applied(user, job)
    const after = (await api().get(`${v1}/jobs/${job._id}`).set(auth(user))).body
    assert.deepEqual(after.application, { id: application.id, status: 'applied' })

    await api().patch(`${v1}/recruiter/jobs/${job._id}/status`).set(auth(recruiter)).send({ status: 'closed' })
    const closed = await api().get(`${v1}/jobs/${job._id}`).set(auth(user))
    assert.deepEqual([closed.status, closed.body.accepting], [200, false])
    assert.equal((await api().get(`${v1}/jobs/${job._id}`).set(auth(await applicantCandidate()))).status, 404)
    assert.equal((await api().get(`${v1}/candidate/applications`).set(auth(user))).body.items[0].job.accepting, false)
  })
})

describe('pipeline stages (M-069 … M-072, OD5)', () => {
  const stages = async (recruiter) => (await api().get(`${v1}/recruiter/pipeline`).set(auth(recruiter))).body
  const addStage = (recruiter, body) => api().post(`${v1}/recruiter/pipeline/stages`).set(auth(recruiter)).send(body)

  it('starts with the six default stages, the first one "Applied"', async () => {
    const { recruiter } = await market()
    const { items, limits } = await stages(recruiter)
    assert.deepEqual(items.map((stage) => [stage.name, stage.category, stage.isEntry]), [
      ['Applied', 'applied', true],
      ['Screening', 'screening', false],
      ['Shortlisted', 'shortlisted', false],
      ['Interview', 'interview', false],
      ['Offer', 'offer', false],
      ['Hired', 'hired', false],
    ])
    assert.deepEqual(limits, { min: 2, max: 12 })
  })

  it('adds a custom stage as screening by default, with name rules and a 12-stage cap', async () => {
    const { recruiter } = await market()
    const added = await addStage(recruiter, { name: '  Portfolio review ' })
    assert.deepEqual([added.status, added.body.items.at(-1).name, added.body.items.at(-1).category], [201, 'Portfolio review', 'screening'])
    const tooLong = await addStage(recruiter, { name: 'x'.repeat(25) })
    assert.deepEqual([tooLong.status, tooLong.body.error.fields.name, tooLong.body.error.params.max], [422, 'too_long', 24])
    assert.equal((await addStage(recruiter, { name: '' })).body.error.fields.name, 'required')
    const duplicate = await addStage(recruiter, { name: 'PORTFOLIO REVIEW' })
    assert.deepEqual([duplicate.status, duplicate.body.error.fields.name], [422, 'duplicate'])
    for (let n = 1; n <= 5; n++) assert.equal((await addStage(recruiter, { name: `Extra ${n}` })).status, 201)
    const thirteenth = await addStage(recruiter, { name: 'One too many' })
    assert.deepEqual([thirteenth.status, thirteenth.body.error.fields.stages, thirteenth.body.error.params.max], [422, 'too_many', 12])
  })

  it('renames and re-categorises a stage; the first stage keeps its category', async () => {
    const { recruiter, company } = await market()
    const screening = await stageOf(company, 'Screening')
    const renamed = await api().patch(`${v1}/recruiter/pipeline/stages/${screening}`).set(auth(recruiter)).send({ name: 'Phone screen', category: 'interview' })
    const stage = renamed.body.items.find((item) => item.id === screening)
    assert.deepEqual([stage.name, stage.category, stage.tone], ['Phone screen', 'interview', 'primary'])
    const clash = await api().patch(`${v1}/recruiter/pipeline/stages/${screening}`).set(auth(recruiter)).send({ name: 'hired' })
    assert.equal(clash.body.error.fields.name, 'duplicate')

    const entry = await stageOf(company, 'Applied')
    const category = await api().patch(`${v1}/recruiter/pipeline/stages/${entry}`).set(auth(recruiter)).send({ category: 'offer' })
    assert.deepEqual([category.status, category.body.error.fields.category], [422, 'not_allowed'])
    assert.equal((await api().patch(`${v1}/recruiter/pipeline/stages/${entry}`).set(auth(recruiter)).send({ name: 'New' })).status, 200)
  })

  it('reorders stages with the first stage staying first', async () => {
    const { recruiter } = await market()
    const ids = (await stages(recruiter)).items.map((stage) => stage.id)
    const swapped = [ids[0], ids[2], ids[1], ...ids.slice(3)]
    const ok = await api().put(`${v1}/recruiter/pipeline/stages/order`).set(auth(recruiter)).send({ ids: swapped })
    assert.deepEqual(ok.body.items.map((stage) => stage.id), swapped)
    for (const bad of [[ids[1], ids[0], ...ids.slice(2)], ids.slice(1), [...ids.slice(0, 5), ids[4]]]) {
      assert.equal((await api().put(`${v1}/recruiter/pipeline/stages/order`).set(auth(recruiter)).send({ ids: bad })).status, 422)
    }
  })

  it('blocks removing the first stage, a stage with active applications, and going below two stages', async () => {
    const { recruiter, company, job } = await market()
    const application = await applied(await applicantCandidate(), job)
    await moveTo(recruiter, company, application, 'Interview')
    const remove = (id) => api().delete(`${v1}/recruiter/pipeline/stages/${id}`).set(auth(recruiter))

    const entry = await remove(await stageOf(company, 'Applied'))
    assert.deepEqual([entry.status, code(entry)], [409, 'CONFLICT'])
    const busy = await remove(await stageOf(company, 'Interview'))
    assert.deepEqual([busy.status, code(busy), busy.body.error.params.count], [409, 'IN_USE', 1])

    for (const name of ['Screening', 'Shortlisted', 'Offer']) assert.equal((await remove(await stageOf(company, name))).status, 200)
    const left = await remove(await stageOf(company, 'Hired'))
    assert.deepEqual(left.body.items.map((stage) => [stage.name, stage.order]), [['Applied', 0], ['Interview', 1]])
    const tooFew = await remove(await stageOf(company, 'Interview'))
    assert.deepEqual([tooFew.status, tooFew.body.error.fields.stages, tooFew.body.error.params.min], [422, 'too_few', 2])
  })
})

describe('moving applications between stages (M-070, M-071, OD5)', () => {
  it('maps the stage category to the candidate status and keeps dated history with stage names', async () => {
    const { recruiter, company, job } = await market()
    const user = await applicantCandidate()
    const application = await applied(user, job)
    await api().post(`${v1}/recruiter/pipeline/stages`).set(auth(recruiter)).send({ name: 'Portfolio review' })
    const expected = [['Screening', 'under_review'], ['Shortlisted', 'under_review'], ['Portfolio review', 'under_review'], ['Interview', 'interview'], ['Offer', 'offer'], ['Hired', 'hired'], ['Applied', 'applied']]
    for (const [name, status] of expected) {
      const res = await moveTo(recruiter, company, application, name)
      assert.deepEqual([res.status, res.body.status, res.body.stage.name], [200, status, name])
    }
    const stored = await Application.findById(application.id)
    assert.deepEqual(stored.history.map((step) => step.stageName), ['Applied', ...expected.map(([name]) => name)])
    assert.equal(stored.history.at(-1).actorType, 'recruiter')
    // Renaming a stage leaves the old name in the history (M-072).
    const screening = await stageOf(company, 'Screening')
    await api().patch(`${v1}/recruiter/pipeline/stages/${screening}`).set(auth(recruiter)).send({ name: 'Phone screen' })
    assert.equal((await Application.findById(application.id)).history[1].stageName, 'Screening')
    // The candidate sees status steps only: a move inside one status is not a step.
    const mine = (await api().get(`${v1}/candidate/applications/${application.id}`).set(auth(user))).body
    assert.deepEqual(mine.history.map((step) => step.status), ['applied', 'under_review', 'interview', 'offer', 'hired', 'applied'])
    assert.equal(await RecruiterActivity.countDocuments({ type: 'stage_changed' }), expected.length)
  })

  it('refuses other companies\' applications and stages, and withdrawn applications', async () => {
    const { recruiter, company, job } = await market()
    const { recruiter: stranger } = await market()
    const user = await applicantCandidate()
    const application = await applied(user, job)
    assert.equal((await moveTo(stranger, company, application, 'Screening')).status, 404)
    const foreignStage = await PipelineStage.findOne({ companyId: (await Company.findOne({ ownerUserId: stranger._id }))._id })
    const wrong = await move(recruiter, application, String(foreignStage._id))
    assert.deepEqual([wrong.status, wrong.body.error.fields.stageId], [422, 'invalid'])
    await api().post(`${v1}/candidate/applications/${application.id}/withdraw`).set(auth(user))
    assert.equal((await moveTo(recruiter, company, application, 'Screening')).status, 409)
    assert.equal((await reject(recruiter, application, true)).status, 409)
  })
})

describe('the recruiter\'s Applications table and board (M-076, M-077)', () => {
  it('lists active applications, filters by job and stage, and lists not selected and withdrawn ones on request', async () => {
    const { recruiter, company, job } = await market()
    const second = await publish(company, recruiter, { title: 'UX Researcher' })
    const [a, b, c, d] = await Promise.all([applicantCandidate(), applicantCandidate(), applicantCandidate(), applicantCandidate()])
    const appA = await applied(a, job)
    const appB = await applied(b, job)
    await applied(c, second)
    const appD = await applied(d, second)
    await moveTo(recruiter, company, appB, 'Interview')
    await reject(recruiter, appA, true)
    await api().post(`${v1}/candidate/applications/${appD.id}/withdraw`).set(auth(d))
    const list = async (query = '') => (await api().get(`${v1}/recruiter/applications${query}`).set(auth(recruiter))).body

    const all = await list()
    assert.equal(all.items.length, 2)
    assert.deepEqual(all.counts, { active: 2, not_selected: 1, withdrawn: 1 })
    assert.deepEqual((await list(`?jobId=${job._id}`)).items.map((item) => item.job.title), ['Senior Product Designer'])
    assert.deepEqual((await list(`?jobId=${job._id}`)).counts, { active: 1, not_selected: 1, withdrawn: 0 })
    assert.deepEqual((await list(`?stageId=${await stageOf(company, 'Interview')}`)).items.map((item) => item.id), [appB.id])
    assert.deepEqual((await list('?status=not_selected')).items.map((item) => item.id), [appA.id])
    assert.deepEqual((await list('?status=withdrawn')).items.map((item) => item.id), [appD.id])
    const row = all.items.find((item) => item.id === appB.id)
    assert.deepEqual([row.stage.name, row.status, row.candidate.fullName, row.candidate.alignedSkills], ['Interview', 'interview', b.fullName, 1])
    assert.equal((await api().get(`${v1}/recruiter/applications`).set(auth(a))).status, 403)
  })
})

describe('status emails (M-091, U13, U33, OQ-6e)', () => {
  const statusMails = (user) => mailTo(user.email, 'application_status')

  it('sends one "under review" email 10 minutes after the last move, then an "interview" email', async () => {
    const { recruiter, company, job } = await market()
    const user = await applicantCandidate()
    const application = await applied(user, job)
    await moveTo(recruiter, company, application, 'Screening')
    await moveTo(recruiter, company, application, 'Shortlisted')
    await tickAt(9 * MINUTE)
    assert.equal(statusMails(user).length, 0)
    await tickAt(11 * MINUTE)
    assert.equal(statusMails(user).length, 1)
    assert.equal(statusMails(user)[0].params.status, 'Under review')
    await tickAt(12 * MINUTE)
    assert.equal(statusMails(user).length, 1, 'sent once')

    await moveTo(recruiter, company, application, 'Interview')
    await tickAt(11 * MINUTE)
    assert.deepEqual(statusMails(user).map((mail) => mail.params.status), ['Under review', 'Interview'])
    assert.equal((await Application.findById(application.id)).lastEmailedStatus, 'interview')
  })

  it('collapses moves inside the wait: back to the status the candidate was last told sends nothing', async () => {
    const { recruiter, company, job } = await market()
    const user = await applicantCandidate()
    const application = await applied(user, job)
    await moveTo(recruiter, company, application, 'Interview')
    await tickAt(11 * MINUTE)
    await moveTo(recruiter, company, application, 'Screening')
    await moveTo(recruiter, company, application, 'Interview')
    await tickAt(22 * MINUTE)
    assert.equal(statusMails(user).length, 1)
    // A move to Applied while the candidate was last told "Applied" is silent too.
    const other = await applicantCandidate()
    const second = await applied(other, job)
    await moveTo(recruiter, company, second, 'Screening')
    await moveTo(recruiter, company, second, 'Applied')
    await tickAt(33 * MINUTE)
    assert.equal(statusMails(other).length, 0)
  })

  it('sends in the candidate\'s language and respects the email toggle', async () => {
    const { recruiter, company, job } = await market()
    const spanish = await applicantCandidate({ language: 'es' })
    const application = await applied(spanish, job)
    await moveTo(recruiter, company, application, 'Interview')
    await tickAt(11 * MINUTE)
    const [mail] = statusMails(spanish)
    assert.deepEqual([mail.language, mail.params.status, mail.subject], ['es', 'Entrevista', 'Novedades sobre tu candidatura a Senior Product Designer'])

    const quiet = await applicantCandidate({ emailOff: ['applications'] })
    const quietApplication = await applied(quiet, job)
    await moveTo(recruiter, company, quietApplication, 'Interview')
    await tickAt(22 * MINUTE)
    assert.equal(statusMails(quiet).length, 0)
    assert.equal(await EmailLog.countDocuments({ userId: quiet._id, type: 'application_status', status: 'skipped_toggle' }), 1)
  })

  it('sends nothing for a withdrawn application', async () => {
    const { recruiter, company, job } = await market()
    const user = await applicantCandidate()
    const application = await applied(user, job)
    await moveTo(recruiter, company, application, 'Interview')
    await api().post(`${v1}/candidate/applications/${application.id}/withdraw`).set(auth(user))
    assert.equal(await ScheduledTask.countDocuments({ type: 'email.stage', status: 'pending' }), 0)
    await tickAt(11 * MINUTE)
    assert.equal(statusMails(user).length, 0)
  })
})

describe('rejection (M-090, U33, OQ-6e)', () => {
  it('moves the card off the board, emails after the wait, and does not email when undone or unchecked', async () => {
    const { recruiter, company, job } = await market()
    const user = await applicantCandidate({ language: 'es' })
    const application = await applied(user, job)
    const rejectedMails = () => mailTo(user.email, 'application_rejected')

    const res = await reject(recruiter, application, true)
    assert.deepEqual([res.status, res.body.status], [200, 'not_selected'])
    const board = (await api().get(`${v1}/recruiter/applications`).set(auth(recruiter))).body
    assert.equal(board.items.length, 0)
    assert.equal((await api().get(`${v1}/recruiter/applications?status=not_selected`).set(auth(recruiter))).body.items[0].id, application.id)
    assert.equal((await api().get(`${v1}/candidate/applications/${application.id}`).set(auth(user))).body.status, 'not_selected')
    assert.equal((await reject(recruiter, application, true)).status, 409)

    // Undo inside the window: choosing a stage again restores the status, and nothing is sent.
    await tickAt(5 * MINUTE)
    assert.equal(rejectedMails().length, 0)
    const undone = await moveTo(recruiter, company, application, 'Applied')
    assert.deepEqual([undone.body.status, undone.body.stage.name], ['applied', 'Applied'])
    await tickAt(20 * MINUTE)
    assert.equal(rejectedMails().length + mailTo(user.email, 'application_status').length, 0)

    // Unchecked: no email at all.
    await reject(recruiter, application, false)
    await tickAt(40 * MINUTE)
    assert.equal(rejectedMails().length, 0)
    await moveTo(recruiter, company, application, 'Applied')
    // Checked: the Spanish email arrives after the wait.
    await reject(recruiter, application, true)
    await tickAt(59 * MINUTE)
    assert.equal(rejectedMails().length, 1)
    assert.deepEqual([rejectedMails()[0].language, rejectedMails()[0].subject], ['es', 'Novedades sobre tu candidatura a Senior Product Designer'])
    assert.equal(rejectedMails()[0].params.status, 'No seleccionada')
    await tickAt(80 * MINUTE)
    assert.equal(rejectedMails().length, 1)
  })
})

describe('new applications to the recruiter (OD14)', () => {
  const mails = (recruiter) => mailTo(recruiter.email, 'new_applications')

  it('sends one email an hour after the first application, counting everything since the last email', async () => {
    const { recruiter, job } = await market()
    const [a, b, c] = await Promise.all([applicantCandidate(), applicantCandidate(), applicantCandidate()])
    await applied(a, job)
    await tickAt(59 * MINUTE)
    assert.equal(mails(recruiter).length, 0)
    await applied(b, job)
    assert.equal(await ScheduledTask.countDocuments({ type: 'email.new-applications', status: 'pending' }), 1, 'the second application joins the pending email')
    await tickAt(61 * MINUTE)
    assert.equal(mails(recruiter).length, 1)
    assert.deepEqual([mails(recruiter)[0].params.countLabel, mails(recruiter)[0].subject], ['2 new applications', '2 new applications for Senior Product Designer'])

    // A new application after the email waits until an hour after that email (the tick time was +61 min).
    await applied(c, job)
    await tickAt(100 * MINUTE)
    assert.equal(mails(recruiter).length, 1)
    await tickAt(122 * MINUTE)
    assert.equal(mails(recruiter).length, 2)
    assert.equal(mails(recruiter)[1].params.countLabel, '1 new application')
  })

  it('does not count withdrawn applications and respects the email toggle', async () => {
    const { recruiter, job } = await market()
    const [a, b] = await Promise.all([applicantCandidate(), applicantCandidate()])
    const first = await applied(a, job)
    await applied(b, job)
    await api().post(`${v1}/candidate/applications/${first.id}/withdraw`).set(auth(a))
    await tickAt(61 * MINUTE)
    assert.equal(mails(recruiter)[0].params.countLabel, '1 new application')

    await User.updateOne({ _id: recruiter._id }, { emailOff: ['new_applications'] })
    await applied(await applicantCandidate(), job)
    await tickAt(130 * MINUTE)
    assert.equal(mails(recruiter).length, 1)
    assert.equal(await EmailLog.countDocuments({ userId: recruiter._id, type: 'new_applications', status: 'skipped_toggle' }), 1)
  })
})

describe('counters, KPI, funnel and momentum (M-082, M-083, M-094, M-170, M-178)', () => {
  it('counts the candidate\'s active applications and answers recruiters with unread messages only', async () => {
    const { recruiter, job } = await market()
    const second = await publish((await Company.findOne({ ownerUserId: recruiter._id })), recruiter, { title: 'UX Researcher' })
    const user = await applicantCandidate()
    const counters = async (who) => (await api().get(`${v1}/me/counters`).set(auth(who))).body
    assert.deepEqual(await counters(user), { unreadMessages: 0, activeApplications: 0, notifications: { unread: 0, sections: {} } })
    const one = await applied(user, job)
    const two = await applied(user, second)
    assert.equal((await counters(user)).activeApplications, 2)
    await api().post(`${v1}/candidate/applications/${one.id}/withdraw`).set(auth(user))
    await reject(recruiter, two, false)
    assert.equal((await counters(user)).activeApplications, 0)
    // P11b-Q2: no application badge for recruiters; the two new applications and the withdrawal are notifications.
    assert.deepEqual(await counters(recruiter), { unreadMessages: 0, notifications: { unread: 3, sections: { applications: 3 } } })

    const unapproved = await createUser({ role: 'recruiter', status: 'onboarding' })
    assert.equal((await api().get(`${v1}/me/counters`).set(auth(unapproved))).status, 403)
    // P11b-Q2: admins poll the counters for their notifications.
    const admin = await createUser({ role: 'admin' })
    assert.deepEqual(await counters(admin), { notifications: { unread: 0, sections: {} } })
  })

  it('computes the Applications KPI and the funnel over the company\'s stages ever reached', async () => {
    const { recruiter, company, job } = await market()
    const [a, b, c, d] = await Promise.all([applicantCandidate(), applicantCandidate(), applicantCandidate(), applicantCandidate()])
    await applied(a, job)
    const appB = await applied(b, job)
    const appC = await applied(c, job)
    const appD = await applied(d, job)
    await moveTo(recruiter, company, appB, 'Interview')
    await moveTo(recruiter, company, appC, 'Screening')
    await reject(recruiter, appC, true)
    await api().post(`${v1}/candidate/applications/${appD.id}/withdraw`).set(auth(d))

    const overview = (await api().get(`${v1}/recruiter/overview`).set(auth(recruiter))).body
    assert.equal(overview.applications, 2, 'applied and interview; not selected and withdrawn are left out')
    const funnel = (await api().get(`${v1}/recruiter/overview/funnel`).set(auth(recruiter))).body
    assert.deepEqual(funnel.items.map((stage) => [stage.name, stage.count]), [['Applied', 3], ['Screening', 1], ['Shortlisted', 0], ['Interview', 1], ['Offer', 0], ['Hired', 0]])
  })

  it('buckets the momentum by Monday weeks in the requested time zone', async () => {
    const { recruiter, company, job } = await market()
    const user = await applicantCandidate()
    const stage = await PipelineStage.findOne({ companyId: company._id, isEntry: true })
    const at = new Date('2026-11-01T23:30:00Z')
    await Application.create({ candidateId: user._id, jobId: job._id, companyId: company._id, stageId: stage._id, consentAt: at, appliedAt: at })
    await ShortlistEntry.collection.insertOne({ companyId: company._id, candidateId: user._id, addedBy: recruiter._id, createdAt: at, updatedAt: at })
    const now = DateTime.fromISO('2026-11-04T12:00:00Z') // a Wednesday

    // 23:30 UTC on Sunday 1 Nov is already Monday 2 Nov in Madrid, so it belongs to this week there and to last week in UTC.
    const madrid = await momentum(company, { timeZone: 'Europe/Madrid', period: 'this_week' }, now)
    assert.equal(madrid.days[0].date, '2026-11-02')
    assert.deepEqual([madrid.days[0].applications, madrid.days[0].shortlisted], [1, 1])
    const utcThis = await momentum(company, { timeZone: 'UTC', period: 'this_week' }, now)
    assert.equal(utcThis.days.reduce((sum, day) => sum + day.applications + day.shortlisted, 0), 0)
    const utcLast = await momentum(company, { timeZone: 'UTC', period: 'last_week' }, now)
    assert.deepEqual(utcLast.days.map((day) => day.date), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    assert.deepEqual([utcLast.days[6].applications, utcLast.days[6].shortlisted], [1, 1])

    const res = await api().get(`${v1}/recruiter/overview/momentum?tz=Europe/Madrid`).set(auth(recruiter))
    assert.deepEqual([res.status, res.body.days.length, res.body.timeZone], [200, 7, 'Europe/Madrid'])
    assert.equal((await api().get(`${v1}/recruiter/overview/momentum?tz=Nowhere/Land`).set(auth(recruiter))).status, 422)
  })
})

describe('recruiter access to applicants (P4-D11, M-030, M-073)', () => {
  it('opens the profile of an applicant who is not discoverable, including after a withdrawal, and lists the CV they sent', async () => {
    const { recruiter, job } = await market()
    const hidden = await applicantCandidate({ privacy: { discoverable: false, resumeVisible: false, matchingConsent: true } })
    const profile = () => api().get(`${v1}/recruiter/candidates/${hidden._id}`).set(auth(recruiter))
    assert.equal((await profile()).status, 404)
    const application = await applied(hidden, job)
    const opened = await profile()
    assert.equal(opened.status, 200)
    assert.deepEqual(opened.body.applications.map((item) => [item.id, item.status, item.job.title]), [[application.id, 'applied', 'Senior Product Designer']])
    const cv = (await api().get(`${v1}/recruiter/candidates/${hidden._id}/cv`).set(auth(recruiter))).body
    assert.equal(cv.live, null)
    assert.equal(cv.applied[0].cv.originalName, 'cv.pdf')

    // M-030: deleting the CV file leaves "removed" for the recruiter.
    await CvVersion.updateOne({ userId: hidden._id }, { fileId: null })
    assert.equal((await api().get(`${v1}/recruiter/candidates/${hidden._id}/cv`).set(auth(recruiter))).body.applied[0].cv, null)
    assert.equal((await api().get(`${v1}/candidate/applications/${application.id}`).set(auth(hidden))).body.cv.removed, true)

    await api().post(`${v1}/candidate/applications/${application.id}/withdraw`).set(auth(hidden))
    assert.equal((await profile()).status, 200)
    const { recruiter: stranger } = await market()
    assert.equal((await api().get(`${v1}/recruiter/candidates/${hidden._id}`).set(auth(stranger))).status, 404)
  })
})
