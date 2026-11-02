/** Badge tone of each candidate-visible status (M-070, U33); labels are `enums:applicationStatus.*`. */
export const STATUS_TONES = {
  applied: 'neutral',
  under_review: 'violet',
  interview: 'success',
  offer: 'success',
  hired: 'success',
  not_selected: 'warning',
  withdrawn: 'neutral',
}

/** Statuses the candidate can still withdraw from (M-074). */
export const canWithdraw = (status) => status !== 'withdrawn' && status !== 'not_selected'
