import { config } from '../config/env.js'
import { LIMITS } from '../config/limits.js'
import { AiUsage, ApiUsage } from '../modules/ai/ai.model.js'
import { notifyAdmins } from '../modules/notifications/notifications.service.js'
import { AppConfig, Subscription } from '../modules/payments/payments.model.js'
import { isPaid, PAID_PLAN } from '../modules/payments/payments.service.js'
import { AppError } from './errors.js'
import { t } from './i18n.js'

/*
 * Paid API usage, budgets and per-user AI limits (owner 2026-11-17). Every OpenAI and Google Places call is counted
 * per day, model, kind and user (ApiUsage) and priced with the admin's prices: OpenAI's own spend needs an admin key the
 * shared project key cannot have, so the cost is an estimate for EU Jobs only. Settings live in AppConfig('aiUsage');
 * a provider whose monthly budget is reached pauses until the next month or a higher budget, and admins with
 * ai.manage are told at each LIMITS.ai.usage.alertAt share.
 */
const U = LIMITS.ai.usage
const SETTINGS_KEY = 'aiUsage'
const ALERTS_KEY = 'aiUsageAlerts'
const CACHE_MS = 30_000
export const PROVIDERS = ['openai', 'places']
export const PLACES_SKUS = ['autocomplete', 'details', 'nearby']

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10)
export const utcMonth = (now = new Date()) => now.toISOString().slice(0, 7)

/** The start of the next UTC day, when a daily count starts again. */
export function nextUtcDay(now = new Date()) {
  const reset = new Date(`${utcDay(now)}T00:00:00.000Z`)
  reset.setUTCDate(reset.getUTCDate() + 1)
  return reset
}

const DEFAULTS = {
  caps: U.caps,
  featureLimits: U.featureLimits,
  creditCosts: U.creditCosts,
  burstPerMinute: U.burstPerMinute,
  skillNamesPerDay: U.skillNamesPerDay,
  budgets: { openai: null, places: null },
  prices: { openai: [], places: [] },
}

let settingsCache = null
const spendCache = new Map()
const bursts = new Map()

/** Forgets cached settings, spend and bursts (a settings save, the /_test/reset route). */
export function clearUsageCache() {
  settingsCache = null
  spendCache.clear()
  bursts.clear()
}

export async function usageSettings() {
  if (settingsCache && settingsCache.at > Date.now() - CACHE_MS) return settingsCache.value
  const stored = (await AppConfig.findOne({ key: SETTINGS_KEY }).lean())?.value ?? {}
  // Caps saved before a plan existed (Agency Plus, 2026-11-20) keep that plan's default.
  const value = { ...DEFAULTS, ...stored, caps: { ...DEFAULTS.caps, ...stored.caps } }
  settingsCache = { value, at: Date.now() }
  return value
}

export async function saveUsageSettings(value) {
  await AppConfig.updateOne({ key: SETTINGS_KEY }, { $set: { value } }, { upsert: true })
  clearUsageCache()
}

/* ---------- counting and pricing ---------- */

/** Counts one call; never fails the caller. */
export async function recordUsage({ provider, model, kind, userId = null, inputTokens = 0, outputTokens = 0, seconds = 0 }) {
  try {
    await ApiUsage.updateOne({ day: utcDay(), provider, model, kind, userId }, { $inc: { calls: 1, inputTokens, outputTokens, seconds } }, { upsert: true })
    // perf 2026-11-24: the call's cost is added to a cached month total (prices are linear) instead of re-summing the month.
    const cached = spendCache.get(provider)
    if (cached && cached.month === utcMonth()) cached.value += costOf({ provider, model, calls: 1, inputTokens, outputTokens, seconds }, (await usageSettings()).prices) ?? 0
    else spendCache.delete(provider)
    await alertBudget(provider)
  } catch (error) {
    console.error(`Usage not recorded: ${error.message}`)
  }
}

/** The admin's price for a row in USD, or null when that model or SKU has no price yet. */
export function costOf(row, prices) {
  if (row.provider === 'places') {
    const price = prices.places.find((item) => item.sku === row.model)
    return price ? (row.calls * price.perThousand) / 1000 : null
  }
  const price = prices.openai.find((item) => item.model === row.model)
  if (!price) return null
  return (row.inputTokens * (price.input ?? 0) + row.outputTokens * (price.output ?? 0)) / 1e6 + (row.seconds / 60) * (price.minute ?? 0)
}

const monthMatch = (month) => ({ day: { $gte: `${month}-01`, $lte: `${month}-31` } })

/** A month's rows grouped by `by` (fields of ApiUsage) with their sums. */
export function monthRows(month, by, match = {}) {
  return ApiUsage.aggregate([
    { $match: { ...monthMatch(month), ...match } },
    {
      $group: {
        _id: Object.fromEntries(by.map((field) => [field, `$${field}`])),
        calls: { $sum: '$calls' },
        inputTokens: { $sum: '$inputTokens' },
        outputTokens: { $sum: '$outputTokens' },
        seconds: { $sum: '$seconds' },
      },
    },
  ]).then((rows) => rows.map(({ _id, ...sums }) => ({ ..._id, ...sums })))
}

/** This month's priced spend of one provider (cached briefly; each recorded call refreshes it). */
export async function monthSpend(provider) {
  const month = utcMonth()
  const cached = spendCache.get(provider)
  if (cached && cached.month === month && cached.at > Date.now() - CACHE_MS) return cached.value
  const { prices } = await usageSettings()
  const rows = await monthRows(month, ['provider', 'model'], { provider })
  const value = rows.reduce((sum, row) => sum + (costOf(row, prices) ?? 0), 0)
  spendCache.set(provider, { month, value, at: Date.now() })
  return value
}

/** Whether the provider's monthly budget is used up (no budget: never). */
export async function budgetReached(provider) {
  const budget = (await usageSettings()).budgets[provider]
  return Boolean(budget) && (await monthSpend(provider)) >= budget
}

const PROVIDER_NAMES = { openai: 'OpenAI', places: 'Google Places' }
const usd = (language, amount) => new Intl.NumberFormat(language, { style: 'currency', currency: 'USD' }).format(amount)

/** After a settings save: a budget lowered below this month's spend alerts (and pauses) at once. */
export async function checkBudgets() {
  for (const provider of PROVIDERS) await alertBudget(provider)
}

/** Each alert share is sent once per provider, month and budget amount (a higher budget can alert again). */
async function alertBudget(provider) {
  const budget = (await usageSettings()).budgets[provider]
  if (!budget) return
  const spent = await monthSpend(provider)
  const month = utcMonth()
  for (const share of U.alertAt) {
    if (spent < budget * share) continue
    const id = `${provider}:${month}:${share}:${budget}`
    const result = await AppConfig.updateOne({ key: ALERTS_KEY }, { $addToSet: { 'value.sent': id } }, { upsert: true })
    if (!result.modifiedCount && !result.upsertedCount) continue
    const percent = Math.round(share * 100)
    await notifyAdmins('admin_ai_budget', {
      params: { provider, percent, spent, budget },
      target: { kind: 'page', id: 'aiUsage' },
      emailParams: (language) => ({
        provider: PROVIDER_NAMES[provider],
        percent,
        spent: usd(language, spent),
        budget: usd(language, budget),
        note: t(language, `email.admin_ai_budget.notes.${share >= 1 ? `${provider}_paused` : 'warning'}`),
        link: `${config.clientOrigin}/admin/ai-matching/usage`,
      }),
    })
  }
}

/* ---------- per-user limits ---------- */

/** The daily cap of a paid plan for its billing interval; without a plan, the monthly cap of the role's paid plan. */
export function capFor(role, subscription, caps) {
  const fallback = caps[PAID_PLAN[role]]?.month ?? U.caps.plus.month
  if (!isPaid(subscription)) return fallback
  return caps[subscription.planKey]?.[subscription.interval] ?? fallback
}

/** Today's AI uses a candidate or recruiter may have. */
export async function dailyCap(user) {
  const { caps } = await usageSettings()
  return capFor(user.role, await Subscription.findOne({ userId: user._id }, 'planKey status retrying interval'), caps)
}

/** The credits one text of `kind` takes (1 unless the admin's settings say more, owner 2026-11-17). */
export async function creditCost(kind) {
  return (await usageSettings()).creditCosts?.[kind] ?? 1
}

/**
 * GET /ai/usage: today's credits used, the cap and when it resets, each feature with its own daily limit (CV drafts,
 * CV to profile) as { kind, used, limit }, and `costs`: the kinds that take more than one credit.
 */
export async function usageLeft(user) {
  const [row, limit, { featureLimits, creditCosts }] = await Promise.all([AiUsage.findOne({ userId: user._id, day: utcDay() }), dailyCap(user), usageSettings()])
  const used = row?.count ?? 0
  const features = Object.entries(featureLimits ?? {}).map(([kind, featureLimit]) => ({ kind, used: Math.min(row?.features?.get(kind) ?? 0, featureLimit), limit: featureLimit }))
  return { used: Math.min(used, limit), limit, remaining: Math.max(limit - used, 0), resetAt: nextUtcDay().toISOString(), features, costs: creditCosts ?? {} }
}

/** At most `burstPerMinute` uncached AI requests per user in any 60 seconds; RATE_LIMITED with retryAfter otherwise. */
export async function takeBurst(userId) {
  const { burstPerMinute } = await usageSettings()
  const now = Date.now()
  const key = String(userId)
  const recent = (bursts.get(key) ?? []).filter((at) => at > now - 60_000)
  if (recent.length >= burstPerMinute) {
    bursts.set(key, recent)
    throw new AppError('RATE_LIMITED', { params: { retryAfter: Math.max(1, Math.ceil((recent[0] + 60_000 - now) / 1000)) } })
  }
  recent.push(now)
  bursts.set(key, recent)
}

/** Reserves `count` of today's skill-name lookups; false when that would pass the cap. */
export async function takeSkillNames(userId, count) {
  const { skillNamesPerDay } = await usageSettings()
  if (count > skillNamesPerDay) return false
  const filter = { userId, day: utcDay(), skillNames: { $not: { $gt: skillNamesPerDay - count } } }
  try {
    const result = await AiUsage.updateOne(filter, { $inc: { skillNames: count } }, { upsert: true })
    return Boolean(result.modifiedCount || result.upsertedCount)
  } catch (error) {
    if (error.code !== 11000) throw error
    // Today's row exists (at the cap, or made by a racing request): take the names only if it still has room.
    return Boolean((await AiUsage.updateOne(filter, { $inc: { skillNames: count } })).modifiedCount)
  }
}
