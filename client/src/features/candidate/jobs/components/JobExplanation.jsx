import { useTranslation } from 'react-i18next'
import { useGetInsightNarrativeQuery } from '@/features/ai/api.js'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import styles from './JobExplanation.module.css'

/**
 * M-057 on a Plus candidate's card: the AI narrative around the code evidence shown above it, in the candidate's
 * language (cached per facts and language). Shares its cache with Job match insights.
 */
export default function JobExplanation({ jobId }) {
  const { t } = useTranslation('ai')
  const query = useGetInsightNarrativeQuery({ section: 'job_match', jobId })
  const list = (key, items) =>
    items?.length > 0 && (
      <>
        <p className={styles.heading}>{t(`explanation.${key}`)}</p>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </>
    )
  return (
    <div className={styles.root} data-narrative="job_match">
      <AiStatus isLoading={query.isFetching} error={query.error} onRetry={query.refetch}>
        {query.data && (
          <>
            <p className={styles.badge}>{t('badge')}</p>
            <p className={styles.summary} data-narrative-text>
              {query.data.summary}
            </p>
            {list('strengths', query.data.strengths)}
            {list('gaps', query.data.gaps)}
          </>
        )}
      </AiStatus>
    </div>
  )
}
