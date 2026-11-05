import { useSearchParams } from 'react-router-dom'
import { useGetInsightRolesQuery } from '@/features/ai/api.js'

/** M-063: the role picker's jobs (top 10, saved, applied) and the chosen one: `?jobId=`, else the top-ranked job. */
export function useChosenJob() {
  const [params, setParams] = useSearchParams()
  const { data, isLoading } = useGetInsightRolesQuery()
  const roles = data?.items ?? []
  const jobId = params.get('jobId') ?? roles[0]?.id ?? null
  return { roles, loaded: Boolean(data), loading: isLoading, jobId, choose: (id) => setParams({ jobId: id }) }
}
