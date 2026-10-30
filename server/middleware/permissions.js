import { AppError } from '../lib/errors.js'
import { effectivePermissions } from '../modules/admin/admin.service.js'

/** M-155: every admin route checks its permission, computed per request from the database. */
export function requirePermission(id) {
  return async (req, res, next) => {
    if (req.user.role !== 'admin') throw new AppError('FORBIDDEN')
    if (!(await effectivePermissions(req.user)).has(id)) throw new AppError('PERMISSION_DENIED', { params: { permission: id } })
    next()
  }
}
