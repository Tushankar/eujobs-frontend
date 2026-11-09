import AccountSecurity from '@/features/account/components/AccountSecurity.jsx'
import DataControls from '@/features/account/components/DataControls.jsx'

/** Settings > Data & account: change the password, export the data ZIP or delete the account and data (M-188, M-190). */
export default function DataAccountSettingsPage() {
  return (
    <>
      <AccountSecurity />
      <DataControls />
    </>
  )
}
