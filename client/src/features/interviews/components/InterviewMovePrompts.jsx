import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from '@/components/ui'
import { useCancelInterviewMutation } from '../api.js'
import { currentPrompt, setPrompt, subscribe, useMoveTo } from '../useInterviewMove.js'
import OfferDialog from './OfferDialog.jsx'

/** The move prompts, mounted once in the workspace shell. */
export default function InterviewMovePrompts() {
  const { t } = useTranslation()
  const current = useSyncExternalStore(subscribe, currentPrompt)
  const moveTo = useMoveTo()
  const [cancel, { isLoading: cancelling }] = useCancelInterviewMutation()
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
