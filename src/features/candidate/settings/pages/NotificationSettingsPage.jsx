import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import SettingsCard from '../components/SettingsCard.jsx'
import ToggleRow from '../components/ToggleRow.jsx'
import { DEFAULT_NOTIFICATIONS, NOTIFICATION_OPTIONS, NOTIFICATIONS_STORAGE_KEY } from '../data/settings.js'
import styles from './SettingsPage.module.css'

/** Settings > Notifications: each switch applies immediately and is kept on this device. */
export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useLocalStorage(NOTIFICATIONS_STORAGE_KEY, DEFAULT_NOTIFICATIONS)

  return (
    <SettingsCard title="Useful updates. Less noise.">
      <ul className={styles.list}>
        {NOTIFICATION_OPTIONS.map((option) => (
          <ToggleRow
            key={option.id}
            label={option.label}
            description={option.description}
            checked={preferences[option.id] ?? DEFAULT_NOTIFICATIONS[option.id]}
            onChange={(checked) => setPreferences((current) => ({ ...current, [option.id]: checked }))}
          />
        ))}
      </ul>
    </SettingsCard>
  )
}
