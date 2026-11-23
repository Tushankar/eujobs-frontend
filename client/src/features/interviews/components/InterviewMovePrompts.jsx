import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from '@/components/ui'
import { useCancelInterviewMutation } from '../api.js'
import MoveNoteDialog from '@/features/recruiter/hiring-pipeline/components/MoveNoteDialog.jsx'
import { currentPrompt, setPrompt, subscribe, useContinueMove, useMoveTo } from '../useInterviewMove.js'
import OfferDialog from './OfferDialog.jsx'

/** The move prompts, mounted once in the workspace shell. */
export default function InterviewMovePrompts() {
  const { t } = useTranslation()
  const current = useSyncExternalStore(subscribe, currentPrompt)
  const moveTo = useMoveTo()
  const continueMove = useContinueMove()
  const [cancel, { isLoading: cancelling }] = useCancelInterviewMutation()
  // 2026-11-23: the note step before every stage move; Move runs the rest (an interview prompt may follow).
  if (current?.kind === 'note') {
    const { application, stageId, stages, candidateName, candidateId } = current
    const stageName = (id) => stages.find((stage) => stage.id === id)?.name ?? ''
    return (
      <MoveNoteDialog
        key={`${application.id}-${stageId}`}
        candidateId={candidateId}
        candidateName={application.candidate?.fullName ?? candidateName}
        jobTitle={application.job?.title}
        fromName={application.status === 'not_selected' ? t('applications:recruiter.notSelected') : (application.stage?.name ?? stageName(application.stageId))}
        toName={stageName(stageId)}
        applicationId={application.id}
        onMove={() => continueMove(application, stageId, stages, candidateName)}
        onClose={() => setPrompt(null)}
      />
    )
  }
  if (current?.kind === 'schedule') return <OfferDialog applicationId={current.application.id} onClose={() => setPrompt(null)} />
  if (current?.kind !== 'leave') return null
  const { application, stageId, to } = current
  return (
    <Modal
      open
      onClose={() => setPrompt(null)}
      title={t('interviews:move.title')}
      description={t('interviews:move.description', { name: application.candidate?.fullName ?? '' })}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={() => moveTo(application, stageId, to)} data-move-keep>
            {t('interviews:move.keep')}
          </Button>
          <Button
            variant="danger"
            loading={cancelling}
            onClick={async () => {
              await cancel({ id: application.interview.id }).unwrap()
              await moveTo(application, stageId, to)
            }}
            data-move-cancel
          >
            {t('interviews:move.cancel')}
          </Button>
        </>
      }
    >
      <p>{t('interviews:move.text')}</p>
    </Modal>
  )
}
