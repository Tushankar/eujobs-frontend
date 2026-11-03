import { describeAudit } from '../../lib/audit.js'
import { t } from '../../lib/i18n.js'
import { paginate } from '../../lib/pages.js'
import { AuditEvent } from './admin.model.js'

/*
 * Admin › Audit logs (M-162, M-163, M-206): newest first, by category chip and actor type. The search looks in the
 * actor name and the event's parameters (names, titles, references); the client renders the sentence from `type`.
 */
const eventDto = (event) => ({
  id: String(event._id),
  type: event.type,
  category: event.category,
  actor: { type: event.actor.type, name: event.actor.name ?? null },
  target: event.target?.type ? { type: event.target.type, id: event.target.id ? String(event.target.id) : null } : null,
  params: event.params ?? {},
  at: event.at,
})

const searchable = (event) => [event.actor.name, ...Object.values(event.params ?? {})].filter((value) => typeof value === 'string').join(' ').toLowerCase()

export async function filteredEvents({ category, actorType, q }) {
  const filter = { ...(category && { category }), ...(actorType && { 'actor.type': actorType }) }
  const events = await AuditEvent.find(filter).sort({ at: -1, _id: -1 })
  return q ? events.filter((event) => searchable(event).includes(q.toLowerCase())) : events
}

export async function listEvents(query) {
  const page = paginate(await filteredEvents(query), query)
  return { ...page, items: page.items.map(eventDto) }
}

/** OQ-6d: headers, labels and the event sentence in the admin's language. */
export function exportRows(events, language) {
  return [
    t(language, 'csv.audit'),
    ...events.map((event) => [
      event.at.toISOString(),
      t(language, `labels.auditCategory.${event.category}`),
      t(language, `labels.actorType.${event.actor.type}`),
      event.actor.name ?? '',
      describeAudit(event, language),
    ]),
  ]
}
