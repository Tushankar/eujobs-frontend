import { PERMISSIONS } from '../config/enums.js'
import { connectDb, disconnectDb } from '../lib/db.js'
import { renderMarkdown } from '../lib/markdown.js'
import { AdminRole, Permission } from '../modules/admin/admin.model.js'
import { ensureDefaultPolicy } from '../modules/matching/matching.admin.js'
import { Country, Faq, LegalDocument } from '../modules/meta/meta.model.js'
import { AppConfig, Plan } from '../modules/payments/payments.model.js'
import { COUNTRIES, PLANS, SYSTEM_ROLES } from './data/catalog.js'
import { FAQS } from './data/faqs.js'
import { LEGAL_DOCUMENTS, LEGAL_VERSION } from './data/legal.js'
import { ensurePlanPrices, ensurePortalConfiguration } from './stripe.js'

/*
 * seed:catalog (U41): an idempotent upsert of the catalogue. Countries, plans, permissions, FAQs and
 * legal texts match the data exactly; the system roles and the default matching policy v1 (§3.20) are only
 * created when missing, so admin edits to them survive.
 */
async function upsertExactly(Model, key, rows) {
  await Model.bulkWrite(rows.map((row) => ({ updateOne: { filter: { [key]: row[key] }, update: { $set: row }, upsert: true } })))
  await Model.deleteMany({ [key]: { $nin: rows.map((row) => row[key]) } })
}

export async function seedCatalog() {
  await ensureDefaultPolicy()
  await upsertExactly(Country, 'code', COUNTRIES)
  // U40, P6, §3.22: a Stripe Product and Prices per paid plan, one Portal configuration; ids live on the plan and in AppConfig('stripe').
  const productIds = {}
  const plans = []
  for (const plan of PLANS) {
    const { productId, priceIds } = plan.prices.length ? await ensurePlanPrices(plan) : { priceIds: {} }
    if (productId) productIds[plan.key] = productId
    plans.push({ ...plan, prices: plan.prices.map((price) => ({ ...price, stripePriceId: priceIds[price.currency] })) })
  }
  await upsertExactly(Plan, 'key', plans)
  await AppConfig.updateOne({ key: 'stripe' }, { $set: { value: { productIds, portalConfigurationId: await ensurePortalConfiguration() } } }, { upsert: true })
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
