import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { Button, Icon, Modal } from '@/components/ui'
import ChangePasswordForm from '@/features/account/components/ChangePasswordForm.jsx'
import { usePreferences, useFormat } from '@/lib/preferences.js'
import SettingsCard from '../components/SettingsCard.jsx'
import SettingsLayout from '../components/SettingsLayout.jsx'
import { DATA_NOTICE, RESET_FLAG_KEY, STORAGE_PREFIX } from '../data/account.js'
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
  const [status, setStatus] = useState(() => (readResetFlag() ? 'Demo workspace reset. Sample data is back in all three workspaces.' : ''))

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
    setStatus('Profile exported as recruiter-profile.csv.')
  }

  return (
    <SettingsLayout>
      <SettingsCard title={t('account:password.title')}>
        <p className={styles.description}>{t('account:password.description')}</p>
        <ChangePasswordForm />
      </SettingsCard>
      <SettingsCard title="Understand and control your data">
        <p className={styles.notice}>{DATA_NOTICE}</p>

        <div className={styles.actions}>
          <div className={styles.action}>
            <div>
              <p className={styles.label}>Download your profile</p>
              <p className={styles.description}>A portable CSV of your reviewed information.</p>
            </div>
            <Button variant="outline" leftIcon={<Icon as={Download} size={13} strokeWidth={2} />} onClick={handleExport}>
              Export data
            </Button>
          </div>
          <div className={styles.action}>
            <div>
              <p className={styles.label}>Reset demo workspace</p>
              <p className={styles.description}>Restore sample data across all three workspaces.</p>
            </div>
            <Button variant="outline" onClick={() => setConfirmingReset(true)}>
              Reset demo
            </Button>
          </div>
        </div>

        <p className={styles.status} role="status">
          {status}
        </p>
      </SettingsCard>

      <Modal
        open={confirmingReset}
        onClose={() => setConfirmingReset(false)}
        title="Reset demo workspace?"
        width={440}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmingReset(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={resetDemoData}>
              Reset demo
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          This restores the sample data in the candidate, recruiter, and admin workspaces and clears the changes saved on
          this device. It can&apos;t be undone.
        </p>
      </Modal>
    </SettingsLayout>
  )
}
