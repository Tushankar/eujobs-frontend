import { Router } from 'express'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { validate } from '../../lib/validate.js'
import { landing } from './landing.service.js'

const router = Router()

/** GET /landing: the public home page's live data (no session needed). */
router.get('/', validate({ query: z.object({ language: z.enum(ENUMS.language).default('en') }) }), async (req, res) => {
  res.json(await landing(req.query.language))
})

export default router
