import { Router } from 'express'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { auditedExport } from '../../lib/csv.js'
import { t } from '../../lib/i18n.js'
import { objectId, validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import { newsletterPerIp } from '../../middleware/rateLimit.js'
import * as issues from './newsletter.issues.js'
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

/* /admin/content/newsletter: composing issues needs `content.manage`, reading them `content.view`. */
export const issuesRouter = Router()
const manage = requirePermission('content.manage')
issuesRouter.use(requireAuth, requireRole('admin'))

const I = LIMITS.newsletterIssue
const language = z.enum(ENUMS.language)
const idParams = validate({ params: z.object({ id: objectId }) })
const copy = z.object({ subject: z.string().trim().max(I.subject.max), intro: z.string().trim().max(I.intro.max) }).partial()
const patchBody = z
  .object({
    translations: z.object(Object.fromEntries(ENUMS.language.map((code) => [code, copy]))).partial(),
    jobIds: z.array(objectId).max(I.maxJobs),
    postIds: z.array(objectId).max(I.maxPosts),
  })
  .partial()

issuesRouter.get('/', view, async (req, res) => {
  res.json(await issues.list())
})

issuesRouter.post('/', manage, async (req, res) => {
  res.status(201).json(await issues.create(req.user))
})

// Before /:id, so "options" is not read as an issue id.
issuesRouter.get('/options', view, async (req, res) => {
  res.json(await issues.options())
})

issuesRouter.get('/:id', view, idParams, async (req, res) => {
  res.json(await issues.get(req.params.id))
})

issuesRouter.patch('/:id', manage, idParams, validate({ body: patchBody }), async (req, res) => {
  res.json(await issues.update(req.user, req.params.id, req.body))
})

issuesRouter.delete('/:id', manage, idParams, async (req, res) => {
  res.json(await issues.remove(req.user, req.params.id))
})

issuesRouter.get('/:id/preview', view, idParams, validate({ query: z.object({ language: language.default('en') }) }), async (req, res) => {
  res.json(await issues.preview(req.params.id, req.query.language))
})

issuesRouter.post('/:id/test', manage, idParams, validate({ body: z.object({ language: language.default('en') }) }), async (req, res) => {
  res.json(await issues.sendTest(req.user, req.params.id, req.body.language))
})

issuesRouter.post('/:id/send', manage, idParams, async (req, res) => {
  res.status(202).json(await issues.send(req.user, req.params.id))
})
