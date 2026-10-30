import { useTranslation } from 'react-i18next'
import { useSetNotificationsMutation } from '@/features/account/api.js'
import { usePreferences } from '@/lib/preferences.js'
import SettingsCard from '../components/SettingsCard.jsx'
import ToggleRow from '../components/ToggleRow.jsx'
import styles from './SettingsPage.module.css'

/** Settings > Notifications: only the email toggle (OD6, M-095); account and security emails are always sent. */
export default function NotificationSettingsPage() {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const [setNotifications] = useSetNotificationsMutation()

  return (
    <SettingsCard title={t('account:notifications.title')}>
      <ul className={styles.list}>
        <ToggleRow
          label={t('account:notifications.email')}
          description={t('account:notifications.candidate')}
          checked={me.notifyEmail}
          onChange={(checked) => setNotifications({ notifyEmail: checked })}
        />
      </ul>
    </SettingsCard>
  )
}
