import { z } from 'zod'
import { AppError } from './errors.js'

/*
 * zod middleware: validate({ body, query, params }) replaces each part with its parsed value or
 * throws VALIDATION_FAILED with field keys (§2.3, §2.4). Keys: required, too_short, too_long,
 * too_small, too_big, too_few, too_many, invalid. Limits go to `params` (min, max).
 */
const SIZE_KEYS = {
  too_small: { string: 'too_short', number: 'too_small', array: 'too_few' },
  too_big: { string: 'too_long', number: 'too_big', array: 'too_many' },
}

function fieldKey(issue) {
  if (issue.code === 'invalid_type' && issue.input === undefined) return 'required'
  if (issue.code === 'too_small' && issue.origin === 'string' && issue.minimum === 1) return 'required'
  return SIZE_KEYS[issue.code]?.[issue.origin] ?? 'invalid'
}

export function validationError(issues) {
  const fields = {}
  const params = {}
  for (const issue of issues) {
    const path = issue.path.join('.') || '_'
    if (fields[path]) continue
    const key = fieldKey(issue)
    fields[path] = key
    if (key !== 'required' && issue.minimum !== undefined) params.min = Number(issue.minimum)
    if (issue.maximum !== undefined) params.max = Number(issue.maximum)
  }
  return new AppError('VALIDATION_FAILED', { fields, params: Object.keys(params).length ? params : undefined })
}

export function validate(schemas) {
  return (req, res, next) => {
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue
      const result = schemas[part].safeParse(req[part] ?? {}, { reportInput: true })
      if (!result.success) throw validationError(result.error.issues)
      // Express 5 exposes req.query through a getter, so it is redefined rather than assigned.
      Object.defineProperty(req, part, { value: result.data, writable: true, configurable: true, enumerable: true })
    }
    next()
  }
}

/** A MongoDB ObjectId in a path or query (M-205). */
export const objectId = z.string().regex(/^[a-f\d]{24}$/i)
