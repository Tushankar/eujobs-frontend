/** Categories offered by the audit log filter (every event belongs to exactly one). */
export const AUDIT_CATEGORIES = [
  { id: 'all', label: 'All events' },
  { id: 'Workspace', label: 'Workspace' },
  { id: 'Policy', label: 'Policy' },
  { id: 'Moderation', label: 'Moderation' },
  { id: 'Reports', label: 'Reports' },
  { id: 'Access', label: 'Access' },
]

/**
 * Events present before this device recorded anything. Only the first one comes from the Figma frame;
 * the rest are sample entries so filtering, paging and expanding have something to work on.
 */
export const SEED_AUDIT_EVENTS = [
  {
    id: 'seed-workspace-initialized',
    title: 'Workspace initialized',
    category: 'Workspace',
    actor: 'Workspace admin',
    at: '2026-09-30T08:00:00',
    detail: 'The demo workspace was created on this device with one candidate, one recruiter and one company profile.',
  },
  {
    id: 'seed-policy-default',
    title: 'Default evidence policy activated',
    category: 'Policy',
    actor: 'Workspace admin',
    at: '2026-09-30T08:05:00',
    detail: 'Skills, experience and work-preference signals are enabled. Human review is required and cannot be disabled.',
  },
  {
    id: 'seed-access-recruiter',
    title: 'Recruiter workspace access reviewed',
    category: 'Access',
    actor: 'Workspace admin',
    at: '2026-09-30T08:40:00',
    detail: 'Sarah Miller (Acme Studio) was confirmed as a recruiter with the standard recruiter role.',
  },
  {
    id: 'seed-report-growth',
    title: 'Content report received',
    category: 'Moderation',
    actor: 'Marketplace user',
    at: '2026-09-30T09:15:00',
    detail: 'Product Designer, Growth was reported for potentially unclear or exclusionary requirements. It awaits human review.',
  },
  {
    id: 'seed-report-profile',
    title: 'Content report received',
    category: 'Moderation',
    actor: 'Marketplace user',
    at: '2026-09-30T10:05:00',
    detail: 'A statement on the Alex Morgan candidate profile was reported for contextual review. No automated conclusion was made.',
  },
  {
    id: 'seed-account-pending',
    title: 'Account registration pending review',
    category: 'Moderation',
    actor: 'System',
    at: '2026-09-20T14:30:00',
    detail: 'James Chen registered a candidate account. Registration details require human review.',
  },
]
