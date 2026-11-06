import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from '@/components/ui'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { useMoveApplicationMutation } from '@/features/recruiter/applications/api.js'
import { usePreferences } from '@/lib/preferences.js'
import { useCancelInterviewMutation } from './api.js'
import OfferDialog from './components/OfferDialog.jsx'

/**
 * Stage moves that keep the pipeline and interviews consistent (owner answer P11d-A6), shared by every stage select
 * and the board's and funnel's drag and drop:
 * - moving a card out of an Interview stage while its interview is still under way asks "Cancel the interview too?";
 * - moving a card into an Interview stage with no interview under way opens the schedule dialog (Recruiter Plus;
 *   Cancel skips it, the move stays).
 * `request(application, stageId, stages)` moves; `element` renders the dialogs.
 */
export function useInterviewMove() {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const [move] = useMoveApplicationMutation()
  const [cancel, { isLoading: cancelling }] = useCancelInterviewMutation()
  const [prompt, setPrompt] = useState(null)
  const canSchedule = !lacksEntitlement(me, 'interviews', ['recruiter'])

  async function moveTo(application, stageId, to) {
    await move({ id: application.id, stageId }).unwrap()
    if (to === 'interview' && !application.interview?.active && canSchedule) setPrompt({ kind: 'schedule', application })
    else setPrompt(null)
  }

  function request(application, stageId, stages) {
    const from = application.stage?.category
    const to = stages.find((stage) => stage.id === stageId)?.category
    if (from === 'interview' && to !== 'interview' && application.interview?.active) return setPrompt({ kind: 'leave', application, stageId, to })
    if (from === 'interview' && to === 'interview') return moveTo(application, stageId, null)
    return moveTo(application, stageId, to)
  }

  let element = null
  if (prompt?.kind === 'schedule') element = <OfferDialog applicationId={prompt.application.id} onClose={() => setPrompt(null)} />
  if (prompt?.kind === 'leave') {
    const { application, stageId, to } = prompt
    element = (
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
  return { request, element }
}
