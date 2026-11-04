import { Router } from 'express'
import { requireAuth, requireVerifiedEmail } from '../../middleware/auth.js'
import { validate } from '../../lib/validate.js'
import * as schemas from './notifications.schemas.js'
import * as notifications from './notifications.service.js'

/* Phase 11b: every role reads and opens only its own notifications. */
const router = Router()

router.use(requireAuth, requireVerifiedEmail)

router.get('/', validate({ query: schemas.listQuery }), async (req, res) => {
  res.json(await notifications.list(req.user, req.query))
})

router.post('/read-all', async (req, res) => {
  await notifications.readAll(req.user)
  res.status(204).end()
})

// P11b-Q10: an item page was opened; its notifications are read.
router.post('/seen', validate({ body: schemas.seenBody }), async (req, res) => {
  await notifications.markSeen(req.user, req.body)
  res.status(204).end()
})

router.post('/:id/open', validate({ params: schemas.idParams }), async (req, res) => {
  res.json(await notifications.open(req.user, req.params.id))
})

export default router
