import { api, writesMe } from '@/app/api.js'

/* The signed-in account's own settings (M-010, M-095). */
export const accountApi = api.injectEndpoints({
  endpoints: (build) => ({
    changePassword: build.mutation({ query: (body) => ({ url: '/me/password', method: 'POST', body }) }),
    setNotifications: build.mutation({ query: (body) => ({ url: '/me/notifications', method: 'PATCH', body }), ...writesMe }),
  }),
})

export const { useChangePasswordMutation, useSetNotificationsMutation } = accountApi
