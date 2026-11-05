import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import { Icon, Modal } from '@/components/ui'
import aiMatchIcon from '@/assets/icons/find-candidates-ai-match.svg'
import { useGetRecruiterMatchQuery } from '@/features/ai/api.js'
import AiButton from '@/features/ai/components/AiButton.jsx'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import styles from './MatchInsights.module.css'

/** M-057: the OpenAI narrative of Match insights, requested when the panel opens; never a score (C6). */
function MatchNarrative({ candidateId, jobId }) {
  const { t } = useTranslation('ai')
  const query = useGetRecruiterMatchQuery({ candidateId, jobId })
  const list = (key, items) =>
    items?.length > 0 && (
      <>
        <p className={styles.label}>{t(`explanation.${key}`)}</p>
        <ul className={styles.narrativeList}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </>
    )
  return (
    <div className={styles.narrative} data-narrative="recruiter_match">
      <AiStatus isLoading={query.isFetching} error={query.error} onRetry={query.refetch}>
        {query.data && (
          <>
            <p className={styles.label}>{t('badge')}</p>
            <p className={styles.narrativeText}>{query.data.summary}</p>
            {list('strengths', query.data.strengths)}
            {list('openQuestions', query.data.openQuestions)}
          </>
        )}
      </AiStatus>
    </div>
  )
}

/** The evidence itself: skills listed, years, missing required skills, the AI narrative and the disclaimer. */
function MatchDetails({ candidate, jobId, id }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { me } = usePreferences()
  const overlap = candidate.overlap
  return (
    <div className={styles.details} id={id}>
      {overlap?.matched.length > 0 && (
        <>
          <p className={styles.label}>{t('discovery:match.skillsEvidence')}</p>
          <ul className={styles.chips}>
            {overlap.matched.map((skill) => (
              <li key={skill} className={styles.chip}>
                <Icon as={Check} size={10} strokeWidth={2} />
                {skill}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className={styles.experience}>
        <Icon as={Check} size={13} strokeWidth={2} />
        {t('discovery:match.experience', { count: candidate.yearsExperience })}
      </p>
      {overlap?.missing.length > 0 && (
        <div className={styles.gap}>
          <p className={styles.gapTitle}>{t('discovery:match.gapTitle')}</p>
          <p>{t('discovery:match.missing', { skills: format.list(overlap.missing) })}</p>
        </div>
      )}
      {jobId &&
        (lacksEntitlement(me, 'ai', ['recruiter']) ? (
          <AiButton variant="outline" size="sm">
            {t('discovery:match.aiNarrative')}
          </AiButton>
        ) : (
          <MatchNarrative candidateId={candidate.id} jobId={jobId} />
        ))}
      <p className={styles.disclaimer}>{t('discovery:match.disclaimer')}</p>
    </div>
  )
}

/**
 * Match evidence for the chosen job (M-052, M-057 code part): the job's skills the candidate lists, the required
 * ones not listed, years and work mode, computed on the server, and, once opened, the AI narrative around them in the
 * recruiter's language (Recruiter Plus, §3.22; without it a locked button). Never a score (C6).
 * `panel` (Find candidates cards) opens the evidence in a side panel so the card grid keeps its height; otherwise
 * (the profile sidebar) it expands in place.
 */
export default function MatchInsights({ candidate, jobId, defaultOpen = false, panel = false }) {
  const hasJob = Boolean(jobId)
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)
  const detailsId = useId()
  const overlap = candidate.overlap
  const summary = [
    hasJob && overlap && t('discovery:match.relevant', { count: overlap.count }),
    t('discovery:match.years', { count: candidate.yearsExperience }),
    candidate.workPreference && t(`enums:workPreference.${candidate.workPreference}`),
  ]
    .filter(Boolean)
    .join(' · ')

  const title = (
    <span className={styles.title}>
      <img src={aiMatchIcon} alt="" width={14} height={14} />
      {t('discovery:match.title')}
    </span>
  )

  if (panel) {
    return (
      <>
        <button type="button" className={cx(styles.root, styles.opener)} aria-haspopup="dialog" data-match-open onClick={() => setOpen(true)}>
          <span className={styles.toggle}>
            {title}
            <Icon as={ChevronRight} size={14} strokeWidth={2} />
          </span>
          <span className={styles.summary}>{summary}</span>
        </button>
        <Modal open={open} onClose={() => setOpen(false)} placement="right" width={440} title={t('discovery:match.title')} description={[candidate.fullName, candidate.headline].filter(Boolean).join(' · ')}>
          <div className={styles.panel}>
            <p className={styles.panelSummary}>{summary}</p>
            <MatchDetails candidate={candidate} jobId={jobId} />
          </div>
        </Modal>
      </>
    )
  }

  return (
    <div className={styles.root}>
      <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((current) => !current)}>
        {title}
        <Icon as={open ? ChevronUp : ChevronDown} size={14} strokeWidth={2} />
      </button>
      <p className={styles.summary}>{summary}</p>
      {open && <MatchDetails candidate={candidate} jobId={jobId} id={detailsId} />}
    </div>
  )
}
