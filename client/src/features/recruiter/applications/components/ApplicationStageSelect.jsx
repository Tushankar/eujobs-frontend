import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquareText } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Checkbox, IconButton, TextareaField } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import AiDraftButton from '@/features/ai/components/AiDraftButton.jsx'
import { useCancelInterviewMutation } from '@/features/interviews/api.js'
import { useInterviewMove } from '@/features/interviews/useInterviewMove.js'
import StageSelect from '@/features/recruiter/hiring-pipeline/components/StageSelect.jsx'
import { usePreferences } from '@/lib/preferences.js'
import { useMessageApplicantMutation, useRejectApplicationMutation } from '../api.js'
import StatusMessageDialog from './StatusMessageDialog.jsx'
import styles from './ApplicationStageSelect.module.css'

const NOT_SELECTED = 'not_selected'

/**
 * One stage select per application (M-071): the company's stages plus "Not selected", which asks first and offers
 * "Email the candidate" (M-090, checked by default). Choosing a stage again undoes a rejection (OQ-6e). A withdrawn
 * application has no select (M-076). With messaging (2026-11-17): the reject can carry a personal message (typed or
 * drafted by AI), and "Send an update" beside the select messages the applicant about their current stage.
 */
export default function ApplicationStageSelect({ application, candidateName, jobTitle, stages, variant, label }) {
  const { t } = useTranslation()
  const [reject] = useRejectApplicationMutation()
  const [cancelInterview] = useCancelInterviewMutation()
  // P11d-A6: moves into or out of an Interview stage keep the interview consistent.
  const interviewMove = useInterviewMove()
  const [rejecting, setRejecting] = useState(false)
  const [notify, setNotify] = useState(true)
  const [alsoCancel, setAlsoCancel] = useState(true)
  const [message, setMessage] = useState('')
  const [updating, setUpdating] = useState(false)
  const [messageApplicant] = useMessageApplicantMutation()
  const { me } = usePreferences()
  const { data: config } = useGetConfigQuery()
  // Recruiters may always message their applicants (message_send gates candidates only).
  const canMessage = me?.role === 'recruiter'
  const activeInterview = application.interview?.active ? application.interview : null

  if (application.status === 'withdrawn') return <PillBadge tone="neutral">{t('applications:recruiter.withdrawn')}</PillBadge>

  // Table and board rows carry `stage`, the profile's application list `stageId`.
  const value = application.status === NOT_SELECTED ? NOT_SELECTED : (application.stageId ?? application.stage.id)
  const options = [...stages.map((stage) => ({ id: stage.id, name: stage.name })), { id: NOT_SELECTED, name: t('applications:recruiter.notSelected') }]

  return (
    <>
      <span data-stage-select={application.id} className={canMessage ? styles.withUpdate : undefined}>
        <StageSelect
          variant={variant}
          options={options}
          value={value}
          label={label}
          onChange={(next) => {
            if (next === NOT_SELECTED) {
              setNotify(true)
              setAlsoCancel(true)
              setMessage('')
              setRejecting(true)
            } else interviewMove.request(application, next, stages)
          }}
        />
        {canMessage && (
          <IconButton icon={MessageSquareText} label={t('applications:statusMessage.open', { name: candidateName ?? '' })} onClick={() => setUpdating(true)} data-status-update={application.id} />
        )}
      </span>
      {updating && <StatusMessageDialog application={application} candidateName={candidateName} jobTitle={jobTitle} onClose={() => setUpdating(false)} />}
      <ConfirmDialog
        open={rejecting}
        title={t('applications:reject.title')}
        description={t('applications:reject.description', { name: candidateName, job: jobTitle })}
        confirmLabel={t('applications:reject.confirm')}
        tone="danger"
        onClose={() => setRejecting(false)}
        onConfirm={async () => {
          setRejecting(false)
          if (activeInterview && alsoCancel) await cancelInterview({ id: activeInterview.id })
          await reject({ id: application.id, notify })
          if (message.trim()) await messageApplicant({ id: application.id, body: message.trim() })
        }}
      >
        <Checkbox name="notify" checked={notify} onChange={(event) => setNotify(event.target.checked)}>
          {t('applications:reject.notify')}
        </Checkbox>
        <p className={styles.hint}>{t('applications:reject.notifyHint')}</p>
        {canMessage && (
          <div className={styles.message} data-reject-message>
            <TextareaField
              label={t('applications:reject.message')}
              hint={t('applications:reject.messageHint')}
              name="rejectMessage"
              rows={4}
              maxLength={config?.limits.message.body.max}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <AiDraftButton request={{ purpose: 'status_update', applicationId: application.id, rejected: true }} onDraft={setMessage} />
          </div>
        )}
        {activeInterview && (
          <Checkbox name="cancelInterview" checked={alsoCancel} onChange={(event) => setAlsoCancel(event.target.checked)}>
            {t('interviews:move.alsoCancel')}
          </Checkbox>
        )}
      </ConfirmDialog>
    </>
  )
}
