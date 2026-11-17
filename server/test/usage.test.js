import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { ScheduledTask } from '../jobs/models.js'
import { clearUsageCache } from '../lib/usage.js'
import { AuditEvent } from '../modules/admin/admin.model.js'
import { AiCache, AiUsage, ApiUsage } from '../modules/ai/ai.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { ensureDefaultPolicy } from '../modules/matching/matching.admin.js'
import { Embedding, MatchingPolicy, MatchingPolicyVersion, MatchResult } from '../modules/matching/matching.model.js'
import { Notification } from '../modules/notifications/notifications.model.js'
import { AppConfig, Subscription } from '../modules/payments/payments.model.js'
import { anonymiseApiUsage } from '../modules/privacy/privacy.erase.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { aiStub } from './helpers/ai.js'
import { api, auth, createUser, mailTo, useTestDb } from './helpers/index.js'
import { approvedRecruiter, jobBody } from './helpers/market.js'
import { suggestion, useFakePlaces } from './helpers/places.js'

/* Admin › AI & matching › Usage and the per-user AI limits (owner 2026-11-17). */
const USAGE_KEYS = { key: { $in: ['aiUsage', 'aiUsageAlerts'] } }
// The e2e server shares eujobs_test: no budget or limit outlives this file (registered first, so it runs before the disconnect).
after(async () => {
  aiStub.reset()
  await AppConfig.deleteMany(USAGE_KEYS)
  clearUsageCache()
})
useTestDb([
  User, Company, Job, CandidateProfile, Subscription, AiCache, AiUsage, ApiUsage, AuditEvent, Embedding, MatchResult, ScheduledTask,
  MatchingPolicy, MatchingPolicyVersion,
])
const places = useFakePlaces()
before(() => seedCatalog())
beforeEach(async () => {
  aiStub.reset()
  await AppConfig.deleteMany(USAGE_KEYS)
  clearUsageCache()
  await ensureDefaultPolicy()
})

const v1 = '/api/v1'
const SETTINGS = {
  caps: { plus: { month: 40, year: 80 }, recruiter_plus: { month: 80, year: 150 } },
  burstPerMinute: 10,
  skillNamesPerDay: 100,
  budgets: { openai: null, places: null },
  prices: { openai: [], places: [] },
}
const owner = () => createUser({ role: 'admin', isOwner: true })
const saveSettings = (admin, changes) => api().put(`${v1}/admin/ai/usage/settings`).set(auth(admin)).send({ ...SETTINGS, ...changes })
const overview = async (admin) => (await api().get(`${v1}/admin/ai/usage`).set(auth(admin))).body
const usageLeft = async (user) => (await api().get(`${v1}/ai/usage`).set(auth(user))).body
const summary = (user, job) => api().post(`${v1}/jobs/${job.id}/ai-summary`).set(auth(user))

async function candidate(interval = 'month', planKey = 'plus') {
  const user = await createUser({ role: 'candidate' })
  await Subscription.create({ userId: user._id, planKey, status: 'active', interval })
  return user
}

/** Published jobs, each one an uncached summary. */
async function jobs(count) {
  const { user: recruiter } = await approvedRecruiter()
  const items = []
  for (let index = 0; index < count; index += 1) {
    const { body: job } = await api().post(`${v1}/recruiter/jobs`).set(auth(recruiter)).send(jobBody({ title: `Role number ${index}` }))
    await api().patch(`${v1}/recruiter/jobs/${job.id}/status`).set(auth(recruiter)).send({ status: 'published' })
    items.push(job)
  }
  return items
}

describe('daily AI caps by plan and billing interval', () => {
  it('gives yearly plans more than monthly ones, and free users the monthly cap', async () => {
    assert.equal((await usageLeft(await candidate('month'))).limit, 40)
    assert.equal((await usageLeft(await candidate('year'))).limit, 80)
    const { user: recruiter } = await approvedRecruiter({ plus: false })
    await Subscription.create({ userId: recruiter._id, planKey: 'recruiter_plus', status: 'active', interval: 'year' })
    assert.equal((await usageLeft(recruiter)).limit, 150)
    const free = await usageLeft(await createUser({ role: 'candidate' }))
    assert.deepEqual([free.limit, free.used, free.remaining], [40, 0, 40])
    assert.ok(free.resetAt)
    assert.equal((await api().get(`${v1}/ai/usage`).set(auth(await owner()))).status, 403)
  })

  it('stops a monthly plan at 40 while a yearly plan goes on', async () => {
    const [job] = await jobs(1)
    const monthly = await candidate('month')
    const yearly = await candidate('year')
    const day = new Date().toISOString().slice(0, 10)
    await AiUsage.create([{ userId: monthly._id, day, count: 40 }, { userId: yearly._id, day, count: 40 }])
    const limited = await summary(monthly, job)
    assert.equal(limited.status, 429)
    assert.deepEqual([limited.body.error.code, limited.body.error.params.limit], ['AI_DAILY_LIMIT', 40])
    assert.equal((await summary(yearly, job)).status, 200)
    assert.deepEqual(await usageLeft(yearly).then(({ used, limit, remaining }) => [used, limit, remaining]), [41, 80, 39])
  })

  it('follows the caps the admin saves', async () => {
    const admin = await owner()
    assert.equal((await saveSettings(admin, { caps: { plus: { month: 5, year: 9 }, recruiter_plus: { month: 7, year: 12 } } })).status, 200)
    assert.equal((await usageLeft(await candidate('year'))).limit, 9)
    const refused = await saveSettings(admin, { caps: { plus: { month: 0, year: 9 }, recruiter_plus: { month: 7, year: 12 } } })
    assert.equal(refused.status, 422)
  })
})

describe('burst and skill-name limits', () => {
  it('allows only the per-minute burst of uncached generations', async () => {
    await saveSettings(await owner(), { burstPerMinute: 2 })
    const user = await candidate()
    const [first, second, third] = await jobs(3)
    assert.equal((await summary(user, first)).status, 200)
    assert.equal((await summary(user, second)).status, 200)
    const limited = await summary(user, third)
    assert.equal(limited.status, 429)
    assert.equal(limited.body.error.code, 'RATE_LIMITED')
    assert.ok(limited.body.error.params.retryAfter > 0)
    assert.equal((await summary(user, first)).status, 200, 'a cached text is not a request to OpenAI')
  })

  it('stops the standard-name lookup past the daily cap but still saves the skill', async () => {
    await saveSettings(await owner(), { skillNamesPerDay: 2 })
    const user = await candidate()
    const lookups = () => aiStub.calls.filter((call) => call.text?.format?.name === 'skill_names').length
    const add = (skill) => api().post(`${v1}/candidate/profile/skills`).set(auth(user)).send({ skill })
    assert.equal((await add('Alpha craft')).status, 201)
    assert.equal((await add('Beta craft')).status, 201)
    assert.equal(lookups(), 2)
    const third = await add('Gamma craft')
    assert.equal(third.status, 201)
    assert.deepEqual(third.body.skills, ['Alpha craft', 'Beta craft', 'Gamma craft'])
    assert.equal(lookups(), 2, 'no third lookup')
    assert.equal((await AiUsage.findOne({ userId: user._id })).skillNames, 2)
  })
})

describe('Usage tab (ai.view reads, ai.manage saves)', () => {
  it('counts every call and prices it with the admin prices', async () => {
    const admin = await owner()
    const user = await candidate()
    const [job] = await jobs(1)
    await summary(user, job)
    const row = await ApiUsage.findOne({ kind: 'job_summary' })
    assert.deepEqual([row.provider, row.model, String(row.userId), row.calls, row.inputTokens, row.outputTokens], ['openai', 'stub-fast', String(user._id), 1, 1000, 200])

    let body = await overview(admin)
    assert.equal(body.providers.openai.unpriced, true)
    assert.equal(body.providers.openai.spend, 0)
    assert.ok(body.models.some((item) => item.model === 'stub-fast'))

    const saved = await saveSettings(admin, { prices: { openai: [{ model: 'stub-fast', input: 1, output: 10, minute: null }], places: [] } })
    assert.equal(saved.status, 200)
    body = saved.body
    const priced = body.breakdown.find((item) => item.kind === 'job_summary')
    assert.equal(priced.cost.toFixed(6), '0.003000')
    const top = body.topUsers.find((item) => item.id === String(user._id))
    assert.deepEqual([top.plan, top.interval, top.today.used, top.today.limit, top.cost.toFixed(6)], ['plus', 'month', 1, 40, '0.003000'])
    assert.ok(await AuditEvent.exists({ type: 'policy.ai_usage_updated' }))
  })

  it('lets ai.view read but not save', async () => {
    const viewer = await createUser({ role: 'admin', adminAccess: { granted: ['ai.view'] } })
    assert.equal((await api().get(`${v1}/admin/ai/usage`).set(auth(viewer))).status, 200)
    assert.equal((await saveSettings(viewer, {})).status, 403)
    assert.equal((await api().get(`${v1}/admin/ai/usage`).set(auth(await candidate()))).status, 403)
  })

  it('alerts ai.manage admins at 80 % and 100 %, then pauses OpenAI until the budget is raised', async () => {
    const admin = await owner()
    // $1 a summary (1,000 input tokens at $1,000 per 1M); the budget is $2.
    await saveSettings(admin, { budgets: { openai: 2, places: null }, prices: { openai: [{ model: 'stub-fast', input: 1000, output: 0, minute: null }], places: [] } })
    const user = await candidate()
    const [first, second, third] = await jobs(3)
    assert.equal((await summary(user, first)).status, 200)
    assert.equal(await Notification.countDocuments({ type: 'admin_ai_budget' }), 0)
    assert.equal((await summary(user, second)).status, 200)
    const alerts = await Notification.find({ userId: admin._id, type: 'admin_ai_budget' }).sort({ 'params.percent': 1 })
    assert.deepEqual(alerts.map((item) => item.params.percent), [80, 100])
    assert.equal(mailTo(admin.email, 'admin_ai_budget').length, 2)

    const paused = await summary(user, third)
    assert.equal(paused.status, 503)
    assert.equal(paused.body.error.code, 'AI_PAUSED')
    assert.equal((await summary(user, first)).status, 200, 'cached texts still show')
    assert.equal((await AiUsage.findOne({ userId: user._id })).count, 2, 'a paused request is not counted')
    assert.equal((await api().get(`${v1}/admin/ai/status`).set(auth(admin))).body.paused, true)
    assert.equal((await overview(admin)).providers.openai.paused, true)

    await saveSettings(admin, { budgets: { openai: 10, places: null }, prices: { openai: [{ model: 'stub-fast', input: 1000, output: 0, minute: null }], places: [] } })
    assert.equal((await summary(user, third)).status, 200)

    // A budget lowered below this month's spend ($3) alerts at once, before any further call.
    await saveSettings(admin, { budgets: { openai: 2.5, places: null }, prices: { openai: [{ model: 'stub-fast', input: 1000, output: 0, minute: null }], places: [] } })
    const lowered = await Notification.find({ userId: admin._id, type: 'admin_ai_budget', 'params.budget': 2.5 })
    assert.deepEqual(lowered.map((item) => item.params.percent).sort(), [100, 80])
  })

  it('counts Google Places calls and switches city fields to manual entry when the Places budget is used up', async () => {
    const admin = await owner()
    const user = await candidate()
    const session = crypto.randomUUID()
    const search = (input) => api().get(`${v1}/places/autocomplete`).query({ input, sessionToken: session }).set(auth(user))
    places.fake.suggestions = [suggestion('ChIJbuild-berlin-0001', 'Berlin', 'Germany')]
    assert.equal((await search('Berl')).body.items[0].city, 'Berlin')
    const row = await ApiUsage.findOne({ provider: 'places' })
    assert.deepEqual([row.model, String(row.userId), row.calls], ['autocomplete', String(user._id), 1])
    assert.equal((await api().get(`${v1}/meta/config`)).body.placesManual, false)

    // $1 a call against a $1 budget: the next lookups take "City, Country" without Google.
    await saveSettings(admin, { budgets: { openai: null, places: 1 }, prices: { openai: [], places: [{ sku: 'autocomplete', perThousand: 1000 }] } })
    assert.equal((await api().get(`${v1}/meta/config`)).body.placesManual, true)
    const calls = places.calls.length
    const [manual] = (await search('Berlin Germany')).body.items
    assert.equal(places.calls.length, calls, 'Google is not called')
    assert.match(manual.placeId, /^manual-DE-/)
    const picked = await api().get(`${v1}/places/${manual.placeId}`).set(auth(user))
    assert.deepEqual([picked.body.city, picked.body.countryCode], ['Berlin', 'DE'])
  })
})

describe('erasure (M-188)', () => {
  it('merges the counts of an erased user into the no-user row, so the totals stay', async () => {
    const user = await candidate()
    const row = { day: '2026-11-17', provider: 'openai', model: 'stub-fast', kind: 'job_summary' }
    await ApiUsage.create([
      { ...row, userId: user._id, calls: 2, inputTokens: 2000, outputTokens: 400 },
      { ...row, userId: null, calls: 1, inputTokens: 1000, outputTokens: 200 },
      { ...row, kind: 'translation', userId: user._id, calls: 1, inputTokens: 300, outputTokens: 50 },
    ])
    await anonymiseApiUsage(user._id)
    assert.equal(await ApiUsage.countDocuments({ userId: user._id }), 0)
    const merged = await ApiUsage.findOne({ ...row, userId: null })
    assert.deepEqual([merged.calls, merged.inputTokens, merged.outputTokens], [3, 3000, 600])
    assert.equal((await ApiUsage.findOne({ ...row, kind: 'translation', userId: null })).calls, 1)
  })
})
