import { createSlice } from '@reduxjs/toolkit'

/*
 * The first-login product tour (candidates, recruiters). It opens by itself while /me says `tourPending`, and the
 * profile menu and Help page replay it with `startTour`.
 */
const tourSlice = createSlice({
  name: 'tour',
  initialState: { open: false },
  reducers: {
    startTour(state) {
      state.open = true
    },
    endTour(state) {
      state.open = false
    },
  },
})

export const { startTour, endTour } = tourSlice.actions
export const tourReducer = tourSlice.reducer
