import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight, CircleCheck, UsersRound } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import styles from './RailCards.module.css'

/** "Make your profile stand out": the server's completeness (§3.2) as a strength meter and every open item. */
export default function ProfileStrengthCard() {
  const { t } = useTranslation()
  const format = useFormat()
  const { me } = usePreferences()
  const completeness = me?.completeness
  if (!completeness) return null
  const open = completeness.items.filter((item) => !item.done)
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
      <span className={styles.bar} aria-hidden="true">
        <span style={{ width: `${completeness.percent}%` }} />
      </span>
      <p className={styles.lead}>{t(completeness.complete ? 'completeness:strength.completeLead' : 'completeness:strength.lead')}</p>
      <ul className={styles.rows}>
        {open.length === 0 ? (
          <li className={styles.row}>
            <span className={styles.rowLabel}>
              <Icon as={CircleCheck} size={16} />
              {t('completeness:progress', { done: completeness.done, total: completeness.total })}
            </span>
          </li>
        ) : (
          open.map((item) => (
            <li key={item.key}>
              <Link to={item.route} className={styles.row}>
                <span className={styles.rowLabel}>
                  <span className={styles.checkOpen} aria-hidden="true" />
                  {t(`completeness:items.${item.key}`)}
                </span>
                <Icon as={ChevronRight} size={14} className={styles.rowChevron} />
              </Link>
            </li>
          ))
        )}
      </ul>
      <Button as={Link} to="/candidate/profile" variant="secondary" fullWidth className={styles.cardButton} rightIcon={<Icon as={ArrowRight} size={12} />}>
        {t('completeness:strength.button')}
      </Button>
    </section>
  )
}
