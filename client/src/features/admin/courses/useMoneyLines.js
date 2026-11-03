import { useTranslation } from 'react-i18next'
import { useFormat } from '@/lib/preferences.js'

const MONEY_LINES = 3

/** U34: money per currency, largest first, at most 3 lines, then "+n more" (never summed across currencies, C15). */
export function useMoneyLines() {
  const { t } = useTranslation('courses')
  const format = useFormat()
  return (revenue) =>
    revenue.length === 0
      ? [t('table.noRevenue')]
      : [
          ...revenue.slice(0, MONEY_LINES).map((entry) => format.money(entry.amountMinor, entry.currency)),
          ...(revenue.length > MONEY_LINES ? [t('table.more', { count: revenue.length - MONEY_LINES })] : []),
        ]
}
