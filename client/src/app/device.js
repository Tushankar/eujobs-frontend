/*
 * This browser's remembered-device key (owner 2026-11-18): set when the browser passes the sign-in second step (or
 * opens a verification / reset link), sent with every sign-in. It outlives sign-out on purpose, so a remembered
 * browser is not asked for a code again for 90 days.
 */
const DEVICE_KEY = 'lwm-device'

export function getDeviceToken() {
  try {
    return window.localStorage.getItem(DEVICE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function setDeviceToken(token) {
  if (!token) return
  try {
    window.localStorage.setItem(DEVICE_KEY, token)
  } catch {
    // storage unavailable: this browser is asked for a code at each sign-in
  }
}

/** For mutations whose answer may carry `deviceToken`: keeps it. */
export const storesDevice = {
  async onQueryStarted(arg, { queryFulfilled }) {
    try {
      const { data } = await queryFulfilled
      setDeviceToken(data?.deviceToken)
    } catch {
      // The caller shows the error.
    }
  },
}
