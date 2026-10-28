import UsersDirectory from '../../shared/components/UsersDirectory.jsx'
import { ADMIN_USERS } from '../../shared/data/users.js'

const RECRUITERS = ADMIN_USERS.filter((user) => user.role === 'Recruiter')

export default function RecruitersPage() {
  return (
    <UsersDirectory
      title="Recruiters, with a clear view."
      description="Manage accounts, review activity, and keep your marketplace trustworthy."
      users={RECRUITERS}
      filename="recruiters.csv"
    />
  )
}
