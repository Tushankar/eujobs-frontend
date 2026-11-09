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

/** Moves an application and, when it enters an Interview stage with nothing under way, opens the schedule dialog. */
export function useMoveTo() {
  const { me } = usePreferences()
  const [move] = useMoveApplicationMutation()
  const canSchedule = !lacksEntitlement(me, 'interviews', ['recruiter'])
  return async (application, stageId, to) => {
    await move({ id: application.id, stageId }).unwrap()
    setPrompt(to === 'interview' && !application.interview?.active && canSchedule ? { kind: 'schedule', application } : null)
  }
}

/** `request(application, stageId, stages)`: the interview-aware stage move. */
export function useInterviewMove() {
  const moveTo = useMoveTo()
  function request(application, stageId, stages) {
    const from = application.stage?.category
    const to = stages.find((stage) => stage.id === stageId)?.category
    if (from === 'interview' && to !== 'interview' && application.interview?.active) return setPrompt({ kind: 'leave', application, stageId, to })
    return moveTo(application, stageId, from === 'interview' && to === 'interview' ? null : to)
  }
  return { request }
}
