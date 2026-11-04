import { CompanyLogo } from '@/components/ui'
import styles from './CompanyCell.module.css'

/** A table cell for a company: its logo (or letter tile), then the display name. */
export default function CompanyCell({ name, id, logoUrl }) {
  if (!name) return <span className={styles.name}>—</span>
  return (
    <span className={styles.cell}>
      <CompanyLogo name={name} id={id} src={logoUrl ?? undefined} size={24} />
      <span className={styles.name}>{name}</span>
    </span>
  )
}
