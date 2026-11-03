import { Router } from 'express'
import { validate } from '../../lib/validate.js'
import { requireApprovedRecruiter, requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import { upload } from '../../middleware/upload.js'
import * as admin from './learning.admin.js'
import * as schemas from './learning.schemas.js'
import * as learning from './learning.service.js'

/** Candidates, and approved recruiters (R✓), learn (§5). */
const learner = [
  requireAuth,
  requireRole('candidate', 'recruiter'),
  (req, res, next) => (req.user.role === 'recruiter' ? requireApprovedRecruiter(req, res, next) : next()),
]
const idParams = validate({ params: schemas.idParams })
const lessonParams = validate({ params: schemas.lessonParams })

/* /courses: the catalogue and course details. */
export const coursesRouter = Router()
coursesRouter.use(...learner)

coursesRouter.get('/', async (req, res) => {
  res.json(await learning.listCourses(req.user))
})

coursesRouter.get('/:id', idParams, async (req, res) => {
  res.json(await learning.getCourse(req.user, req.params.id))
})

/* /learning: enrollments and lessons. */
export const learningRouter = Router()
learningRouter.use(...learner)

learningRouter.get('/enrollments', async (req, res) => {
  res.json(await learning.listEnrollments(req.user))
})

learningRouter.post('/enrollments', validate({ body: schemas.enrollBody }), async (req, res) => {
  res.status(201).json(await learning.enrollFree(req.user, req.body))
})

learningRouter.get('/courses/:id/lessons/:lessonId', lessonParams, async (req, res) => {
  res.json(await learning.getLesson(req.user, req.params.id, req.params.lessonId))
})

/* /admin/courses: the builder (M-101); viewing needs `learning.view`, changes `learning.manage`. */
export const adminCoursesRouter = Router()
const view = requirePermission('learning.view')
const manage = requirePermission('learning.manage')
adminCoursesRouter.use(requireAuth, requireRole('admin'))

adminCoursesRouter.get('/', view, validate({ query: schemas.audienceQuery }), async (req, res) => {
  res.json(await admin.listCourses(req.user, req.query))
})

adminCoursesRouter.post('/', manage, validate({ body: schemas.createBody }), async (req, res) => {
  res.status(201).json(await admin.createCourse(req.user, req.body))
})

adminCoursesRouter.get('/:id', view, idParams, async (req, res) => {
  res.json(await admin.getCourse(req.user, req.params.id))
})

adminCoursesRouter.patch('/:id', manage, idParams, validate({ body: schemas.detailsBody }), async (req, res) => {
  res.json(await admin.updateDetails(req.user, req.params.id, req.body))
})

adminCoursesRouter.post('/:id/lessons', manage, idParams, validate({ body: schemas.lessonBody }), async (req, res) => {
  res.status(201).json(await admin.addLesson(req.user, req.params.id, req.body))
})

// Before /:id/lessons/:lessonId, so "order" is not read as a lesson id.
adminCoursesRouter.put('/:id/lessons/order', manage, idParams, validate({ body: schemas.orderBody }), async (req, res) => {
  res.json(await admin.reorderLessons(req.user, req.params.id, req.body))
})

adminCoursesRouter.patch('/:id/lessons/:lessonId', manage, lessonParams, validate({ body: schemas.lessonPatchBody }), async (req, res) => {
  res.json(await admin.updateLesson(req.user, req.params.id, req.params.lessonId, req.body))
})

adminCoursesRouter.delete('/:id/lessons/:lessonId', manage, lessonParams, async (req, res) => {
  res.json(await admin.deleteLesson(req.user, req.params.id, req.params.lessonId))
})

adminCoursesRouter.put('/:id/quiz', manage, idParams, validate({ body: schemas.quizBody }), async (req, res) => {
  res.json(await admin.saveQuiz(req.user, req.params.id, req.body))
})

adminCoursesRouter.patch('/:id/status', manage, idParams, validate({ body: schemas.statusBody }), async (req, res) => {
  res.json(await admin.setStatus(req.user, req.params.id, req.body))
})

/* POST /admin/uploads?purpose= and POST /admin/markdown/preview (`learning.manage`), mounted under /admin. */
export const adminToolsRouter = Router()
const manager = [requireAuth, requireRole('admin'), manage]
const uploaders = Object.fromEntries(schemas.uploadQuery.shape.purpose.options.map((purpose) => [purpose, upload(purpose)]))

adminToolsRouter.post('/uploads', ...manager, validate({ query: schemas.uploadQuery }), (req, res, next) => uploaders[req.query.purpose](req, res, next), async (req, res) => {
  res.status(201).json(await admin.uploadCourseFile(req.user, req.query.purpose, req.file))
})

adminToolsRouter.post('/markdown/preview', ...manager, validate({ body: schemas.markdownBody }), (req, res) => {
  res.json(admin.previewMarkdown(req.body))
})
