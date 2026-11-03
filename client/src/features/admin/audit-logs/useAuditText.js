import { useTranslation } from 'react-i18next'
import { useFormat } from '@/lib/preferences.js'

/**
 * The sentence of an audit event (M-162): `type` is an `audit:types` key and `params` fill it; enum params become
 * labels and money is formatted, as the server's export does (OQ-6d).
 */
export function useAuditText() {
  const { t } = useTranslation(['audit', 'enums'])
  const format = useFormat()
  return ({ type, params }) =>
    t(`audit:types.${type}`, {
      ...params,
      ...(params.category && { category: t(`enums:verificationCategory.${params.category}`) }),
      ...(params.from && { from: t(`enums:jobStatus.${params.from}`) }),
      ...(params.to && { to: t(`enums:jobStatus.${params.to}`) }),
      ...(params.amountMinor !== undefined && { amount: format.money(params.amountMinor, params.currency) }),
    })
}
