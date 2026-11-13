import { useTranslation } from 'react-i18next'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import styles from './PlanPrice.module.css'

/** A year's price per month: cents below 100 a month, whole units above (HUF, CZK, SEK…). */
function monthlyShare(amountMinor) {
  const share = amountMinor / 12
  return share >= 10000 ? Math.round(share / 100) * 100 : Math.round(share)
}

/**
 * A plan's price for the chosen billing period (2026-11-13). Monthly: the price a month. Yearly: what it comes to a
 * month, then the yearly total beside 12 months struck through. Free: "Free forever". Every variant has the note line,
 * so cards side by side keep their features aligned. `size="lg"` is the public pricing page.
 */
export default function PlanPrice({ plan, interval = 'month', size, className }) {
  const { t } = useTranslation('billing')
  const format = useFormat()
  const { price, yearlyPrice } = plan
  if (!price) return null
  const money = (amountMinor) => format.money(amountMinor, price.currency)
  const yearly = interval === 'year' && yearlyPrice
  let note = t('price.billedMonthly')
  if (price.amountMinor === 0) note = t('price.forever')
  else if (yearly) {
    note = (
      <>
        <s className={styles.full}>
          <span className="sr-only">{t('price.insteadOf')} </span>
          {money(price.amountMinor * 12)}
        </s>{' '}
        {t('price.billedYearly', { amount: money(yearlyPrice.amountMinor) })}
      </>
    )
  }
  return (
    <div className={cx(styles.root, size === 'lg' && styles.large, className)} data-plan-price={yearly ? 'year' : 'month'}>
      <p className={styles.line}>
        <strong className={styles.amount}>{money(yearly ? monthlyShare(yearlyPrice.amountMinor) : price.amountMinor)}</strong>
        {price.amountMinor > 0 && <span className={styles.per}>{t('price.perMonth')}</span>}
      </p>
      <p className={styles.note}>{note}</p>
    </div>
  )
}
