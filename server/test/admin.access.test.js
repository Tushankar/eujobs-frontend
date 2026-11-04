import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { roleText } from '../modules/admin/admin.access.js'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { EmailToken } from '../modules/auth/auth.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { PASSWORD, api, auth, createUser, linkToken, mailTo, shiftBack, testEmail, useTestDb } from './helpers/index.js'

useTestDb([User, AuditEvent, EmailToken])
before(async () => {
  await AdminRole.deleteMany({ system: false })
  await seedCatalog()
})

const v1 = '/api/v1'
const owner = () => createUser({ role: 'admin', isOwner: true, fullName: 'Workspace admin' })
const roleBody = (fields = {}) => ({ name: `Ops ${Math.random().toString(36).slice(2, 8)}`, scope: 'team', description: 'Day-to-day operations.', permissions: ['users.view'], ...fields })
const createRole = (user, body) => api().post(`${v1}/admin/roles`).set(auth(user)).send(body)
const saveAccess = (user, id, body) => api().put(`${v1}/admin/access/users/${id}`).set(auth(user)).send(body)

describe('roles (M-157, M-158)', () => {
  it('validates name length, unique names in any case and at least one permission', async () => {
    const admin = await owner()
    const tooLong = await createRole(admin, roleBody({ name: 'x'.repeat(41) }))
    assert.deepEqual([tooLong.status, tooLong.body.error.fields], [422, { name: 'too_long' }])
    assert.deepEqual((await createRole(admin, roleBody({ name: 'x' }))).body.error.fields, { name: 'too_short' })
    assert.deepEqual((await createRole(admin, roleBody({ permissions: [] }))).body.error.fields, { permissions: 'too_few' })
    assert.deepEqual((await createRole(admin, roleBody({ name: 'mAnAgEr' }))).body.error.fields, { name: 'taken' })
    assert.deepEqual((await createRole(admin, roleBody({ permissions: ['users.edit'] }))).body.error.fields, { 'permissions.0': 'invalid' })
  })

  it('shows unchanged system roles in the admin’s language and keeps their seeded text (P11-Q6)', async () => {
    const admin = await owner()
    await User.updateOne({ _id: admin._id }, { language: 'es' })
    const list = async (user) => (await api().get(`${v1}/admin/roles`).set(auth(user))).body.items
    const manager = (await list(admin)).find((role) => role.system && role.scope === 'department' && role.permissions.includes('roles.assign'))
    assert.deepEqual([manager.name, manager.description.startsWith('Supervisa un equipo')], ['Responsable de equipo', true])

    // A permissions-only edit through the dialog, which is prefilled with the Spanish text, keeps the seeded text.
    const seeded = await AdminRole.findById(manager.id)
    const edited = await api().patch(`${v1}/admin/roles/${manager.id}`).set(auth(admin)).send({ name: manager.name, description: manager.description, scope: manager.scope, permissions: [...manager.permissions, 'audit.view'] })
    assert.equal(edited.body.name, 'Responsable de equipo')
    assert.deepEqual([(await AdminRole.findById(manager.id)).name, (await AdminRole.findById(manager.id)).description], [seeded.name, seeded.description])
    const english = await owner()
    assert.equal((await list(english)).find((role) => role.id === manager.id).name, 'Manager')
    await AdminRole.updateOne({ _id: manager.id }, { permissions: seeded.permissions })

    // A copy reads as the source did, with the suffix in the admin's language; it is an ordinary role from then on.
    const copy = await api().post(`${v1}/admin/roles/${manager.id}/duplicate`).set(auth(admin))
    assert.equal(copy.body.name, 'Responsable de equipo (copia)')
    assert.equal((await list(english)).find((role) => role.id === copy.body.id).name, 'Responsable de equipo (copia)')

    // Changed text reads as written in every language.
    assert.deepEqual(roleText({ system: true, name: 'Gerencia', description: 'Texto propio.' }, 'fr'), { name: 'Gerencia', description: 'Texto propio.' })
    assert.equal(roleText(seeded, 'fr').name, 'Responsable d’équipe')
  })

  it('creates, duplicates with a free name, edits and audits', async () => {
    const admin = await owner()
    const created = await createRole(admin, roleBody({ name: 'Support desk', permissions: ['users.view', 'users.view', 'audit.view'] }))
    assert.equal(created.status, 201)
    assert.deepEqual(created.body.permissions, ['users.view', 'audit.view'])
    const copy = await api().post(`${v1}/admin/roles/${created.body.id}/duplicate`).set(auth(admin))
    assert.equal(copy.body.name, 'Support desk (copy)')
    const copy2 = await api().post(`${v1}/admin/roles/${created.body.id}/duplicate`).set(auth(admin))
    assert.equal(copy2.body.name, 'Support desk (copy 2)')
    const edited = await api().patch(`${v1}/admin/roles/${copy.body.id}`).set(auth(admin)).send(roleBody({ name: 'Support lead', permissions: ['users.view', 'users.add'] }))
    assert.deepEqual([edited.body.name, edited.body.permissions], ['Support lead', ['users.view', 'users.add']])
    const list = await api().get(`${v1}/admin/roles`).set(auth(admin))
    assert.ok(list.body.items.some((role) => role.name === 'Support lead' && role.assignedCount === 0))
    const types = (await AuditEvent.find({ category: 'access' }).sort({ at: 1 })).map((event) => event.type)
    assert.deepEqual(types, ['access.role_created', 'access.role_duplicated', 'access.role_duplicated', 'access.role_updated'])
    await AdminRole.deleteMany({ system: false })
  })

  it('blocks archiving a role with users, archives an unused one, and freezes it', async () => {
    const admin = await owner()
    const role = (await createRole(admin, roleBody())).body
    const staff = await createUser({ role: 'admin', adminAccess: { roleId: role.id } })
    const blocked = await api().post(`${v1}/admin/roles/${role.id}/archive`).set(auth(admin))
    assert.deepEqual([blocked.status, blocked.body.error], [409, { code: 'IN_USE', params: { count: 1 } }])
    await saveAccess(admin, staff.id, { roleId: null })
    const archived = await api().post(`${v1}/admin/roles/${role.id}/archive`).set(auth(admin))
    assert.equal(archived.body.status, 'archived')
    assert.equal((await api().patch(`${v1}/admin/roles/${role.id}`).set(auth(admin)).send(roleBody())).body.error.code, 'CONFLICT')
    // An archived role cannot be assigned.
    assert.deepEqual((await saveAccess(admin, staff.id, { roleId: role.id })).body.error.fields, { roleId: 'invalid' })
    await AdminRole.deleteMany({ system: false })
  })
})

describe('user access and lock-out (M-154, M-160)', () => {
  it('lists admin staff only, Owners first, with effective permissions', async () => {
    const admin = await owner()
    const staffRole = await AdminRole.findOne({ name: 'Staff' })
    await createUser({ role: 'admin', fullName: 'Ada Admin', adminAccess: { roleId: staffRole._id, granted: ['audit.view'], removed: ['candidates.view'] } })
    await createUser({ role: 'candidate' })
    const res = await api().get(`${v1}/admin/access/users`).set(auth(admin))
    assert.deepEqual(res.body.items.map((user) => user.fullName), ['Workspace admin', 'Ada Admin'])
    assert.deepEqual(res.body.items[1].permissions.sort(), ['audit.view', 'users.view'])
    assert.equal(res.body.items[1].role.name, 'Staff')
  })

  it('never changes an Owner', async () => {
    const admin = await owner()
    const other = await createUser({ role: 'admin', isOwner: true })
    for (const res of [await saveAccess(admin, other.id, { roleId: null }), await api().delete(`${v1}/admin/access/users/${other.id}`).set(auth(admin))]) {
      assert.deepEqual([res.status, res.body.error], [409, { code: 'OWNER_PROTECTED', params: { reason: 'owner' } }])
    }
  })

  it('refuses removing your own roles.assign by access, revoke or role edit', async () => {
    const manager = await AdminRole.findOne({ name: 'Manager' })
    const self = await createUser({ role: 'admin', adminAccess: { roleId: manager._id } })
    const ownProtected = { code: 'OWNER_PROTECTED', params: { reason: 'own_roles_assign' } }
    assert.deepEqual((await saveAccess(self, self.id, { roleId: manager.id, removed: ['roles.assign'] })).body.error, ownProtected)
    assert.deepEqual((await api().delete(`${v1}/admin/access/users/${self.id}`).set(auth(self))).body.error, ownProtected)
    const editor = await createUser({ role: 'admin', adminAccess: { roleId: manager._id, granted: ['roles.edit'] } })
    const edit = await api().patch(`${v1}/admin/roles/${manager.id}`).set(auth(editor)).send({ name: 'Manager', scope: 'department', permissions: ['users.view', 'roles.view'] })
    assert.deepEqual(edit.body.error, ownProtected)
    // Keeping roles.assign through a grant is fine.
    const kept = await saveAccess(self, self.id, { roleId: null, granted: ['roles.assign', 'roles.view'] })
    assert.equal(kept.status, 200)
    assert.deepEqual(kept.body.permissions.sort(), ['roles.assign', 'roles.view'])
  })

  it('saves another admin’s role, department, grants and removals, and revokes them', async () => {
    const admin = await owner()
    const staff = await createUser({ role: 'admin', fullName: 'Bea Staff' })
    const accounts = await AdminRole.findOne({ name: 'Accounts Head' })
    const saved = await saveAccess(admin, staff.id, { roleId: accounts.id, department: 'Finance', granted: ['documents.view'], removed: ['audit.view'] })
    assert.equal(saved.body.department, 'Finance')
    assert.ok(saved.body.permissions.includes('documents.view') && !saved.body.permissions.includes('audit.view'))
    const revoked = await api().delete(`${v1}/admin/access/users/${staff.id}`).set(auth(admin))
    assert.deepEqual([revoked.body.role, revoked.body.permissions, revoked.body.department], [null, [], 'Finance'])
    const types = (await AuditEvent.find({ category: 'access' }).sort({ at: 1 })).map((event) => event.type)
    assert.deepEqual(types, ['access.user_access_saved', 'access.user_access_revoked'])
  })
})

describe('admin invites (M-159, U21)', () => {
  const invite = (admin, body) => api().post(`${v1}/admin/invitations`).set(auth(admin)).send(body)

  it('invites by email with the chosen role; the single-use link sets the password', async () => {
    const admin = await owner()
    const staffRole = await AdminRole.findOne({ name: 'Staff' })
    const email = testEmail('invitee')
    const res = await invite(admin, { email, fullName: 'Nia Invitee', roleId: staffRole.id, department: 'Support' })
    assert.equal(res.status, 201)
    assert.deepEqual([res.body.status, res.body.isOwner, res.body.role.name], ['invited', false, 'Staff'])
    const mail = mailTo(email, 'admin_invite').at(-1)
    assert.equal(mail.params.inviter, 'Workspace admin')
    assert.match(mail.params.link, /\/admin\/set-password\?token=/)
    const token = linkToken(email, 'admin_invite')

    // An invited admin cannot sign in or reset a password yet.
    assert.equal((await api().post(`${v1}/auth/login`).send({ email, password: PASSWORD, portal: 'admin' })).status, 401)
    await api().post(`${v1}/auth/forgot-password`).send({ email })
    assert.equal(mailTo(email, 'password_reset').length, 0)

    assert.deepEqual((await api().get(`${v1}/auth/invite/${token}`)).body, { email, fullName: 'Nia Invitee' })
    assert.equal((await api().post(`${v1}/auth/invite/accept`).send({ token, password: 'short' })).status, 422)
    const accepted = await api().post(`${v1}/auth/invite/accept`).send({ token, password: PASSWORD })
    assert.deepEqual(accepted.body, { role: 'admin' })
    assert.equal((await api().post(`${v1}/auth/invite/accept`).send({ token, password: PASSWORD })).body.error.code, 'TOKEN_USED')
    const login = await api().post(`${v1}/auth/login`).send({ email, password: PASSWORD, portal: 'admin' })
    assert.equal(login.status, 200)
    assert.deepEqual(login.body.me.permissions.sort(), ['candidates.view', 'users.view'])
    const types = (await AuditEvent.find({ category: 'access' }).sort({ at: 1 })).map((event) => event.type)
    assert.deepEqual(types, ['access.admin_invited', 'access.invite_accepted'])
  })

  it('expires after 72 hours; a new invite voids the old link; registered emails are taken', async () => {
    const admin = await owner()
    const staffRole = await AdminRole.findOne({ name: 'Staff' })
    const email = testEmail('late')
    await invite(admin, { email, fullName: 'Late Invitee', roleId: staffRole.id })
    const first = linkToken(email, 'admin_invite')
    await shiftBack(EmailToken, { purpose: 'admin_invite' }, 'expiresAt', 72 * 60 * 60 * 1000 + 1000)
    assert.equal((await api().get(`${v1}/auth/invite/${first}`)).body.error.code, 'TOKEN_EXPIRED')
    await invite(admin, { email, fullName: 'Late Invitee', roleId: staffRole.id })
    assert.equal((await api().get(`${v1}/auth/invite/${first}`)).body.error.code, 'TOKEN_INVALID')
    assert.equal((await api().get(`${v1}/auth/invite/${linkToken(email, 'admin_invite')}`)).status, 200)
    const candidate = await createUser()
    assert.equal((await invite(admin, { email: candidate.email, fullName: 'Taken', roleId: staffRole.id })).body.error.code, 'EMAIL_TAKEN')
    assert.equal((await invite(admin, { email: testEmail('x'), fullName: 'No role' })).body.error.fields.roleId, 'required')
  })
})
