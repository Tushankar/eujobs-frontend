import { HIRING_ROLES } from '@/app/roles.js'
import { useDispatch } from 'react-redux'
import { celebrate } from '@/app/celebrate.js'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { useMoveApplicationMutation } from '@/features/recruiter/applications/api.js'
import { usePreferences } from '@/lib/preferences.js'

/*
 * Stage moves that keep the pipeline and interviews consistent (owner answer P11d-A6), shared by every stage select
 * and the board's and funnel's drag and drop:
 * - moving a card out of an Interview stage while its interview is still under way asks "Cancel the interview too?";
 * - moving a card into an Interview stage with no interview under way opens the schedule dialog (Recruiter Plus;
 *   Cancel skips it, the move stays).
 * The prompt is kept in one shared store and shown by <InterviewMovePrompts /> in the workspace shell, because the row
 * that asked usually leaves its list (another column, another funnel stage) as soon as the move lands.
 */
let prompt = null
/** The prompt now (null, { kind: 'schedule', application } or { kind: 'leave', application, stageId, to }). */
export const currentPrompt = () => prompt
const listeners = new Set()
export const setPrompt = (next) => {
  prompt = next
  for (const listener of listeners) listener()
}
export const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Moves an application and, when it enters an Interview stage with nothing under way, opens the schedule dialog; when
 * it enters a Hired stage, the recruiter's "Great hire!" success modal (2026-11-17). `candidateName` is for rows
 * without the candidate (the profile's application list).
 */
export function useMoveTo() {
  const { me } = usePreferences()
  const dispatch = useDispatch()
  const [move] = useMoveApplicationMutation()
  const canSchedule = !lacksEntitlement(me, 'interviews', HIRING_ROLES)
  return async (application, stageId, to, candidateName) => {
    await move({ id: application.id, stageId }).unwrap()
    setPrompt(to === 'interview' && !application.interview?.active && canSchedule ? { kind: 'schedule', application } : null)
    if (to === 'hired' && application.stage?.category !== 'hired') {
      const name = application.candidate?.fullName ?? candidateName
      dispatch(celebrate({ kind: 'candidate_hired', params: { name, job: application.job?.title ?? '', jobId: application.job?.id ?? application.jobId } }))
    }
  }
}

/** The browser checks turn the note step off for older scenarios (e2e/lib/browser.js); real users never set this. */
function moveNotesOff() {
  try {
    return localStorage.getItem('eujobs.e2e.moveNotes') === 'off'
  } catch {
    return false
  }
}

/** The move after the note step: the interview prompts (leave / schedule), else the move itself. */
export function useContinueMove() {
  const moveTo = useMoveTo()
  return (application, stageId, stages, candidateName) => {
    const from = application.stage?.category ?? stages.find((stage) => stage.id === application.stageId)?.category
    const to = stages.find((stage) => stage.id === stageId)?.category
    if (from === 'interview' && to !== 'interview' && application.interview?.active) return setPrompt({ kind: 'leave', application, stageId, to })
    return moveTo(application, stageId, from === 'interview' && to === 'interview' ? null : to, candidateName)
  }
}

/**
 * `request(application, stageId, stages, candidateName?, candidateId?)`: the interview-aware stage move. 2026-11-23
 * (owner: "before moving, show notes"): it first opens the note step (the candidate's notes and an optional note),
 * whose Move runs the rest. A move to the stage the card is already in does nothing.
 */
export function useInterviewMove() {
  const continueMove = useContinueMove()
  function request(application, stageId, stages, candidateName, candidateId) {
    const current = application.stage?.id ?? application.stageId
    if (stageId === current && application.status !== 'not_selected') return undefined
    if (moveNotesOff()) return continueMove(application, stageId, stages, candidateName)
    return setPrompt({ kind: 'note', application, stageId, stages, candidateName, candidateId: candidateId ?? application.candidate?.id ?? application.candidateId })
  }
  return { request }
}
