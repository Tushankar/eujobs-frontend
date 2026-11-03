import { api } from '@/app/api.js'

/* Admin > Audit logs (M-162, M-163, M-206): admin, user and system events, newest first, server-paginated. */
export const auditApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAuditEvents: build.query({ query: (params) => ({ url: '/admin/audit-events', params }), providesTags: ['AuditEvents'] }),
  }),
})

export const { useGetAuditEventsQuery } = auditApi
