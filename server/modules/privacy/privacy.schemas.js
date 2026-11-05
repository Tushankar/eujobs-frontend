import { z } from 'zod'

export const deleteBody = z.object({ currentPassword: z.string().min(1) })
