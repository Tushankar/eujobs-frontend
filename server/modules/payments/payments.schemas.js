import { z } from 'zod'
import { ENUMS } from '../../config/enums.js'

/* Quote and Checkout (M-124, M-125). `itemId` is the role's plan key or a course id; a plan bills monthly or yearly. */
export const itemQuery = z.object({
  kind: z.enum(ENUMS.paymentKind),
  itemId: z.string().trim().min(1).max(64),
  interval: z.enum(ENUMS.billingInterval).default('month'),
})

// The page to return to after Checkout: a path inside the buyer's own workspace (checked in the service).
export const checkoutBody = itemQuery.extend({ from: z.string().max(300).regex(/^\/(candidate|recruiter)(\/[\w\-./?=&%]*)?$/) })

export const sessionParams = z.object({ id: z.string().regex(/^cs_(test|live)_\w+$/) })
