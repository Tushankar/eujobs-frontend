import { useTranslation } from 'react-i18next'
import {
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
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
import { useFormat } from '@/lib/preferences.js'

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
}

const PLURAL_TYPES = ['message', 'admin_content_report']

/**
 * The sentence of a notification, rendered now in the reader's language from its type and parameters (P11b rule:
 * the server stores no finished text). Enum parameters are translated; amounts are formatted for the reader.
 */
export function useNotificationText() {
  const { t } = useTranslation()
  const format = useFormat()
  return ({ type, params, count }) => {
    const amount = params.amountMinor !== undefined ? format.money(params.amountMinor, params.currency) : undefined
    const values = {
      ...params,
      // Only grouped types have plural forms (P11b-Q6).
      ...(PLURAL_TYPES.includes(type) && { count }),
      amount,
      status: params.status && t(`enums:applicationStatus.${params.status}`),
      reason: params.reason && t(type === 'cv_request' ? `enums:cvRequestReason.${params.reason}` : `enums:reportReason.${params.reason}`),
      category: params.category && t(`enums:verificationCategory.${params.category}`),
      target: params.targetType && t(`enums:reportTargetType.${params.targetType}`),
    }
    switch (type) {
      case 'verification_decided':
      case 'account_decided':
      case 'cv_request_decided':
        return t(`notifications:types.${type}.${params.decision}`, values)
      case 'content_restricted':
      case 'content_lifted':
        return t(`notifications:types.${type}.${params.content}`, values)
      case 'admin_account_review':
        return t(`notifications:types.${type}.${params.resubmitted ? 'resubmitted' : 'submitted'}`, values)
      default:
        return t(`notifications:types.${type}`, values)
    }
  }
}
