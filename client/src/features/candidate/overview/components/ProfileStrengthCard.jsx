import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, UsersRound } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Button, Icon } from '@/components/ui'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import styles from './RailCards.module.css'

// The card lists the next open items only; My profile shows the whole checklist.
const NEXT_ITEMS = 3

/** "Make your profile stand out": the server's completeness (§3.2) as a strength meter and the next open items. */
export default function ProfileStrengthCard() {
  const { t } = useTranslation()
  const format = useFormat()
  const { me } = usePreferences()
  const completeness = me?.completeness
  if (!completeness) return null
  const next = completeness.items.filter((item) => !item.done).slice(0, NEXT_ITEMS)
  return (
    <section className={styles.card} data-card="profile-strength">
      <div className={styles.head}>
        <h2 className={styles.cardTitle}>{t('completeness:strength.title')}</h2>
        <span className={styles.tile}>
          <Icon as={UsersRound} size={14} />
        </span>
      </div>
      <div className={styles.meterRow}>
        <span className={styles.muted}>{t('completeness:strength.label')}</span>
        <span className={styles.strong}>{format.number(completeness.percent / 100, { style: 'percent' })}</span>
      </div>
      <p className={cx(styles.lead, styles.afterMeter)}>{t(completeness.complete ? 'completeness:strength.completeLead' : 'completeness:strength.lead')}</p>
      {next.length > 0 && (
        <ul className={styles.checklist}>
          {next.map((item) => (
            <li key={item.key} className={styles.checkItem}>
              <span className={styles.checkOpen} aria-hidden="true" />
              <Link to={item.route}>{t(`completeness:items.${item.key}`)}</Link>
            </li>
          ))}
        </ul>
      )}
      <Button as={Link} to="/candidate/profile" variant="secondary" fullWidth className={styles.cardButton} rightIcon={<Icon as={ArrowRight} size={12} />}>
        {t('completeness:strength.button')}
      </Button>
    </section>
  )
}
