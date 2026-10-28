import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { getCandidate } from '@/features/recruiter/find-candidates/data/candidates.js'
import {
  APPLICANTS,
  INITIAL_PIPELINE,
  MAX_STAGE_NAME_LENGTH,
  PIPELINE_STORAGE_KEY,
  REJECTED,
} from '../data/pipeline.js'

/** Validates a stage name against the other stages; returns an error message or null. */
function stageNameError(name, stages, ignoreId) {
  if (!name) return 'Enter a stage name.'
  if (name.length > MAX_STAGE_NAME_LENGTH) return `Stage names can be up to ${MAX_STAGE_NAME_LENGTH} characters.`
  const taken = stages.some((stage) => stage.id !== ignoreId && stage.name.toLowerCase() === name.toLowerCase())
  return taken ? `A stage called “${name}” already exists.` : null
}

/**
 * Hiring pipeline state shared by Applications and the Hiring pipeline board, persisted on this device:
 * the ordered stages and where each applicant sits (a stage id, or REJECTED).
 * The stage-editing helpers return an error message (or null on success) so the dialog can show it.
 */
export function usePipeline() {
  const [{ stages, placements }, setPipeline] = useLocalStorage(PIPELINE_STORAGE_KEY, INITIAL_PIPELINE)

  const applicants = APPLICANTS.map(({ id, alignedSkills }) => ({
    ...getCandidate(id),
    alignedSkills,
    stageId: placements[id] ?? stages[0].id,
  }))

  const countIn = (stageId) => applicants.filter((applicant) => applicant.stageId === stageId).length

  function moveTo(applicantId, stageId) {
    setPipeline((current) => ({ ...current, placements: { ...current.placements, [applicantId]: stageId } }))
  }

  function addStage(rawName) {
    const name = rawName.trim()
    const error = stageNameError(name, stages)
    if (error) return error
    setPipeline((current) => ({
      ...current,
      stages: [...current.stages, { id: `stage-${Date.now().toString(36)}`, name, tone: 'primary' }],
    }))
    return null
  }

  function renameStage(stageId, rawName) {
    const name = rawName.trim()
    const error = stageNameError(name, stages, stageId)
    if (error) return error
    setPipeline((current) => ({
      ...current,
      stages: current.stages.map((stage) => (stage.id === stageId ? { ...stage, name } : stage)),
    }))
    return null
  }

  function moveStage(stageId, direction) {
    setPipeline((current) => {
      const from = current.stages.findIndex((stage) => stage.id === stageId)
      const to = from + direction
      if (from < 0 || to < 0 || to >= current.stages.length) return current
      const next = [...current.stages]
      ;[next[from], next[to]] = [next[to], next[from]]
      return { ...current, stages: next }
    })
  }

  function removeStage(stageId) {
    const stage = stages.find((item) => item.id === stageId)
    if (stages.length <= 2) return 'A pipeline needs at least two stages.'
    const count = countIn(stageId)
    if (count > 0) {
      return `Move the ${count === 1 ? 'candidate' : `${count} candidates`} out of ${stage.name} before removing it.`
    }
    setPipeline((current) => ({ ...current, stages: current.stages.filter((item) => item.id !== stageId) }))
    return null
  }

  return {
    stages,
    applicants,
    openApplicants: applicants.filter((applicant) => applicant.stageId !== REJECTED),
    countIn,
    moveTo,
    addStage,
    renameStage,
    moveStage,
    removeStage,
  }
}
