import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Icon } from '@/components/ui'
import styles from './HelpLinkCard.module.css'

/** Resource card under the FAQ: blue glyph, label, arrow; the whole card is the link. */
export default function HelpLinkCard({ icon, label, to }) {
  return (
    <Link to={to} className={styles.card}>
      <span className={styles.content}>
        <Icon as={icon} size={19} strokeWidth={2} className={styles.glyph} />
        {label}
      </span>
      <Icon as={ArrowRight} size={14} strokeWidth={2} />
    </Link>
  )
}
