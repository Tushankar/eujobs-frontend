import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import mongoose from 'mongoose'
import { PERMISSIONS } from '../config/enums.js'
import { ADMIN_MOUNTS } from '../routes/v1.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { api, auth, createUser, useTestDb } from './helpers/index.js'

/*
 * M-155: the permission matrix, generated from the admin route table (ADMIN_MOUNTS). For every route, an admin who
 * holds every permission except one the route needs gets PERMISSION_DENIED naming it; an admin who holds exactly the
 * route's permissions gets past the gate (whatever the handler then answers, never a 500).
 */
useTestDb([User])
before(() => seedCatalog())

const ALL = PERMISSIONS.map((permission) => permission.id)

/** [{ method, path, permissions }] in mount order; router-level permissions apply to the routes after them. */
function routeTable() {
  const rows = []
  for (const [mount, router] of ADMIN_MOUNTS) {
    let inherited = []
    for (const layer of router.stack) {
      if (!layer.route) {
        assert.ok(!layer.handle.stack, `${mount}: nested routers are not in the table`)
        if (layer.handle.permission) inherited = [...inherited, layer.handle.permission]
        continue
      }
      const own = layer.route.stack.map((entry) => entry.handle.permission).filter(Boolean)
      for (const method of Object.keys(layer.route.methods)) rows.push({ method, path: `${mount}${layer.route.path}`, permissions: [...inherited, ...own] })
    }
  }
  return rows
}

const ROUTES = routeTable()
// Phase 10b adds the Overview, Analytics, Reports, Applications and Recruitment routes.
const PENDING = { 'dashboard.view': 'Phase 10b', 'reports.view': 'Phase 10b', 'candidates.view': 'Phase 10b' }

const call = (route, user) => {
  assert.ok(!/[*{]/.test(route.path), `${route.path}: only :params are supported`)
  const url = `/api/v1${route.path.replace(/:\w+/g, () => String(new mongoose.Types.ObjectId()))}`
  return api()[route.method](url).set(auth(user))
}

const adminWith = (granted) => createUser({ role: 'admin', adminAccess: { granted } })

describe('admin permission matrix (M-155)', () => {
  it('guards every admin route with at least one permission', () => {
    assert.ok(ROUTES.length > 40, `only ${ROUTES.length} routes found`)
    const open = ROUTES.filter((route) => !route.permissions.length).map((route) => `${route.method} ${route.path}`)
    assert.deepEqual(open, [])
  })

  for (const { id } of PERMISSIONS) {
    it(`${id}: refused without it, allowed with it`, { todo: PENDING[id] }, async () => {
      const guarded = ROUTES.filter((route) => route.permissions.includes(id))
      if (id === 'users.deactivate') {
        // Checked inside the account decisions (OQ-2), not by a route: companies.test.js covers it.
        assert.deepEqual(guarded, [])
        return
      }
      assert.ok(guarded.length, `no route needs ${id}`)
      const without = await adminWith(ALL.filter((permission) => permission !== id))
      for (const route of guarded) {
        const res = await call(route, without)
        assert.equal(res.status, 403, `${route.method} ${route.path} without ${id}`)
        assert.deepEqual(res.body.error, { code: 'PERMISSION_DENIED', params: { permission: id } }, `${route.method} ${route.path}`)
        const exact = await adminWith(route.permissions)
        const allowed = await call(route, exact)
        assert.ok(allowed.body?.error?.code !== 'PERMISSION_DENIED' && allowed.status < 500, `${route.method} ${route.path} with ${route.permissions}: ${allowed.status} ${JSON.stringify(allowed.body?.error)}`)
      }
    })
  }
})
