/*
 * Sample rows for the admin Applications page only (as P5-Q1), in the server's status keys (M-070, U33), until
 * Phase 10 reads GET /admin/applications. Candidates and recruiters read their applications from the server.
 */
export const APPLICATION_STATUS = {
  applied: { label: 'Applied', tone: 'accent' },
  under_review: { label: 'Under review', tone: 'accent' },
  interview: { label: 'Interview', tone: 'success' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
}

export const SAMPLE_APPLICATIONS = [
  { id: 'sample-application-1', candidate: 'Alex Morgan', role: 'Product Designer', company: 'Figma', appliedAt: '2026-09-28', status: 'under_review' },
  { id: 'sample-application-2', candidate: 'Alex Morgan', role: 'Product Designer, Growth', company: 'Notion', appliedAt: '2026-09-25', status: 'interview' },
  { id: 'sample-application-3', candidate: 'Alex Morgan', role: 'Lead Product Designer', company: 'Vercel', appliedAt: '2026-09-24', status: 'applied' },
]
