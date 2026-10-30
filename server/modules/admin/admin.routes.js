import { Router } from 'express'
import { z } from 'zod'
import { objectId, validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import { adminFileUrl } from '../files/files.service.js'
import { listPermissions } from './admin.service.js'

const router = Router()

router.use(requireAuth, requireRole('admin'))

router.get('/permissions', requirePermission('roles.view'), async (req, res) => {
  const items = await listPermissions()
  res.json({ items, total: items.length, page: 1, pageSize: items.length })
})

router.get('/files/:fileId', requirePermission('documents.view'), validate({ params: z.object({ fileId: objectId }) }), async (req, res) => {
  res.json(await adminFileUrl(req.user, req.params.fileId))
})

export default router
