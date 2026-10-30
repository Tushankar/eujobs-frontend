/*
 * Browser-only demo session: a marker that the user went through sign-in, never a credential.
 * Candidate and recruiter share one 'member' session (the header workspace switch links between
 * them, so a signed-in user can switch); admin has its own. The key is deliberately not prefixed
 * 'lwm.': Reset demo removes every 'lwm.' key and must not sign the user out. If storage is
 * blocked, the session is kept in memory instead.
 */
const SESSION_KEY = 'lwm-session'
const SESSION_GROUP = { candidate: 'member', recruiter: 'member', admin: 'admin' }

let memorySession = null

export function startSession(workspaceId) {
  const group = SESSION_GROUP[workspaceId]
  try {
    window.localStorage.setItem(SESSION_KEY, group)
  } catch {
    memorySession = group
  }
}

export function endSession() {
  memorySession = null
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // storage unavailable: the in-memory session is already cleared
  }
}

export function hasSession(workspaceId) {
  let stored = null
  try {
    stored = window.localStorage.getItem(SESSION_KEY)
  } catch {
    // storage unavailable: fall back to the in-memory session
  }
  return (stored ?? memorySession) === SESSION_GROUP[workspaceId]
}
