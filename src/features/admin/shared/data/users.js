/*
 * Demo marketplace accounts listed by Admin > Candidates and Admin > Recruiters (and counted on the Overview).
 * Copy mirrors the Figma rows. `verification.badge` is set when the account has a verification state to show
 * as a pill rather than the plain "Not connected" text; `learning` is empty for accounts without learning data.
 */
export const USER_STATUSES = {
  active: { label: 'Active', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
}

export const ADMIN_USERS = [
  {
    id: 'alex-morgan',
    name: 'Alex Morgan',
    email: 'alex@example.com',
    role: 'Candidate',
    joined: '2026-09-24',
    verification: { label: 'Not started', badge: true },
    learning: '0 enrolled · 0 badges',
    status: 'active',
  },
  {
    id: 'emma-wilson',
    name: 'Emma Wilson',
    email: 'emma@example.com',
    role: 'Candidate',
    joined: '2026-09-20',
    verification: { label: 'Not connected' },
    learning: '',
    status: 'active',
  },
  {
    id: 'james-chen',
    name: 'James Chen',
    email: 'james@example.com',
    role: 'Candidate',
    joined: '2026-09-20',
    verification: { label: 'Not connected' },
    learning: '',
    status: 'pending',
  },
  {
    id: 'sarah-miller',
    name: 'Sarah Miller',
    email: 'sarah@acme.example',
    role: 'Recruiter',
    joined: '2026-09-22',
    verification: { label: 'Not connected' },
    learning: '',
    status: 'active',
  },
]

/** "Sep 24, 2026" from an ISO date (read at noon so the local timezone never shifts the day). */
export function formatJoined(isoDate) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
