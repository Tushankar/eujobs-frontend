import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Icon } from '@/components/ui'
import { FUNNEL_STAGES } from '../data/overview.js'
import SectionHeading from './SectionHeading.jsx'
import styles from './HiringFunnelCard.module.css'

/** "Your hiring funnel": current candidates per stage; each row opens the hiring pipeline. */
export default function HiringFunnelCard() {
  const max = Math.max(...FUNNEL_STAGES.map((item) => item.count), 1)
  return (
    <section className={styles.card} aria-labelledby="funnel-title">
      <SectionHeading id="funnel-title" title="Your hiring funnel" description="Current candidates, by stage" />
      <ul className={styles.list}>
        {FUNNEL_STAGES.map(({ stage, count }) => (
          <li key={stage}>
            <Link to="/recruiter/hiring-pipeline" className={styles.row} aria-label={`${stage}: ${count} candidates`}>
              <span className={styles.stage}>{stage}</span>
              <span className={styles.track}>
                <span className={styles.fill} style={{ width: `${(count / max) * 100}%` }} />
              </span>
              <span className={styles.count}>{count}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/recruiter/hiring-pipeline" className={styles.link}>
        Open hiring pipeline
        <Icon as={ArrowRight} size={12} />
      </Link>
    </section>
  )
}
