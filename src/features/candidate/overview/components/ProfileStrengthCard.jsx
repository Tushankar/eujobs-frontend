import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck, UsersRound } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Button, Icon } from '@/components/ui'
import styles from './RailCards.module.css'

const CHECKLIST = [
  { label: 'Resume uploaded', done: true },
  { label: 'Skills & experience added', done: true },
  { label: 'Add your portfolio', done: false, boost: '+15%' },
]

/** "Make your profile stand out": strength meter and the remaining checklist items. */
export default function ProfileStrengthCard() {
  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.cardTitle}>Make your profile stand out</h2>
        <span className={styles.tile}>
          <Icon as={UsersRound} size={14} />
        </span>
      </div>
      <div className={styles.meterRow}>
        <span className={styles.muted}>Profile strength</span>
        <span className={styles.strong}>85%</span>
      </div>
      <p className={cx(styles.lead, styles.afterMeter)}>A little more about you. A lot more possibilities.</p>
      <ul className={styles.checklist}>
        {CHECKLIST.map((item) => (
          <li key={item.label} className={styles.checkItem}>
            {item.done ? <Icon as={CircleCheck} size={13} className={styles.checkDone} /> : <span className={styles.checkOpen} aria-hidden="true" />}
            <span>{item.label}</span>
            {item.boost && <span className={styles.boost}>{item.boost}</span>}
          </li>
        ))}
      </ul>
      <Button as={Link} to="/candidate/profile" variant="secondary" fullWidth className={styles.cardButton} rightIcon={<Icon as={ArrowRight} size={12} />}>
        Improve my profile
      </Button>
    </section>
  )
}
