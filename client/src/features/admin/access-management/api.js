import { api } from '@/app/api.js'

/*
 * Admin > Access management (§3.13): the permission catalogue, roles (M-157, M-158), admin staff access (M-154,
 * M-160) and invites (M-159). A role or access change can change the signed-in admin's own permissions, so /me
 * is refetched with the lists.
 */
const changes = ['AdminRoles', 'AdminAccess', 'Me']

export const accessApi = api.injectEndpoints({
  endpoints: (build) => ({
    getPermissions: build.query({ query: () => '/admin/permissions', transformResponse: (response) => response.items }),
    getRoles: build.query({ query: () => '/admin/roles', transformResponse: (response) => response.items, providesTags: ['AdminRoles'] }),
    createRole: build.mutation({ query: (body) => ({ url: '/admin/roles', method: 'POST', body }), invalidatesTags: changes }),
    duplicateRole: build.mutation({ query: (id) => ({ url: `/admin/roles/${id}/duplicate`, method: 'POST' }), invalidatesTags: changes }),
    updateRole: build.mutation({ query: ({ id, ...body }) => ({ url: `/admin/roles/${id}`, method: 'PATCH', body }), invalidatesTags: changes }),
    archiveRole: build.mutation({ query: (id) => ({ url: `/admin/roles/${id}/archive`, method: 'POST' }), invalidatesTags: changes }),
    getAccessUsers: build.query({ query: () => '/admin/access/users', transformResponse: (response) => response.items, providesTags: ['AdminAccess'] }),
    saveAccess: build.mutation({ query: ({ id, ...body }) => ({ url: `/admin/access/users/${id}`, method: 'PUT', body }), invalidatesTags: changes }),
    revokeAccess: build.mutation({ query: (id) => ({ url: `/admin/access/users/${id}`, method: 'DELETE' }), invalidatesTags: changes }),
    inviteAdmin: build.mutation({ query: (body) => ({ url: '/admin/invitations', method: 'POST', body }), invalidatesTags: ['AdminRoles', 'AdminAccess'] }),
  }),
})

export const {
  useGetPermissionsQuery,
  useGetRolesQuery,
  useCreateRoleMutation,
  useDuplicateRoleMutation,
  useUpdateRoleMutation,
  useArchiveRoleMutation,
  useGetAccessUsersQuery,
  useSaveAccessMutation,
  useRevokeAccessMutation,
  useInviteAdminMutation,
} = accessApi
