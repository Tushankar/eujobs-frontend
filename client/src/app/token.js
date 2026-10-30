/*
 * The JWT (M-007), kept in localStorage under a key that does not start with `lwm.` (the legacy
 * Reset demo code wipes `lwm.` keys; A: shared §4.6). If storage is blocked it lives in memory.
 */
export const TOKEN_KEY = 'lwm-auth-token'

let memoryToken = null

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? memoryToken
  } catch {
    return memoryToken
  }
}

export function setToken(token) {
  memoryToken = token
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // storage unavailable: the in-memory token is used
  }
}

export function clearToken() {
  memoryToken = null
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage unavailable: the in-memory token is already cleared
  }
}
