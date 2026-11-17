import { config } from '../../config/env.js'
import { LIMITS } from '../../config/limits.js'
import { TRANSCRIBE_FALLBACK_MODEL } from '../../lib/ai.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { capFor, checkBudgets, costOf, monthRows, PLACES_SKUS, PROVIDERS, saveUsageSettings, usageSettings, utcDay, utcMonth } from '../../lib/usage.js'
import { Subscription } from '../payments/payments.model.js'
import { isPaid } from '../payments/payments.service.js'
import { User } from '../users/users.model.js'
import { AiUsage } from './ai.model.js'

/*
 * Admin › AI & matching › Usage (owner 2026-11-17): a month of OpenAI and Google Places calls priced with the admin's
 * prices, each provider against its budget, the top users, and the settings (limits, budgets, prices). `ai.view`
 * reads, `ai.manage` saves; every save is audited.
 */

const sum = (rows, field) => rows.reduce((total, row) => total + row[field], 0)

/**
 * Every OpenAI model to price, with its use (which prices apply): the configured ones, the transcription fallback
 * (billed per minute), and any seen or priced before (`other`).
 */
function openaiModels(rows, prices) {
  const uses = new Map()
  const add = (model, use) => model && !uses.has(model) && uses.set(model, use)
  add(config.openai.fastModel, 'fast')
  add(config.openai.model, 'main')
  add(config.openai.embeddingModel, 'embedding')
  add(config.openai.transcribeModel, 'transcribe')
  add(TRANSCRIBE_FALLBACK_MODEL, 'transcribeFallback')
  for (const row of rows) if (row.provider === 'openai') add(row.model, 'other')
  for (const price of prices.openai) add(price.model, 'other')
  return [...uses].map(([model, use]) => ({ model, use }))
}

async function topUsers(month, prices, caps) {
  const rows = await monthRows(month, ['userId', 'provider', 'model'], { userId: { $ne: null } })
  const byUser = new Map()
  for (const row of rows) {
    const key = String(row.userId)
    const entry = byUser.get(key) ?? { id: key, calls: 0, inputTokens: 0, outputTokens: 0, cost: 0, unpriced: false }
    const cost = costOf(row, prices)
    entry.calls += row.calls
    entry.inputTokens += row.inputTokens
    entry.outputTokens += row.outputTokens
    entry.cost += cost ?? 0
    entry.unpriced ||= cost === null
    byUser.set(key, entry)
  }
  const top = [...byUser.values()].sort((a, b) => b.cost - a.cost || b.calls - a.calls).slice(0, LIMITS.ai.usage.topUsers)
  const ids = top.map((entry) => entry.id)
  const [users, subscriptions, today] = await Promise.all([
    User.find({ _id: { $in: ids } }, 'fullName email role'),
    Subscription.find({ userId: { $in: ids } }, 'userId planKey status retrying interval'),
    AiUsage.find({ userId: { $in: ids }, day: utcDay() }, 'userId count'),
  ])
  const userOf = new Map(users.map((user) => [String(user._id), user]))
  const subscriptionOf = new Map(subscriptions.map((subscription) => [String(subscription.userId), subscription]))
  const usedOf = new Map(today.map((row) => [String(row.userId), row.count]))
  return top.map((entry) => {
    const user = userOf.get(entry.id)
    const subscription = subscriptionOf.get(entry.id)
    const paid = isPaid(subscription)
    return {
      ...entry,
      // An erased user (M-188) keeps the counts without a name.
      name: user?.fullName ?? null,
      email: user?.email ?? null,
      role: user?.role ?? null,
      plan: paid ? subscription.planKey : user?.role === 'admin' ? null : 'free',
      interval: paid ? subscription.interval : null,
      today: user && user.role !== 'admin' ? { used: usedOf.get(entry.id) ?? 0, limit: capFor(user.role, subscription, caps) } : null,
    }
  })
}

/** GET /admin/ai/usage?month=YYYY-MM */
export async function usageOverview(month = utcMonth()) {
  const settings = await usageSettings()
  const rows = await monthRows(month, ['provider', 'model', 'kind'])
  const breakdown = rows
    .map((row) => ({ ...row, cost: costOf(row, settings.prices) }))
    .sort((a, b) => a.provider.localeCompare(b.provider) || (b.cost ?? 0) - (a.cost ?? 0) || b.calls - a.calls)
  const current = month === utcMonth()
  const providers = Object.fromEntries(
    PROVIDERS.map((provider) => {
      const own = breakdown.filter((row) => row.provider === provider)
      const spend = own.reduce((total, row) => total + (row.cost ?? 0), 0)
      const budget = settings.budgets[provider]
      return [
        provider,
        {
          calls: sum(own, 'calls'),
          inputTokens: sum(own, 'inputTokens'),
          outputTokens: sum(own, 'outputTokens'),
          spend,
          // Rows of a model or SKU without a price are counted but not in the spend.
          unpriced: own.some((row) => row.cost === null),
          budget,
          share: budget ? spend / budget : null,
          paused: current && Boolean(budget) && spend >= budget,
        },
      ]
    }),
  )
  return {
    month,
    providers,
    breakdown,
    topUsers: await topUsers(month, settings.prices, settings.caps),
    settings,
    models: openaiModels(rows, settings.prices),
    placesSkus: PLACES_SKUS,
    billingUrl: 'https://platform.openai.com/settings/organization/billing/overview',
    placesBillingUrl: 'https://console.cloud.google.com/billing',
  }
}

/** PUT /admin/ai/usage/settings */
export async function updateUsageSettings(admin, body) {
  await saveUsageSettings(body)
  await checkBudgets()
  await recordAudit({ type: 'policy.ai_usage_updated', category: 'policy', actor: actorFor(admin), params: {} })
  return usageOverview()
}
