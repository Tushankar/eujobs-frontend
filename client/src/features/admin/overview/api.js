import { api } from '@/app/api.js'

/*
 * Admin numbers (§3.15): the Overview (dashboard.view), Analytics (reports.view) and Recruitment (candidates.view),
 * each with the country filter (M-138); the activity chart per period in the browser time zone (M-170).
 */
export const adminMetricsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getOverview: build.query({ query: (params) => ({ url: '/admin/overview', params }), providesTags: ['AdminMetrics'] }),
    getAnalytics: build.query({ query: (params) => ({ url: '/admin/analytics', params }), providesTags: ['AdminMetrics'] }),
    // `source` picks the route the page's permission opens: the Overview's or Analytics'.
    getActivity: build.query({
      query: ({ source, ...params }) => ({ url: source === 'analytics' ? '/admin/analytics/activity' : '/admin/activity', params }),
      providesTags: ['AdminMetrics'],
    }),
    getRecruitment: build.query({ query: (params) => ({ url: '/admin/recruitment', params }), providesTags: ['AdminMetrics'] }),
  }),
})

export const { useGetOverviewQuery, useGetAnalyticsQuery, useGetActivityQuery, useGetRecruitmentQuery } = adminMetricsApi
