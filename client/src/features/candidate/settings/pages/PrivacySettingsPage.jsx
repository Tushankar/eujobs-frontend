import { ShieldCheck } from 'lucide-react'
import { Icon } from '@/components/ui'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import SettingsCard from '../components/SettingsCard.jsx'
import ToggleRow from '../components/ToggleRow.jsx'
import { DEFAULT_PRIVACY, PRIVACY_OPTIONS, PRIVACY_STORAGE_KEY } from '../data/settings.js'
import styles from './SettingsPage.module.css'

/** Settings > Privacy & visibility: each switch applies immediately and is kept on this device. */
export default function PrivacySettingsPage() {
  const [privacy, setPrivacy] = useLocalStorage(PRIVACY_STORAGE_KEY, DEFAULT_PRIVACY)

  return (
    <SettingsCard
      title="Choose how you’re discovered"
      description="Your resume isn’t shared just because your profile is visible."
    >
      <ul className={styles.list}>
        {PRIVACY_OPTIONS.map((option) => (
          <ToggleRow
            key={option.id}
            label={option.label}
            description={option.description}
            checked={privacy[option.id] ?? DEFAULT_PRIVACY[option.id]}
            onChange={(checked) => setPrivacy((current) => ({ ...current, [option.id]: checked }))}
          />
        ))}
      </ul>
      <p className={styles.note}>
        <Icon as={ShieldCheck} size={15} />
        These are local prototype preferences. No personal information is transmitted to a recruitment service.
      </p>
    </SettingsCard>
  )
}
