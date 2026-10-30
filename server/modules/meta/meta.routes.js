import { Router } from 'express'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { validate } from '../../lib/validate.js'
import { optionalAuth, requireAuth } from '../../middleware/auth.js'
import * as schemas from './meta.schemas.js'
import * as meta from './meta.service.js'

/* Public catalogue reads (§5 "Meta and public"); mounted at the API root. */
const router = Router()
const list = (items) => ({ items, total: items.length, page: 1, pageSize: items.length })

/** Limits and enum keys, so client forms never hard-code them (§2.4). */
router.get('/meta/config', (req, res) => {
  res.json({ limits: LIMITS, enums: ENUMS })
})

router.get('/meta/countries', async (req, res) => {
  res.json(list(await meta.listCountries()))
})

router.get('/meta/languages', (req, res) => {
  res.json(list(meta.listLanguageCodes()))
})

/** M-116: prices in the requested currency, else the signed-in user's, else EUR (Remote's currency). */
router.get('/plans', optionalAuth, validate({ query: schemas.plansQuery }), async (req, res) => {
  const currency = req.query.currency ?? (await meta.userCurrency(req.user)) ?? 'EUR'
  res.json(list(await meta.listPlans(currency, req.query.language ?? req.user?.language ?? 'en')))
})

router.get('/legal/:doc', validate({ params: schemas.legalParams, query: schemas.legalQuery }), async (req, res) => {
  res.json(await meta.currentLegalDocument(req.params.doc, req.query.language))
})

/** FAQs for the signed-in role, in the requested language or the user's own (M-200). */
router.get('/help/faqs', requireAuth, validate({ query: schemas.faqQuery }), async (req, res) => {
  res.json(list(await meta.listFaqs(req.user.role, req.query.language ?? req.user.language)))
})

export default router
