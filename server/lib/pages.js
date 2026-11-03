import { z } from 'zod'
import { LIMITS } from '../config/limits.js'

/* Server pagination of the four admin tables (M-206, §2.3): `page` from 1, `pageSize` up to the limit. */
export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIMITS.adminTable.maxPageSize).default(LIMITS.adminTable.pageSize),
}

export function paginate(items, { page, pageSize }) {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize }
}
