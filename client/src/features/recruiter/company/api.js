import { api, formData } from '@/app/api.js'

/* The Company page (M-147, M-150). Every change answers with the company; /me is refetched for the shell. */
const writesCompany = {
  async onQueryStarted(arg, { dispatch, queryFulfilled }) {
    try {
      const { data } = await queryFulfilled
      dispatch(api.util.upsertQueryData('getCompany', undefined, data))
    } catch {
      // The caller shows the error.
    }
  },
  invalidatesTags: ['Me', 'RecruiterJobs'],
}

export const companyApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCompany: build.query({ query: () => '/recruiter/company', providesTags: ['Company'] }),
    updateCompany: build.mutation({ query: (body) => ({ url: '/recruiter/company', method: 'PATCH', body }), ...writesCompany }),
    uploadLogo: build.mutation({ query: (file) => ({ url: '/recruiter/company/logo', method: 'POST', body: formData(file) }), ...writesCompany }),
    removeLogo: build.mutation({ query: () => ({ url: '/recruiter/company/logo', method: 'DELETE' }), ...writesCompany }),
  }),
})

export const { useGetCompanyQuery, useUpdateCompanyMutation, useUploadLogoMutation, useRemoveLogoMutation } = companyApi
