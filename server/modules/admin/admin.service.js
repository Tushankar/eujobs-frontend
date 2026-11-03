import { ENUMS } from '../../config/enums.js'
import { AdminRole, Permission } from './admin.model.js'

/**
 * Effective permissions = active role's permissions ∪ granted − removed; Owners hold all (M-160, §3.13).
 * `role` replaces the stored role (null = none), so a change can be checked before it is saved.
 */
export async function effectivePermissions(user, role) {
  if (user.isOwner) return new Set(ENUMS.permission)
  const { roleId, granted = [], removed = [] } = user.adminAccess ?? {}
  if (role === undefined) role = roleId ? await AdminRole.findOne({ _id: roleId, status: 'active' }, 'permissions') : null
  const permissions = new Set([...(role?.permissions ?? []), ...granted])
  for (const id of removed) permissions.delete(id)
  return permissions
}

export async function listPermissions() {
  const permissions = await Permission.find({}, 'id group order').sort({ order: 1 })
  return permissions.map(({ id, group, order }) => ({ id, group, order }))
}
