import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Trash2 } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Button, Icon, Modal, SelectField, TextField } from '@/components/ui'
import FormAlert from '@/features/auth/components/FormAlert.jsx'
import { serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useGetPermissionsQuery, useRevokeAccessMutation, useSaveAccessMutation } from '../api.js'
import { accessErrorText } from './CreateRoleModal.jsx'
import PermissionOption from './PermissionOption.jsx'
import styles from './ManageAccessModal.module.css'

const FORM_ID = 'manage-access-form'

/** Effective permissions = role ∪ granted − removed (§3.13), as the server computes them. */
function effectiveOf(role, granted, removed) {
  const ids = new Set([...(role?.permissions ?? []), ...granted])
  removed.forEach((id) => ids.delete(id))
  return ids
}

function permissionNote(t, { checked, inherited }) {
  if (checked) return inherited ? t('manage.inherited') : t('manage.granted')
  return inherited ? t('manage.removed') : t('manage.notGranted')
}

/**
 * "Manage access" for one admin (M-154, M-160): the assigned role and department, then individual grants and
 * removals. Saving and revoking ask first; the server refuses changing an Owner and removing your own
 * `roles.assign`, and the dialog shows why.
 */
export default function ManageAccessModal({ user, roles, onClose, onDone }) {
  const { t } = useTranslation(['access', 'enums'])
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { data: catalogue = [] } = useGetPermissionsQuery()
  const [saveAccess] = useSaveAccessMutation()
  const [revokeAccess] = useRevokeAccessMutation()
  const hasRole = Boolean(user.role)
  const [roleId, setRoleId] = useState(user.role?.status === 'active' ? user.role.id : '')
  const [department, setDepartment] = useState(user.department)
  const [granted, setGranted] = useState(user.granted)
  const [removed, setRemoved] = useState(user.removed)
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState(null)
  const [confirming, setConfirming] = useState(null)

  const role = roles.find((candidate) => candidate.id === roleId) ?? null
  const roleIds = new Set(role?.permissions ?? [])
  const effective = effectiveOf(role, granted, removed)

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
    const max = config?.limits.adminRole.department.max
    const nextErrors = {}
    if (!roleId) nextErrors.roleId = { key: 'required' }
    if (max && department.trim().length > max) nextErrors.department = { key: 'too_long', params: { max } }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) setConfirming('save')
  }

  async function run(action, message) {
    setConfirming(null)
    setFailure(null)
    try {
      await action().unwrap()
      onDone(message)
    } catch (error) {
      setErrors(serverFieldErrors(error))
      setFailure(error)
    }
  }

  const reason = failure?.data?.error?.params?.reason
  const failureText = reason === 'own_roles_assign' ? t('errors.ownProtected') : reason === 'owner' ? t('errors.ownerProtected') : failure && errorText.code(failure)

  return (
    <>
      <Modal
        open={confirming === null}
        divided
        className={styles.dialog}
        width={896}
        title={t(hasRole ? 'manage.manageTitle' : 'manage.assignTitle', { name: user.fullName })}
        onClose={onClose}
        footer={
          <>
            {hasRole && (
              <Button variant="outline" className={styles.revoke} leftIcon={<Icon as={Trash2} size={13} />} onClick={() => setConfirming('revoke')}>
                {t('manage.revoke')}
              </Button>
            )}
            <Button variant="outline" className={hasRole ? undefined : styles.pushRight} onClick={onClose}>
              {t('manage.cancel')}
            </Button>
            <Button type="submit" form={FORM_ID} rightIcon={<Icon as={Check} size={13} />}>
              {t('manage.save')}
            </Button>
          </>
        }
      >
        <form id={FORM_ID} className={styles.form} onSubmit={handleSubmit} noValidate>
          {failure && errorCode(failure) !== 'VALIDATION_FAILED' && <FormAlert>{failureText}</FormAlert>}
          <div className={styles.pair}>
            <SelectField
              label={t('manage.role')}
              name="roleId"
              value={roleId}
              onChange={changeRole}
              error={accessErrorText(t, 'roleId', errors.roleId)}
              placeholder={t('manage.rolePlaceholder')}
              options={roles.map((candidate) => ({ value: candidate.id, label: t('manage.roleOption', { name: candidate.name, kind: t(candidate.system ? 'role.system' : 'role.custom') }) }))}
              data-autofocus
            />
            <TextField
              label={t('manage.department')}
              name="department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              error={accessErrorText(t, 'department', errors.department)}
            />
          </div>

          <section aria-labelledby="effective-permissions">
            <SectionTitle id="effective-permissions" title={t('manage.effective')} description={t('manage.effectiveHelp')} />
            <div className={styles.tiles}>
              {catalogue.map((permission) => {
                const checked = effective.has(permission.id)
                return (
                  <PermissionOption
                    key={permission.id}
                    id={permission.id}
                    variant="tile"
                    checked={checked}
                    onChange={(next) => togglePermission(permission.id, next)}
                    label={t(`enums:permission.${permission.id}`)}
                    description={permissionNote(t, { checked, inherited: roleIds.has(permission.id) })}
                  />
                )
              })}
            </div>
          </section>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirming === 'save'}
        title={t('manage.saveTitle', { name: user.fullName })}
        description={t('manage.saveText', { role: role?.name ?? t('manage.noRole'), count: effective.size })}
        confirmLabel={t('manage.save')}
        onClose={() => setConfirming(null)}
        onConfirm={() =>
          run(
            () => saveAccess({ id: user.id, roleId, department: department.trim(), granted, removed }),
            t('users.saved', { name: user.fullName }),
          )
        }
      />
      <ConfirmDialog
        open={confirming === 'revoke'}
        title={t('manage.revokeTitle', { name: user.fullName })}
        description={t('manage.revokeText')}
        confirmLabel={t('manage.revoke')}
        tone="danger"
        onClose={() => setConfirming(null)}
        onConfirm={() => run(() => revokeAccess(user.id), t('users.revoked', { name: user.fullName }))}
      />
    </>
  )
}
