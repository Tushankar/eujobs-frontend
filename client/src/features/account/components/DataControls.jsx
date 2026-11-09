import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Download, FileDown, Trash2 } from 'lucide-react'
import { Button, Icon, Modal, PasswordField } from '@/components/ui'
import { errorCode } from '@/app/api.js'
import { signOut } from '@/app/session.js'
import { downloadFromApi } from '@/lib/download.js'
import { check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useDeleteAccountMutation } from '../api.js'
import SettingRow, { SettingsSection } from './SettingRow.jsx'
import styles from './DataControls.module.css'

/**
 * Data & account for candidates and recruiters (M-188 … M-190): download the export ZIP, or delete the account with the
 * current password (candidate erasure; a recruiter's jobs are closed). After a deletion the session ends.
 */
export default function DataControls() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const navigate = useNavigate()
  const { me } = usePreferences()
  const [deleteAccount, { isLoading: deleting }] = useDeleteAccountMutation()
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [deleteError, setDeleteError] = useState('')
  const deleteKey = me.role === 'recruiter' ? 'account:data.deleteRecruiter' : 'account:data.delete'

  async function handleExport() {
    setExporting(true)
    setStatus(null)
    try {
      await downloadFromApi('/me/export')
      setStatus({ text: t('account:data.export.done') })
    } catch (error) {
      setStatus({ text: errorText.code(error), error: true })
    } finally {
      setExporting(false)
    }
  }

  function closeDialog() {
    setConfirming(false)
    setPassword('')
    setErrors({})
    setDeleteError('')
  }

  async function handleDelete(event) {
    event.preventDefault()
    const nextErrors = compact({ currentPassword: check.required(password) })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    try {
      await deleteAccount({ currentPassword: password }).unwrap()
      signOut()
      navigate(me.role === 'recruiter' ? '/recruiter/sign-in' : '/sign-in', { replace: true })
    } catch (error) {
      setErrors(serverFieldErrors(error))
      if (errorCode(error) !== 'VALIDATION_FAILED') setDeleteError(errorText.code(error))
    }
  }

  return (
    <>
      <SettingsSection
        title={t('account:data.title')}
        description={t('account:data.notice')}
        footer={
          <p className={cx(styles.status, status?.error && styles.statusError)} role="status">
            {status?.text}
          </p>
        }
      >
        <SettingRow
          id="export"
          icon={FileDown}
          label={t('account:data.export.label')}
          value={t('account:data.export.description')}
          action={
            <Button variant="outline" leftIcon={<Icon as={Download} size={13} />} onClick={handleExport} loading={exporting} className={styles.button}>
              {t('account:data.export.action')}
            </Button>
          }
        />
        <SettingRow
          id="delete"
          icon={Trash2}
          label={t(`${deleteKey}.label`)}
          value={t(`${deleteKey}.description`)}
          action={
            <Button variant="outline" className={cx(styles.button, styles.dangerButton)} onClick={() => setConfirming(true)}>
              {t(`${deleteKey}.action`)}
            </Button>
          }
        />
      </SettingsSection>

      <Modal
        open={confirming}
        onClose={closeDialog}
        title={t(`${deleteKey}.confirmTitle`)}
        width={480}
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog}>
              {t('common:cancel')}
            </Button>
            <Button variant="danger" type="submit" form="delete-account" loading={deleting}>
              {t(`${deleteKey}.action`)}
            </Button>
          </>
        }
      >
        <form id="delete-account" className={styles.confirm} onSubmit={handleDelete} noValidate>
          <p className={styles.confirmText}>{t(`${deleteKey}.confirmBody`)}</p>
          <PasswordField
            label={t('account:password.current')}
            hint={t(`${deleteKey}.password`)}
            name="currentPassword"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setErrors({})
            }}
            error={errorText.field('currentPassword', errors.currentPassword)}
          />
          {deleteError && (
            <p className={styles.statusError} role="alert">
              {deleteError}
            </p>
          )}
        </form>
      </Modal>
    </>
  )
}
