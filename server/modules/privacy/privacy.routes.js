import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { validate } from '../../lib/validate.js'
import { deleteAccount } from './privacy.erase.js'
import { sendExport } from './privacy.export.js'
import { deleteBody } from './privacy.schemas.js'
import './privacy.retention.js'

/* GET /me/export · DELETE /me (M-188 … M-190): candidates and recruiters, in any account state they can sign in with. */
const router = Router()

const owner = [requireAuth, requireRole('candidate', 'recruiter')]

router.get('/export', owner, async (req, res) => {
  await sendExport(req.user, res)
})

router.delete('/', owner, validate({ body: deleteBody }), async (req, res) => {
  await deleteAccount(req.user, req.body)
  res.status(204).end()
})

export default router
