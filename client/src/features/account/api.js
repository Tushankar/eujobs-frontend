import { api, writesMe } from '@/app/api.js'

/* The signed-in account's own settings (M-010, M-095). */
export const accountApi = api.injectEndpoints({
  endpoints: (build) => ({
    changePassword: build.mutation({ query: (body) => ({ url: '/me/password', method: 'POST', body }) }),
    setNotifications: build.mutation({ query: (body) => ({ url: '/me/notifications', method: 'PATCH', body }), ...writesMe }),
    // M-188, M-189: erasure (candidate) or account deletion (recruiter), with the current password.
    deleteAccount: build.mutation({ query: (body) => ({ url: '/me', method: 'DELETE', body }) }),
  }),
})

export const { useChangePasswordMutation, useSetNotificationsMutation, useDeleteAccountMutation } = accountApi
