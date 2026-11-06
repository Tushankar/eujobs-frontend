import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'

/* Interviews and document requests (§3.23, §5). Who may do what is checked by the routes and the service. */
const L = LIMITS.interviews
const D = LIMITS.documentRequest

export const idParams = z.object({ id: objectId })
export const itemParams = z.object({ id: objectId, itemId: objectId })

const text = (max) => z.string().trim().min(1).max(max)
const slot = z.object({ startAt: z.coerce.date(), minutes: z.coerce.number().refine((value) => L.minutes.includes(value)) })

// P11d-Q1, Q3, Q17, Q28: the mode with its address or https link, 2–3 slots and the AI-notes tick (video only).
const place = {
  mode: z.enum(ENUMS.interviewMode).default('video'),
  address: z.string().trim().max(L.address.max).optional(),
  link: z.url({ protocol: /^https$/ }).max(L.link.max).optional(),
  aiNotes: z.boolean().optional(),
  slots: z.array(slot).min(L.slots.min).max(L.slots.max),
}

export const offerBody = z.object({ applicationId: objectId, ...place })
export const rescheduleBody = z.object(place)
export const cancelBody = z.object({ reason: z.string().trim().max(L.reason.max).optional() })
export const outcomeBody = z.object({
  result: z.enum(ENUMS.interviewOutcome),
  note: z.string().trim().max(L.feedback.max).optional(),
  // Not selected: the reject flow's "Email the candidate" box (M-090).
  notify: z.boolean().optional(),
})
export const pickBody = z.object({ startAt: z.coerce.date() })
export const noteBody = z.object({ note: text(L.note.max) })
export const consentBody = z.object({ agree: z.boolean() })
export const chunkQuery = z.object({ seq: z.coerce.number().int().min(0) })

// Multipart fields arrive as strings: `items` is JSON.
const items = z
  .string()
  .transform((value, context) => {
    try {
      return JSON.parse(value)
    } catch {
      context.addIssue({ code: 'custom', message: 'invalid' })
      return z.NEVER
    }
  })
  .pipe(z.array(z.object({ kind: z.enum(ENUMS.documentKind), label: z.string().trim().max(D.otherLabel.max).optional() })).min(D.items.min).max(D.items.max))

export const requestBody = z.object({ applicationId: objectId, items, note: z.string().trim().max(D.note.max).optional() })
export const declineBody = z.object({ note: text(D.declineNote.max) })
