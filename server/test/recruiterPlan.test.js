import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { setStripeClient, testSignature } from '../lib/stripe.js'
import { Application, PipelineStage } from '../modules/applications/applications.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { CandidateNote, ShortlistEntry } from '../modules/discovery/discovery.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { enforceFreeJobLimit } from '../modules/jobs/jobs.service.js'
import { Conversation, Message } from '../modules/messages/messages.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { AppConfig, Counter, Payment, StripeEvent, Subscription } from '../modules/payments/payments.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { RECRUITER_PLUS_PRICES } from '../seed/data/catalog.js'
import { api, auth, createUser, mailTo, useTestDb } from './helpers/index.js'
import { approvedRecruiter, jobBody, listedCandidate } from './helpers/market.js'
import { useFakePlaces } from './helpers/places.js'

/*
 * Phase 11c, §3.22: Recruiter Plus. Every recruiter lock Free vs Plus, the 1-published-job rule, the plan-end pause
 * and the start-up step, the recruiter webhooks, the admin totals by role.
 */
useTestDb([User, Company, Job, CandidateProfile, Application, PipelineStage, ShortlistEntry, CandidateNote, Conversation, Message, Subscription, Payment, Counter, StripeEvent])
useFakePlaces()
before(() => seedCatalog())

const v1 = '/api/v1'
// P11d-C1: Recruiter Plus also holds `interviews`.
const RECRUITER_KEYS = ['jobs_unlimited', 'discovery', 'outreach', 'ai', 'interviews']
const createJob = (user, body) => api().post(`${v1}/recruiter/jobs`).set(auth(user)).send(jobBody(body))
const setStatus = (user, id, status) => api().patch(`${v1}/recruiter/jobs/${id}/status`).set(auth(user)).send({ status })
async function published(user, body) {
  const { id } = (await createJob(user, body)).body
  const res = await setStatus(user, id, 'published')
  assert.equal(res.status, 200, JSON.stringify(res.body))
  return res.body
}
const planRequired = (res, entitlement) => {
  assert.equal(res.status, 402, `${res.req.method} ${res.req.path}: ${res.status} ${JSON.stringify(res.body)}`)
  assert.deepEqual(res.body.error, { code: 'PLAN_REQUIRED', params: { entitlement } })
}
async function applied(candidate, job, status = 'applied') {
  const stage = await PipelineStage.findOne({ companyId: job.companyId, isEntry: true })
  const now = new Date()
  return Application.create({ candidateId: candidate._id, jobId: job._id ?? job.id, companyId: job.companyId, stageId: stage._id, status, consentAt: now, appliedAt: now, history: [{ status: 'applied', at: now, actorType: 'candidate' }] })
}

describe('plan, /me and prices (P11c-Q1, Q2)', () => {
  it('gives recruiters Free or Recruiter Plus in /me', async () => {
    const { user: free } = await approvedRecruiter({ plus: false })
    const meFree = (await api().get(`${v1}/me`).set(auth(free))).body
    assert.deepEqual([meFree.plan, meFree.entitlements], ['free', []])
    const { user: plus } = await approvedRecruiter()
    const mePlus = (await api().get(`${v1}/me`).set(auth(plus))).body
    assert.deepEqual([mePlus.plan, mePlus.entitlements], ['recruiter_plus', RECRUITER_KEYS])
  })

  it('prices Recruiter Plus in the company country currency, from the £49 row', async () => {
    for (const [city, currency] of [['london', 'GBP'], ['berlin', 'EUR'], ['warsaw', 'PLN'], ['stockholm', 'SEK']]) {
      const { user } = await approvedRecruiter({ city, plus: false, pickerCountry: 'GB' })
      const quote = await api().get(`${v1}/payments/quote`).query({ kind: 'subscription', itemId: 'recruiter_plus' }).set(auth(user))
      assert.equal(quote.status, 200, JSON.stringify(quote.body))
      assert.deepEqual([quote.body.itemName, quote.body.currency, quote.body.amountMinor], ['Recruiter Plus', currency, RECRUITER_PLUS_PRICES[currency] * 100])
      const plans = (await api().get(`${v1}/plans`).set(auth(user))).body.items
      assert.deepEqual(
        plans.map((plan) => [plan.key, plan.price]),
        [
          ['recruiter_free', { amountMinor: 0, currency }],
          ['recruiter_plus', { amountMinor: RECRUITER_PLUS_PRICES[currency] * 100, currency }],
        ],
      )
    }
  })

  it('sells each role only its own plan', async () => {
    const { user: recruiter } = await approvedRecruiter({ plus: false })
    const candidate = await createUser()
    const quote = (user, itemId) => api().get(`${v1}/payments/quote`).query({ kind: 'subscription', itemId }).set(auth(user))
    assert.equal((await quote(recruiter, 'plus')).status, 422)
    assert.equal((await quote(candidate, 'recruiter_plus')).status, 422)
    assert.deepEqual((await api().get(`${v1}/plans`).set(auth(candidate))).body.items.map((plan) => plan.key), ['free', 'plus'])
  })

  it('opens the Portal for a subscribed recruiter and returns to recruiter Billing', async () => {
    const { user } = await approvedRecruiter()
    await Subscription.updateOne({ userId: user._id }, { stripeCustomerId: 'cus_portal' })
    let params
    setStripeClient({ billingPortal: { sessions: { create: async (body) => ((params = body), { url: 'https://billing.stripe.com/p/session' }) } } })
    try {
      const res = await api().post(`${v1}/payments/portal-session`).set(auth(user))
      assert.equal(res.status, 200)
      const { value } = await AppConfig.findOne({ key: 'stripe' })
      assert.equal(params.customer, 'cus_portal')
      // 2026-11-13: the recruiter configuration, whose plan switches offer Recruiter Plus prices only.
      assert.equal(params.configuration, value.portalConfigurationIds.recruiter)
      assert.notEqual(value.portalConfigurationIds.recruiter, value.portalConfigurationIds.candidate)
      assert.match(params.return_url, /\/recruiter\/settings\/billing$/)
    } finally {
      setStripeClient()
    }
    assert.equal((await api().get(`${v1}/recruiter/subscription`).set(auth(user))).body.subscription.planKey, 'recruiter_plus')
  })
})

describe('the 1-published-job rule (P11c-Q3, Q5)', () => {
  it('lets Free publish one job and answers 402 jobs_unlimited for a second, by publish, republish and reopen', async () => {
    const { user } = await approvedRecruiter({ plus: false })
    const first = await published(user, { title: 'First role' })
    const draft = (await createJob(user, { title: 'Second role' })).body
    planRequired(await setStatus(user, draft.id, 'published'), 'jobs_unlimited')
    assert.equal((await Job.findById(draft.id)).status, 'draft')
    // Pausing the live job frees the slot; a paused or closed job going live again counts too.
    assert.equal((await setStatus(user, first.id, 'paused')).status, 200)
    assert.equal((await setStatus(user, draft.id, 'published')).status, 200)
    planRequired(await setStatus(user, first.id, 'published'), 'jobs_unlimited')
    assert.equal((await setStatus(user, first.id, 'closed')).status, 200)
    planRequired(await setStatus(user, first.id, 'published'), 'jobs_unlimited')
  })

  it('lets Recruiter Plus publish any number of jobs', async () => {
    const { user } = await approvedRecruiter()
    for (const title of ['One', 'Two', 'Three']) await published(user, { title })
    assert.equal(await Job.countDocuments({ status: 'published' }), 3)
  })
})

describe('recruiter locks, Free vs Recruiter Plus (P11c-Q4, Q5, Q10, Q14 … Q16)', () => {
  /** A company with one live job, one applicant (and her thread, started by her) and one listed non-applicant. */
  async function company(plus) {
    const { user, company } = await approvedRecruiter({ plus })
    const job = await published(user)
    const applicant = await listedCandidate({ fullName: 'Ada Applicant' })
    const other = await listedCandidate({ fullName: 'Otto Other' })
    await applied(applicant, { ...job, _id: job.id, companyId: company._id })
    const conversation = await Conversation.create({ companyId: company._id, candidateId: applicant._id, jobId: job.id, startedBy: 'candidate' })
    await Message.create({ conversationId: conversation._id, senderRole: 'candidate', senderId: applicant._id, body: 'Hello' })
    return { user, company, job, applicant, other, conversation }
  }
  const get = (user, path) => api().get(`${v1}${path}`).set(auth(user))
  const send = (user, method, path, body = {}) => api()[method](`${v1}${path}`).set(auth(user)).send(body)

  it('Free: Find candidates lists applicants only and refuses search, filters, sort and a job (Compare reads this list)', async () => {
    const { user, applicant, job } = await company(false)
    const list = await get(user, '/recruiter/candidates')
    assert.equal(list.status, 200)
    assert.deepEqual(list.body.items.map((item) => item.fullName), [applicant.fullName])
    for (const query of ['?q=design', '?sort=name', '?sort=experience', '?workPreference=remote', '?verified=1', `?jobId=${job.id}`, '?skill=Figma']) {
      planRequired(await get(user, `/recruiter/candidates${query}`), 'discovery')
    }
  })

  it('Free: applicant profiles, CV, activity and notes open; anyone else answers 402 discovery', async () => {
    const { user, applicant, other } = await company(false)
    for (const path of ['', '/cv', '/activity', '/notes']) {
      assert.equal((await get(user, `/recruiter/candidates/${applicant._id}${path}`)).status, 200, path)
      planRequired(await get(user, `/recruiter/candidates/${other._id}${path}`), 'discovery')
    }
    assert.equal((await send(user, 'post', `/recruiter/candidates/${applicant._id}/notes`, { text: 'Strong portfolio' })).status, 201)
    planRequired(await send(user, 'post', `/recruiter/candidates/${other._id}/notes`, { text: 'No' }), 'discovery')
  })

  it('Free: the shortlist, the talent lists and CV requests answer 402; the Overview counts stay', async () => {
    const { user, applicant, job } = await company(false)
    planRequired(await get(user, '/recruiter/shortlist'), 'discovery')
    planRequired(await send(user, 'put', `/recruiter/shortlist/${applicant._id}`), 'discovery')
    planRequired(await send(user, 'delete', `/recruiter/shortlist/${applicant._id}`), 'discovery')
    planRequired(await get(user, '/recruiter/overview/talent'), 'discovery')
    planRequired(await get(user, `/recruiter/jobs/${job.id}/relevant-talent`), 'discovery')
    planRequired(await send(user, 'post', `/recruiter/candidates/${applicant._id}/cv-requests`, { reason: 'verify_employment' }), 'outreach')
    const overview = await get(user, '/recruiter/overview')
    assert.equal(overview.status, 200)
    assert.equal(overview.body.openPositions, 1)
    assert.equal(typeof (await get(user, '/recruiter/jobs')).body.items[0].relevantCount, 'number')
  })

  it('Free: starting a conversation answers 402 outreach; replying in an existing one works (Q14)', async () => {
    const { user, applicant, other, conversation, company: own } = await company(false)
    planRequired(await send(user, 'post', '/conversations', { candidateId: String(applicant._id), body: 'Hi' }), 'outreach')
    planRequired(await send(user, 'post', '/conversations', { candidateId: String(other._id), body: 'Hi' }), 'outreach')
    assert.equal((await send(user, 'post', `/conversations/${conversation._id}/messages`, { body: 'Thanks for applying' })).status, 201)
    // A thread the recruiter started while on Plus stays open too.
    const started = await Conversation.create({ companyId: own._id, candidateId: other._id, startedBy: 'recruiter' })
    await Message.create({ conversationId: started._id, senderRole: 'recruiter', senderId: user._id, body: 'Earlier outreach' })
    assert.equal((await send(user, 'post', `/conversations/${started._id}/messages`, { body: 'Following up' })).status, 201)
  })

  it('Free: job AI summaries, the match narrative and Translate answer 402 ai', async () => {
    const { user, applicant, job } = await company(false)
    planRequired(await send(user, 'post', `/jobs/${job.id}/ai-summary`), 'ai')
    planRequired(await get(user, `/recruiter/candidates/${applicant._id}/match?jobId=${job.id}`), 'ai')
    planRequired(await send(user, 'post', '/translate', { entity: 'job', id: job.id, field: 'brief' }), 'ai')
  })

  it('Free: applicants stay manageable (stage, reject)', async () => {
    const { user, company: own } = await company(false)
    const application = await Application.findOne({ companyId: own._id })
    const stages = await PipelineStage.find({ companyId: own._id }).sort({ order: 1 })
    assert.equal((await send(user, 'patch', `/recruiter/applications/${application._id}/stage`, { stageId: String(stages[1]._id) })).status, 200)
    assert.equal((await send(user, 'post', `/recruiter/applications/${application._id}/reject`, { notify: false })).status, 200)
  })

  it('Recruiter Plus: every locked endpoint answers', async () => {
    const { user, applicant, other, job } = await company(true)
    assert.equal((await get(user, '/recruiter/candidates?q=other&sort=name')).status, 200)
    assert.equal((await get(user, `/recruiter/candidates/${other._id}`)).status, 200)
    assert.equal((await send(user, 'put', `/recruiter/shortlist/${other._id}`)).status, 200)
    assert.deepEqual((await get(user, '/recruiter/shortlist')).body.items.map((item) => item.fullName), [other.fullName])
    assert.equal((await get(user, '/recruiter/overview/talent')).status, 200)
    assert.equal((await get(user, `/recruiter/jobs/${job.id}/relevant-talent`)).status, 200)
    assert.equal((await send(user, 'post', `/recruiter/candidates/${applicant._id}/cv-requests`, { reason: 'verify_employment' })).status, 201)
    assert.equal((await send(user, 'post', '/conversations', { candidateId: String(other._id), body: 'Hi' })).status, 201)
    assert.equal((await send(user, 'post', `/jobs/${job.id}/ai-summary`)).status, 200)
    assert.equal((await get(user, `/recruiter/candidates/${applicant._id}/match?jobId=${job.id}`)).status, 200)
    assert.equal((await send(user, 'post', '/translate', { entity: 'job', id: job.id, field: 'brief' })).status, 200)
  })
})

describe('plan end and the start-up step (P11c-Q6, Q12, Q18)', () => {
  it('pauses every published job but the most recently published, once at start, only without Recruiter Plus', async () => {
    const { company: free } = await approvedRecruiter({ plus: false })
    const { company: plus } = await approvedRecruiter()
    const at = (hours) => new Date(Date.now() - hours * 3600_000)
    const jobs = async (companyId) =>
      Job.insertMany(
        [3, 1, 2].map((hours) => ({ title: `Role ${hours}h`, companyId, status: 'published', publishedAt: at(hours), firstPublishedAt: at(hours), country: 'GB' })),
      )
    await jobs(free._id)
    await jobs(plus._id)
    await enforceFreeJobLimit()
    const statuses = async (companyId) => (await Job.find({ companyId }).sort({ title: 1 })).map((job) => [job.title, job.status])
    assert.deepEqual(await statuses(free._id), [['Role 1h', 'published'], ['Role 2h', 'paused'], ['Role 3h', 'paused']])
    assert.deepEqual(await statuses(plus._id), [['Role 1h', 'published'], ['Role 2h', 'published'], ['Role 3h', 'published']])
    await enforceFreeJobLimit()
    assert.equal(await Job.countDocuments({ companyId: free._id, status: 'paused' }), 2)
  })
})

describe('recruiter webhooks (P11c-Q2, Q6, Q7, Q18)', () => {
  const objects = new Map()
  const put = (object) => objects.set(object.id, structuredClone(object))
  const fetch = async (id) => {
    if (!objects.has(id)) throw Object.assign(new Error('missing'), { code: 'resource_missing' })
    return structuredClone(objects.get(id))
  }
  before(() =>
    setStripeClient({
      subscriptions: { retrieve: async (id) => ({ ...(await fetch(id)), latest_invoice: (await fetch(id)).latest_invoice && (await fetch((await fetch(id)).latest_invoice)) }) },
      invoices: { retrieve: fetch },
      paymentIntents: { retrieve: fetch },
      charges: { retrieve: fetch },
      checkout: { sessions: { retrieve: fetch } },
    }),
  )
  after(() => setStripeClient())

  const NOW = Math.floor(Date.now() / 1000)
  const DAY = 24 * 60 * 60
  let eventCount = 0
  const event = (type, id) => {
    const payload = JSON.stringify({ id: `evt_rec_${++eventCount}`, object: 'event', type, data: { object: { id } } })
    return api().post(`${v1}/stripe/webhook`).set('Content-Type', 'application/json').set('Stripe-Signature', testSignature(payload)).send(payload)
  }

  /** A Free recruiter (company in Berlin, EUR) with a Stripe subscription `sub` whose first invoice was paid. */
  async function subscriber(tag) {
    const { user, company } = await approvedRecruiter({ city: 'berlin', plus: false, stripeCustomerId: `cus_${tag}` })
    const meta = { kind: 'subscription', itemId: 'recruiter_plus', userId: String(user._id) }
    const subscription = (fields = {}) => ({
      id: `sub_${tag}`,
      customer: `cus_${tag}`,
      status: 'active',
      currency: 'eur',
      start_date: NOW,
      cancel_at_period_end: false,
      cancel_at: null,
      metadata: meta,
      latest_invoice: `in_${tag}_1`,
      items: { data: [{ price: { unit_amount: 5700 }, current_period_start: NOW, current_period_end: NOW + 30 * DAY }] },
      ...fields,
    })
    const invoice = (id, intent, fields = {}) => ({
      id,
      customer: `cus_${tag}`,
      status: 'paid',
      attempted: true,
      billing_reason: 'subscription_create',
      amount_paid: 5700,
      amount_due: 5700,
      currency: 'eur',
      next_payment_attempt: null,
      hosted_invoice_url: `https://invoice.stripe.com/i/${id}`,
      created: NOW,
      status_transitions: { paid_at: NOW },
      parent: { subscription_details: { subscription: `sub_${tag}`, metadata: meta } },
      lines: { data: [{ period: { start: NOW, end: NOW + 30 * DAY } }] },
      payments: { data: [{ status: fields.status === 'open' ? 'open' : 'paid', payment: { payment_intent: intent } }] },
      ...fields,
    })
    put(subscription())
    put(invoice(`in_${tag}_1`, `pi_${tag}_1`))
    put({ id: `pi_${tag}_1`, latest_charge: { id: `ch_${tag}_1`, created: NOW, refunded: false, payment_method_details: { type: 'card', card: { brand: 'visa', last4: '4242' } } } })
    return { user, company, subscription, invoice }
  }

  it('records the first invoice as a Recruiter Plus row, unlocks the plan and tells the recruiter once', async () => {
    const { user } = await subscriber('first')
    assert.equal((await event('invoice.paid', 'in_first_1')).status, 200)
    assert.equal((await event('customer.subscription.created', 'sub_first')).status, 200)
    const payment = await Payment.findOne({ userId: user._id })
    assert.deepEqual([payment.payerRole, payment.kind, payment.itemId, payment.itemName, payment.amountMinor, payment.currency], ['recruiter', 'subscription', 'recruiter_plus', 'Recruiter Plus', 5700, 'EUR'])
    const me = (await api().get(`${v1}/me`).set(auth(user))).body
    assert.deepEqual([me.plan, me.entitlements], ['recruiter_plus', RECRUITER_KEYS])
    const notes = await Notification.find({ userId: user._id })
    assert.deepEqual(notes.map((note) => [note.type, note.target.id]), [['payment_paid', 'billing']])
  })

  it('a failed renewal: a failed row, the in-app notice, the always-on email with recruiter Billing, and the finance admin', async () => {
    const { user, subscription, invoice } = await subscriber('renew')
    await event('invoice.paid', 'in_renew_1')
    const finance = await createUser({ role: 'admin', status: 'active', isOwner: true })
    put(invoice('in_renew_2', 'pi_renew_2', { status: 'open', billing_reason: 'subscription_cycle', amount_paid: 0, next_payment_attempt: NOW + DAY }))
    put({ id: 'pi_renew_2', latest_charge: { id: 'ch_renew_2', created: NOW, failure_code: 'card_declined' } })
    put(subscription({ status: 'past_due', latest_invoice: 'in_renew_2' }))
    await event('invoice.payment_failed', 'in_renew_2')
    assert.equal((await Payment.findOne({ 'stripe.invoiceId': 'in_renew_2' })).status, 'failed')
    // Still Recruiter Plus while Stripe retries (U38).
    assert.equal((await api().get(`${v1}/me`).set(auth(user))).body.plan, 'recruiter_plus')
    const [mail] = mailTo(user.email, 'renewal_failed')
    assert.match(mail.text, /Recruiter Plus/)
    assert.match(mail.text, /\/recruiter\/settings\/billing/)
    const failed = await Notification.findOne({ userId: user._id, type: 'renewal_failed' })
    assert.equal(failed.params.planKey, 'recruiter_plus')
    const adminNote = await Notification.findOne({ userId: finance._id, type: 'admin_renewal_failed' })
    assert.equal(adminNote.params.planKey, 'recruiter_plus')
    assert.match(mailTo(finance.email, 'admin_renewal_failed')[0].text, /Recruiter Plus renewal/)
  })

  it('plan end pauses all but the most recently published job and names them in the notification and email', async () => {
    const { user, company, subscription } = await subscriber('end')
    await event('invoice.paid', 'in_end_1')
    for (const title of ['Older role', 'Middle role', 'Newest role']) await published(user, { title })
    put(subscription({ status: 'canceled' }))
    assert.equal((await event('customer.subscription.deleted', 'sub_end')).status, 200)
    const statuses = (await Job.find({ companyId: company._id }).sort({ publishedAt: 1 })).map((job) => [job.title, job.status])
    assert.deepEqual(statuses, [['Older role', 'paused'], ['Middle role', 'paused'], ['Newest role', 'published']])
    const ended = await Notification.findOne({ userId: user._id, type: 'plan_ended' })
    assert.deepEqual([ended.params, ended.target.id], [{ planKey: 'recruiter_plus', job: 'Newest role', paused: 2 }, 'jobs'])
    const [mail] = mailTo(user.email, 'recruiter_plan_ended')
    assert.match(mail.text, /Newest role stays live; 2 other jobs were paused/)
    assert.match(mail.text, /\/recruiter\/jobs/)
    assert.equal(mailTo(user.email, 'plan_ended').length, 0)
    // Free again: republishing a paused job needs Recruiter Plus; applications and threads are untouched.
    const paused = await Job.findOne({ companyId: company._id, status: 'paused' })
    planRequired(await setStatus(user, paused._id, 'published'), 'jobs_unlimited')
  })
})

describe('admin totals by role (P11c-Q8, Q17, Q20)', () => {
  it('splits the Payments cards and the Overview subscribers by role, and lists the recruiter plan', async () => {
    const admin = await createUser({ role: 'admin', status: 'active', isOwner: true })
    const { user: plus } = await approvedRecruiter()
    await Subscription.updateOne({ userId: plus._id }, { currency: 'GBP', amountMinor: 4900 })
    const { user: free } = await approvedRecruiter({ plus: false })
    const candidate = await createUser()
    await Subscription.create({ userId: candidate._id, planKey: 'plus', status: 'active', currency: 'GBP', amountMinor: 900 })
    // 2026-11-13: a yearly plan counts a twelfth of its price in MRR.
    const yearly = await createUser()
    await Subscription.create({ userId: yearly._id, planKey: 'plus', status: 'active', currency: 'EUR', amountMinor: 10200, interval: 'year' })
    await Payment.create({ reference: 'LWM-900001', userId: plus._id, payerRole: 'recruiter', kind: 'subscription', amountMinor: 4900, currency: 'GBP', status: 'failed', paidAt: new Date() })

    const stats = (await api().get(`${v1}/admin/payments/stats`).set(auth(admin))).body
    assert.deepEqual(stats.activeSubscribers, { total: 3, candidate: 2, recruiter: 1 })
    assert.deepEqual(stats.mrr, {
      candidate: [
        { currency: 'GBP', amountMinor: 900 },
        { currency: 'EUR', amountMinor: 850 },
      ],
      recruiter: [{ currency: 'GBP', amountMinor: 4900 }],
    })
    assert.deepEqual(stats.failedRenewals, { total: 1, candidate: 0, recruiter: 1 })
    const overview = (await api().get(`${v1}/admin/overview`).set(auth(admin))).body
    assert.deepEqual(overview.health.activeSubscribers, stats.activeSubscribers)

    const list = (plan) => api().get(`${v1}/admin/users`).query({ role: 'recruiter', ...(plan && { plan }) }).set(auth(admin))
    const rows = (await list()).body.items
    assert.deepEqual(Object.fromEntries(rows.map((row) => [row.id, row.plan])), { [plus._id]: 'recruiter_plus', [free._id]: 'free' })
    assert.deepEqual((await list('recruiter_plus')).body.items.map((row) => row.id), [String(plus._id)])
    const detail = (await api().get(`${v1}/admin/users/${plus._id}`).set(auth(admin))).body
    assert.equal(detail.plan.plan, 'recruiter_plus')
    assert.equal(detail.plan.subscription.amountMinor, 4900)
  })
})
