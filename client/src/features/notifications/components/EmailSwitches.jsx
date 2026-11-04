import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { Icon } from '@/components/ui'
import { useSetNotificationsMutation } from '@/features/account/api.js'
import ToggleRow from '@/features/candidate/settings/components/ToggleRow.jsx'
import { usePreferences } from '@/lib/preferences.js'
import styles from './EmailSwitches.module.css'

/**
 * Settings → Notifications for every role (P11b-Q3, Q12): one email switch per category of the account's role, saved
 * at once; in-app notifications always show; the always-sent emails are named under the list.
 */
export default function EmailSwitches() {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const [save] = useSetNotificationsMutation()
  return (
    <div data-email-switches>
      <p className={styles.description}>{t('notifications:settings.description')}</p>
      <ul className={styles.list}>
        {Object.entries(me.emailSwitches).map(([category, on]) => (
          <ToggleRow
            key={category}
            label={t(`enums:emailCategory.${category}`)}
            description={t(`notifications:settings.categories.${category}`)}
            checked={on}
            onChange={(checked) => save({ emailSwitches: { [category]: checked } })}
          />
        ))}
      </ul>
      <p className={styles.note}>
        <Icon as={Info} size={14} />
        {t(`notifications:settings.alwaysOn.${me.role}`)}
      </p>
    </div>
  )
}
