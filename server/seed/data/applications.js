/*
 * Applications for seed:demo (§3.20, Phase 6 task 6): the six placements of the recruiter pipeline mock, as
 * applications to Acme Studio's three jobs. Each applicant passed the gate (complete profile, one historical Plus
 * month dated 40 days before the seed run, OQ-4.2), so every application is younger than that. `path` lists the stage
 * categories the recruiter moved the application through after it arrived, one step a day. Alex has none (P6-Q1):
 * a Free, incomplete candidate cannot have applied.
 */
export const PLACEMENTS = [
  { person: 'Emma Wilson', job: 'Senior Product Designer', daysAgo: 12, path: ['screening'] },
  { person: 'James Chen', job: 'Product Designer, Growth', daysAgo: 10, path: ['screening', 'shortlisted'] },
  { person: 'Sofia Martinez', job: 'Senior Product Designer', daysAgo: 6, path: [] },
  { person: 'Oliver Park', job: 'Senior UX Designer', daysAgo: 9, path: ['screening', 'shortlisted', 'interview'] },
  { person: 'Aisha Patel', job: 'Product Designer, Growth', daysAgo: 3, path: [] },
  { person: 'Daniel Kim', job: 'Senior UX Designer', daysAgo: 2, path: [] },
]
