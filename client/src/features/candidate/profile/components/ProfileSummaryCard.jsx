import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Sparkles } from 'lucide-react'
import aiSparkle from '@/assets/icons/ai-sparkle-blue-16.svg'
import { Button, Icon, Modal, Panel } from '@/components/ui'
import { useWriteProfileSummaryMutation } from '@/features/ai/api.js'
import AiButton from '@/features/ai/components/AiButton.jsx'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import PlanChip from '@/features/candidate/billing/components/PlanChip.jsx'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { usePreferences } from '@/lib/preferences.js'
import styles from './ProfileSummaryCard.module.css'

const POINTS = ['facts', 'language', 'reuse']
const COVERS = ['role', 'experience', 'skills', 'preferences']

/**
 * M-062 (back after P3-Q3): the "Ai Job Summary" card on My profile. It says what the summary is, then OpenAI writes a
 * recruiter-ready summary from the profile and the live CV in the candidate's language, which can be copied. Free
 * candidates see the Plus crown and a locked button that opens the upgrade dialog (M-118).
 */
export default function ProfileSummaryCard() {
  const { t } = useTranslation('ai')
  const { me } = usePreferences()
  const [open, setOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const [write, state] = useWriteProfileSummaryMutation()
  const request = () => write().catch(() => {})
  const locked = lacksEntitlement(me, 'ai')

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
      <Panel padding={24} className={styles.card} aria-labelledby="profile-summary-title">
        <div className={styles.head}>
          <h2 id="profile-summary-title" className={styles.title}>
            <img src={aiSparkle} alt="" width={16} height={16} />
            {t('profileSummary.title')}
          </h2>
          {locked && <PlanChip />}
        </div>
        <p className={styles.lead}>{t('profileSummary.cardLead')}</p>
        <ul className={styles.covers} aria-label={t('profileSummary.coversLabel')}>
          {COVERS.map((key) => (
            <li key={key}>{t(`profileSummary.covers.${key}`)}</li>
          ))}
        </ul>
        <ul className={styles.points}>
          {POINTS.map((key) => (
            <li key={key}>
              <Icon as={Check} size={15} strokeWidth={2.2} className={styles.check} />
              <span>{t(`profileSummary.points.${key}`)}</span>
            </li>
          ))}
        </ul>
        <AiButton fullWidth leftIcon={<Icon as={Sparkles} size={15} />} onClick={handleOpen} data-profile-summary-button>
          {t(state.data ? 'profileSummary.view' : 'profileSummary.write')}
        </AiButton>
      </Panel>
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
