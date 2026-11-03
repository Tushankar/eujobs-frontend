import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { DateTime } from 'luxon'
import { ScheduledTask } from '../jobs/models.js'
import { EmailLog } from '../lib/mail/emailLog.model.js'
import { AlertMatch, JobAlert } from '../modules/alerts/alerts.model.js'
import { alertMatches, digestSlot } from '../modules/alerts/alerts.delivery.js'
import { PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PLACES } from '../seed/data/places.js'
import { api, auth, createUser, mailTo, useTestDb } from './helpers/index.js'
import { approvedRecruiter, jobBody } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

useTestDb([User, Company, Job, CandidateProfile, Subscription, PipelineStage, JobAlert, AlertMatch, ScheduledTask, EmailLog])
useFakePlaces()
before(() => seedCatalog())

const v1 = '/api/v1'
const DAY = 24 * 60 * 60 * 1000

/** A candidate with Plus (unless `plus: false`), picker country GB unless given. */
async function candidate({ plus = true, ...fields } = {}) {
  const user = await createUser({ role: 'candidate', ...fields })
  if (plus) await Subscription.create({ userId: user._id, planKey: 'plus', status: 'active' })
  return user
}

const create = (user, body) => api().post(`${v1}/candidate/job-alerts`).set(auth(user)).send({ frequency: 'instant', ...body })
const patch = (user, id, body) => api().patch(`${v1}/candidate/job-alerts/${id}`).set(auth(user)).send(body)
const list = async (user) => (await api().get(`${v1}/candidate/job-alerts`).set(auth(user))).body
const tick = (date) => api().post(`${v1}/_test/scheduler/tick`).send({ now: date.toISOString() })

/** The first 08:00 in `zone` after now (today before 08:00, otherwise tomorrow), so the test passes at any hour. */
function nextEight(zone) {
  const now = DateTime.now().setZone(zone)
  const today = now.set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
  return today > now ? today : today.plus({ days: 1 })
}

/** A job published through the recruiter API, so the first publish schedules the instant alerts (M-097). */
async function publishJob(recruiter, overrides = {}) {
  const draft = await api().post(`${v1}/recruiter/jobs`).set(auth(recruiter)).send(jobBody(overrides))
  assert.equal(draft.status, 201, JSON.stringify(draft.body))
  const published = await api().patch(`${v1}/recruiter/jobs/${draft.body.id}/status`).set(auth(recruiter)).send({ status: 'published' })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  return published.body
}

describe('job alert CRUD and limits (§3.6, M-031, P7-Q2)', () => {
  it('creates alerts in the picker country and language, with an optional city in that country', async () => {
    const user = await candidate({ language: 'es' })
    const res = await create(user, { name: 'Diseño', keywords: 'designer', placeId: PLACES.london.placeId, frequency: 'daily' })
    assert.equal(res.status, 201)
    assert.deepEqual([res.body.country, res.body.location.city, res.body.frequency, res.body.active], ['GB', 'London', 'daily', true])
    assert.equal((await JobAlert.findById(res.body.id)).language, 'es')
    const other = await create(user, { name: 'Berlin', keywords: 'designer', placeId: PLACES.berlin.placeId })
    assert.deepEqual([other.status, other.body.error.fields.placeId], [422, 'other_country'])

    const remote = await candidate({ pickerCountry: 'REMOTE' })
    assert.equal((await create(remote, { name: 'Remote', keywords: 'designer' })).body.country, 'REMOTE')
    assert.equal((await create(remote, { name: 'Remote', keywords: 'designer', placeId: PLACES.london.placeId })).status, 422)
  })

  it('allows 10 alerts, names up to 80 and keywords up to 120 characters', async () => {
    const user = await candidate()
    const name = await create(user, { name: 'x'.repeat(81), keywords: 'designer' })
    assert.deepEqual([name.status, name.body.error.fields.name, name.body.error.params.max], [422, 'too_long', 80])
    assert.equal((await create(user, { name: 'Alert', keywords: 'x'.repeat(121) })).body.error.fields.keywords, 'too_long')
    assert.equal((await create(user, { name: '', keywords: 'designer' })).body.error.fields.name, 'required')
    for (let i = 0; i < 10; i += 1) assert.equal((await create(user, { name: `Alert ${i}`, keywords: 'designer' })).status, 201)
    const eleventh = await create(user, { name: 'One more', keywords: 'designer' })
    assert.deepEqual([eleventh.status, eleventh.body.error.fields.alerts, eleventh.body.error.params.max], [422, 'too_many', 10])
  })

  it('edits, pauses and keeps the city unless it is sent', async () => {
    const user = await candidate()
    const { body } = await create(user, { name: 'Alert', keywords: 'designer', placeId: PLACES.london.placeId })
    const edited = await patch(user, body.id, { name: 'Renamed', active: false })
    assert.deepEqual([edited.body.name, edited.body.active, edited.body.location.city], ['Renamed', false, 'London'])
    assert.equal((await patch(user, body.id, { placeId: null })).body.location, null)
    const stranger = await candidate()
    assert.equal((await patch(stranger, body.id, { name: 'Mine' })).status, 404)
  })

  it('keeps a Free candidate’s alerts readable and deletable, but paused and locked (M-119)', async () => {
    const user = await candidate()
    const { body } = await create(user, { name: 'Alert', keywords: 'designer' })
    assert.equal((await list(user)).planPaused, false)
    await Subscription.updateOne({ userId: user._id }, { status: 'canceled' })
    const listed = await list(user)
    assert.deepEqual([listed.planPaused, listed.items.length], [true, 1])
    const locked = await create(user, { name: 'Another', keywords: 'designer' })
    assert.deepEqual([locked.status, locked.body.error.code], [402, 'PLAN_REQUIRED'])
    assert.equal((await patch(user, body.id, { active: false })).status, 402)
    assert.equal((await api().delete(`${v1}/candidate/job-alerts/${body.id}`).set(auth(user))).status, 204)
    assert.equal((await list(user)).items.length, 0)
  })
})

describe('matching (M-098, U35)', () => {
  const company = { displayName: 'Acme Studio', industry: 'Fintech' }
  const job = { title: 'React Engineer', country: 'GB', workPreference: 'hybrid', level: 'mid', location: PLACES.london, requiredSkills: [{ name: 'TypeScript' }], preferredSkills: [] }
  const alert = (fields) => ({ keywords: '', country: 'GB', language: 'en', location: null, ...fields })

  it('needs every keyword in the job fields, the same country and the same city', () => {
    assert.equal(alertMatches(alert({ keywords: 'react fintech' }), job, company), true)
    assert.equal(alertMatches(alert({ keywords: 'react senior' }), job, company), false)
    assert.equal(alertMatches(alert({ keywords: 'react senior' }), { ...job, level: 'senior' }, company), true)
    assert.equal(alertMatches(alert({ keywords: 'typescript london hybrid' }), job, company), true)
    assert.equal(alertMatches(alert({ keywords: 'react', country: 'DE' }), job, company), false)
    assert.equal(alertMatches(alert({ keywords: 'react', location: PLACES.manchester }), job, company), false)
    assert.equal(alertMatches(alert({ keywords: 'react', location: PLACES.london }), job, company), true)
    assert.equal(alertMatches(alert({ keywords: 'react', country: 'REMOTE' }), { ...job, country: 'REMOTE', location: null, workPreference: 'remote' }, company), true)
  })

  it('matches the labels in the alert’s language', () => {
    assert.equal(alertMatches(alert({ keywords: 'react intermedio', language: 'es' }), job, company), true)
    assert.equal(alertMatches(alert({ keywords: 'react intermedio', language: 'en' }), job, company), false)
    assert.equal(alertMatches(alert({ keywords: 'híbrido', language: 'es' }), job, company), true)
  })
})

describe('instant alerts (M-097)', () => {
  it('emails matching instant alerts once, on the first publish only, and only to candidates with the plan', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const plus = await candidate()
    const lapsed = await candidate()
    const daily = await candidate()
    await create(plus, { name: 'Design', keywords: 'designer' })
    await create(plus, { name: 'Other', keywords: 'accountant' })
    await create(lapsed, { name: 'Design', keywords: 'designer' })
    await create(daily, { name: 'Design', keywords: 'designer', frequency: 'daily' })
    await Subscription.updateOne({ userId: lapsed._id }, { status: 'canceled' })

    const job = await publishJob(recruiter, { title: 'Product Designer' })
    await tick(new Date())
    const [mail, ...rest] = mailTo(plus.email, 'alert_instant')
    assert.equal(rest.length, 0)
    assert.deepEqual(mail.params.items, [`Product Designer · ${recruiter.fullName} Studio · London`])
    assert.match(mail.params.link, new RegExp(`/candidate/jobs/${job.id}$`))
    assert.equal(mailTo(lapsed.email).length + mailTo(daily.email).length, 0)

    // Pause, resume and edit never send again (M-037, M-097).
    await api().patch(`${v1}/recruiter/jobs/${job.id}/status`).set(auth(recruiter)).send({ status: 'paused' })
    await api().patch(`${v1}/recruiter/jobs/${job.id}/status`).set(auth(recruiter)).send({ status: 'published' })
    await api().put(`${v1}/recruiter/jobs/${job.id}`).set(auth(recruiter)).send(jobBody({ title: 'Senior Product Designer' }))
    await tick(new Date())
    assert.equal(mailTo(plus.email, 'alert_instant').length, 1)
    assert.equal(await ScheduledTask.countDocuments({ type: 'alerts.instant' }), 1)
  })

  it('respects the daily email cap (OD9)', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const plus = await candidate()
    await create(plus, { name: 'Design', keywords: 'designer' })
    await EmailLog.insertMany(Array.from({ length: 400 }, () => ({ type: 'alert_instant', class: 'non_critical', to: 'someone@inbox.localworkman.eu', status: 'sent' })))
    await publishJob(recruiter, { title: 'Product Designer' })
    await tick(new Date())
    assert.equal(mailTo(plus.email).length, 0)
    assert.equal(await EmailLog.countDocuments({ type: 'alert_instant', status: 'skipped_cap' }), 1)
  })
})

describe('digests (U12)', () => {
  it('finds the last 08:00 slot in the user’s time zone, Mondays for weekly', () => {
    const at = (iso) => DateTime.fromISO(iso, { zone: 'Europe/Madrid' }).toJSDate()
    assert.deepEqual(digestSlot(at('2026-11-04T07:59'), 'daily', 'Europe/Madrid'), at('2026-11-03T08:00'))
    assert.deepEqual(digestSlot(at('2026-11-04T08:00'), 'daily', 'Europe/Madrid'), at('2026-11-04T08:00'))
    assert.deepEqual(digestSlot(at('2026-11-04T08:00'), 'weekly', 'Europe/Madrid'), at('2026-11-02T08:00'))
    assert.deepEqual(digestSlot(at('2026-11-02T07:00'), 'weekly', 'Europe/Madrid'), at('2026-10-26T08:00'))
  })

  it('sends a daily digest at 08:00 local with the jobs first published since the last one, and no empty digests', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const user = await candidate({ timezone: 'Europe/Madrid' })
    await create(user, { name: 'Design', keywords: 'designer', frequency: 'daily' })
    await publishJob(recruiter, { title: 'Product Designer' })
    await publishJob(recruiter, { title: 'Accountant' })
    const next8 = nextEight('Europe/Madrid')

    await tick(next8.minus({ minutes: 1 }).toJSDate())
    assert.equal(mailTo(user.email, 'alert_daily').length, 0)
    await tick(next8.toJSDate())
    const [mail] = mailTo(user.email, 'alert_daily')
    assert.deepEqual([mail.params.items.length, mail.params.countLabel], [1, '1 new job'])
    assert.match(mail.params.items[0], /^Product Designer · /)
    await tick(next8.plus({ days: 1 }).toJSDate())
    assert.equal(mailTo(user.email, 'alert_daily').length, 1)
  })

  it('pauses digests while the plan has lapsed and resumes after re-subscribing (M-119)', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const user = await candidate({ timezone: 'Europe/London' })
    await create(user, { name: 'Design', keywords: 'designer', frequency: 'weekly' })
    await publishJob(recruiter, { title: 'Product Designer' })
    await Subscription.updateOne({ userId: user._id }, { status: 'canceled' })
    const monday = DateTime.now().setZone('Europe/London').plus({ weeks: 1 }).set({ weekday: 1, hour: 8, minute: 0, second: 0, millisecond: 0 })
    await tick(monday.toJSDate())
    assert.equal(mailTo(user.email).length, 0)
    await Subscription.updateOne({ userId: user._id }, { status: 'active' })
    await tick(monday.plus({ minutes: 1 }).toJSDate())
    assert.equal(mailTo(user.email, 'alert_weekly').length, 1)
  })

  it('lists at most the 20 newest jobs, with "See all" to Find jobs with the alert keywords (P7-C4 change)', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const user = await candidate({ timezone: 'Europe/London' })
    await create(user, { name: 'Design', keywords: 'designer', frequency: 'daily' })
    const first = await Job.findById((await publishJob(recruiter, { title: 'Product Designer' })).id).lean()
    const start = first.firstPublishedAt.getTime()
    await Job.insertMany(
      Array.from({ length: 20 }, (_, index) => {
        const at = new Date(start + (index + 1) * 1000)
        return { ...first, _id: undefined, title: `Designer ${index + 1}`, publishedAt: at, firstPublishedAt: at }
      }),
    )
    const next8 = nextEight('Europe/London')
    await tick(next8.toJSDate())
    const [mail] = mailTo(user.email, 'alert_daily')
    assert.deepEqual([mail.params.items.length, mail.params.countLabel, mail.params.shown, mail.params.total], [20, '21 new jobs', 20, 21])
    assert.match(mail.params.items[0], /^Designer 20 · /)
    assert.ok(mail.params.moreLink.endsWith('/candidate/jobs?q=designer'))
    assert.match(mail.text, /These are the 20 newest\. See all 21 jobs: http\S+\/candidate\/jobs\?q=designer/)
    assert.equal(await AlertMatch.countDocuments(), 20)
  })

  it('leaves a job out once it went out instantly for the same alert', async () => {
    const { user: recruiter } = await approvedRecruiter()
    const user = await candidate()
    const { body } = await create(user, { name: 'Design', keywords: 'designer' })
    await publishJob(recruiter, { title: 'Product Designer' })
    await tick(new Date())
    await JobAlert.updateOne({ _id: body.id }, { frequency: 'daily' })
    await tick(new Date(Date.now() + 2 * DAY))
    assert.equal(mailTo(user.email, 'alert_daily').length, 0)
  })
})
