import { randomBytes } from 'node:crypto'
import { mkdir, unlink } from 'node:fs/promises'
import multer from 'multer'
import { LIMITS } from '../config/limits.js'
import { AppError, fieldError } from '../lib/errors.js'
import { detectFileType, incomingDir, readHead } from '../lib/files.js'

// Large files (`toDisk`) are streamed into the incoming folder; multer deletes a partial file it refuses.
const diskStorage = multer.diskStorage({
  destination: (req, file, done) => {
    mkdir(incomingDir(), { recursive: true }).then(() => done(null, incomingDir()), done)
  },
  filename: (req, file, done) => done(null, randomBytes(16).toString('hex')),
})

/**
 * One multipart `file` per request, checked against the purpose's types and size (M-185, §2.6). It is held in
 * memory (req.file.buffer), or for `toDisk` purposes written to the incoming folder (req.file.path; the service
 * moves it with storeFile). Other multipart fields arrive as strings in req.body. Sets req.file.ext. With
 * `optional`, a request without a file (or a JSON body) passes through.
 */
export function upload(purpose, { optional = false } = {}) {
  const { types, maxBytes, toDisk } = LIMITS.uploads[purpose]
  const storage = toDisk ? diskStorage : multer.memoryStorage()
  const parse = multer({ storage, limits: { fileSize: maxBytes, files: 1 } }).single('file')
  return (req, res, next) => {
    parse(req, res, async (error) => {
      try {
        if (error?.code === 'LIMIT_FILE_SIZE') throw new AppError('FILE_TOO_LARGE', { params: { maxBytes } })
        if (error) throw fieldError({ file: 'invalid' })
        if (!req.file) {
          if (optional) return next()
          throw fieldError({ file: 'required' })
        }
        const head = toDisk ? await readHead(req.file.path) : req.file.buffer
        req.file.ext = await detectFileType({ ...req.file, buffer: head }, types)
        next()
      } catch (failure) {
        if (req.file?.path) await unlink(req.file.path).catch(() => {})
        next(failure)
      }
    })
  }
}
