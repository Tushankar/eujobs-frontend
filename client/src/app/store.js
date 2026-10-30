import { configureStore, createSlice } from '@reduxjs/toolkit'
import { api } from './api.js'
import { getToken } from './token.js'

/* The session slice mirrors whether a token exists, so components re-render on sign-in and sign-out. */
const sessionSlice = createSlice({
  name: 'session',
  initialState: { signedIn: Boolean(getToken()) },
  reducers: {
    signedIn(state) {
      state.signedIn = true
    },
    signedOut(state) {
      state.signedIn = false
    },
  },
})

export const { signedIn, signedOut } = sessionSlice.actions

export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer, session: sessionSlice.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
})
