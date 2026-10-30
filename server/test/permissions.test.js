import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { actorFor, recordAudit, SYSTEM_ACTOR } from '../lib/audit.js'
import { AdminRole, AuditEvent } from '../modules/admin/admin.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { api, auth, createUser, useTestDb } from './helpers/index.js'

useTestDb([User, AuditEvent])
before(() => seedCatalog())

const getPermissions = (user) => api().get('/api/v1/admin/permissions').set(auth(user))
const role = (name) => AdminRole.findOne({ name })
const admin = async (access) => createUser({ role: 'admin', adminAccess: access })

describe('admin permissions (M-155, M-156, M-160)', () => {
  it('lets the Owner through without any role', async () => {
    const res = await getPermissions(await createUser({ role: 'admin', isOwner: true }))
    assert.equal(res.status, 200)
    assert.equal(res.body.total, 21)
    assert.deepEqual(res.body.items[0], { id: 'users.view', group: 'people', order: 1 })
  })

  it('answers PERMISSION_DENIED without roles.view', async () => {
    for (const access of [undefined, { roleId: (await role('Staff'))._id }]) {
      const res = await getPermissions(await admin(access))
      assert.equal(res.status, 403)
      assert.deepEqual(res.body.error, { code: 'PERMISSION_DENIED', params: { permission: 'roles.view' } })
    }
  })

  it('applies role ∪ granted − removed, and ignores archived roles', async () => {
    const manager = await role('Manager')
    assert.equal((await getPermissions(await admin({ roleId: manager._id }))).status, 200)
    assert.equal((await getPermissions(await admin({ granted: ['roles.view'] }))).status, 200)
    assert.equal((await getPermissions(await admin({ roleId: manager._id, removed: ['roles.view'] }))).status, 403)
    const archived = await AdminRole.create({ name: 'Old', nameLower: 'old-test', permissions: ['roles.view'], status: 'archived' })
    assert.equal((await getPermissions(await admin({ roleId: archived._id }))).status, 403)
    await archived.deleteOne()
  })

  it('refuses non-admins with FORBIDDEN', async () => {
    const res = await getPermissions(await createUser())
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'FORBIDDEN')
  })
})

describe('audit writer (M-162)', () => {
  it('records admin and system events with an actor type', async () => {
    const owner = await createUser({ role: 'admin', isOwner: true, fullName: 'Workspace admin' })
    await recordAudit({ type: 'access.role_created', category: 'access', actor: actorFor(owner), target: { type: 'role', id: owner._id } })
    await recordAudit({ type: 'system.retention_sweep', category: 'workspace', actor: SYSTEM_ACTOR, params: { files: 2 } })
    const events = await AuditEvent.find().sort({ at: 1 }).lean()
    assert.deepEqual(events.map((event) => [event.type, event.actor.type]), [
      ['access.role_created', 'admin'],
      ['system.retention_sweep', 'system'],
    ])
    assert.equal(events[0].actor.name, 'Workspace admin')
    assert.ok(events[1].at instanceof Date)
  })
})
