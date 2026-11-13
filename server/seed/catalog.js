import { PERMISSIONS } from '../config/enums.js'
import { connectDb, disconnectDb } from '../lib/db.js'
import { renderMarkdown } from '../lib/markdown.js'
import { AdminRole, Permission } from '../modules/admin/admin.model.js'
import { ensureDefaultPolicy } from '../modules/matching/matching.admin.js'
import { Country, Faq, LegalDocument } from '../modules/meta/meta.model.js'
import { Plan } from '../modules/payments/payments.model.js'
import { syncPortalConfigurations, yearlyAmount } from '../modules/payments/plans.stripe.js'
import { COUNTRIES, PLANS, SYSTEM_ROLES } from './data/catalog.js'
import { FAQS } from './data/faqs.js'
import { LEGAL_DOCUMENTS, LEGAL_VERSION } from './data/legal.js'
import { ensurePlanPrices, ensureProduct } from './stripe.js'

/*
 * seed:catalog (U41): an idempotent upsert of the catalogue. Countries, permissions, FAQs and legal texts match the
 * data exactly; the system roles and the default matching policy v1 (§3.20) are only created when missing, so admin
 * edits to them survive. Plans match the data in key, role and entitlements; their names, features and prices are the
 * admin's once created (Payments › Plans, 2026-11-13).
 */
async function upsertExactly(Model, key, rows) {
  await Model.bulkWrite(rows.map((row) => ({ updateOne: { filter: { [key]: row[key] }, update: { $set: row }, upsert: true } })))
  await Model.deleteMany({ [key]: { $nin: rows.map((row) => row[key]) } })
}

/**
 * U40, P6, §3.22: a Stripe Product per paid plan with a monthly and a yearly Price per currency. A plan's stored prices
 * are kept; missing ones (a new plan, or yearly prices added on 2026-11-13) come from the data, yearly at the plan's
 * discount. Then one Portal configuration per role.
 */
async function seedPlans() {
  const productIds = {}
  for (const plan of PLANS) {
    const stored = await Plan.findOne({ key: plan.key }).lean()
    const fields = { role: plan.role, entitlements: plan.entitlements, interval: plan.interval }
    const created = { name: plan.name, features: plan.features }
    if (plan.prices.length) {
      const productId = (productIds[plan.key] = await ensureProduct(plan))
      const percent = stored?.yearlyDiscountPercent ?? 15
      const monthly = stored?.prices?.length ? stored.prices : plan.prices
      const yearly = stored?.yearlyPrices?.length
        ? stored.yearlyPrices
        : monthly.map(({ currency, amountMinor }) => ({ currency, amountMinor: yearlyAmount(amountMinor, percent), override: false }))
      const withIds = async (interval, prices) => {
        const missing = prices.filter((price) => !price.stripePriceId)
        const ids = missing.length ? await ensurePlanPrices(productId, plan.key, interval, missing) : {}
        return prices.map((price) => ({ ...price, stripePriceId: price.stripePriceId ?? ids[price.currency] }))
      }
      Object.assign(fields, {
        prices: await withIds('month', monthly),
        yearlyPrices: await withIds('year', yearly),
        yearlyDiscountPercent: percent,
        yearlyEnabled: stored?.yearlyEnabled ?? true,
      })
    }
    await Plan.updateOne({ key: plan.key }, { $set: fields, $setOnInsert: created }, { upsert: true })
  }
  await Plan.deleteMany({ key: { $nin: PLANS.map((plan) => plan.key) } })
  await syncPortalConfigurations(productIds)
}

export async function seedCatalog() {
  await ensureDefaultPolicy()
  await upsertExactly(Country, 'code', COUNTRIES)
  await seedPlans()
  await upsertExactly(Permission, 'id', PERMISSIONS.map((permission, index) => ({ ...permission, order: index + 1 })))
  for (const role of SYSTEM_ROLES) {
    const nameLower = role.name.toLowerCase()
    await AdminRole.updateOne({ nameLower }, { $setOnInsert: { ...role, nameLower, status: 'active', system: true } }, { upsert: true })
  }
  // FAQs and legal texts have no admin editor (M-200, OD12), so the seed owns them exactly.
  await Faq.deleteMany({})
  await Faq.insertMany(FAQS.map((faq, index) => ({ ...faq, order: index + 1 })))
  await LegalDocument.deleteMany({ version: { $ne: LEGAL_VERSION } })
  for (const [doc, languages] of Object.entries(LEGAL_DOCUMENTS)) {
    for (const [language, { title, body }] of Object.entries(languages)) {
      await LegalDocument.updateOne(
        { doc, version: LEGAL_VERSION, language },
        {
          $set: { title, bodyMarkdown: body, bodyHtml: renderMarkdown(body), isDraft: true },
          $setOnInsert: { publishedAt: new Date() },
        },
        { upsert: true },
      )
    }
  }
}

if (import.meta.main) {
  await connectDb()
  await seedCatalog()
  const counts = await Promise.all([Country, Plan, Permission, AdminRole, Faq, LegalDocument].map((Model) => Model.countDocuments()))
  console.log(
    `seed:catalog done: ${counts[0]} countries, ${counts[1]} plans, ${counts[2]} permissions, ${counts[3]} roles, ${counts[4]} FAQs, ${counts[5]} legal texts`,
  )
  await disconnectDb()
}
