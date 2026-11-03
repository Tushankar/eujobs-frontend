import { Router } from 'express'
import { z } from 'zod'
import { auditedExport } from '../../lib/csv.js'
import { objectId, validate } from '../../lib/validate.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import { adminFileUrl } from '../files/files.service.js'
import * as access from './admin.access.js'
import * as audit from './admin.audit.js'
import * as schemas from './admin.schemas.js'
import { listPermissions } from './admin.service.js'
import * as users from './admin.users.js'

const router = Router()
const { idParams } = schemas

router.use(requireAuth, requireRole('admin'))

router.get('/permissions', requirePermission('roles.view'), async (req, res) => {
  const items = await listPermissions()
  res.json({ items, total: items.length, page: 1, pageSize: items.length })
})

/* ---------- Access management (§3.13) ---------- */

router.get('/roles', requirePermission('roles.view'), async (req, res) => {
  res.json(await access.listRoles())
})

router.post('/roles', requirePermission('roles.create'), validate({ body: schemas.roleBody }), async (req, res) => {
  res.status(201).json(await access.createRole(req.user, req.body))
})

router.post('/roles/:id/duplicate', requirePermission('roles.create'), validate({ params: idParams }), async (req, res) => {
  res.status(201).json(await access.duplicateRole(req.user, req.params.id))
})

router.patch('/roles/:id', requirePermission('roles.edit'), validate({ params: idParams, body: schemas.roleBody }), async (req, res) => {
  res.json(await access.updateRole(req.user, req.params.id, req.body))
})

router.post('/roles/:id/archive', requirePermission('roles.archive'), validate({ params: idParams }), async (req, res) => {
  res.json(await access.archiveRole(req.user, req.params.id))
})

router.get('/access/users', requirePermission('roles.view'), async (req, res) => {
  res.json(await access.listAccessUsers())
})

router.put('/access/users/:id', requirePermission('roles.assign'), validate({ params: idParams, body: schemas.accessBody }), async (req, res) => {
  res.json(await access.saveAccess(req.user, req.params.id, req.body))
})

router.delete('/access/users/:id', requirePermission('roles.assign'), validate({ params: idParams }), async (req, res) => {
  res.json(await access.revokeAccess(req.user, req.params.id))
})

router.post('/invitations', requirePermission('users.add'), validate({ body: schemas.inviteBody }), async (req, res) => {
  res.status(201).json(await access.invite(req.user, req.body))
})

/* ---------- Users (M-161) ---------- */

router.get('/users', requirePermission('users.view'), validate({ query: schemas.usersQuery }), async (req, res) => {
  res.json(await users.listUsers(req.query))
})

router.get('/users/export', requirePermission('users.view'), requirePermission('reports.export'), validate({ query: schemas.usersQuery }), async (req, res) => {
  const rows = users.exportRows(req.query.role, await users.filteredUsers(req.query), req.user.language)
  await auditedExport(req, res, { type: `${req.query.role}s_exported`, name: `${req.query.role}s`, rows })
})

router.get('/users/:id', requirePermission('users.view'), validate({ params: idParams }), async (req, res) => {
  res.json(await users.userDetail(req.user, req.params.id))
})

/* ---------- Audit logs (M-162, M-163) ---------- */

router.get('/audit-events', requirePermission('audit.view'), validate({ query: schemas.auditQuery }), async (req, res) => {
  res.json(await audit.listEvents(req.query))
})

router.get('/audit-events/export', requirePermission('audit.view'), requirePermission('reports.export'), validate({ query: schemas.auditQuery }), async (req, res) => {
  const rows = audit.exportRows(await audit.filteredEvents(req.query), req.user.language)
  await auditedExport(req, res, { type: 'audit_exported', name: 'audit-log', rows })
})

router.get('/files/:fileId', requirePermission('documents.view'), validate({ params: z.object({ fileId: objectId }) }), async (req, res) => {
  res.json(await adminFileUrl(req.user, req.params.fileId))
})

export default router
