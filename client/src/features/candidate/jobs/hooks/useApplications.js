import { useCallback } from 'react'
import { useSharedLocalStorage } from '@/hooks/useSharedLocalStorage.js'
import { SEED_APPLICATIONS } from '../data/applications.js'

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** The candidate's applications (newest first), persisted on this device and shared across pages. */
export function useApplications() {
  const [applications, setApplications] = useSharedLocalStorage('lwm.candidate.applications', SEED_APPLICATIONS)

  const applyTo = useCallback(
    (jobId) =>
      setApplications((current) => {
        const existing = current.find((item) => item.jobId === jobId)
        if (existing && existing.status !== 'withdrawn') return current
        const rest = current.filter((item) => item.jobId !== jobId)
        return [{ id: `app-${jobId}`, jobId, status: 'applied', appliedAt: todayIso() }, ...rest]
      }),
    [setApplications],
  )

  const withdraw = useCallback(
    (applicationId) =>
      setApplications((current) => current.map((item) => (item.id === applicationId ? { ...item, status: 'withdrawn' } : item))),
    [setApplications],
  )

  const activeCount = applications.filter((item) => item.status !== 'withdrawn').length

  return {
    applications,
    activeCount,
    hasApplied: (jobId) => applications.some((item) => item.jobId === jobId && item.status !== 'withdrawn'),
    applyTo,
    withdraw,
  }
}

/** Sidebar badge text for the Applications nav item. */
export function useActiveApplicationsBadge() {
  return String(useApplications().activeCount)
}
