/* Account review (P4-Q2): the status filter, in tab order, and the badge tone of each status. */
export const ACCOUNT_STATUSES = ['pending_review', 'active', 'suspended', 'rejected']
export const ACCOUNT_TONES = { pending_review: 'warning', active: 'success', suspended: 'danger', rejected: 'danger' }

/* Content cases (M-167): the badge tone of each case status. */
export const CASE_TONES = { open: 'warning', dismissed: 'success', restricted: 'danger' }
