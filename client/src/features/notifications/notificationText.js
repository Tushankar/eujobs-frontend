import { useTranslation } from 'react-i18next'
import {
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CreditCard,
  FileText,
  Flag,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import { useFormat, usePreferences } from '@/lib/preferences.js'

/** One neutral icon per type (LinkedIn style: grey glyphs, no tinted tiles). */
export const NOTIFICATION_ICONS = {
  application_status: BriefcaseBusiness,
  application_new: BriefcaseBusiness,
  application_withdrawn: BriefcaseBusiness,
  message: MessageSquare,
  cv_request: FileText,
  cv_request_decided: FileText,
  verification_decided: ShieldCheck,
  job_alert: Bell,
  payment_paid: CreditCard,
  renewal_failed: CreditCard,
  plan_ended: CreditCard,
  course_purchased: GraduationCap,
  certificate_issued: GraduationCap,
  content_restricted: TriangleAlert,
  content_lifted: TriangleAlert,
  account_decided: BadgeCheck,
  admin_account_review: Users,
  admin_verification_submitted: ShieldCheck,
  admin_content_report: Flag,
  admin_renewal_failed: CreditCard,
  admin_joined: UserPlus,
  interview_offered: CalendarClock,
  interview_confirmed: CalendarClock,
  interview_cancelled: CalendarClock,
  interview_other_times: CalendarClock,
  interview_reschedule_requested: CalendarClock,
  interview_expired: CalendarClock,
  interview_reminder: CalendarClock,
  interview_notes_ready: CalendarClock,
  document_requested: FileText,
  document_answered: FileText,
  documents_received: FileText,
}

const PLURAL_TYPES = ['message', 'admin_content_report']

/**
 * The sentence of a notification, rendered now in the reader's language from its type and parameters (P11b rule:
 * the server stores no finished text). Enum parameters are translated; amounts are formatted for the reader.
 */
export function useNotificationText() {
  const { t } = useTranslation()
  const format = useFormat()
  const { me } = usePreferences()
  return ({ type, params, count }) => {
    const amount = params.amountMinor !== undefined ? format.money(params.amountMinor, params.currency) : undefined
    const values = {
      ...params,
      // A name an erasure removed (P12-Q3) reads "Deleted user".
      ...Object.fromEntries(['name', 'candidate', 'payer', 'sender'].filter((key) => params[key] === null).map((key) => [key, t('common:deletedUser')])),
      // Only grouped types have plural forms (P11b-Q6).
      ...(PLURAL_TYPES.includes(type) && { count }),
      amount,
      status: params.status && t(`enums:applicationStatus.${params.status}`),
      reason: params.reason && t(type === 'cv_request' ? `enums:cvRequestReason.${params.reason}` : `enums:reportReason.${params.reason}`),
      category: params.category && t(`enums:verificationCategory.${params.category}`),
      target: params.targetType && t(`enums:reportTargetType.${params.targetType}`),
      // Plan notifications name the plan (Plus or Recruiter Plus, §3.22); rows from before 11c are Plus.
      plan: t(`enums:planKey.${params.planKey ?? 'plus'}`),
      // §3.23: interview times in the reader's time zone.
      when: params.startAt && format.dateTime(params.startAt),
    }
    switch (type) {
      case 'verification_decided':
      case 'account_decided':
      case 'cv_request_decided':
        return t(`notifications:types.${type}.${params.decision}`, values)
      case 'content_restricted':
      case 'content_lifted':
        return t(`notifications:types.${type}.${params.content}`, values)
      case 'plan_ended':
        // P11c-Q18: a recruiter's names the job kept live and the number paused.
        return params.paused ? t('notifications:types.plan_ended_paused', { ...values, count: params.paused }) : t('notifications:types.plan_ended', values)
      // §3.23: the candidate reads the company, the recruiter the candidate; a reminder says how soon.
      case 'interview_confirmed':
        return t(`notifications:types.${type}.${me?.role === 'recruiter' ? 'recruiter' : 'candidate'}`, values)
      case 'interview_reminder':
        return t(`notifications:types.${type}.${me?.role === 'recruiter' ? 'recruiter' : 'candidate'}`, { ...values, count: params.hours })
      case 'interview_offered':
        return t(`notifications:types.${type}.${params.rescheduled ? 'rescheduled' : 'new'}`, values)
      case 'admin_account_review':
        return t(`notifications:types.${type}.${params.resubmitted ? 'resubmitted' : 'submitted'}`, values)
      default:
        return t(`notifications:types.${type}`, values)
    }
  }
}
