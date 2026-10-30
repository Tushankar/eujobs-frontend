/*
 * Demo accounts for seed:demo (§3.20, OD9). `tag` makes the plus-alias of SEED_ADMIN_EMAIL; the Owner
 * uses the address itself. Cities follow owner answer P1-Q3. Later phases complete these accounts.
 */
export const DEMO_ACCOUNTS = [
  { tag: null, role: 'admin', status: 'active', isOwner: true, fullName: 'Workspace admin' },
  { tag: 'alex', role: 'candidate', status: 'active', fullName: 'Alex Morgan', country: 'GB', timezone: 'Europe/London' },
  { tag: 'emma', role: 'candidate', status: 'active', fullName: 'Emma Wilson', country: 'GB', timezone: 'Europe/London' },
  { tag: 'sarah', role: 'recruiter', status: 'onboarding', fullName: 'Sarah Miller', country: 'GB', timezone: 'Europe/London' },
  { tag: 'james', role: 'recruiter', status: 'onboarding', fullName: 'James Chen', country: 'IE', timezone: 'Europe/Dublin' },
]
