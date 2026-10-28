import { useCallback } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { SEED_ALERTS } from '../data/alerts.js'

/** Job alerts persisted on this device: create / update / pause-resume / delete. */
export function useJobAlerts() {
  const [alerts, setAlerts] = useLocalStorage('lwm.candidate.jobAlerts', SEED_ALERTS)

  const saveAlert = useCallback(
    (alert) =>
      setAlerts((current) =>
        current.some((item) => item.id === alert.id)
          ? current.map((item) => (item.id === alert.id ? { ...item, ...alert } : item))
          : [{ ...alert, active: true }, ...current],
      ),
    [setAlerts],
  )

  const toggleAlert = useCallback(
    (alertId) => setAlerts((current) => current.map((item) => (item.id === alertId ? { ...item, active: !item.active } : item))),
    [setAlerts],
  )

  const deleteAlert = useCallback((alertId) => setAlerts((current) => current.filter((item) => item.id !== alertId)), [setAlerts])

  return { alerts, saveAlert, toggleAlert, deleteAlert }
}
