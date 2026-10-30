import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../../lib/errors.js'
import { absolutePath, validSignature } from '../../lib/files.js'
import { objectId, validate } from '../../lib/validate.js'
import { User } from '../users/users.model.js'
import { File, FileAccessLog } from './files.model.js'

/* GET /files/:fileId with a signed URL (U39): no Authorization header, so <img>, PDF viewers and links work. */
const router = Router()

const signedQuery = z.object({
  u: objectId,
  exp: z.coerce.number().int(),
  sig: z.string().regex(/^[a-f\d]{64}$/),
  download: z.literal('1').optional(),
})

/** M-187: a CV served to someone other than its owner is logged once per view (not per Range chunk). */
async function logCvAccess(file, accessorId, range) {
  if (file.purpose !== 'cv' || accessorId === String(file.ownerId) || (range && !range.startsWith('bytes=0-'))) return
  const accessor = await User.findById(accessorId, 'companyId')
  await FileAccessLog.create({ fileId: file._id, ownerId: file.ownerId, accessorId, companyId: accessor?.companyId })
}

router.get('/:fileId', validate({ params: z.object({ fileId: objectId }), query: signedQuery }), async (req, res, next) => {
  const file = await File.findById(req.params.fileId)
  if (!file || !validSignature(file, req.query)) throw new AppError('FORBIDDEN')
  await logCvAccess(file, req.query.u, req.get('range'))
  if (req.query.download) res.attachment(file.originalName ?? file.path.split('/').pop())
  else res.set('Content-Disposition', 'inline')
  res.set('Cache-Control', 'private')
  res.sendFile(absolutePath(file), { cacheControl: false, headers: { 'Content-Type': file.mime } }, (error) => {
    // ECONNABORTED: the browser cancelled the request (a reload or a new Range request); nobody is listening.
    if (!error || error.code === 'ECONNABORTED' || res.headersSent) return
    next(error.code === 'ENOENT' ? new AppError('NOT_FOUND') : error)
  })
})

export default router
