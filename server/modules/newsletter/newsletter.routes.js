import { Router } from 'express'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { auditedExport } from '../../lib/csv.js'
import { t } from '../../lib/i18n.js'
import { validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import { newsletterPerIp } from '../../middleware/rateLimit.js'
import * as newsletter from './newsletter.service.js'

const tokenBody = validate({ body: z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }) })

/* POST /newsletter (10 an hour per IP), /newsletter/confirm and /newsletter/unsubscribe: no session. */
export const publicRouter = Router()

const subscribeBody = z.object({ email: z.email().trim().toLowerCase().max(LIMITS.email.max), language: z.enum(ENUMS.language).default('en') })

publicRouter.post('/', newsletterPerIp, validate({ body: subscribeBody }), async (req, res) => {
  res.status(202).json(await newsletter.subscribe(req.body))
})

publicRouter.post('/confirm', tokenBody, async (req, res) => {
  res.json(await newsletter.confirm(req.body.token))
})

publicRouter.post('/unsubscribe', tokenBody, async (req, res) => {
  res.json(await newsletter.unsubscribe(req.body.token))
})

/* /admin/content/subscribers (`content.view`; the export also needs `reports.export`). */
export const adminRouter = Router()
const view = requirePermission('content.view')
adminRouter.use(requireAuth, requireRole('admin'))

const listQuery = z.object({ status: z.enum(ENUMS.subscriberStatus).default('confirmed'), page: z.coerce.number().int().min(1).default(1) })

adminRouter.get('/', view, validate({ query: listQuery }), async (req, res) => {
  res.json(await newsletter.adminList(req.query))
})

adminRouter.get('/export', view, requirePermission('reports.export'), async (req, res) => {
  const rows = await newsletter.confirmedRows(t(req.user.language, 'csv.subscribers'))
  await auditedExport(req, res, { type: 'subscribers_exported', name: 'newsletter-subscribers', rows })
})
