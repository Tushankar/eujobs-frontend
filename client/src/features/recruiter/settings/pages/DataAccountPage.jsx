import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { Button, Icon, Modal } from '@/components/ui'
import ChangePasswordForm from '@/features/account/components/ChangePasswordForm.jsx'
import { usePreferences, useFormat } from '@/lib/preferences.js'
import SettingsCard from '../components/SettingsCard.jsx'
import SettingsLayout from '../components/SettingsLayout.jsx'
import { RESET_FLAG_KEY, STORAGE_PREFIX } from '../data/account.js'
import styles from './DataAccountPage.module.css'

function csvCell(value) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(rows, filename) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Removes everything this demo stored on the device, then reloads so every screen starts from the sample data. */
function resetDemoData() {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => window.localStorage.removeItem(key))
    window.sessionStorage.setItem(RESET_FLAG_KEY, '1')
  } catch {
    // storage unavailable: nothing was saved, so there is nothing to reset
  }
  window.location.reload()
}

function readResetFlag() {
  try {
    return window.sessionStorage.getItem(RESET_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

function clearResetFlag() {
  try {
    window.sessionStorage.removeItem(RESET_FLAG_KEY)
  } catch {
    // storage unavailable: nothing to clear
  }
}

/** Settings > Data & account: export the reviewed profile as CSV, or reset the demo data stored on this device. */
export default function DataAccountPage() {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const format = useFormat()
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [status, setStatus] = useState(() => (readResetFlag() ? 'data.reset.done' : ''))

  useEffect(clearResetFlag, [])

  function handleExport() {
    downloadCsv(
      [
        ['Field', 'Value'],
        ['Name', me.fullName],
        ['Email', me.email],
        ['Market location', me.pickerCountry ? format.country(me.pickerCountry) : ''],
        ['Email alerts', me.notifyEmail ? 'On' : 'Off'],
      ],
      'recruiter-profile.csv',
    )
    setStatus('data.export.recruiterDone')
  }

  return (
    <SettingsLayout>
      <SettingsCard title={t('account:password.title')}>
        <p className={styles.description}>{t('account:password.description')}</p>
        <ChangePasswordForm />
      </SettingsCard>
      <SettingsCard title={t('account:data.title')}>
        <p className={styles.notice}>{t('account:data.notice')}</p>

        <div className={styles.actions}>
          <div className={styles.action}>
            <div>
              <p className={styles.label}>{t('account:data.export.label')}</p>
              <p className={styles.description}>{t('account:data.export.description')}</p>
            </div>
            <Button variant="outline" leftIcon={<Icon as={Download} size={13} strokeWidth={2} />} onClick={handleExport}>
              {t('account:data.export.action')}
            </Button>
          </div>
          <div className={styles.action}>
            <div>
              <p className={styles.label}>{t('account:data.reset.label')}</p>
              <p className={styles.description}>{t('account:data.reset.description')}</p>
            </div>
            <Button variant="outline" onClick={() => setConfirmingReset(true)}>
              {t('account:data.reset.action')}
            </Button>
          </div>
        </div>

        <p className={styles.status} role="status">
          {status && t(`account:${status}`)}
        </p>
      </SettingsCard>

      <Modal
        open={confirmingReset}
        onClose={() => setConfirmingReset(false)}
        title={t('account:data.reset.confirmTitle')}
        width={440}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmingReset(false)}>
              {t('common:cancel')}
            </Button>
            <Button variant="danger" onClick={resetDemoData}>
              {t('account:data.reset.action')}
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>{t('account:data.reset.confirmBody')}</p>
      </Modal>
    </SettingsLayout>
  )
}
