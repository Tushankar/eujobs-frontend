/** Application statuses, as labelled and coloured in the Applications frame. */
export const APPLICATION_STATUS = {
  applied: { label: 'Applied', tone: 'neutral' },
  'under-review': { label: 'Under review', tone: 'violet' },
  interview: { label: 'Interview', tone: 'success' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
}

/** Steps shown in the "View activity" dialog, in order. */
export const APPLICATION_STEPS = ['applied', 'under-review', 'interview']

/** Seed applications: the three rows of the Applications frame (the sidebar badge shows 3 on most frames). */
export const SEED_APPLICATIONS = [
  { id: 'app-figma-product-designer', jobId: 'figma-product-designer', status: 'under-review', appliedAt: '2026-09-28' },
  { id: 'app-notion-product-designer-growth', jobId: 'notion-product-designer-growth', status: 'interview', appliedAt: '2026-09-25' },
  { id: 'app-vercel-lead-product-designer', jobId: 'vercel-lead-product-designer', status: 'applied', appliedAt: '2026-09-24' },
]

export const SEED_SAVED_JOB_IDS = ['stripe-senior-ux-designer', 'spotify-ux-researcher']

/** "Sep 28" from an ISO date (read at noon so the local timezone never shifts the day). */
export function formatApplied(isoDate) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
