import { api } from './api.js'
import { store } from './store.js'

/*
 * 2026-11-20: agencies use every hiring tool recruiters have, under /agency instead of /recruiter. Shared hiring pages
 * build their links with hiringPath(), which reads the signed-in role when it is called (at render or on a click).
 */
export const HIRING_ROLES = ['recruiter', 'agency']
export const isHiring = (role) => HIRING_ROLES.includes(role)
/** 'recruiter' for both hiring roles (shared texts and records name the hiring side so), else the role. */
export const sideOf = (role) => (isHiring(role) ? 'recruiter' : role)

/** The hiring workspace of a role: /agency for agencies, /recruiter otherwise. */
export const hiringBase = (role) => (role === 'agency' ? '/agency' : '/recruiter')

/** The signed-in account's role (read when called), or undefined. */
export const currentRole = () => api.endpoints.getMe.select()(store.getState())?.data?.role

/** The sign-in and sign-up pages of a hiring role (agencies: /agencies/login, /agencies/signup). */
export const hiringSignIn = (role) => (role === 'agency' ? '/agencies/login' : '/recruiter/sign-in')
export const hiringSignUp = (role) => (role === 'agency' ? '/agencies/signup' : '/recruiter/sign-up')

/** A path in the signed-in account's hiring workspace, e.g. hiringPath('jobs/new') → /agency/jobs/new. */
export function hiringPath(to = '') {
  const base = hiringBase(currentRole())
  return to ? `${base}/${to}` : base
}
