import { useSearchParams } from 'react-router-dom'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { PROFILE, ROLES } from '../data/insights.js'

const PREFIX = 'lwm.ai-insights.'

function toggleIn(list, item) {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item]
}

/** Skills the candidate reviewed and confirmed from the skill-gap page. Saved on this device only. */
export function useAddedSkills() {
  const [added, setAdded] = useLocalStorage(`${PREFIX}added-skills`, [])
  return {
    added,
    skills: [...PROFILE.skills, ...added.filter((skill) => !PROFILE.skills.includes(skill))],
    add: (skill) => setAdded((previous) => (previous.includes(skill) ? previous : [...previous, skill])),
    undo: (skill) => setAdded((previous) => previous.filter((entry) => entry !== skill)),
  }
}

/** Skills the candidate chose to learn. Never added to the profile automatically. */
export function useLearningPlan() {
  const [plan, setPlan] = useLocalStorage(`${PREFIX}learning-plan`, [])
  return { plan, toggle: (skill) => setPlan((previous) => toggleIn(previous, skill)) }
}

export function useSavedRoles() {
  const [saved, setSaved] = useLocalStorage(`${PREFIX}saved-roles`, [])
  return { saved, toggle: (roleId) => setSaved((previous) => toggleIn(previous, roleId)) }
}

/** "Helpful" / "Needs review" notes per role: a local note, not a model training submission. */
export function useExplanationFeedback() {
  const [feedback, setFeedback] = useLocalStorage(`${PREFIX}explanation-feedback`, {})
  return {
    feedback,
    choose: (roleId, value) =>
      setFeedback((previous) => {
        const { [roleId]: current, ...rest } = previous
        return current === value ? rest : { ...rest, [roleId]: value }
      }),
  }
}

/** The role chosen in the "Compare with a role" picker lives in the URL (`?role=`) so links can target a role. */
export function useSelectedRole(defaultId) {
  const [params, setParams] = useSearchParams()
  const role = ROLES.find((entry) => entry.id === params.get('role')) ?? ROLES.find((entry) => entry.id === defaultId)
  return [role, (roleId) => setParams({ role: roleId }, { replace: true })]
}
