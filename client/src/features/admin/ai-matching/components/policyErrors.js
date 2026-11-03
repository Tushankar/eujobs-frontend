import { check } from '@/lib/forms.js'

/** Field errors of the policy forms: the page's own texts first, then the shared validation texts. */
export const policyErrorText = (t, field, error) => error && t([`aiMatching:errors.${field}.${error.key}`, `validation:${error.key}`], error.params)

/** A trimmed text within the server's limits (GET /meta/config), as the server checks it (A: admin §1.19). */
export function checkLength(value, { min, max }) {
  const required = check.required(value)
  if (required) return required
  const length = value.trim().length
  if (length < min) return { key: 'too_short', params: { min } }
  return length > max ? { key: 'too_long', params: { max } } : undefined
}
