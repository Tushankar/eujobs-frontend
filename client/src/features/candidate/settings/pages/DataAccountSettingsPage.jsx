import { useTranslation } from 'react-i18next'
import ChangePasswordForm from '@/features/account/components/ChangePasswordForm.jsx'
import DataControls from '@/features/account/components/DataControls.jsx'
import SettingsCard from '../components/SettingsCard.jsx'

/** Settings > Data & account: change the password, export the data ZIP or delete the account and data (M-188, M-190). */
export default function DataAccountSettingsPage() {
  const { t } = useTranslation()
  return (
    <>
      <SettingsCard title={t('account:password.title')} description={t('account:password.description')}>
        <ChangePasswordForm />
      </SettingsCard>
      <SettingsCard title={t('account:data.title')}>
        <DataControls />
      </SettingsCard>
    </>
  )
}
