/* Mock data for the recruiter Overview (copy and numbers from the Figma frame). */

/** KPI cards. `openPositions` is derived from the jobs store and `shortlistedCandidates` from the shortlist; the rest are illustrative demo numbers. */
export const OVERVIEW_STATS = {
  recommendedCandidates: 6,
  applications: 6,
}

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

/** "Talent worth meeting". `matchedSkills` is the subset of `skills` relevant to the recruiter's open roles. */
export const TALENT = [
  {
    id: 'emma-wilson',
    name: 'Emma Wilson',
    initials: 'EW',
    tone: 'lilac',
    headline: 'Senior Product Designer · Notion',
    years: 6,
    workPreference: 'Remote',
    location: 'San Francisco, US',
    skills: ['Figma', 'Product Design', 'Design Systems'],
    matchedSkills: ['Figma', 'Product Design', 'Design Systems'],
    availability: 'Open to opportunities',
  },
  {
    id: 'james-chen',
    name: 'James Chen',
    initials: 'JC',
    tone: 'mint',
    headline: 'Senior Product Designer · Stripe',
    years: 7,
    workPreference: 'Remote',
    location: 'New York, US',
    skills: ['Figma', 'Design Systems', 'Prototyping'],
    matchedSkills: ['Figma', 'Design Systems'],
    availability: 'Available in 2 weeks',
  },
  {
    id: 'sofia-martinez',
    name: 'Sofia Martinez',
    initials: 'SM',
    tone: 'peach',
    headline: 'Product Designer · Monzo',
    years: 4,
    workPreference: 'Hybrid',
    location: 'London, UK',
    skills: ['Figma', 'UX Research', 'Prototyping'],
    matchedSkills: ['Figma'],
    availability: 'Open to opportunities',
  },
]
