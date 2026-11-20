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

/** `request(application, stageId, stages, candidateName?)`: the interview-aware stage move. */
export function useInterviewMove() {
  const moveTo = useMoveTo()
  function request(application, stageId, stages, candidateName) {
    const from = application.stage?.category
    const to = stages.find((stage) => stage.id === stageId)?.category
    if (from === 'interview' && to !== 'interview' && application.interview?.active) return setPrompt({ kind: 'leave', application, stageId, to })
    return moveTo(application, stageId, from === 'interview' && to === 'interview' ? null : to, candidateName)
  }
  return { request }
}
