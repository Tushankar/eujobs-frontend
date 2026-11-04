import { useTranslation } from 'react-i18next'
import EmailSwitches from '@/features/notifications/components/EmailSwitches.jsx'
import SettingsCard from '../components/SettingsCard.jsx'
import SettingsLayout from '../components/SettingsLayout.jsx'
import styles from './NotificationsPage.module.css'

/** Settings > Notifications (P11b-Q3, Q12; supersedes OD6): one email switch per category; in-app is always on. */
export default function NotificationsPage() {
  const { t } = useTranslation()
  return (
    <SettingsLayout>
      <div className={styles.card}>
        <SettingsCard title={t('account:notifications.title')}>
          <EmailSwitches />
        </SettingsCard>
      </div>
    </SettingsLayout>
  )
}
