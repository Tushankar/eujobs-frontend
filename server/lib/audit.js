import { AuditEvent } from '../modules/admin/admin.model.js'

/*
 * Audit writer (M-162, M-163). `type` is an i18n key the client translates with `params`;
 * the actor is an admin, a user or the system.
 */
export const SYSTEM_ACTOR = { type: 'system' }

export function actorFor(user) {
  return { type: user.role === 'admin' ? 'admin' : 'user', id: user._id, name: user.fullName }
}

export function recordAudit({ type, category, actor, target, params }) {
  return AuditEvent.create({ type, category, actor, target, params, at: new Date() })
}
