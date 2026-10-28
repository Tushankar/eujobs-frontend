import { useCallback, useMemo } from 'react'
import { useSharedLocalStorage } from '@/hooks/useSharedLocalStorage.js'
import { SEED_AUDIT_EVENTS } from '../data/auditEvents.js'

const STORAGE_KEY = 'lwm.admin.audit-log'
const NO_EVENTS = []

/**
 * Local audit log: events recorded on this device (persisted) merged with the sample events, newest first.
 * `record({ title, category, detail })` is what other admin features call when an admin changes something.
 */
export function useAuditLog() {
  const [recorded, setRecorded] = useSharedLocalStorage(STORAGE_KEY, NO_EVENTS)

  const record = useCallback(
    (event) =>
      setRecorded((previous) => [
        {
          id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          at: new Date().toISOString(),
          actor: 'Workspace admin',
          ...event,
        },
        ...previous,
      ]),
    [setRecorded],
  )

  const events = useMemo(
    () => [...recorded, ...SEED_AUDIT_EVENTS].sort((a, b) => new Date(b.at) - new Date(a.at)),
    [recorded],
  )

  return { events, record }
}
