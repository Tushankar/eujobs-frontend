import UsersDirectory from '../../shared/components/UsersDirectory.jsx'
import { ADMIN_USERS } from '../../shared/data/users.js'

const CANDIDATES = ADMIN_USERS.filter((user) => user.role === 'Candidate')

export default function CandidatesPage() {
  return (
    <UsersDirectory
      title="Candidates, with a clear view."
      description="Manage accounts, review activity, and keep your marketplace trustworthy."
      users={CANDIDATES}
      filename="candidates.csv"
    />
  )
}
