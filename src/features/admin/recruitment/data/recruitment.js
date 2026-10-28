/* Mock recruiter activity shown on Admin > Recruitment. Copy and numbers mirror the Figma frames. */

export const PIPELINE_STAGES = ['Applied', 'Screening', 'Shortlisted', 'Interview', 'Offer', 'Hired']

/** Candidate avatars use their own soft tints in the design (not the generic Avatar palettes). */
export const CANDIDATES = [
  { id: 'alex-morgan', name: 'Alex Morgan', title: 'Product Designer', stage: 'Applied', shortlisted: false, tone: ['#eaf4ff', '#0066c4'] },
  { id: 'emma-wilson', name: 'Emma Wilson', title: 'Senior Product Designer', stage: 'Screening', shortlisted: false, tone: ['#e8e4f4', '#6c5b97'] },
  { id: 'james-chen', name: 'James Chen', title: 'Senior Product Designer', stage: 'Shortlisted', shortlisted: true, tone: ['#ddebe8', '#527b72'] },
  { id: 'sofia-martinez', name: 'Sofia Martinez', title: 'Product Designer', stage: 'Applied', shortlisted: false, tone: ['#f3e7dc', '#a77850'] },
  { id: 'oliver-park', name: 'Oliver Park', title: 'Lead Product Designer', stage: 'Interview', shortlisted: true, tone: ['#dfe8f4', '#5a7b9e'] },
  { id: 'aisha-patel', name: 'Aisha Patel', title: 'UX Researcher', stage: 'Applied', shortlisted: false, tone: ['#f3e1e9', '#a76580'] },
  { id: 'daniel-kim', name: 'Daniel Kim', title: 'Product Designer', stage: 'Applied', shortlisted: false, tone: ['#ece9db', '#8f8553'] },
]

export const PUBLISHED_ROLES = [
  { id: 'senior-product-designer', title: 'Senior Product Designer', meta: 'Remote · San Francisco, US' },
  { id: 'product-designer-growth', title: 'Product Designer, Growth', meta: 'Hybrid · New York, US' },
  { id: 'senior-ux-designer', title: 'Senior UX Designer', meta: 'Remote · London, UK' },
]

export const APPLICATION_COVERAGE = [
  { id: 'product-designer', title: 'Product Designer', meta: 'Alex Morgan · 2026-09-28', status: 'Under review', tone: 'accent' },
  { id: 'product-designer-growth', title: 'Product Designer, Growth', meta: 'Alex Morgan · 2026-09-25', status: 'Interview', tone: 'success' },
  { id: 'lead-product-designer', title: 'Lead Product Designer', meta: 'Alex Morgan · 2026-09-24', status: 'Applied', tone: 'accent' },
]

/** Funnel counts as drawn in the Figma funnel view (candidates that reached each stage). `stage` links to the table filter. */
export const FUNNEL_STAGES = [
  { id: 'applied', label: 'Applied', stage: 'Applied', count: 9 },
  { id: 'screening', label: 'Screening', stage: 'Screening', count: 6 },
  { id: 'shortlisted', label: 'Shortlisted', stage: 'Shortlisted', count: 5 },
  { id: 'interview', label: 'Interview', stage: 'Interview', count: 4 },
  { id: 'offer', label: 'Offer', stage: 'Offer', count: 3 },
  { id: 'hire', label: 'Hire', stage: 'Hired', count: 2 },
]
