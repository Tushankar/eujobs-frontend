import { createSlice } from '@reduxjs/toolkit'

/*
 * The candidate upgrade dialog (M-118, A: shared §8.3): opened by a 402 PLAN_REQUIRED from any request, by the
 * promo card and by Billing. `entitlement` names what was asked for, when known.
 */
const upgradeSlice = createSlice({
  name: 'upgrade',
  initialState: { open: false, entitlement: null },
  reducers: {
    openUpgrade(state, { payload }) {
      state.open = true
      state.entitlement = payload ?? null
    },
    closeUpgrade(state) {
      state.open = false
    },
  },
})

export const { openUpgrade, closeUpgrade } = upgradeSlice.actions
export const upgradeReducer = upgradeSlice.reducer
