import { Router } from 'express'
import { ENUMS, isHiring, sideOf } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { validate } from '../../lib/validate.js'
import { optionalAuth, requireAuth } from '../../middleware/auth.js'
import * as schemas from './meta.schemas.js'
import { chargeCurrency } from '../payments/currencies.js'
import { companyCurrency } from '../payments/payments.service.js'
import { placesManual } from '../places/places.service.js'
import * as meta from './meta.service.js'
import { listSectors } from './sectors.service.js'

/* Public catalogue reads (§5 "Meta and public"); mounted at the API root. */
const router = Router()
const list = (items) => ({ items, total: items.length, page: 1, pageSize: items.length })

/**
 * Limits and enum keys, so client forms never hard-code them (§2.4). `placesManual`: city fields take a typed "City,
 * Country" and "Use my location" is hidden (the testing mode, or the Places budget used up, 2026-11-17).
 */
router.get('/meta/config', async (req, res) => {
  res.json({ limits: LIMITS, enums: ENUMS, placesManual: await placesManual() })
})

router.get('/meta/countries', async (req, res) => {
  res.json(list(await meta.listCountries()))
})

// 2026-11-24: job sectors with their names in every language; hidden ones are flagged.
router.get('/meta/sectors', async (req, res) => {
  res.json(list(await listSectors()))
})

router.get('/meta/languages', (req, res) => {
  res.json(list(meta.listLanguageCodes()))
})

/**
 * M-116, §3.22: the signed-in recruiter's or agency's plans (in the company country's currency) or the candidate plans
 * (in the requested currency, else the user's, else EUR, Remote's currency). `role` picks the plans (the public pricing
 * page shows them all); without it, the user's own.
 */
router.get('/plans', optionalAuth, validate({ query: schemas.plansQuery }), async (req, res) => {
  const wanted = req.query.role ?? req.user?.role
  const role = isHiring(wanted) ? wanted : 'candidate'
  // A requested currency is charged as such: the 8 of EU + UK, or USD (worldwide since 2026-11-16).
  const currency = (req.query.currency && chargeCurrency(req.query.currency)) ?? (req.user?.role === role && isHiring(role) ? await companyCurrency(req.user) : await meta.userCurrency(req.user)) ?? 'EUR'
  res.json(list(await meta.listPlans(currency, req.query.language ?? req.user?.language ?? 'en', role)))
})

router.get('/legal/:doc', validate({ params: schemas.legalParams, query: schemas.legalQuery }), async (req, res) => {
  res.json(await meta.currentLegalDocument(req.params.doc, req.query.language))
})

/** FAQs for the signed-in role, in the requested language or the user's own (M-200). */
router.get('/help/faqs', requireAuth, validate({ query: schemas.faqQuery }), async (req, res) => {
  res.json(list(await meta.listFaqs(sideOf(req.user.role), req.query.language ?? req.user.language)))
})

export default router
