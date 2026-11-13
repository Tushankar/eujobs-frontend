import { Router } from 'express'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId, validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import { upload } from '../../middleware/upload.js'
import * as blog from './blog.service.js'

const B = LIMITS.blog
const language = z.enum(ENUMS.language)
const fields = {
  title: z.string().trim().min(B.title.min).max(B.title.max),
  language,
  excerpt: z.string().trim().min(B.excerpt.min).max(B.excerpt.max),
  bodyMarkdown: z.string().trim().min(B.body.min).max(B.body.max),
  coverFileId: objectId.nullable(),
}
const createBody = z.object({ ...fields, coverFileId: fields.coverFileId.optional() })
const patchBody = z.object(fields).partial()
const idParams = validate({ params: z.object({ id: objectId }) })

/* GET /blog and /blog/:slug: the public blog, no session. */
export const publicRouter = Router()

publicRouter.get('/', validate({ query: z.object({ language: language.default('en'), page: z.coerce.number().int().min(1).default(1) }) }), async (req, res) => {
  res.json(await blog.publicList(req.query.language, req.query.page))
})

publicRouter.get('/:slug', validate({ params: z.object({ slug: z.string().regex(/^[a-z0-9-]{1,90}$/) }) }), async (req, res) => {
  res.json(await blog.publicPost(req.params.slug))
})

/* /admin/content/blog: viewing needs `content.view`, changes `content.manage`. */
export const adminRouter = Router()
const view = requirePermission('content.view')
const manage = requirePermission('content.manage')
adminRouter.use(requireAuth, requireRole('admin'))

adminRouter.get('/', view, async (req, res) => {
  res.json(await blog.adminList())
})

adminRouter.post('/', manage, validate({ body: createBody }), async (req, res) => {
  res.status(201).json(await blog.create(req.user, req.body))
})

// Before /:id, so "covers" is not read as a post id.
adminRouter.post('/covers', manage, upload('blog_cover'), async (req, res) => {
  res.status(201).json(await blog.uploadCover(req.user, req.file))
})

adminRouter.get('/:id', view, idParams, async (req, res) => {
  res.json(await blog.adminGet(req.params.id))
})

adminRouter.patch('/:id', manage, idParams, validate({ body: patchBody }), async (req, res) => {
  res.json(await blog.update(req.user, req.params.id, req.body))
})

adminRouter.patch('/:id/status', manage, idParams, validate({ body: z.object({ status: z.enum(ENUMS.blogStatus) }) }), async (req, res) => {
  res.json(await blog.setStatus(req.user, req.params.id, req.body))
})

adminRouter.delete('/:id', manage, idParams, async (req, res) => {
  res.json(await blog.remove(req.user, req.params.id))
})
