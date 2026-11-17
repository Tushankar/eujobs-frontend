/** Badge tone of each candidate-visible status (M-070, U33); labels are `enums:applicationStatus.*`. */
export const STATUS_TONES = {
  // Owner 2026-11-17: brand blue, not grey — applying is good news.
  applied: 'primary',
  under_review: 'violet',
  interview: 'success',
  offer: 'success',
  hired: 'success',
  not_selected: 'warning',
  withdrawn: 'neutral',
}

/** Statuses the candidate can still withdraw from (M-074). */
export const canWithdraw = (status) => status !== 'withdrawn' && status !== 'not_selected'
