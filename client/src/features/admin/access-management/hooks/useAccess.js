import { useMemo } from 'react'
import { useSharedLocalStorage } from '@/hooks/useSharedLocalStorage.js'
import { ACCESS_USERS, DEFAULT_USER_ACCESS, SYSTEM_ROLES } from '../data/accessData.js'

const ROLES_KEY = 'lwm.admin.roles'
const USER_ACCESS_KEY = 'lwm.admin.userAccess'
const NO_CUSTOM_ROLES = []
const NO_ACCESS = { roleId: null, department: '', granted: [], removed: [] }

/** Permission ids a user effectively holds: the role's permissions plus individual grants minus individual removals. */
export function effectivePermissionIds(role, access) {
  const ids = new Set(role?.permissions ?? [])
  access.granted.forEach((id) => ids.add(id))
  access.removed.forEach((id) => ids.delete(id))
  return ids
}

function uniqueRoleId(name, roles) {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'role'
  let id = `custom-${base}`
  for (let n = 2; roles.some((role) => role.id === id); n += 1) id = `custom-${base}-${n}`
  return id
}

/**
 * Roles and per-user access for Admin > Access management. System roles are fixed; custom roles
 * (`lwm.admin.roles`) and user assignments (`lwm.admin.userAccess`) persist on this device and are
 * shared by every component that calls the hook.
 */
export function useAccess() {
  const [customRoles, setCustomRoles] = useSharedLocalStorage(ROLES_KEY, NO_CUSTOM_ROLES)
  const [userAccess, setUserAccess] = useSharedLocalStorage(USER_ACCESS_KEY, DEFAULT_USER_ACCESS)

  const users = useMemo(
    () =>
      ACCESS_USERS.map((user) => {
        const access = { ...NO_ACCESS, ...userAccess[user.id] }
        const role = [...SYSTEM_ROLES, ...customRoles].find((candidate) => candidate.id === access.roleId) ?? null
        return { ...user, access, role, effective: effectivePermissionIds(role, access) }
      }),
    [customRoles, userAccess],
  )

  const roles = useMemo(
    () =>
      [...SYSTEM_ROLES, ...customRoles].map((role) => ({
        ...role,
        assignedUsers: users.filter((user) => user.role?.id === role.id).length,
      })),
    [customRoles, users],
  )

  function addRole({ name, scope, description, permissions }, { copyOf } = {}) {
    const role = {
      id: uniqueRoleId(name, roles),
      name: name.trim(),
      description: description.trim() || (copyOf ? copyOf.description : 'Custom role created by an admin.'),
      scope,
      system: false,
      permissions,
    }
    setCustomRoles((current) => [...current, role])
    return role
  }

  function duplicateRole(role) {
    let name = `${role.name} (copy)`
    for (let n = 2; roles.some((existing) => existing.name.toLowerCase() === name.toLowerCase()); n += 1) {
      name = `${role.name} (copy ${n})`
    }
    return addRole({ name, scope: role.scope, description: role.description, permissions: role.permissions }, { copyOf: role })
  }

  function saveUserAccess(userId, access) {
    setUserAccess((current) => ({ ...current, [userId]: access }))
  }

  function revokeUserAccess(userId) {
    setUserAccess((current) => ({ ...current, [userId]: { ...NO_ACCESS } }))
  }

  return { roles, users, addRole, duplicateRole, saveUserAccess, revokeUserAccess }
}
