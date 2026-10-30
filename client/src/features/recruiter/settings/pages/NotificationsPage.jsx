import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui'
import { useSetNotificationsMutation } from '@/features/account/api.js'
import { usePreferences } from '@/lib/preferences.js'
import SettingsCard from '../components/SettingsCard.jsx'
import SettingsLayout from '../components/SettingsLayout.jsx'
import styles from './NotificationsPage.module.css'

/** Settings > Notifications: only the email toggle (OD6, M-095); account and security emails are always sent. */
export default function NotificationsPage() {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const [setNotifications] = useSetNotificationsMutation()

  return (
    <SettingsLayout>
      <div className={styles.card}>
        <SettingsCard title={t('account:notifications.title')}>
          <ul className={styles.list}>
            <li className={styles.row}>
              <div className={styles.text}>
                <p className={styles.label}>{t('account:notifications.email')}</p>
                <p className={styles.description}>{t('account:notifications.recruiter')}</p>
              </div>
              <Switch
                size="lg"
                label={t('account:notifications.email')}
                checked={me.notifyEmail}
                onChange={(checked) => setNotifications({ notifyEmail: checked })}
              />
            </li>
          </ul>
        </SettingsCard>
      </div>
    </SettingsLayout>
  )
}
