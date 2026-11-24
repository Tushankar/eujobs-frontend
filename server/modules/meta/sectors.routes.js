import { Router } from 'express'
import { z } from 'zod'
import { LIMITS } from '../../config/limits.js'
import { validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import * as sectors from './sectors.service.js'

/* /admin/content/sectors (2026-11-24): viewing needs `content.view`, changes `content.manage`. */
const S = LIMITS.sector
const text = z.string().trim().min(S.name.min).max(S.name.max)
const name = z.object({ en: text, es: text, fr: text })
const keyParams = validate({ params: z.object({ key: z.string().regex(/^[a-z0-9_]{1,50}$/) }) })

export const adminRouter = Router()
adminRouter.use(requireAuth, requireRole('admin'))

adminRouter.get('/', requirePermission('content.view'), async (req, res) => {
  res.json(await sectors.adminList())
})

adminRouter.post('/', requirePermission('content.manage'), validate({ body: z.object({ name }) }), async (req, res) => {
  res.status(201).json(await sectors.create(req.user, req.body))
})

adminRouter.patch('/:key', requirePermission('content.manage'), keyParams, validate({ body: z.object({ name: name.optional(), hidden: z.boolean().optional() }) }), async (req, res) => {
  res.json(await sectors.update(req.user, req.params.key, req.body))
})
