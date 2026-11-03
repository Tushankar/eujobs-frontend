import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { pageQuery } from '../../lib/pages.js'
import { objectId } from '../../lib/validate.js'
import { email, fullName } from '../auth/auth.schemas.js'

const { name, description, department } = LIMITS.adminRole
const permissions = z.array(z.enum(ENUMS.permission))
const country = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/)
const q = z.string().trim().max(100)

export const idParams = z.object({ id: objectId })

// M-158, A: admin §2.2: name 2–40, description ≤ 240, at least one permission.
export const roleBody = z.object({
  name: z.string().trim().min(name.min).max(name.max),
  description: z.string().trim().max(description.max).default(''),
  scope: z.enum(ENUMS.roleScope),
  permissions: permissions.min(1).transform((ids) => [...new Set(ids)]),
})

export const accessBody = z.object({
  roleId: objectId.nullable(),
  department: z.string().trim().max(department.max).default(''),
  granted: permissions.default([]),
  removed: permissions.default([]),
})

// U21: the role is chosen at invite.
export const inviteBody = z.object({ email, fullName, roleId: objectId, department: z.string().trim().max(department.max).default('') })

// M-161, M-169, M-138: one table per role; the candidate filters apply to candidates only.
export const usersQuery = z.object({
  role: z.enum(['candidate', 'recruiter']),
  q: q.optional(),
  status: z.enum(ENUMS.userStatus).optional(),
  state: z.enum(['pending', 'approved', 'rejected', 'suspended']).optional(),
  country: country.optional(),
  verification: z.enum(['not_started', 'in_review', 'partial', 'verified']).optional(),
  plan: z.enum(ENUMS.planKey).optional(),
  rightToWork: z.enum([...ENUMS.rtwRegion, 'none']).optional(),
  ...pageQuery,
})

export const auditQuery = z.object({
  category: z.enum(ENUMS.auditCategory).optional(),
  actorType: z.enum(ENUMS.actorType).optional(),
  q: q.optional(),
  ...pageQuery,
})

export const paymentsQuery = z.object({
  q: q.optional(),
  status: z.enum(ENUMS.paymentStatus).optional(),
  payer: z.enum(['candidate', 'recruiter']).optional(),
  kind: z.enum(ENUMS.paymentKind).optional(),
  source: z.enum(ENUMS.paymentSource).optional(),
  country: country.optional(),
  ...pageQuery,
})

export const statsQuery = z.object({ country: country.optional() })
