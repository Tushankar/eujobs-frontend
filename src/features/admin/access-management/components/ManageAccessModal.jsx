import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Button, Icon, Modal, SelectField, TextField } from '@/components/ui'
import { PERMISSIONS } from '../data/accessData.js'
import { effectivePermissionIds } from '../hooks/useAccess.js'
import PermissionOption from './PermissionOption.jsx'
import styles from './ManageAccessModal.module.css'

const FORM_ID = 'manage-access-form'

function roleLabel(role) {
  return `${role.name} · ${role.system ? 'System' : 'Custom'}`
}

function permissionNote({ checked, inherited }) {
  if (checked) return inherited ? 'Inherited from role' : 'Granted individually'
  return inherited ? 'Removed for this user' : 'Not granted'
}

/**
 * "Manage access" dialog for one user: pick the assigned role and scope, then adjust individual permissions.
 * Saving and revoking both ask for confirmation first; the caller persists the result.
 */
export default function ManageAccessModal({ user, roles, onClose, onSave, onRevoke }) {
  const hasRole = Boolean(user.role)
  const [roleId, setRoleId] = useState(user.access.roleId ?? '')
  const [department, setDepartment] = useState(user.access.department ?? '')
  const [granted, setGranted] = useState(user.access.granted)
  const [removed, setRemoved] = useState(user.access.removed)
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(null)

  const role = roles.find((candidate) => candidate.id === roleId) ?? null
  const roleIds = new Set(role?.permissions ?? [])
  const effective = effectivePermissionIds(role, { granted, removed })

  function changeRole(event) {
    const next = roles.find((candidate) => candidate.id === event.target.value)
    const nextIds = new Set(next?.permissions ?? [])
    setRoleId(event.target.value)
    setGranted((current) => current.filter((id) => !nextIds.has(id)))
    setRemoved((current) => current.filter((id) => nextIds.has(id)))
    setErrors({})
  }

  function togglePermission(id, checked) {
    const add = (list) => (list.includes(id) ? list : [...list, id])
    const drop = (list) => list.filter((existing) => existing !== id)
    if (roleIds.has(id)) setRemoved((current) => (checked ? drop(current) : add(current)))
    else setGranted((current) => (checked ? add(current) : drop(current)))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!roleId) nextErrors.role = 'Choose a role to assign.'
    if (department.length > 60) nextErrors.department = 'Keep the department or scope under 60 characters.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) setConfirming('save')
  }

  const closeConfirm = () => setConfirming(null)

  return (
    <>
      <Modal
        open={confirming === null}
        divided
        className={styles.dialog}
        width={896}
        title={`${hasRole ? 'Manage access' : 'Assign role'} · ${user.name}`}
        onClose={onClose}
        footer={
          <>
            {hasRole && (
              <Button variant="outline" className={styles.revoke} leftIcon={<Icon as={Trash2} size={13} />} onClick={() => setConfirming('revoke')}>
                Revoke access
              </Button>
            )}
            <Button variant="outline" className={hasRole ? undefined : styles.pushRight} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} rightIcon={<Icon as={Check} size={13} />}>
              Save assignment
            </Button>
          </>
        }
      >
        <form id={FORM_ID} className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.pair}>
            <SelectField
              label="Assigned role"
              value={roleId}
              onChange={changeRole}
              error={errors.role}
              placeholder="Select a role"
              options={roles.map((candidate) => ({ value: candidate.id, label: roleLabel(candidate) }))}
              data-autofocus
            />
            <TextField
              label="Department or scope"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              error={errors.department}
            />
          </div>

          <section aria-labelledby="effective-permissions">
            <SectionTitle
              id="effective-permissions"
              title="Effective permissions"
              description="Role permissions are automatic. Adjust individual access only when responsibility genuinely differs."
            />
            <div className={styles.tiles}>
              {PERMISSIONS.map((permission) => {
                const checked = effective.has(permission.id)
                return (
                  <PermissionOption
                    key={permission.id}
                    variant="tile"
                    checked={checked}
                    onChange={(next) => togglePermission(permission.id, next)}
                    label={permission.label}
                    description={permissionNote({ checked, inherited: roleIds.has(permission.id) })}
                  />
                )
              })}
            </div>
          </section>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirming === 'save'}
        title={`Save access for ${user.name}?`}
        description={`${role?.name ?? 'No role'} with ${effective.size} effective ${effective.size === 1 ? 'permission' : 'permissions'}${department.trim() ? ` in ${department.trim()}` : ''}. This is saved on this device only.`}
        confirmLabel="Save assignment"
        onClose={closeConfirm}
        onConfirm={() => onSave({ roleId, department: department.trim(), granted, removed })}
      />
      <ConfirmDialog
        open={confirming === 'revoke'}
        title={`Revoke access for ${user.name}?`}
        description="This removes the assigned role, the department scope and any individual permissions."
        confirmLabel="Revoke access"
        tone="danger"
        onClose={closeConfirm}
        onConfirm={onRevoke}
      />
    </>
  )
}
