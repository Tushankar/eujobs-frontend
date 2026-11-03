import { Router } from 'express'
import { validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requireEntitlement } from '../../middleware/entitlements.js'
// Registers the instant-alert task and the digest check with the scheduler.
import './alerts.delivery.js'
import * as schemas from './alerts.schemas.js'
import * as alerts from './alerts.service.js'

/* /candidate/job-alerts (§5). Reading and deleting stay open after a lapse; changes need `job_alerts` (M-119, P7-Q2). */
const router = Router()
const idParams = validate({ params: schemas.idParams })
const plan = requireEntitlement('job_alerts')

router.use(requireAuth, requireRole('candidate'))

router.get('/', async (req, res) => {
  res.json(await alerts.listAlerts(req.user))
})

router.post('/', plan, validate({ body: schemas.alertBody }), async (req, res) => {
  res.status(201).json(await alerts.createAlert(req.user, req.body))
})

router.patch('/:id', idParams, plan, validate({ body: schemas.alertPatchBody }), async (req, res) => {
  res.json(await alerts.updateAlert(req.user, req.params.id, req.body))
})

router.delete('/:id', idParams, async (req, res) => {
  await alerts.deleteAlert(req.user, req.params.id)
  res.status(204).end()
})

export default router
