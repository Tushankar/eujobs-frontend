import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { Icon, Panel } from '@/components/ui'
import styles from './MarketplaceHealthCard.module.css'

/** "Marketplace health": a short list of counters with a link into the moderation queue. `items` = [{ key, label, value }]. */
export default function MarketplaceHealthCard({ items }) {
  return (
    <Panel padding={24} aria-labelledby="marketplace-health-title">
      <SectionTitle id="marketplace-health-title" title="Marketplace health" description="Human oversight at every step" />
      <dl className={styles.rows}>
        {items.map((item) => (
          <div key={item.key} className={styles.row}>
            <dt className={styles.label}>{item.label}</dt>
            <dd className={styles.value}>{item.value}</dd>
          </div>
        ))}
      </dl>
      <Link to="/admin/moderation" className={styles.link}>
        Review moderation queue
        <Icon as={ArrowRight} size={12} />
      </Link>
    </Panel>
  )
}
