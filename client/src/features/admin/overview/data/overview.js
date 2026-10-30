/*
 * Admin overview (mock data). Numbers and copy mirror the Figma frame; the figures that can be read from
 * live demo data (accounts, published jobs, pending reviews) are computed on the page instead.
 */

/** Totals that are not derived from other admin data. */
export const OVERVIEW_STATS = {
  applications: 9,
  verifiedProfiles: 0,
  courseEnrollments: 0,
  courseBadges: 0,
  averageRoleMatch: '68%',
}

/** "Marketplace health" counters, in Figma order (`pendingReviews` is filled in from the accounts list). */
export const MARKETPLACE_HEALTH = [
  { key: 'companies', label: 'Companies registered', value: 1 },
  { key: 'purchases', label: 'Course purchases', value: 0 },
  { key: 'checks', label: 'Verification checks in review', value: 0 },
  { key: 'shortlists', label: 'Shortlist activity', value: 2 },
  { key: 'outreach', label: 'Outreach drafts reviewed', value: 0 },
  { key: 'pendingReviews', label: 'Pending user reviews', value: 1 },
]

/** "Most demanded skills": how many current roles require each skill. */
export const DEMANDED_SKILLS = [
  { skill: 'Figma', roles: 3 },
  { skill: 'Product Design', roles: 1 },
  { skill: 'Design Systems', roles: 1 },
  { skill: 'UX Research', roles: 1 },
  { skill: 'Prototyping', roles: 1 },
  { skill: 'Interaction Design', roles: 1 },
]

export const RECENT_ACTIVITY = [{ id: 'workspace-initialized', text: 'Workspace initialized · Sep 30, 2026' }]

/*
 * "Platform activity": illustrative registrations and applications per period.
 * `bars` are daily counts (Mon to Sun, scaled to BAR_SCALE_MAX); `line` is the 0-100 index plotted by the
 * line view (Mon to Sat), as in the Figma popup frame.
 */
export const BAR_SCALE_MAX = 25

export const ACTIVITY_PERIODS = [
  {
    id: 'this-week',
    label: 'This week',
    bars: {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      registrations: [8, 12, 9, 18, 14, 21, 17],
      applications: [9, 18, 14, 21, 17, 8, 12],
    },
    line: {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      registrations: [56, 64, 76, 78, 70, 37],
      applications: [39, 80, 15, 17, 65, 15],
    },
  },
  {
    id: 'last-week',
    label: 'Last week',
    bars: {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      registrations: [5, 9, 7, 13, 11, 15, 10],
      applications: [7, 11, 12, 16, 13, 9, 6],
    },
    line: {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      registrations: [48, 55, 62, 70, 66, 41],
      applications: [30, 52, 24, 28, 58, 20],
    },
  },
]
