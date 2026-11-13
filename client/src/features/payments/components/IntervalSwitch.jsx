import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx.js'
import styles from './IntervalSwitch.module.css'

const INTERVALS = ['month', 'year']

/** Monthly / Yearly (2026-11-13): a pill switch; `saving` (percent) shows as a quiet tag on Yearly. */
export default function IntervalSwitch({ value, onChange, saving = 0, className }) {
  const { t } = useTranslation('billing')
  return (
    <div className={cx(styles.switch, className)} role="radiogroup" aria-label={t('interval.label')}>
      {INTERVALS.map((interval) => (
        <button
          key={interval}
          type="button"
          role="radio"
          aria-checked={value === interval}
          className={cx(styles.option, value === interval && styles.active)}
          onClick={() => onChange(interval)}
          data-interval={interval}
        >
          {t(`interval.${interval}`)}
          {interval === 'year' && saving > 0 && <span className={styles.saving}>{t('interval.save', { percent: saving })}</span>}
        </button>
      ))}
    </div>
  )
}
