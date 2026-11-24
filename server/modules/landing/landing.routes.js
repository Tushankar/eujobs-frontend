import { Router } from 'express'
import { z } from 'zod'
import { ENUMS, JOB_TYPES } from '../../config/enums.js'
import { validate } from '../../lib/validate.js'
import { sectorKey } from '../jobs/jobs.schemas.js'
import { landingPerIp, placesNearPerIp } from '../../middleware/rateLimit.js'
import { cityNear } from '../places/places.service.js'
import { landing, publicJobs } from './landing.service.js'

const router = Router()

// perf 2026-11-24: a generous per-IP limit on the public reads, and a minute of browser caching for the two answers that
// are the same for every visitor (the language and filters are in the URL, no session is read).
router.use(landingPerIp)
const PUBLIC_MINUTE = 'public, max-age=60'

/** GET /landing: the public home page's live data (no session needed). */
router.get('/', validate({ query: z.object({ language: z.enum(ENUMS.language).default('en') }) }), async (req, res) => {
  const body = await landing(req.query.language)
  res.set('Cache-Control', PUBLIC_MINUTE).json(body)
})

const keywords = z.string().trim().max(200).default('')

/** GET /landing/jobs: the public job list (no session needed). */
router.get(
  '/jobs',
  validate({
    query: z.object({
      language: z.enum(ENUMS.language).default('en'),
      q: keywords,
      location: keywords,
      workPreference: z.enum(ENUMS.workPreference).optional(),
      employmentType: z.enum(JOB_TYPES).optional(),
      sector: sectorKey.optional(),
      visa: z.enum(['1']).optional(),
    }),
  }),
  async (req, res) => {
    const body = await publicJobs(req.query)
    res.set('Cache-Control', PUBLIC_MINUTE).json(body)
  },
)

/** GET /landing/near: the city at the visitor's position, for the job search (owner 2026-11-16; no session needed). */
router.get(
  '/near',
  placesNearPerIp,
  validate({
    query: z.object({
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
      language: z.enum(ENUMS.language).default('en'),
    }),
  }),
  async (req, res) => {
    res.json(await cityNear(req.query))
  },
)

export default router
