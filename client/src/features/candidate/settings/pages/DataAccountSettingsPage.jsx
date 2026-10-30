import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { cx } from '@/utils/cx.js'
import { downloadCsv } from '@/utils/downloadCsv.js'
import { CV_STORAGE_KEY, INITIAL_CV } from '../../cv/data/cvVersions.js'
import { INITIAL_PROFILE, PROFILE_STORAGE_KEY } from '../../profile/data/profile.js'
import { INITIAL_VERIFICATION, VERIFICATION_STORAGE_KEY } from '../../verification/data/verification.js'
import ChangePasswordForm from '@/features/account/components/ChangePasswordForm.jsx'
import { usePreferences } from '@/lib/preferences.js'
import SettingsCard from '../components/SettingsCard.jsx'
import { DATA_NOTICE, DEFAULT_PRIVACY, PRIVACY_STORAGE_KEY } from '../data/settings.js'
import {
  clearResultFlag,
  deleteCandidateData,
  profileExportRows,
  readResultFlag,
  resetDemoData,
  RESULT_MESSAGES,
} from '../utils/localData.js'
import styles from './DataAccountSettingsPage.module.css'

const CONFIRMATIONS = {
  data: {
    title: 'Delete local candidate information?',
    body: 'This removes your profile, CV versions, verification progress, learning progress, saved jobs, applications, and alerts from this device, and your plan goes back to Free. Your settings are kept. Payment records are kept as finance records; only Reset demo clears them. This can’t be undone.',
    confirmLabel: 'Delete my data',
  },
  reset: {
    title: 'Reset demo workspace?',
    body: 'This restores the sample data in the candidate, recruiter, and admin workspaces and clears the changes saved on this device. This can’t be undone.',
    confirmLabel: 'Reset demo',
  },
}

function ActionRow({ label, description, tone, children }) {
  return (
    <li className={cx(styles.action, tone === 'danger' && styles.actionDanger)}>
      <div className={styles.actionText}>
        <p className={styles.actionLabel}>{label}</p>
        <p className={styles.actionDescription}>{description}</p>
      </div>
      {children}
    </li>
  )
}

/** Settings > Data & account: export the saved profile as CSV, delete what is stored here, or reset the demo. */
export default function DataAccountSettingsPage() {
  const [profile] = useLocalStorage(PROFILE_STORAGE_KEY, INITIAL_PROFILE)
  const [cv] = useLocalStorage(CV_STORAGE_KEY, INITIAL_CV)
  const [verification] = useLocalStorage(VERIFICATION_STORAGE_KEY, INITIAL_VERIFICATION)
  const [privacy] = useLocalStorage(PRIVACY_STORAGE_KEY, DEFAULT_PRIVACY)
  const { t } = useTranslation()
  const { me } = usePreferences()
  const [confirming, setConfirming] = useState(null)
  const [status, setStatus] = useState(() => RESULT_MESSAGES[readResultFlag()] ?? '')

  useEffect(clearResultFlag, [])

  function handleExport() {
    downloadCsv(profileExportRows({ profile, cv, verification, privacy, notifyEmail: me.notifyEmail }), 'candidate-profile.csv')
    setStatus('Profile exported as candidate-profile.csv. The file was created in your browser and not sent anywhere.')
  }

  function handleConfirm() {
    const action = confirming
    setConfirming(null)
    if (action === 'data') {
      deleteCandidateData()
    } else if (action === 'reset') {
      resetDemoData()
    }
  }

  const dialog = confirming ? CONFIRMATIONS[confirming] : null

  return (
    <>
      <SettingsCard title={t('account:password.title')} description={t('account:password.description')}>
        <ChangePasswordForm />
      </SettingsCard>
      <SettingsCard title="Understand and control your data">
        <p className={styles.notice}>{DATA_NOTICE}</p>

        <ul className={styles.actions}>
          <ActionRow label="Download your profile" description="A portable CSV of your reviewed information.">
            <Button variant="outline" leftIcon={<Icon as={Download} size={13} />} onClick={handleExport}>
              Export data
            </Button>
          </ActionRow>
          <ActionRow
            tone="danger"
            label="Delete local candidate information"
            description="Remove your profile, saved jobs, applications, and alerts. Payment records are kept."
          >
            <Button variant="outline" className={styles.dangerButton} onClick={() => setConfirming('data')}>
              Delete my data
            </Button>
          </ActionRow>
          <ActionRow label="Reset demo workspace" description="Restore sample data across all three workspaces.">
            <Button variant="outline" onClick={() => setConfirming('reset')}>
              Reset demo
            </Button>
          </ActionRow>
        </ul>

        <p className={styles.status} role="status">
          {status}
        </p>

        <ConfirmDialog
          open={Boolean(dialog)}
          title={dialog?.title ?? ''}
          confirmLabel={dialog?.confirmLabel}
          tone="danger"
          onConfirm={handleConfirm}
          onClose={() => setConfirming(null)}
        >
          <p className={styles.confirmText}>{dialog?.body}</p>
        </ConfirmDialog>
      </SettingsCard>
    </>
  )
}
