import { BriefcaseBusiness, Building2, ShieldCheck, Users } from 'lucide-react'

/** Portal tiles of the Authentication frames (labels: `auth:portals.<id>`). `path` is the same screen for that portal. */
export const SIGN_IN_CHOICES = [
  { id: 'candidate', icon: Users, path: '/sign-in' },
  { id: 'recruiter', icon: BriefcaseBusiness, path: '/recruiter/sign-in' },
]

export const SIGN_UP_CHOICES = [
  { id: 'candidate', icon: Users, path: '/sign-up' },
  { id: 'recruiter', icon: BriefcaseBusiness, path: '/recruiter/sign-up' },
]

export const ADMIN_CHOICES = [{ id: 'admin', icon: ShieldCheck }]

// 2026-11-20: the agency portal (/agencies/login, /agencies/signup) is its own, like the admin one.
export const AGENCY_CHOICES = [{ id: 'agency', icon: Building2 }]
