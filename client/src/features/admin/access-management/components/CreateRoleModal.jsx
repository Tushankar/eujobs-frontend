import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Button, Modal, SelectField, TextField, TextareaField } from '@/components/ui'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import FormAlert from '@/features/auth/components/FormAlert.jsx'
import { compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { checkLength } from '@/features/admin/ai-matching/components/policyErrors.js'
import { useCreateRoleMutation, useGetPermissionsQuery, useUpdateRoleMutation } from '../api.js'
import PermissionOption from './PermissionOption.jsx'
import styles from './CreateRoleModal.module.css'

const FORM_ID = 'create-role-form'
const SCOPES = ['organization', 'department', 'finance_department', 'team']
const GROUPS = ['people', 'roles', 'recruitment', 'finance', 'governance']

/** The page's own texts first, then the shared validation texts. */
export const accessErrorText = (t, field, error) => error && t([`access:errors.${field}.${error.key}`, `validation:${error.key}`], error.params)

/**
 * "Create custom role" and, prefilled, "Edit role" (M-158): name, scope, description and the permission matrix
 * from the server catalogue (M-156). Name rules come from /meta/config; the server also refuses a taken name.
 */
export default function CreateRoleModal({ role, onClose, onSaved }) {
  const { t } = useTranslation(['access', 'enums'])
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { data: catalogue = [] } = useGetPermissionsQuery()
  const [createRole, creating] = useCreateRoleMutation()
  const [updateRole, updating] = useUpdateRoleMutation()
  const [values, setValues] = useState({ name: role?.name ?? '', scope: role?.scope ?? SCOPES[0], description: role?.description ?? '' })
  const [permissions, setPermissions] = useState(role?.permissions ?? [])
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState(null)

  const setField = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }))
  const togglePermission = (id, checked) => setPermissions((current) => (checked ? [...current, id] : current.filter((existing) => existing !== id)))

  async function handleSubmit(event) {
    event.preventDefault()
    const limits = config?.limits.adminRole
    const nextErrors = compact({
      name: limits && checkLength(values.name, limits.name),
      description: limits && values.description.trim().length > limits.description.max ? { key: 'too_long', params: { max: limits.description.max } } : undefined,
    })
    setErrors(nextErrors)
    setFailure(null)
    if (Object.keys(nextErrors).length > 0) return
    const body = { ...values, name: values.name.trim(), description: values.description.trim(), permissions }
    try {
      const saved = role ? await updateRole({ id: role.id, ...body }).unwrap() : await createRole(body).unwrap()
      onSaved(saved)
    } catch (error) {
      setErrors(serverFieldErrors(error))
      setFailure(error)
    }
  }

  const ownProtected = failure?.data?.error?.params?.reason === 'own_roles_assign'

  return (
    <Modal
      open
      divided
      className={styles.dialog}
      width={896}
      title={role ? t('roleDialog.editTitle', { name: role.name }) : t('roleDialog.createTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('roleDialog.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} className={styles.save} disabled={permissions.length === 0} loading={creating.isLoading || updating.isLoading}>
            {role ? t('roleDialog.save') : t('roleDialog.create')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className={styles.form} onSubmit={handleSubmit} noValidate>
        {failure && errorCode(failure) !== 'VALIDATION_FAILED' && <FormAlert>{ownProtected ? t('errors.ownProtected') : errorText.code(failure)}</FormAlert>}
        <div className={styles.pair}>
          <TextField
            label={t('roleDialog.name')}
            name="name"
            value={values.name}
            onChange={setField('name')}
            error={accessErrorText(t, 'name', errors.name)}
            maxLength={config?.limits.adminRole.name.max}
            data-autofocus
          />
          <SelectField
            label={t('roleDialog.scope')}
            name="scope"
            value={values.scope}
            onChange={setField('scope')}
            options={SCOPES.map((scope) => ({ value: scope, label: t(`enums:roleScope.${scope}`) }))}
          />
        </div>
        <TextareaField
          label={t('roleDialog.description')}
          name="description"
          value={values.description}
          onChange={setField('description')}
          error={accessErrorText(t, 'description', errors.description)}
          rows={2}
          style={{ minHeight: 60 }}
        />

        <section aria-labelledby="role-permissions">
          <SectionTitle id="role-permissions" title={t('roleDialog.permissions')} description={t('roleDialog.selected', { count: permissions.length })} />
          <div className={styles.matrix}>
            {GROUPS.map((group) => (
              <div key={group} role="group" aria-labelledby={`group-${group}`} className={styles.group}>
                <p className={styles.legend} id={`group-${group}`}>
                  {t(`enums:permissionGroup.${group}`)}
                </p>
                <div className={styles.options}>
                  {catalogue
                    .filter((permission) => permission.group === group)
                    .map((permission) => (
                      <PermissionOption
                        key={permission.id}
                        id={permission.id}
                        checked={permissions.includes(permission.id)}
                        onChange={(checked) => togglePermission(permission.id, checked)}
                        label={t(`enums:permission.${permission.id}`)}
                        description={t(`permissionHelp.${permission.id}`)}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </form>
    </Modal>
  )
}
