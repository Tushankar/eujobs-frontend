import { Skeleton, SkeletonRegion } from '@/components/ui'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import { useGetInsightNarrativeQuery } from '@/features/ai/api.js'
import styles from './Narrative.module.css'

/**
 * The OpenAI part of an insights page (M-057), requested on its own so the code evidence around it always shows; a
 * failure, the daily limit or a timeout show here with Try again (§2.9, OD13).
 */
export default function Narrative({ section, jobId, children }) {
  const query = useGetInsightNarrativeQuery({ section, jobId }, { skip: section !== 'overview' && section !== 'improve' && !jobId })
  return (
    <div data-narrative={section}>
      {query.isFetching ? (
        <SkeletonRegion className={styles.skeleton}>
          <Skeleton />
          <Skeleton width="92%" />
          <Skeleton width="64%" />
        </SkeletonRegion>
      ) : (
        <AiStatus error={query.error} onRetry={query.refetch}>
          {query.data && children(query.data)}
        </AiStatus>
      )}
    </div>
  )
}
