import { Building2, MessageSquare, TrendingUp, Users } from 'lucide-react'

export const ANALYTICS_STATS = [
  { label: 'Shortlist conversion', value: '33%', caption: 'Shortlisted / current demo candidates', icon: TrendingUp },
  { label: 'Recruiter accounts', value: '1', caption: 'Registered in the demo workspace', icon: Users },
  { label: 'Company registrations', value: '1', caption: 'Local company profile', icon: Building2 },
  { label: 'Reviewed outreach', value: '0', caption: 'Human-reviewed drafts saved', icon: MessageSquare },
]

export const DEMANDED_SKILLS = [
  { name: 'Figma', count: 3 },
  { name: 'Product Design', count: 1 },
  { name: 'Design Systems', count: 1 },
  { name: 'UX Research', count: 1 },
  { name: 'Prototyping', count: 1 },
  { name: 'Interaction Design', count: 1 },
]

export const QUALITY_NOTES = [
  {
    title: 'Relevance feedback',
    status: 'Not yet connected',
    text: 'Collect candidate and recruiter feedback on why a recommendation did or didn’t fit.',
  },
  {
    title: 'Recommendation conversion',
    status: 'Not yet measured',
    text: 'Track real recommendation views, applications, and shortlists with consent.',
  },
  {
    title: 'Fairness & quality',
    status: 'Human review required',
    text: 'Evaluate role relevance, explanation quality, and bias before deploying a model.',
  },
]

export const DATE_RANGES = [
  { id: 'this-week', label: 'This week' },
  { id: 'last-week', label: 'Last week' },
  { id: 'last-month', label: 'Last month' },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Illustrative platform activity per date range (the Figma chart is labelled "Illustrative registrations and applications"). */
export const ACTIVITY_BY_RANGE = {
  'this-week': {
    labels: DAYS,
    registrations: [8, 12, 9, 18, 14, 21, 17],
    applications: [9, 18, 14, 21, 17, 8, 12],
  },
  'last-week': {
    labels: DAYS,
    registrations: [11, 7, 15, 12, 19, 10, 6],
    applications: [14, 10, 12, 20, 16, 9, 5],
  },
  'last-month': {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    registrations: [62, 74, 81, 99],
    applications: [58, 85, 77, 104],
  },
}
