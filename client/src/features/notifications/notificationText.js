import { isHiring } from '@/app/roles.js'
import { useTranslation } from 'react-i18next'
import {
  BadgeCheck,
  Bell,
  Building2,
  BriefcaseBusiness,
  CalendarClock,
  CreditCard,
  Gauge,
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
  payment_recovered: CreditCard,
  plan_cancel_scheduled: CreditCard,
  plan_resumed: CreditCard,
  plan_changed: CreditCard,
  plan_change_scheduled: CreditCard,
  renewal_reminder: CreditCard,
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
  admin_ai_budget: Gauge,
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
  // 2026-11-20: agencies
  agency_join_requested: UserPlus,
  agency_member_agreed: BadgeCheck,
  agency_member_left: Users,
  placement_offer_answered: CalendarClock,
  placement_notice_given: CalendarClock,
  placement_ending_soon: CalendarClock,
  // 2026-11-20 (phase 5): the candidate's agencies and placements
  agency_invited: Building2,
  agency_request_accepted: Building2,
  agency_membership_declined: Building2,
  agency_removed: Building2,
  agency_agreement_updated: FileText,
  placement_confirmed: CalendarClock,
  placement_ended_early: CalendarClock,
  placement_offered: CalendarClock,
  placement_offer_withdrawn: CalendarClock,
  placement_starts_soon: CalendarClock,
  placement_ends_soon: CalendarClock,
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
      // 2026-11-13: plan lifecycle notifications name a date and the billing period.
      date: params.date && format.date(params.date),
      billing: params.interval && t(`billing:page.billing.${params.interval}`),
    }
    switch (type) {
      // 2026-11-23: an agency's account decision speaks of its agency account.
      case 'account_decided':
        return t(`notifications:types.account_decided.${me?.role === 'agency' ? 'agency_' : ''}${params.decision}`, values)
      case 'verification_decided':
      case 'cv_request_decided':
      case 'placement_offer_answered':
      case 'agency_membership_declined':
        return t(`notifications:types.${type}.${params.decision}`, values)
      // Phase 6 (2026-11-23): how many of the agency's jobs fit the person next.
      case 'placement_ending_soon':
        return params.next ? t(`notifications:types.${type}.fits`, { ...values, count: params.next }) : t(`notifications:types.${type}.none`, values)
      case 'content_restricted':
      case 'content_lifted':
        return t(`notifications:types.${type}.${params.content}`, values)
      case 'plan_ended':
        // P11c-Q18: a recruiter's names the job kept live and the number paused.
        return params.paused ? t('notifications:types.plan_ended_paused', { ...values, count: params.paused }) : t('notifications:types.plan_ended', values)
      // §3.23: the candidate reads the company, the recruiter the candidate; a reminder says how soon.
      case 'interview_confirmed':
        return t(`notifications:types.${type}.${isHiring(me?.role) ? 'recruiter' : 'candidate'}`, values)
      case 'interview_reminder':
        return t(`notifications:types.${type}.${isHiring(me?.role) ? 'recruiter' : 'candidate'}`, { ...values, count: params.hours })
      case 'interview_offered':
        return t(`notifications:types.${type}.${params.rescheduled ? 'rescheduled' : 'new'}`, values)
      // 2026-11-17: an OpenAI or Google Places budget at 80 % (warning) or used up (paused); amounts are USD.
      case 'admin_ai_budget':
        return t(`notifications:types.${type}.${params.percent >= 100 ? 'paused' : 'warning'}`, {
          ...values,
          provider: t(`aiMatching:usage.providers.${params.provider}`),
          spent: format.money(Math.round(params.spent * 100), 'USD'),
          budget: format.money(Math.round(params.budget * 100), 'USD'),
        })
      case 'admin_account_review':
        return t(`notifications:types.${type}.${params.resubmitted ? 'resubmitted' : 'submitted'}`, values)
      default:
        return t(`notifications:types.${type}`, values)
    }
  }
}
