import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorCode } from '@/app/api.js'
import { useFormat } from './preferences.js'

/*
 * Form validation (§2.4): validators return { key, params } per field; the server's
 * VALIDATION_FAILED becomes the same shape. Messages are translated where they are shown.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isBlank = (value) => !value || !String(value).trim()

export const check = {
  required: (value) => (isBlank(value) ? { key: 'required' } : undefined),
  email: (value) => (isBlank(value) ? { key: 'required' } : EMAIL_PATTERN.test(value.trim()) ? undefined : { key: 'invalid' }),
  /** New passwords: the length rule from GET /meta/config; the server checks the rest (M-006). */
  newPassword: (value, limits) => {
    if (!value) return { key: 'required' }
    if (limits && value.length < limits.password.min) return { key: 'too_short', params: { min: limits.password.min } }
    return undefined
  },
  confirm: (value, password) => (!value ? { key: 'required' } : value === password ? undefined : { key: 'mismatch' }),
  /** A required text of at most `max` characters (after trimming). */
  text: (value, max) => (isBlank(value) ? { key: 'required' } : value.trim().length > max ? { key: 'too_long', params: { max } } : undefined),
  /** An optional text of at most `max` characters. */
  maxLength: (value, max) => (value && value.trim().length > max ? { key: 'too_long', params: { max } } : undefined),
  /** An optional whole number from `min` to `max` (typed text). */
  wholeNumber: (value, { min, max }) => {
    const text = String(value ?? '').trim()
    if (!text) return undefined
    if (!/^\d+$/.test(text)) return { key: 'invalid' }
    if (Number(text) < min) return { key: 'too_small', params: { min } }
    return Number(text) > max ? { key: 'too_big', params: { max } } : undefined
  },
}

/** Drops fields without an error. */
export function compact(errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, error]) => error))
}

/** A VALIDATION_FAILED response as { field: { key, params } }; empty for any other error. */
export function serverFieldErrors(error) {
  const body = error?.data?.error
  if (body?.code !== 'VALIDATION_FAILED' || !body.fields) return {}
  return Object.fromEntries(Object.entries(body.fields).map(([field, key]) => [field, { key, params: body.params }]))
}

/**
 * A form's values, field errors and failure. `run(checks, work)` shows the client checks first; when they pass
 * it awaits `work` (a mutation's unwrap()) and maps a VALIDATION_FAILED answer onto the fields. Returns true on success.
 */
export function useFormState(initial) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState(null)

  const set = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }, [])

  async function run(checks, work) {
    const nextErrors = compact(checks)
    setErrors(nextErrors)
    setFailure(null)
    if (Object.keys(nextErrors).length > 0) return false
    try {
      await work()
      return true
    } catch (error) {
      setErrors(serverFieldErrors(error))
      if (errorCode(error) !== 'VALIDATION_FAILED') setFailure(error)
      return false
    }
  }

  return { values, set, setValues, errors, setErrors, failure, run }
}

/** Translators for field errors and API error codes. */
export function useErrorText() {
  const { t } = useTranslation()
  return {
    field: (name, error) => error && t([`validation:fields.${name}.${error.key}`, `validation:${error.key}`], error.params),
    code: (error) => {
      const params = error?.data?.error?.params ?? {}
      return t(`errors:${errorCode(error)}`, { ...params, count: params.attemptsLeft ?? params.retryAfter })
    },
  }
}

/** Seconds left of a cooldown started with start(); used for the resend links. */
export function useCooldown() {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until <= now) return undefined
    const timer = window.setTimeout(() => setNow(Date.now()), 250)
    return () => window.clearTimeout(timer)
  }, [until, now])
  const start = useCallback((seconds) => {
    setNow(Date.now())
    setUntil(Date.now() + seconds * 1000)
  }, [])
  return { remaining: Math.max(0, Math.ceil((until - now) / 1000)), start }
}

/** The browser's IANA time zone, saved at sign-up and each sign-in (U12). */
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

const EXTENSION_ALIASES = { jpeg: 'jpg' }

/** M-185, before uploading: a wrong extension, an empty file or one over the size limit, as an i18n key. */
export function checkUpload(file, rule) {
  const name = file.name.toLowerCase()
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : ''
  if (!rule.types.includes(EXTENSION_ALIASES[ext] ?? ext)) return 'wrongType'
  if (file.size === 0) return 'empty'
  if (file.size > rule.maxBytes) return 'tooLarge'
  return null
}

/** Texts of an upload rule from GET /meta/config: "PDF or DOCX · Up to 10 MB" and the checkUpload problems. */
export function useUploadText(rule) {
  const { t } = useTranslation()
  const format = useFormat()
  const params = rule && { types: format.list(rule.types.map((type) => type.toUpperCase()), 'disjunction'), size: format.fileSize(rule.maxBytes) }
  return {
    limits: rule ? t('common:upload.limits', params) : '',
    problem: (key, file) => t(`common:upload.${key}`, { ...params, name: file.name }),
  }
}
