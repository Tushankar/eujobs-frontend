import { interpolate, t } from './i18n.js'
import { AuditEvent } from '../modules/admin/admin.model.js'

/*
 * Audit writer (M-162, M-163). `type` is an i18n key the client translates with `params`;
 * the actor is an admin, a user or the system.
 */
export const SYSTEM_ACTOR = { type: 'system' }

// OQ-6b: admins format by their language's default region.
const ADMIN_LOCALE = { en: 'en-IE', es: 'es-ES', fr: 'fr-FR' }

export function actorFor(user) {
  return { type: user.role === 'admin' ? 'admin' : 'user', id: user._id, name: user.fullName }
}

export function recordAudit({ type, category, actor, target, params }) {
  return AuditEvent.create({ type, category, actor, target, params, at: new Date() })
}

/** One event as a sentence in `language` (the audit export, OQ-6d); enum params become labels, money is formatted. */
export function describeAudit(event, language) {
  const params = { ...event.params }
  if (params.category) params.category = t(language, `labels.verificationCategory.${params.category}`)
  for (const key of ['from', 'to']) if (params[key]) params[key] = t(language, `labels.jobStatus.${params[key]}`)
  if (params.amountMinor !== undefined) {
    params.amount = new Intl.NumberFormat(ADMIN_LOCALE[language], { style: 'currency', currency: params.currency }).format(params.amountMinor / 100)
  }
  return interpolate(t(language, `audit.${event.type}`), params)
}
