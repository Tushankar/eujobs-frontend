import { createSlice } from '@reduxjs/toolkit'

/*
 * Success moments that happen on the person's own screen (owner 2026-11-17): applying, publishing a job, confirming an
 * interview… Any feature dispatches celebrate({ kind, params }); CelebrationHost shows them one at a time. Moments
 * decided elsewhere come from GET /me (`celebrations`) instead.
 */
const celebrateSlice = createSlice({
  name: 'celebrate',
  initialState: { queue: [] },
  reducers: {
    celebrate(state, { payload }) {
      state.queue.push({ id: `local-${Date.now()}-${state.queue.length}`, kind: payload.kind, params: payload.params ?? {} })
    },
    dismissCelebration(state, { payload }) {
      state.queue = state.queue.filter((item) => item.id !== payload)
    },
  },
})

export const { celebrate, dismissCelebration } = celebrateSlice.actions
export const celebrateReducer = celebrateSlice.reducer
