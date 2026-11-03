import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import aiSparkle from '@/assets/icons/ai-sparkle-blue-16.svg'
import { Button, Icon, Modal } from '@/components/ui'
import { useWriteProfileSummaryMutation } from '@/features/ai/api.js'
import AiButton from '@/features/ai/components/AiButton.jsx'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import styles from './ProfileSummaryButton.module.css'

/**
 * M-062 (back after P3-Q3): "Ai Job Summary" on My profile. OpenAI writes a recruiter-ready summary from the profile and
 * the live CV in the candidate's language; it can be copied. Free candidates see the lock (M-118).
 */
export default function ProfileSummaryButton({ className }) {
  const { t } = useTranslation('ai')
  const [open, setOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const [write, state] = useWriteProfileSummaryMutation()
  const request = () => write().catch(() => {})

  function handleOpen() {
    setOpen(true)
    setCopyStatus('')
    if (!state.data) request()
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(state.data.summary)
      setCopyStatus(t('profileSummary.copied'))
    } catch {
      setCopyStatus(t('profileSummary.copyFailed'))
    }
  }

  return (
    <>
      <AiButton variant="outline" className={className} leftIcon={<img src={aiSparkle} alt="" width={16} height={16} />} onClick={handleOpen} data-profile-summary-button>
        {t('profileSummary.action')}
      </AiButton>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        width={560}
        title={t('profileSummary.title')}
        description={t('profileSummary.lead')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('profileSummary.close')}
            </Button>
            <Button leftIcon={<Icon as={Copy} size={14} />} disabled={!state.data} onClick={handleCopy}>
              {t('profileSummary.copy')}
            </Button>
          </>
        }
      >
        <div className={styles.body} data-profile-summary>
          <AiStatus isLoading={state.isLoading} error={state.error} onRetry={request}>
            {state.data && <p className={styles.summary}>{state.data.summary}</p>}
          </AiStatus>
          {copyStatus && (
            <p className={styles.status} role="status">
              {copyStatus}
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
