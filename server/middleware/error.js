import { AppError } from '../lib/errors.js'

export function notFound(req, res, next) {
  next(new AppError('NOT_FOUND'))
}

/** JSON errors only, never stack traces (§2.12). Body-parser failures are validation errors. */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, fields: err.fields, params: err.params } })
  }
  if (err.type?.startsWith('entity.') || err.type === 'charset.unsupported') {
    return res.status(422).json({ error: { code: 'VALIDATION_FAILED' } })
  }
  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR' } })
}
