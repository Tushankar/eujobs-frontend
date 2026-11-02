/*
 * Demo accounts for seed:demo (§3.20, OD9). `tag` makes the plus-alias of SEED_ADMIN_EMAIL; the Owner
 * uses the address itself. Cities follow owner answer P1-Q3. Sarah is approved and James waits for review
 * (OQ-4.1); later phases complete the rest.
 */
export const DEMO_ACCOUNTS = [
  { tag: null, role: 'admin', status: 'active', isOwner: true, fullName: 'Workspace admin' },
  { tag: 'alex', role: 'candidate', status: 'active', fullName: 'Alex Morgan', country: 'GB', timezone: 'Europe/London' },
  { tag: 'emma', role: 'candidate', status: 'active', fullName: 'Emma Wilson', country: 'GB', timezone: 'Europe/London' },
  { tag: 'sarah', role: 'recruiter', status: 'active', fullName: 'Sarah Miller', jobTitle: 'Head of Talent', country: 'GB', timezone: 'Europe/London' },
  { tag: 'james', role: 'recruiter', status: 'pending_review', fullName: 'James Chen', jobTitle: 'Founder', country: 'IE', timezone: 'Europe/Dublin' },
]
