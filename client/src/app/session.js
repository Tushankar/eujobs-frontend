import i18n from '@/i18n/index.js'
import { api, setAuthRequiredHandler } from './api.js'
import { navigateTo } from './navigation.js'
import { signedIn, signedOut, store } from './store.js'
import { clearToken, getToken, setToken, TOKEN_KEY } from './token.js'

/* Sign-in state and the account state machine of BACKEND_PLAN §3.1. */
export const SIGN_IN_PATH = { candidate: '/sign-in', recruiter: '/recruiter/sign-in', admin: '/admin/sign-in' }
export const WORKSPACE_PATH = { candidate: '/candidate', recruiter: '/recruiter', admin: '/admin' }

/** The sign-in page of the workspace a path belongs to. */
export function signInPathFor(pathname) {
  const role = Object.keys(WORKSPACE_PATH).find((id) => pathname.startsWith(WORKSPACE_PATH[id]))
  return SIGN_IN_PATH[role] ?? SIGN_IN_PATH.candidate
}

/** `next` only when it is a path on this site (M-011). */
export function safeNext(next) {
  return typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : null
}

/**
 * The page this account must stay on until its state moves on (§3.1), as { path, prefix };
 * null when the whole workspace is open.
 */
export function requiredPage(me) {
  if (me.role === 'candidate' && !me.onboardingCompleted) return { path: '/candidate/onboarding/story', prefix: '/candidate/onboarding' }
  if (me.role !== 'recruiter' || me.status === 'active') return null
  if (me.status === 'unverified') return { path: '/recruiter/onboarding/email-code', prefix: '/recruiter/onboarding/email-code' }
  if (me.status === 'onboarding') return { path: '/recruiter/onboarding', prefix: '/recruiter/onboarding' }
  return { path: '/recruiter/onboarding/review', prefix: '/recruiter/onboarding/review' }
}

/** Where a signed-in account lands: its required page, else `next` inside its own workspace, else the workspace. */
export function landingPath(me, next) {
  const required = requiredPage(me)
  if (required) return required.path
  const target = safeNext(next)
  return target?.startsWith(WORKSPACE_PATH[me.role]) ? target : WORKSPACE_PATH[me.role]
}

/** GET /me for the stored token (cached by RTK Query), switching the UI to the account's language. */
export async function loadMe() {
  if (!getToken()) return null
  const { data } = await store.dispatch(api.endpoints.getMe.initiate(undefined, { subscribe: false }))
  if (!data) return null
  if (i18n.language !== data.language) await i18n.changeLanguage(data.language)
  return data
}

export async function signIn(token, me) {
  setToken(token)
  store.dispatch(signedIn())
  // Awaited, so the next route loader reads this /me instead of a pending cache entry.
  await store.dispatch(api.util.upsertQueryData('getMe', undefined, me))
  if (i18n.language !== me.language) await i18n.changeLanguage(me.language)
}

/** Logout is client-side (M-007): drop the token and every cached response. */
export function signOut() {
  clearToken()
  store.dispatch(signedOut())
  store.dispatch(api.util.resetApiState())
}

const PUBLIC_PORTAL_PAGES = ['/recruiter/sign-in', '/recruiter/sign-up', '/admin/sign-in']

/** Workspace and recruiter onboarding pages need a session; sign-in, sign-up, reset, legal and the like do not. */
function needsSession(pathname) {
  if (PUBLIC_PORTAL_PAGES.includes(pathname)) return false
  return Object.values(WORKSPACE_PATH).some((base) => pathname === base || pathname.startsWith(`${base}/`))
}

/** The session ended: drop it, and leave a page that needs one for its sign-in with ?next. */
function returnToSignIn() {
  const { pathname, search } = window.location
  signOut()
  if (needsSession(pathname)) navigateTo(`${signInPathFor(pathname)}?next=${encodeURIComponent(pathname + search)}`, { replace: true })
}

setAuthRequiredHandler(returnToSignIn)

// Another tab signed out (or in as someone else): follow it.
window.addEventListener('storage', (event) => {
  if (event.key !== TOKEN_KEY) return
  if (event.newValue) window.location.reload()
  else returnToSignIn()
})
