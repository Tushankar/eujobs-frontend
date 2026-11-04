import { Award, BriefcaseBusiness, Earth, GraduationCap, ShieldCheck } from 'lucide-react'

/** PillBadge tones for account states, shared by the Candidates / Recruiters lists and the user detail page. */
export const STATUS_TONES = { active: 'success', unverified: 'warning', invited: 'warning' }
export const STATE_TONES = { pending: 'warning', approved: 'success', rejected: 'danger', suspended: 'danger' }
export const VERIFICATION_TONES = { verified: 'success', partial: 'info', in_review: 'warning', not_started: 'neutral' }

/** One verification submission: its status tone and its category icon (moderation queue and user detail page). */
export const SUBMISSION_TONES = { in_review: 'warning', approved: 'success', rejected: 'danger' }
export const CATEGORY_ICONS = { identity: ShieldCheck, academic: GraduationCap, employment: BriefcaseBusiness, right_to_work: Earth, certificate: Award }
