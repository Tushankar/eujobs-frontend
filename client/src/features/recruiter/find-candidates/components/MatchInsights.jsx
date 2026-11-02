import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { Icon } from '@/components/ui'
import aiMatchIcon from '@/assets/icons/find-candidates-ai-match.svg'
import { useFormat } from '@/lib/preferences.js'
import styles from './MatchInsights.module.css'

/**
 * Match evidence for the chosen job (M-052, M-057 code part): the job's skills the candidate lists, the required
 * ones not listed, years and work mode, computed on the server. Never a score (C6); the narrative comes in Phase 9.
 */
export default function MatchInsights({ candidate, hasJob, defaultOpen = false }) {
  const { t } = useTranslation()
  const format = useFormat()
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

  return (
    <div className={styles.root}>
      <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((current) => !current)}>
        <span className={styles.title}>
          <img src={aiMatchIcon} alt="" width={14} height={14} />
          {t('discovery:match.title')}
        </span>
        <Icon as={open ? ChevronUp : ChevronDown} size={14} strokeWidth={2} />
      </button>
      <p className={styles.summary}>{summary}</p>

      {open && (
        <div className={styles.details} id={detailsId}>
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
          <p className={styles.disclaimer}>{t('discovery:match.disclaimer')}</p>
        </div>
      )}
    </div>
  )
}
