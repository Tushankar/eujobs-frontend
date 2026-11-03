import { config } from '../../config/env.js'
import { LIMITS } from '../../config/limits.js'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { AppError, fieldError } from '../../lib/errors.js'
import { sendEmail } from '../../lib/mailer.js'
import { EmailToken } from '../auth/auth.model.js'
import { checkPassword, findEmailToken, hashPassword, issueEmailToken, useEmailToken } from '../auth/auth.service.js'
import { User } from '../users/users.model.js'
import { AdminRole } from './admin.model.js'
import { effectivePermissions } from './admin.service.js'

/*
 * Access management (§3.13): roles (M-157, M-158), admin staff access (M-154) with the Owner and lock-out rules
 * (M-160), and invites by email (M-159, U21). Every change is audited in the Access category.
 */

const audit = (admin, type, target, params) => recordAudit({ type: `access.${type}`, category: 'access', actor: actorFor(admin), target, params })

/* ---------- roles ---------- */

const roleDto = (role, assignedCount) => ({
  id: String(role._id),
  name: role.name,
  description: role.description ?? '',
  scope: role.scope ?? null,
  permissions: role.permissions,
  status: role.status,
  system: role.system,
  assignedCount,
  createdAt: role.createdAt,
})

async function assignedCounts() {
  const rows = await User.aggregate([{ $match: { role: 'admin', 'adminAccess.roleId': { $ne: null } } }, { $group: { _id: '$adminAccess.roleId', count: { $sum: 1 } } }])
  return new Map(rows.map((row) => [String(row._id), row.count]))
}

/** GET /admin/roles: active roles first (system roles, then by name), archived last. */
export async function listRoles() {
  const [roles, counts] = await Promise.all([AdminRole.find(), assignedCounts()])
  const items = roles
    .sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived') || Number(b.system) - Number(a.system) || a.name.localeCompare(b.name))
    .map((role) => roleDto(role, counts.get(String(role._id)) ?? 0))
  return { items, total: items.length, page: 1, pageSize: items.length }
}

async function findRole(id) {
  const role = await AdminRole.findById(id)
  if (!role) throw new AppError('NOT_FOUND')
  return role
}

/** M-158: names are unique ignoring case (`name: taken`). */
async function assertNameFree(name, exceptId) {
  const clash = await AdminRole.findOne({ nameLower: name.toLowerCase(), _id: { $ne: exceptId } })
  if (clash) throw fieldError({ name: 'taken' })
}

export async function createRole(admin, body) {
  await assertNameFree(body.name)
  const role = await AdminRole.create({ ...body, nameLower: body.name.toLowerCase(), createdBy: admin._id })
  await audit(admin, 'role_created', { type: 'role', id: role._id }, { role: role.name })
  return roleDto(role, 0)
}

/** "Name (copy)", then "Name (copy 2)", … until the name is free. */
export async function duplicateRole(admin, id) {
  const source = await findRole(id)
  let name = `${source.name} (copy)`
  for (let n = 2; await AdminRole.exists({ nameLower: name.toLowerCase() }); n += 1) name = `${source.name} (copy ${n})`
  name = name.slice(0, LIMITS.adminRole.name.max)
  await assertNameFree(name)
  const role = await AdminRole.create({
    name,
    nameLower: name.toLowerCase(),
    description: source.description,
    scope: source.scope,
    permissions: source.permissions,
    createdBy: admin._id,
  })
  await audit(admin, 'role_duplicated', { type: 'role', id: role._id }, { role: role.name, source: source.name })
  return roleDto(role, 0)
}

/** M-160: nobody removes their own `roles.assign`, by a role edit or an access change. */
async function assertKeepsRolesAssign(admin, nextAccess) {
  if (admin.isOwner) return
  const before = await effectivePermissions(admin)
  if (!before.has('roles.assign')) return
  const after = await effectivePermissions({ isOwner: false, adminAccess: nextAccess }, nextAccess.role)
  if (!after.has('roles.assign')) throw new AppError('OWNER_PROTECTED', { params: { reason: 'own_roles_assign' } })
}

export async function updateRole(admin, id, body) {
  const role = await findRole(id)
  if (role.status === 'archived') throw new AppError('CONFLICT', { params: { status: role.status } })
  await assertNameFree(body.name, role._id)
  if (String(admin.adminAccess?.roleId) === String(role._id)) {
    await assertKeepsRolesAssign(admin, { ...admin.adminAccess.toObject(), role: { ...role.toObject(), permissions: body.permissions } })
  }
  Object.assign(role, body, { nameLower: body.name.toLowerCase() })
  await role.save()
  await audit(admin, 'role_updated', { type: 'role', id: role._id }, { role: role.name })
  return roleDto(role, (await assignedCounts()).get(String(role._id)) ?? 0)
}

/** M-158: archiving is blocked while users are assigned (`IN_USE { count }`). */
export async function archiveRole(admin, id) {
  const role = await findRole(id)
  if (role.status === 'archived') throw new AppError('CONFLICT', { params: { status: role.status } })
  const count = await User.countDocuments({ role: 'admin', 'adminAccess.roleId': role._id })
  if (count) throw new AppError('IN_USE', { params: { count } })
  role.status = 'archived'
  await role.save()
  await audit(admin, 'role_archived', { type: 'role', id: role._id }, { role: role.name })
  return roleDto(role, 0)
}

/* ---------- admin staff access ---------- */

async function accessDto(user, roles) {
  const role = user.adminAccess?.roleId ? roles.get(String(user.adminAccess.roleId)) : null
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    status: user.status,
    isOwner: user.isOwner,
    role: role ? { id: String(role._id), name: role.name, status: role.status } : null,
    department: user.adminAccess?.department ?? '',
    granted: user.adminAccess?.granted ?? [],
    removed: user.adminAccess?.removed ?? [],
    permissions: [...(await effectivePermissions(user))],
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
  }
}

/** GET /admin/access/users (M-154): admin staff only, Owners first, then by name. */
export async function listAccessUsers() {
  const [users, roles] = await Promise.all([User.find({ role: 'admin' }), AdminRole.find()])
  const byId = new Map(roles.map((role) => [String(role._id), role]))
  users.sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.fullName.localeCompare(b.fullName))
  const items = await Promise.all(users.map((user) => accessDto(user, byId)))
  return { items, total: items.length, page: 1, pageSize: items.length }
}

async function staffMember(id) {
  const user = await User.findOne({ _id: id, role: 'admin' })
  if (!user) throw new AppError('NOT_FOUND')
  if (user.isOwner) throw new AppError('OWNER_PROTECTED', { params: { reason: 'owner' } })
  return user
}

async function activeRole(roleId) {
  if (!roleId) return null
  const role = await AdminRole.findOne({ _id: roleId, status: 'active' })
  if (!role) throw fieldError({ roleId: 'invalid' })
  return role
}

/** PUT /admin/access/users/:id: role, department and the individual grants and removals (effective = role ∪ granted − removed). */
export async function saveAccess(admin, id, { roleId, department, granted, removed }) {
  const user = await staffMember(id)
  const role = await activeRole(roleId)
  const next = { roleId: role?._id ?? null, department, granted: [...new Set(granted)], removed: [...new Set(removed)] }
  if (String(user._id) === String(admin._id)) await assertKeepsRolesAssign(admin, { ...next, role })
  user.adminAccess = next
  await user.save()
  await audit(admin, 'user_access_saved', { type: 'user', id: user._id }, { name: user.fullName, role: role?.name ?? null })
  return accessDto(user, new Map(role ? [[String(role._id), role]] : []))
}

/** DELETE /admin/access/users/:id: no role, no grants (the department label stays). */
export async function revokeAccess(admin, id) {
  const user = await staffMember(id)
  const next = { roleId: null, department: user.adminAccess?.department ?? '', granted: [], removed: [] }
  if (String(user._id) === String(admin._id)) await assertKeepsRolesAssign(admin, { ...next, role: null })
  user.adminAccess = next
  await user.save()
  await audit(admin, 'user_access_revoked', { type: 'user', id: user._id }, { name: user.fullName })
  return accessDto(user, new Map())
}

/* ---------- invites (M-159, U21) ---------- */

/**
 * POST /admin/invitations: a new admin in status `invited` with the chosen role, never an Owner. Inviting an address
 * that is still only invited sends a fresh link and voids the earlier ones; any other registered address is EMAIL_TAKEN.
 * The invite is written in the inviting admin's language, which the new account starts with.
 */
export async function invite(admin, { email, fullName, roleId, department }) {
  const role = await activeRole(roleId)
  let user = await User.findOne({ email })
  if (user && !(user.role === 'admin' && user.status === 'invited')) throw new AppError('EMAIL_TAKEN')
  user ??= new User({ role: 'admin', email, status: 'invited' })
  Object.assign(user, { fullName, language: admin.language, adminAccess: { roleId: role._id, department, granted: [], removed: [] } })
  await user.save()
  await EmailToken.deleteMany({ userId: user._id, purpose: 'admin_invite' })
  const token = await issueEmailToken(user._id, 'admin_invite', LIMITS.emailLink.inviteTtlMs)
  await sendEmail({
    type: 'admin_invite',
    to: user.email,
    userId: user._id,
    language: user.language,
    params: { name: user.fullName, inviter: admin.fullName, role: role.name, link: `${config.clientOrigin}/admin/set-password?token=${token}` },
  })
  await audit(admin, 'admin_invited', { type: 'user', id: user._id }, { name: user.fullName, email: user.email, role: role.name })
  return accessDto(user, new Map([[String(role._id), role]]))
}

/** GET /auth/invite/:token: who the link is for. */
export async function inviteDetails(raw) {
  const token = await findEmailToken(raw, 'admin_invite')
  const user = await User.findById(token.userId, 'email fullName')
  return { email: user.email, fullName: user.fullName }
}

/** POST /auth/invite/accept: sets the password once; the admin then signs in (as after a reset). */
export async function acceptInvite(raw, password) {
  const token = await findEmailToken(raw, 'admin_invite')
  const user = await User.findById(token.userId)
  checkPassword(password, user.email)
  const passwordHash = await hashPassword(password)
  await useEmailToken(token)
  Object.assign(user, { passwordHash, status: 'active', emailVerifiedAt: new Date() })
  await user.save()
  await audit(user, 'invite_accepted', { type: 'user', id: user._id }, { name: user.fullName })
  return { role: user.role }
}
