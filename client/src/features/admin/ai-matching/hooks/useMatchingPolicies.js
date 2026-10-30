import { useCallback } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { DEFAULT_POLICY } from '../data/matching.js'

const INITIAL = { policies: [DEFAULT_POLICY], activeId: DEFAULT_POLICY.id }

/** Matching policies and which one is active, persisted on this device. */
export function useMatchingPolicies() {
  const [state, setState] = useLocalStorage('lwm.admin.matching-policies', INITIAL)
  const policies = Array.isArray(state?.policies) && state.policies.length > 0 ? state.policies : INITIAL.policies
  const activeId = state?.activeId ?? INITIAL.activeId

  /** Adds a draft with every approved signal on and returns its id. */
  const addPolicy = useCallback(
    ({ name, description }) => {
      const policy = {
        id: `policy-${Date.now()}`,
        name,
        description,
        updatedAt: new Date().toISOString(),
        signals: { ...DEFAULT_POLICY.signals },
      }
      setState((previous) => ({ activeId: previous?.activeId ?? INITIAL.activeId, policies: [...(previous?.policies ?? INITIAL.policies), policy] }))
      return policy.id
    },
    [setState],
  )

  const saveSignals = useCallback(
    (id, signals) =>
      setState((previous) => ({
        ...previous,
        policies: previous.policies.map((policy) =>
          policy.id === id ? { ...policy, signals, updatedAt: new Date().toISOString() } : policy,
        ),
      })),
    [setState],
  )

  const activate = useCallback((id) => setState((previous) => ({ ...previous, activeId: id })), [setState])

  return { policies, activeId, addPolicy, saveSignals, activate }
}
