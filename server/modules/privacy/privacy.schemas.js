import { z } from 'zod'

export const deleteBody = z.object({ password: z.string().min(1) })
