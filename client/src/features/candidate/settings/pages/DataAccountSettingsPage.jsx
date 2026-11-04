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
import { DEFAULT_PRIVACY, PRIVACY_STORAGE_KEY } from '../data/settings.js'
import {
  clearResultFlag,
  deleteCandidateData,
  profileExportRows,
  readResultFlag,
  resetDemoData,
} from '../utils/localData.js'
import styles from './DataAccountSettingsPage.module.css'

// The confirm dialogs and the result line after a reload (the flag names the action that ran).
const CONFIRMATIONS = { data: 'delete', reset: 'reset' }
const RESULTS = { reset: 'reset', deleted: 'delete' }

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
  const [status, setStatus] = useState(() => RESULTS[readResultFlag()] && `data.${RESULTS[readResultFlag()]}.done`)

  useEffect(clearResultFlag, [])

  function handleExport() {
    downloadCsv(profileExportRows({ profile, cv, verification, privacy, notifyEmail: Object.values(me.emailSwitches).some(Boolean) }), 'candidate-profile.csv')
    setStatus('data.export.candidateDone')
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

  const dialog = confirming && `account:data.${CONFIRMATIONS[confirming]}`

  return (
    <>
      <SettingsCard title={t('account:password.title')} description={t('account:password.description')}>
        <ChangePasswordForm />
      </SettingsCard>
      <SettingsCard title={t('account:data.title')}>
        <p className={styles.notice}>{t('account:data.notice')}</p>

        <ul className={styles.actions}>
          <ActionRow label={t('account:data.export.label')} description={t('account:data.export.description')}>
            <Button variant="outline" leftIcon={<Icon as={Download} size={13} />} onClick={handleExport}>
              {t('account:data.export.action')}
            </Button>
          </ActionRow>
          <ActionRow
            tone="danger"
            label={t('account:data.delete.label')}
            description={t('account:data.delete.description')}
          >
            <Button variant="outline" className={styles.dangerButton} onClick={() => setConfirming('data')}>
              {t('account:data.delete.action')}
            </Button>
          </ActionRow>
          <ActionRow label={t('account:data.reset.label')} description={t('account:data.reset.description')}>
            <Button variant="outline" onClick={() => setConfirming('reset')}>
              {t('account:data.reset.action')}
            </Button>
          </ActionRow>
        </ul>

        <p className={styles.status} role="status">
          {status && t(`account:${status}`)}
        </p>

        <ConfirmDialog
          open={Boolean(dialog)}
          title={dialog ? t(`${dialog}.confirmTitle`) : ''}
          confirmLabel={dialog && t(`${dialog}.action`)}
          tone="danger"
          onConfirm={handleConfirm}
          onClose={() => setConfirming(null)}
        >
          <p className={styles.confirmText}>{dialog && t(`${dialog}.confirmBody`)}</p>
        </ConfirmDialog>
      </SettingsCard>
    </>
  )
}
