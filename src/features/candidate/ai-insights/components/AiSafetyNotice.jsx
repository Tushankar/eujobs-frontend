import { ShieldCheck } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import styles from './AiSafetyNotice.module.css'

/** Closing notice shown on every AI insights page: what the preview does and does not do. */
export default function AiSafetyNotice() {
  return (
    <Panel className={styles.notice} padding="16px 20px">
      <span className={styles.icon}>
        <Icon as={ShieldCheck} size={17} strokeWidth={2} />
      </span>
      <p className={styles.text}>
        AI-assisted design, human-led decisions. This preview compares reviewed profile fields with listed job requirements.
        Semantic AI, verification, and predictive confidence are not connected. Your information stays on this device.
      </p>
    </Panel>
  )
}
