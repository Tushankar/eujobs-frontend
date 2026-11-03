import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorCode } from '@/app/api.js'
import { Button, Modal, SelectField, TextField } from '@/components/ui'
import FormAlert from '@/features/auth/components/FormAlert.jsx'
import { check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useInviteAdminMutation } from '../api.js'
import { accessErrorText } from './CreateRoleModal.jsx'
import styles from './InviteDialog.module.css'

const FORM_ID = 'invite-admin-form'

/** M-159, U21: invite an admin by email with the role chosen now; the link sets a password (72 h, single use). */
export default function InviteDialog({ roles, onClose, onInvited }) {
  const { t } = useTranslation('access')
  const errorText = useErrorText()
  const [invite, { isLoading }] = useInviteAdminMutation()
  const [values, setValues] = useState({ fullName: '', email: '', roleId: '', department: '' })
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState(null)
  const setField = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = compact({ fullName: check.required(values.fullName), email: check.email(values.email), roleId: check.required(values.roleId) })
    setErrors(nextErrors)
    setFailure(null)
    if (Object.keys(nextErrors).length > 0) return
    try {
      const invited = await invite({ ...values, fullName: values.fullName.trim(), email: values.email.trim(), department: values.department.trim() }).unwrap()
      onInvited(invited)
    } catch (error) {
      setErrors(serverFieldErrors(error))
      setFailure(error)
    }
  }

  return (
    <Modal
      open
      title={t('inviteDialog.title')}
      description={t('inviteDialog.description')}
      width={520}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('inviteDialog.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={isLoading}>
            {t('inviteDialog.submit')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className={styles.form}>
        {failure && errorCode(failure) !== 'VALIDATION_FAILED' && (
          <FormAlert>{errorCode(failure) === 'EMAIL_TAKEN' ? t('errors.emailTaken') : errorText.code(failure)}</FormAlert>
        )}
        <TextField label={t('inviteDialog.fullName')} name="fullName" value={values.fullName} onChange={setField('fullName')} error={accessErrorText(t, 'fullName', errors.fullName)} data-autofocus />
        <TextField label={t('inviteDialog.email')} name="email" type="email" value={values.email} onChange={setField('email')} error={accessErrorText(t, 'email', errors.email)} />
        <SelectField
          label={t('inviteDialog.role')}
          name="roleId"
          value={values.roleId}
          onChange={setField('roleId')}
          placeholder={t('inviteDialog.rolePlaceholder')}
          options={roles.map((role) => ({ value: role.id, label: role.name }))}
          error={accessErrorText(t, 'roleId', errors.roleId)}
        />
        <TextField label={t('inviteDialog.department')} name="department" value={values.department} onChange={setField('department')} error={accessErrorText(t, 'department', errors.department)} />
      </form>
    </Modal>
  )
}
