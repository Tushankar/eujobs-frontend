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

/** A path in the signed-in account's hiring workspace, e.g. hiringPath('jobs/new') → /agency/jobs/new. */
export function hiringPath(to = '') {
  const base = hiringBase(api.endpoints.getMe.select()(store.getState())?.data?.role)
  return to ? `${base}/${to}` : base
}
