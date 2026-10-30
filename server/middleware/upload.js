import multer from 'multer'
import { LIMITS } from '../config/limits.js'
import { AppError, fieldError } from '../lib/errors.js'
import { detectFileType } from '../lib/files.js'

/**
 * One multipart `file` per request, held in memory and checked against the purpose's types and size
 * (M-185, §2.6). Other multipart fields arrive as strings in req.body. Sets req.file.ext. With
 * `optional`, a request without a file (or a JSON body) passes through.
 */
export function upload(purpose, { optional = false } = {}) {
  const { types, maxBytes } = LIMITS.uploads[purpose]
  const parse = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1 } }).single('file')
  return (req, res, next) => {
    parse(req, res, async (error) => {
      try {
        if (error?.code === 'LIMIT_FILE_SIZE') throw new AppError('FILE_TOO_LARGE', { params: { maxBytes } })
        if (error) throw fieldError({ file: 'invalid' })
        if (!req.file) {
          if (optional) return next()
          throw fieldError({ file: 'required' })
        }
        req.file.ext = await detectFileType(req.file, types)
        next()
      } catch (failure) {
        next(failure)
      }
    })
  }
}
