import { useEffect, useRef } from 'react'
import { api } from '@/app/api.js'
import { useCounters } from '@/app/counters.js'

/*
 * In-app notifications (Phase 11b): the list (bell and page), opening one, mark all read, and "seen" when an item is
 * opened from its own page (P11b-Q10). The unread numbers come with the 15 s counters poll (P11b-Q2).
 */
const CHANGES = ['Notifications', 'Counters']

export const notificationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.query({ query: (params) => ({ url: '/notifications', params }), providesTags: ['Notifications'] }),
    openNotification: build.mutation({ query: (id) => ({ url: `/notifications/${id}/open`, method: 'POST' }), invalidatesTags: CHANGES }),
    readAllNotifications: build.mutation({ query: () => ({ url: '/notifications/read-all', method: 'POST' }), invalidatesTags: CHANGES }),
    markSeen: build.mutation({ query: (body) => ({ url: '/notifications/seen', method: 'POST', body }), invalidatesTags: CHANGES }),
  }),
})

export const { useGetNotificationsQuery, useOpenNotificationMutation, useReadAllNotificationsMutation } = notificationsApi

/** The unread total and the per-section counts of the counters poll. */
export function useNotificationCounts() {
  return useCounters()?.notifications ?? { unread: 0, sections: {} }
}

/** A sidebar item's count of unread notifications (P11b-Q10), as badge text; none at 0. */
export function useSectionBadge(section) {
  const count = useNotificationCounts().sections[section]
  return count ? String(count) : null
}

/**
 * The page of `kind` + `id` opened: its unread notifications become read (P11b-Q10). Decided once, when the item opens
 * and the counters are known (sent only if something is unread); a notification that arrives while the page stays
 * open remains unread until the item is opened again.
 */
export function useMarkSeen(kind, id) {
  const counts = useCounters()?.notifications
  const [markSeen] = notificationsApi.useMarkSeenMutation()
  const decided = useRef(null)
  const key = id ? `${kind}:${id}` : null
  useEffect(() => {
    if (!key || !counts || decided.current === key) return
    decided.current = key
    if (counts.unread) markSeen({ kind, id: String(id) })
  }, [key, kind, id, counts, markSeen])
}
