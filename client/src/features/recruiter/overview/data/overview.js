/*
 * Mock data of the Overview's hiring funnel and momentum cards (Figma numbers). Those cards are hidden until
 * Phase 6 builds them on applications (P4-Q1), which also replaces this file.
 */

/** "Your hiring funnel": current candidates per stage. */
export const FUNNEL_STAGES = [
  { stage: 'Applied', count: 3 },
  { stage: 'Screening', count: 0 },
  { stage: 'Shortlisted', count: 2 },
  { stage: 'Interview', count: 1 },
  { stage: 'Offer', count: 0 },
  { stage: 'Hired', count: 0 },
]

/** "Hiring momentum": illustrative daily activity per period, Mon to Sun. */
export const MOMENTUM_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const MOMENTUM_PERIODS = [
  {
    id: 'this-week',
    label: 'This week',
    applications: [8, 12, 9, 18, 14, 21, 17],
    shortlisted: [9, 18, 14, 21, 17, 8, 12],
  },
  {
    id: 'last-week',
    label: 'Last week',
    applications: [6, 9, 11, 14, 12, 16, 10],
    shortlisted: [4, 7, 8, 12, 9, 13, 8],
  },
]
