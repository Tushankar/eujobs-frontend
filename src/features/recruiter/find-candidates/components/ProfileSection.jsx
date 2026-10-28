import { Panel } from '@/components/ui'
import styles from './ProfileSection.module.css'

/** White content card under the profile tabs (28px padding). Pages put `SectionTitle`s and text inside it. */
export default function ProfileSection({ labelledBy, children }) {
  return (
    <Panel padding={28} className={styles.section} aria-labelledby={labelledBy}>
      {children}
    </Panel>
  )
}
