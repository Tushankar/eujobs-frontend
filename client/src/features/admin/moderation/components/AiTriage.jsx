import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import { useTriageReportMutation } from '../../ai/api.js'
import styles from './AiSuggestion.module.css'

const SEVERITY_TONES = { high: 'warning', medium: 'neutral', low: 'neutral' }

/**
 * "Triage with AI" on a content case (owner 2026-11-17, phase 4): a suggested severity, report reason and action with a
 * short rationale, from the reports and the reported content (never who reported it). Only a suggestion: the admin
 * decides with the usual buttons.
 */
export default function AiTriage({ caseId }) {
  const { t } = useTranslation(['moderation', 'enums'])
  const [triage, { data, error, isLoading }] = useTriageReportMutation({ fixedCacheKey: `triage-${caseId}` })
  const run = () => triage(caseId).catch(() => {})

  return (
    <section className={styles.card} aria-label={t('content.ai.label')} data-ai-triage>
      <div className={styles.head}>
        <div className={styles.headText}>
          <p className={styles.label}>{t(data ? 'content.ai.suggestion' : 'content.ai.label')}</p>
          {!data && <p className={styles.muted}>{t('content.ai.hint')}</p>}
        </div>
        {!data && (
          <Button variant="outline" size="sm" leftIcon={<Icon as={Sparkles} size={13} />} loading={isLoading} onClick={run} data-ai-triage-run>
            {t('content.ai.action')}
          </Button>
        )}
      </div>
      {isLoading && (
        <SkeletonRegion className={styles.skeleton}>
          <Skeleton width="60%" />
          <Skeleton width="50%" />
          <Skeleton width="90%" />
        </SkeletonRegion>
      )}
      {error && (
        <div className={styles.body}>
          <AiStatus isLoading={false} error={error} onRetry={run} />
        </div>
      )}
      {data && (
        <div className={styles.body} data-ai-triage-result={data.action}>
          <dl className={styles.rows}>
            <div>
              <dt>{t('content.ai.severity')}</dt>
              <dd>
                <PillBadge tone={SEVERITY_TONES[data.severity]}>{t(`content.ai.severities.${data.severity}`)}</PillBadge>
              </dd>
            </div>
            <div>
              <dt>{t('content.ai.reason')}</dt>
              <dd>{t(`enums:reportReason.${data.reason}`)}</dd>
            </div>
            <div>
              <dt>{t('content.ai.suggestedAction')}</dt>
              <dd>{t(`content.ai.actions.${data.action}`)}</dd>
            </div>
          </dl>
          <p className={styles.text}>{data.rationale}</p>
          <p className={styles.note}>{t('content.ai.note')}</p>
        </div>
      )}
    </section>
  )
}
