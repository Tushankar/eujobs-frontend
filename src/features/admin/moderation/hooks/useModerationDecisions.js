import { useCallback } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'

/**
 * Moderation decisions, persisted on this device as { [queueKey]: { status, reason, decidedAt } }.
 * Items with no entry are still pending review. Keys look like "content:<id>" or "account:<id>".
 */
export function useModerationDecisions() {
  const [decisions, setDecisions] = useLocalStorage('lwm.admin.moderation', {})

  const decide = useCallback(
    (key, status, reason) =>
      setDecisions((previous) => ({
        ...previous,
        [key]: { status, reason, decidedAt: new Date().toISOString() },
      })),
    [setDecisions],
  )


  return { decisions, decide }
}
