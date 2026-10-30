import { Panel } from '@/components/ui'
import styles from './SettingsCard.module.css'

/** The 768px white card each settings tab renders: Manrope title, optional lead line, then the body. */
export default function SettingsCard({ title, description, children }) {
  return (
    <Panel padding={28} className={styles.card}>
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </Panel>
  )
}
