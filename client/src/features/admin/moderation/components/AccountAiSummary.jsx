import { useTranslation } from 'react-i18next'
import { CircleAlert, Sparkles } from 'lucide-react'
import { Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import { useSummariseAccountMutation } from '../../ai/api.js'
import styles from './AiSuggestion.module.css'

/**
 * "Summarise with AI" on a recruiter under review (owner 2026-11-17, phase 4): a short summary of the submitted company
 * details and the points worth checking. The documents, the person's name and phone never go to the AI; the admin
 * still checks the documents and decides.
 */
export default function AccountAiSummary({ userId }) {
  const { t } = useTranslation('moderation')
  const [summarise, { data, error, isLoading }] = useSummariseAccountMutation({ fixedCacheKey: `account-summary-${userId}` })
  const run = () => summarise(userId).catch(() => {})
  const dialog = (key, params) => t(`accounts.dialog.ai.${key}`, params)

  return (
    <section className={styles.card} aria-label={dialog('label')} data-ai-account-summary>
      <div className={styles.head}>
        <div className={styles.headText}>
          <p className={styles.label}>{dialog(data ? 'suggestion' : 'label')}</p>
          {!data && <p className={styles.muted}>{dialog('hint')}</p>}
        </div>
        {!data && (
          <Button variant="outline" size="sm" leftIcon={<Icon as={Sparkles} size={13} />} loading={isLoading} onClick={run} data-ai-account-summary-run>
            {dialog('action')}
          </Button>
        )}
      </div>
      {isLoading && (
        <SkeletonRegion className={styles.skeleton}>
          <Skeleton width="95%" />
          <Skeleton width="85%" />
          <Skeleton width="60%" />
        </SkeletonRegion>
      )}
      {error && (
        <div className={styles.body}>
          <AiStatus isLoading={false} error={error} onRetry={run} />
        </div>
      )}
      {data && (
        <div className={styles.body} data-ai-account-summary-result={data.flags.length}>
          <p className={styles.text}>{data.summary}</p>
          <p className={styles.sub}>{dialog('flags')}</p>
          {data.flags.length ? (
            <ul className={styles.flags}>
              {data.flags.map((flag) => (
                <li key={flag}>
                  <Icon as={CircleAlert} size={14} />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>{dialog('noFlags')}</p>
          )}
          <p className={styles.note}>{dialog('note')}</p>
        </div>
      )}
    </section>
  )
}
