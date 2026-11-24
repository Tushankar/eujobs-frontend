import { Router } from 'express'
import { z } from 'zod'
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
import { currentSite } from './sites.service.js'

/* Public catalogue reads (§5 "Meta and public"); mounted at the API root. */
const router = Router()
const list = (items) => ({ items, total: items.length, page: 1, pageSize: items.length })
// perf 2026-11-24: catalogue reads that are the same for every visitor (no session; the language is in the URL) may be
// kept by browsers for 5 minutes. /plans reads the session, so it is never cached; nor are the sectors (below).
const PUBLIC_5_MINUTES = 'public, max-age=300'

/**
 * Limits and enum keys, so client forms never hard-code them (§2.4). `placesManual`: city fields take a typed "City,
 * Country" and "Use my location" is hidden (the testing mode, or the Places budget used up, 2026-11-17).
 */
router.get('/meta/config', async (req, res) => {
  res.json({ limits: LIMITS, enums: ENUMS, placesManual: await placesManual() })
})

router.get('/meta/countries', async (req, res) => {
  const body = list(await meta.listCountries())
  res.set('Cache-Control', PUBLIC_5_MINUTES).json(body)
})

// 2026-11-24: job sectors with their names in every language; hidden ones are flagged.
router.get('/meta/sectors', async (req, res) => {
  // Not browser-cached: the client fetches it again right after an admin edits the sectors.
  res.json(list(await listSectors()))
})

// 2026-11-24: the sector site on this domain (null on the main site) and the main site's origin. Same for every visitor.
router.get('/meta/site', validate({ query: z.object({ host: z.string().trim().max(200).default('') }) }), async (req, res) => {
  res.set('Cache-Control', PUBLIC_5_MINUTES).json(await currentSite(req.query.host))
})

router.get('/meta/languages', (req, res) => {
  const body = list(meta.listLanguageCodes())
  res.set('Cache-Control', PUBLIC_5_MINUTES).json(body)
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
  const body = await meta.currentLegalDocument(req.params.doc, req.query.language)
  res.set('Cache-Control', PUBLIC_5_MINUTES).json(body)
})

/** FAQs for the signed-in role, in the requested language or the user's own (M-200). */
router.get('/help/faqs', requireAuth, validate({ query: schemas.faqQuery }), async (req, res) => {
  res.json(list(await meta.listFaqs(sideOf(req.user.role), req.query.language ?? req.user.language)))
})

export default router
