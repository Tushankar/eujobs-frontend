import { useTranslation } from 'react-i18next'
import { useFormat } from '@/lib/preferences.js'

/**
 * The sentence of an audit event (M-162): `type` is an `audit:types` key and `params` fill it; enum params become
 * labels and money is formatted, as the server's export does (OQ-6d).
 */
/** Name parameters an erasure set to null (OD15, P12-Q3): they read "Deleted user". */
const NAME_KEYS = ['name', 'candidate', 'payer']

export function useAuditText() {
  const { t } = useTranslation(['audit', 'enums'])
  const format = useFormat()
  return ({ type, params }) =>
    t(`audit:types.${type}`, {
      ...params,
      ...Object.fromEntries(NAME_KEYS.filter((key) => params[key] === null).map((key) => [key, t('common:deletedUser')])),
      ...(params.accountRole && { accountRole: t(`enums:role.${params.accountRole}`) }),
      ...(params.category && { category: t(`enums:verificationCategory.${params.category}`) }),
      ...(params.from && { from: t(`enums:jobStatus.${params.from}`) }),
      ...(params.to && { to: t(`enums:jobStatus.${params.to}`) }),
      ...(params.targetType && { targetType: t(`enums:reportTargetType.${params.targetType}`) }),
      ...(params.reason && { reason: t(`enums:reportReason.${params.reason}`, { defaultValue: params.reason }) }),
      ...(params.amountMinor !== undefined && { amount: format.money(params.amountMinor, params.currency) }),
    })
}
