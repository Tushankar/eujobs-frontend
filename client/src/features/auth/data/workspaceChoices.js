import { BriefcaseBusiness, ShieldCheck, Users } from 'lucide-react'

/** Workspace tiles of the Authentication frames. `path` is the same screen for that workspace. */
export const SIGN_IN_CHOICES = [
  { id: 'candidate', label: 'Candidate', icon: Users, path: '/sign-in' },
  { id: 'recruiter', label: 'Recruiter', icon: BriefcaseBusiness, path: '/recruiter/sign-in' },
]

export const SIGN_UP_CHOICES = [
  { id: 'candidate', label: 'Candidate', icon: Users, path: '/sign-up' },
  { id: 'recruiter', label: 'Recruiter', icon: BriefcaseBusiness, path: '/recruiter/sign-up' },
]

export const ADMIN_CHOICES = [{ id: 'admin', label: 'Admin', icon: ShieldCheck }]
