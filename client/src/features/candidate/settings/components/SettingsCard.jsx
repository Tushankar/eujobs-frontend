import { Panel } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './SettingsCard.module.css'

/** The 768px white card each settings tab renders: Manrope title, optional lead line, then the body. `wide` spans the full width (Billing). */
export default function SettingsCard({ title, description, wide = false, children }) {
  return (
    <Panel padding={28} className={cx(styles.card, wide && styles.wide)}>
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </Panel>
  )
}
