import { useTranslation } from 'react-i18next'
import EmailSwitches from '@/features/notifications/components/EmailSwitches.jsx'
import SettingsCard from '../components/SettingsCard.jsx'

/** Settings > Notifications (P11b-Q3, Q12; supersedes OD6): one email switch per category; in-app is always on. */
export default function NotificationSettingsPage() {
  const { t } = useTranslation()
  return (
    <SettingsCard title={t('account:notifications.title')}>
      <EmailSwitches />
    </SettingsCard>
  )
}
