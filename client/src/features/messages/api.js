import { useDispatch } from 'react-redux'
import { api } from '@/app/api.js'
import { useCounters } from '@/app/counters.js'
import { openUpgrade } from '@/app/upgrade.js'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { usePageVisible } from '@/hooks/usePageVisible.js'
import { usePreferences } from '@/lib/preferences.js'

/*
 * Messages for candidates and recruiters (§3.5): the inbox, one thread per company and candidate (M-086), starting,
 * replying and read marking. Open lists and threads poll about every 15 s, paused in hidden tabs (M-094).
 */
const POLL_MS = 15_000

export const messagesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getConversations: build.query({ query: () => '/conversations', providesTags: ['Conversations'] }),
    getThread: build.query({ query: (id) => `/conversations/${id}/messages`, providesTags: ['Conversations'] }),
    startConversation: build.mutation({ query: (body) => ({ url: '/conversations', method: 'POST', body }), invalidatesTags: ['Conversations', 'CandidateActivity'] }),
    sendMessage: build.mutation({ query: ({ id, body }) => ({ url: `/conversations/${id}/messages`, method: 'POST', body: { body } }), invalidatesTags: ['Conversations', 'CandidateActivity'] }),
    markRead: build.mutation({ query: (id) => ({ url: `/conversations/${id}/read`, method: 'POST' }), invalidatesTags: ['Conversations', 'Counters'] }),
  }),
})

export const { useStartConversationMutation, useSendMessageMutation, useMarkReadMutation } = messagesApi

export function useConversations() {
  const visible = usePageVisible()
  return messagesApi.useGetConversationsQuery(undefined, { pollingInterval: visible ? POLL_MS : 0 })
}

export function useThread(id) {
  const visible = usePageVisible()
  return messagesApi.useGetThreadQuery(id, { pollingInterval: visible ? POLL_MS : 0 })
}

/** The Messages sidebar badge: unread messages, hidden at 0 (M-094). */
export function useUnreadMessagesBadge() {
  const count = useCounters()?.unreadMessages
  return count ? String(count) : null
}

/** M-118: a candidate without `message_send` gets the upgrade dialog instead of the start dialog. */
export function useCompanyMessageStart() {
  const dispatch = useDispatch()
  const { me } = usePreferences()
  return (openDialog) => (lacksEntitlement(me, 'message_send') ? dispatch(openUpgrade('message_send')) : openDialog())
}
