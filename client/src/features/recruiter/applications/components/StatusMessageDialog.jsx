import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from '@/components/ui'
import AiDraftButton from '@/features/ai/components/AiDraftButton.jsx'
import MessageForm from '@/features/messages/components/MessageForm.jsx'
import { useMessageApplicantMutation } from '../api.js'
import styles from './ApplicationStageSelect.module.css'

const FORM_ID = 'status-message-form'

/**
 * "Send an update" (owner 2026-11-17): a message to the applicant about where their application stands, typed or
 * drafted by AI from the current stage, sent in the company's thread with them about the job.
 */
export default function StatusMessageDialog({ application, candidateName, jobTitle, onClose }) {
  const { t } = useTranslation('applications')
  const [draft, setDraft] = useState(null)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [messageApplicant] = useMessageApplicantMutation()
  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title={t('statusMessage.title', { name: candidateName })}
      description={jobTitle && t('statusMessage.description', { job: jobTitle })}
      footer={
        sent ? (
          <Button onClick={onClose}>{t('statusMessage.done')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" form={FORM_ID} loading={sending}>
              {t('statusMessage.send')}
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <p className={styles.sent} role="status" data-status-message-sent>
          {t('statusMessage.sent', { name: candidateName })}
        </p>
      ) : (
        <div className={styles.message} data-status-message>
          <AiDraftButton request={{ purpose: 'status_update', applicationId: application.id }} onDraft={(text) => setDraft({ text })} />
          <MessageForm
            formId={FORM_ID}
            rows={6}
            autoFocus
            draft={draft}
            placeholder={t('statusMessage.placeholder')}
            onPendingChange={setSending}
            onSubmit={async (body) => {
              await messageApplicant({ id: application.id, body }).unwrap()
              setSent(true)
            }}
          />
        </div>
      )}
    </Modal>
  )
}
