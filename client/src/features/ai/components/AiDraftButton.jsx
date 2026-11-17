import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Icon } from '@/components/ui'
import { useDraftMessageMutation } from '../api.js'
import AiButton from './AiButton.jsx'
import AiStatus from './AiStatus.jsx'
import styles from './AiDraftButton.module.css'

/**
 * "Draft with AI" for a recruiter's message (owner 2026-11-17): `request` is the body of POST
 * /recruiter/ai/message-draft (first_message, status_update or reply); the draft goes to `onDraft(text)` for the
 * recruiter to edit before sending. Each click is one AI use and gives a new draft. Without Recruiter Plus the button
 * shows a lock and opens the upgrade dialog (AiButton).
 */
export default function AiDraftButton({ request, onDraft }) {
  const { t } = useTranslation('ai')
  const [draftMessage, state] = useDraftMessageMutation()

  async function run() {
    try {
      const { body } = await draftMessage(request).unwrap()
      onDraft(body)
    } catch {
      // AiStatus shows the failure.
    }
  }

  return (
    <div className={styles.draft}>
      <AiButton variant="outline" size="sm" leftIcon={<Icon as={Sparkles} size={13} />} loading={state.isLoading} onClick={run} data-ai-message-draft={request.purpose}>
        {t(state.isSuccess ? 'draft.again' : 'draft.action')}
      </AiButton>
      {state.error && <AiStatus isLoading={false} error={state.error} onRetry={run} />}
    </div>
  )
}
