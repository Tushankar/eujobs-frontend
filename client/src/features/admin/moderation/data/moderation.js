import { Check, EyeOff } from 'lucide-react'

/** Reported content waiting for a human decision. `id` is the URL segment of /admin/moderation/content/:itemId. */
export const CONTENT_ITEMS = [
  {
    id: 'product-designer-growth',
    title: 'Product Designer, Growth',
    kind: 'Job listing',
    priority: 'high',
    reason: 'Potentially unclear or exclusionary requirements',
    summary:
      'A marketplace user asked for a human review of the role requirements and whether every criterion is genuinely essential.',
    reportedAt: '2026-09-30T09:15:00',
  },
  {
    id: 'alex-morgan-profile',
    title: 'Alex Morgan',
    kind: 'Candidate profile',
    priority: 'standard',
    reason: 'Profile claim needs contextual review',
    summary:
      'A profile statement was reported for review. No automated conclusion has been made about its accuracy.',
    reportedAt: '2026-09-30T10:05:00',
  },
]

export const CONTENT_ACTIONS = [
  {
    id: 'dismissed',
    label: 'Dismiss report',
    icon: Check,
    variant: 'outline',
    confirmTitle: 'Dismiss this report?',
    confirmText: 'The content stays visible. The report is closed with your note.',
    confirmLabel: 'Dismiss report',
  },
  {
    id: 'restricted',
    label: 'Restrict content',
    icon: EyeOff,
    variant: 'danger',
    reasonRequired: true,
    confirmTitle: 'Restrict this content?',
    confirmText: 'Restricting a job pauses it; restricting the current candidate profile removes it from recruiter discovery.',
    confirmLabel: 'Restrict content',
  },
]

/** Badge label and tone per decision; `pending` is the default state of every queue item. */
export const DECISION_BADGES = {
  pending: { label: 'Pending review', tone: 'warning' },
  dismissed: { label: 'Report dismissed', tone: 'success' },
  restricted: { label: 'Content restricted', tone: 'danger' },
}

/* Account review (P4-Q2): the status filter, in tab order, and the badge tone of each status. */
export const ACCOUNT_STATUSES = ['pending_review', 'active', 'suspended', 'rejected']
export const ACCOUNT_TONES = { pending_review: 'warning', active: 'success', suspended: 'danger', rejected: 'danger' }
