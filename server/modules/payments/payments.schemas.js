import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'

/* Quote and Checkout (M-124, M-125). `itemId` is `plus` for the plan or a course id. */
export const itemQuery = z.object({ kind: z.enum(ENUMS.paymentKind), itemId: z.string().trim().min(1).max(64) })

// The page to return to after Checkout: a path inside the buyer's own workspace (checked in the service).
export const checkoutBody = itemQuery.extend({ from: z.string().max(300).regex(/^\/(candidate|recruiter)(\/[\w\-./?=&%]*)?$/) })

export const sessionParams = z.object({ id: z.string().regex(/^cs_(test|live)_\w+$/) })
