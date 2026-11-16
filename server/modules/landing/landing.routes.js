import { Router } from 'express'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { validate } from '../../lib/validate.js'
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
      employmentType: z.enum(ENUMS.employmentType).optional(),
    }),
  }),
  async (req, res) => {
    res.json(await publicJobs(req.query))
  },
)

export default router
