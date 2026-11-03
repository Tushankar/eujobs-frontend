import { AppError } from '../lib/errors.js'
import { effectivePermissions } from '../modules/admin/admin.service.js'

/**
 * M-155: every admin route checks its permission, computed per request from the database. The middleware carries
 * its `permission`, so the permission matrix test reads the route table instead of a hand-made list.
 */
export function requirePermission(id) {
  const check = async (req, res, next) => {
    if (req.user.role !== 'admin') throw new AppError('FORBIDDEN')
    if (!(await effectivePermissions(req.user)).has(id)) throw new AppError('PERMISSION_DENIED', { params: { permission: id } })
    next()
  }
  check.permission = id
  return check
}
