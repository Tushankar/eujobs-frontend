/*
 * Stable error codes (§2.3). The server sends codes, field keys and params; the client translates
 * them (M-143). INTERNAL_ERROR covers unexpected failures.
 */
export const ERROR_STATUS = {
  AUTH_REQUIRED: 401,
  INVALID_CREDENTIALS: 401,
  EMAIL_UNVERIFIED: 403,
  ACCOUNT_SUSPENDED: 403,
  RECRUITER_NOT_APPROVED: 403,
  FORBIDDEN: 403,
  PERMISSION_DENIED: 403,
  PLAN_REQUIRED: 402,
  PROFILE_INCOMPLETE: 403,
  NOT_FOUND: 404,
  JOB_NOT_ACCEPTING: 410,
  TOKEN_INVALID: 400,
  TOKEN_EXPIRED: 410,
  TOKEN_USED: 409,
  CODE_INVALID: 422,
  CODE_EXPIRED: 410,
  CODE_LOCKED: 429,
  EMAIL_TAKEN: 409,
  CONFLICT: 409,
  IN_USE: 409,
  LOCKED: 409,
  OWNER_PROTECTED: 409,
  VALIDATION_FAILED: 422,
  FILE_TYPE_NOT_ALLOWED: 422,
  FILE_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  AI_DAILY_LIMIT: 429,
  AI_UNAVAILABLE: 503,
  PAYMENT_PROVIDER_ERROR: 502,
  PLACES_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
}

export class AppError extends Error {
  constructor(code, { fields, params } = {}) {
    super(code)
    this.code = code
    this.status = ERROR_STATUS[code]
    this.fields = fields
    this.params = params
  }
}

/** Shorthand for a business-rule validation error on one or more fields. */
export function fieldError(fields, params) {
  return new AppError('VALIDATION_FAILED', { fields, params })
}
