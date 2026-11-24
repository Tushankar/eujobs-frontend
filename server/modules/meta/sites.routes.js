import { Router } from 'express'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import { sectorKey } from '../jobs/jobs.schemas.js'
import * as sites from './sites.service.js'

/* /admin/content/sites (2026-11-24): viewing needs `content.view`, changes `content.manage`. */
const S = LIMITS.site
const localized = (max) => z.object({ en: z.string().trim().min(2).max(max), es: z.string().trim().min(2).max(max), fr: z.string().trim().min(2).max(max) })
const fields = {
  host: z.string().trim().toLowerCase().regex(/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/).max(S.host.max),
  sectors: z.array(sectorKey).max(LIMITS.sector.max),
  employmentTypes: z.array(z.enum(ENUMS.employmentType)).max(ENUMS.employmentType.length),
  remoteOnly: z.boolean(),
  title: localized(S.title.max),
  text: localized(S.text.max),
  active: z.boolean(),
}
const createBody = z.object({ ...fields, sectors: fields.sectors.default([]), employmentTypes: fields.employmentTypes.default([]), remoteOnly: fields.remoteOnly.default(false), active: fields.active.default(true) })
const { host, ...editable } = fields
const patchBody = z.object(editable).partial()
const hostParams = validate({ params: z.object({ host: fields.host }) })

export const adminRouter = Router()
adminRouter.use(requireAuth, requireRole('admin'))

adminRouter.get('/', requirePermission('content.view'), async (req, res) => {
  res.json(await sites.adminList())
})

adminRouter.post('/', requirePermission('content.manage'), validate({ body: createBody }), async (req, res) => {
  res.status(201).json(await sites.create(req.user, req.body))
})

adminRouter.patch('/:host', requirePermission('content.manage'), hostParams, validate({ body: patchBody }), async (req, res) => {
  res.json(await sites.update(req.user, req.params.host, req.body))
})
