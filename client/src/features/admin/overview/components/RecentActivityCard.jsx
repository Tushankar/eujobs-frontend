import { Link } from 'react-router-dom'
import { CircleCheck, ShieldCheck } from 'lucide-react'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Icon, Panel } from '@/components/ui'
import styles from './RecentActivityCard.module.css'

/** "Recent platform activity": latest events with a link to the audit log, plus the human-oversight note. */
export default function RecentActivityCard({ items }) {
  return (
    <Panel padding={24} aria-labelledby="recent-activity-title">
      <SectionTitle id="recent-activity-title" title="Recent platform activity">
        <Link to="/admin/audit-logs" className={styles.link}>
          View audit log
        </Link>
      </SectionTitle>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <Icon as={CircleCheck} size={15} className={styles.itemIcon} />
            {item.text}
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        <Icon as={ShieldCheck} size={15} className={styles.noteIcon} />
        AI assists with evidence. People make decisions. Your marketplace controls reflect that principle.
      </p>
    </Panel>
  )
}
