import { ArrowUpRight, Check, EyeOff } from 'lucide-react'

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

/** New accounts waiting for approval. `id` is the URL segment of /admin/moderation/accounts/:accountId. */
export const PENDING_ACCOUNTS = [
  {
    id: 'james-chen',
    name: 'James Chen',
    email: 'james@example.com',
    type: 'Candidate',
    joinedAt: '2026-09-20T09:00:00',
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
  {
    id: 'escalated',
    label: 'Escalate',
    icon: ArrowUpRight,
    variant: 'ghost',
    reasonRequired: true,
    confirmTitle: 'Escalate for a second review?',
    confirmText: 'The report stays open and is marked for a second human reviewer.',
    confirmLabel: 'Escalate',
  },
]

export const ACCOUNT_ACTIONS = [
  {
    id: 'suspended',
    label: 'Suspend for review',
    variant: 'danger',
    reasonRequired: true,
    confirmTitle: 'Suspend this account for review?',
    confirmText: 'The account stays suspended until a person completes the review.',
    confirmLabel: 'Suspend account',
  },
  {
    id: 'approved',
    label: 'Approve account',
    icon: Check,
    variant: 'primary',
    confirmTitle: 'Approve this account?',
    confirmText: 'The registration is approved in this demo record.',
    confirmLabel: 'Approve account',
  },
  {
    id: 'escalated',
    label: 'Escalate',
    icon: ArrowUpRight,
    variant: 'ghost',
    reasonRequired: true,
    confirmTitle: 'Escalate for a second review?',
    confirmText: 'The registration stays pending and is marked for a second human reviewer.',
    confirmLabel: 'Escalate',
  },
]

/** Badge label and tone per decision; `pending` is the default state of every queue item. */
export const DECISION_BADGES = {
  pending: { label: 'Pending review', tone: 'warning' },
  dismissed: { label: 'Report dismissed', tone: 'success' },
  restricted: { label: 'Content restricted', tone: 'danger' },
  approved: { label: 'Account approved', tone: 'success' },
  suspended: { label: 'Account suspended', tone: 'danger' },
  escalated: { label: 'Escalated', tone: 'info' },
}

export const QUEUE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending review' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'resolved', label: 'Resolved' },
]
