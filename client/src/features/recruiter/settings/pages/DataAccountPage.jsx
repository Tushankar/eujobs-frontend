import AccountSecurity from '@/features/account/components/AccountSecurity.jsx'
import DataControls from '@/features/account/components/DataControls.jsx'
import SettingsLayout from '../components/SettingsLayout.jsx'

/** Settings > Data & account: change the password, export the data ZIP or delete the account (M-189, M-190). */
export default function DataAccountPage() {
  return (
    <SettingsLayout>
      <AccountSecurity />
      <DataControls />
    </SettingsLayout>
  )
}
