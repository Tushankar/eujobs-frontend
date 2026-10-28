import { Switch } from '@/components/ui'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import SettingsCard from '../components/SettingsCard.jsx'
import SettingsLayout from '../components/SettingsLayout.jsx'
import { DEFAULT_NOTIFICATIONS, NOTIFICATIONS_STORAGE_KEY, NOTIFICATION_OPTIONS } from '../data/notifications.js'
import styles from './NotificationsPage.module.css'

/** Settings > Notifications: each switch applies immediately and is kept on this device. */
export default function NotificationsPage() {
  const [preferences, setPreferences] = useLocalStorage(NOTIFICATIONS_STORAGE_KEY, DEFAULT_NOTIFICATIONS)

  return (
    <SettingsLayout>
      <SettingsCard title="Useful updates. Less noise.">
        <ul className={styles.list}>
          {NOTIFICATION_OPTIONS.map((option) => (
            <li key={option.id} className={styles.row}>
              <div className={styles.text}>
                <p className={styles.label}>{option.label}</p>
                <p className={styles.description}>{option.description}</p>
              </div>
              <Switch
                size="lg"
                label={option.label}
                checked={preferences[option.id] ?? DEFAULT_NOTIFICATIONS[option.id]}
                onChange={(checked) => setPreferences((current) => ({ ...current, [option.id]: checked }))}
              />
            </li>
          ))}
        </ul>
      </SettingsCard>
    </SettingsLayout>
  )
}
