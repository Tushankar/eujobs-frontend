import { Router } from 'express'
import { z } from 'zod'
import { ENUMS, JOB_TYPES } from '../../config/enums.js'
import { validate } from '../../lib/validate.js'
import { sectorKey } from '../jobs/jobs.schemas.js'
import { placesNearPerIp } from '../../middleware/rateLimit.js'
import { cityNear } from '../places/places.service.js'
import { landing, publicJobs } from './landing.service.js'

const router = Router()

/** GET /landing: the public home page's live data (no session needed). */
router.get('/', validate({ query: z.object({ language: z.enum(ENUMS.language).default('en') }) }), async (req, res) => {
  res.json(await landing(req.query.language))
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
    res.json(await publicJobs(req.query))
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
