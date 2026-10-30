import ISO6391 from 'iso-639-1'
import { ENUMS } from '../../config/enums.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { Plan } from '../payments/payments.model.js'
import { Country, Faq, LegalDocument } from './meta.model.js'

/** An enabled country row, or VALIDATION_FAILED on `field` (M-135, M-139). */
export async function findEnabledCountry(code, field = 'country') {
  const country = await Country.findOne({ code, enabled: true })
  if (!country) throw fieldError({ [field]: 'invalid' })
  return country
}

/** Enabled countries in catalogue order; names come from Intl.DisplayNames on the client (M-139). */
export async function listCountries() {
  const countries = await Country.find({ enabled: true }, 'code currency defaultLanguage isRemote order').sort({ order: 1 })
  return countries.map(({ code, currency, defaultLanguage, isRemote }) => ({ code, currency, defaultLanguage, isRemote }))
}

const latestVersion = (doc) => LegalDocument.findOne({ doc, publishedAt: { $ne: null } }, 'version').sort({ publishedAt: -1 })

/** The latest published Terms and Privacy versions (M-191, U22); null while none exists. */
export async function currentLegalVersions() {
  const [terms, privacy] = await Promise.all([latestVersion('terms'), latestVersion('privacy')])
  return { termsVersion: terms?.version ?? null, privacyVersion: privacy?.version ?? null }
}

/** The current version of a legal text in `language`, falling back to English (M-191). */
export async function currentLegalDocument(doc, language) {
  const latest = await latestVersion(doc)
  if (!latest) throw new AppError('NOT_FOUND')
  const texts = await LegalDocument.find({ doc, version: latest.version, language: { $in: [language, 'en'] } })
  const text = texts.find((entry) => entry.language === language) ?? texts[0]
  const { version, title, bodyHtml, isDraft, publishedAt } = text
  return { doc, version, language: text.language, title, html: bodyHtml, isDraft, publishedAt }
}

/** FAQs for one audience in one language (M-200). */
export async function listFaqs(audience, language) {
  const faqs = await Faq.find({ audiences: audience }).sort({ order: 1 })
  return faqs.map((faq) => ({ id: String(faq._id), question: faq.question[language], answer: faq.answer[language] }))
}

/** M-020: every ISO 639-1 code; names come from Intl.DisplayNames on the client. */
export function listLanguageCodes() {
  return ISO6391.getAllCodes().sort()
}

/** The currency of the signed-in user's header country (M-130), or null when anonymous. */
export async function userCurrency(user) {
  if (!user?.pickerCountry) return null
  return (await Country.findOne({ code: user.pickerCountry }, 'currency'))?.currency ?? null
}

/** M-116: Free then Plus, in one language, with the price in `currency` (Free is 0; null where Plus has no price). */
export async function listPlans(currency, language) {
  const plans = await Plan.find({})
  return plans
    .sort((a, b) => ENUMS.planKey.indexOf(a.key) - ENUMS.planKey.indexOf(b.key))
    .map((plan) => {
      const price = plan.key === 'free' ? { currency, amountMinor: 0 } : plan.prices.find((entry) => entry.currency === currency)
      return {
        key: plan.key,
        name: plan.name[language],
        features: plan.features.map((feature) => feature[language]),
        interval: plan.interval,
        price: price ? { amountMinor: price.amountMinor, currency } : null,
        entitlements: plan.entitlements,
      }
    })
}
