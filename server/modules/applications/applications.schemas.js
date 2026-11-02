import { DateTime } from 'luxon'
import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'

/* Applications and the pipeline (§3.4, §5). Business rules (limits per company, duplicates) live in the services. */
export const idParams = z.object({ id: objectId })

// M-073: the consent box is checked in the service, after the gate, so a missing box answers `consent: required`.
export const applyBody = z.object({
  jobId: objectId,
  cvVersionId: objectId.optional(),
  coverNote: z.string().trim().max(LIMITS.application.coverNote.max).default(''),
  consent: z.boolean().default(false),
})

export const stageMoveBody = z.object({ stageId: objectId })
export const rejectBody = z.object({ notify: z.boolean().default(true) })

const stageName = z.string().trim().min(LIMITS.pipeline.stageName.min).max(LIMITS.pipeline.stageName.max)
export const stageBody = z.object({ name: stageName, category: z.enum(ENUMS.stageCategory).optional() })
export const stagePatchBody = z.object({ name: stageName.optional(), category: z.enum(ENUMS.stageCategory).optional() })
export const stageOrderBody = z.object({ ids: z.array(objectId) })

// M-076: the table's filters; withdrawn and not selected applications only through `status`.
export const recruiterListQuery = z.object({
  jobId: objectId.optional(),
  stageId: objectId.optional(),
  status: z.enum(['not_selected', 'withdrawn']).optional(),
})

// M-170: the browser's IANA time zone; chart endpoints take `tz`.
export const momentumQuery = z.object({
  tz: z.string().refine((zone) => DateTime.local().setZone(zone).isValid).optional(),
  period: z.enum(['this_week', 'last_week']).default('this_week'),
})
