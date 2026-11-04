import { z } from 'zod'
import { EMAIL_CATEGORIES } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'

const { pageSize } = LIMITS.notifications

export const listQuery = z.object({
  filter: z.enum(['all', 'unread']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(pageSize).default(pageSize),
})

export const idParams = z.object({ id: objectId })

export const seenBody = z.object({ kind: z.string().min(1).max(40), id: z.string().min(1).max(40) })

/** PATCH /me/notifications: any of the role's categories, true (on) or false (off). */
export const switchesBody = z.object({
  emailSwitches: z.partialRecord(z.enum([...new Set(Object.values(EMAIL_CATEGORIES).flat())]), z.boolean()),
})
