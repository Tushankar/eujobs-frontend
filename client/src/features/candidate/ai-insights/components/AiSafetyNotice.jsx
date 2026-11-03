import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import styles from './AiSafetyNotice.module.css'

/** Closing notice of every AI insights page: what the scores and the AI texts are, and what they are not. */
export default function AiSafetyNotice() {
  const { t } = useTranslation('aiInsights')
  return (
    <Panel className={styles.notice} padding="16px 20px">
      <span className={styles.icon}>
        <Icon as={ShieldCheck} size={17} strokeWidth={2} />
      </span>
      <p className={styles.text}>{t('shell.notice')}</p>
    </Panel>
  )
}
