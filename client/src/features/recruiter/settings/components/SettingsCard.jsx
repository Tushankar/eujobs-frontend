import { Panel } from '@/components/ui'
import styles from './SettingsCard.module.css'

/** White settings card with its Manrope section title; children are the card body. */
export default function SettingsCard({ title, children }) {
  return (
    <Panel padding={28}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </Panel>
  )
}
