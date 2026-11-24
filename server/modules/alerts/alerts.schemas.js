import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'
import { objectId } from '../../lib/validate.js'
import { sectorKey } from '../jobs/jobs.schemas.js'

/* Job alerts (§3.6, M-031). The city is a Places id (G-1); null clears it. The 10-alert limit is checked in the service. */
const A = LIMITS.jobAlert

export const idParams = z.object({ id: objectId })

// 2026-11-24: keywords may stay empty when the alert has sectors (the service checks one of them is given).
const fields = {
  name: z.string().trim().min(1).max(A.name.max),
  keywords: z.string().trim().max(A.keywords.max),
  sectors: z.array(sectorKey).max(LIMITS.sector.picks),
  placeId: z.string().trim().min(1).max(300).nullable(),
  frequency: z.enum(ENUMS.alertFrequency),
}

export const alertBody = z.object({ ...fields, sectors: fields.sectors.default([]), placeId: fields.placeId.default(null) })

export const alertPatchBody = z.object(fields).partial().extend({ active: z.boolean().optional() })
