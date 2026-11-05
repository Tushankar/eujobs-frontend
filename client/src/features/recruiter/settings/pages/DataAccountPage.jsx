import { useTranslation } from 'react-i18next'
import ChangePasswordForm from '@/features/account/components/ChangePasswordForm.jsx'
import DataControls from '@/features/account/components/DataControls.jsx'
import SettingsCard from '../components/SettingsCard.jsx'
import SettingsLayout from '../components/SettingsLayout.jsx'
import styles from './DataAccountPage.module.css'

/** Settings > Data & account: change the password, export the data ZIP or delete the account (M-189, M-190). */
export default function DataAccountPage() {
  const { t } = useTranslation()
  return (
    <SettingsLayout>
      <SettingsCard title={t('account:password.title')}>
        <p className={styles.description}>{t('account:password.description')}</p>
        <ChangePasswordForm />
      </SettingsCard>
      <SettingsCard title={t('account:data.title')}>
        <DataControls />
      </SettingsCard>
    </SettingsLayout>
  )
}
