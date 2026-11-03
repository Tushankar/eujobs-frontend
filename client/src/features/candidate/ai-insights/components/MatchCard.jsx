import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, CircleHelp } from 'lucide-react'
import { CompanyLogo, Icon, Panel } from '@/components/ui'
import sparkle from '@/assets/icons/ai-sparkle-blue.svg'
import MatchBadge from '@/features/candidate/jobs/components/MatchBadge.jsx'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import styles from './MatchCard.module.css'

const AI_INSIGHTS = '/candidate/ai-insights'

/** One of the best matches (M-053): the score, the skills that align and the required skills not listed (M-052). */
export default function MatchCard({ job }) {
  const { t } = useTranslation('aiInsights')
  const format = useFormat()
  const [open, setOpen] = useState(false)
  const detailId = useId()
  const missing = job.requiredSkills.filter((skill) => !job.overlap.matched.includes(skill))
  return (
    <Panel as="article" padding={20} data-match-card={job.id}>
      <Link to={`/candidate/jobs/${job.id}`} className={styles.role}>
        <CompanyLogo name={job.company.displayName} id={job.company.id} src={job.company.logoUrl ?? undefined} size={36} />
        <span>
          <span className={styles.title}>{job.title}</span>
          <span className={styles.company}>{job.company.displayName}</span>
        </span>
      </Link>
      <MatchBadge job={job} />
      <div className={styles.insight}>
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={detailId} onClick={() => setOpen((value) => !value)}>
          <span className={styles.toggleLabel}>
            <img src={sparkle} alt="" width={14} height={14} />
            {t('match.insights')}
          </span>
          <Icon as={ChevronDown} size={14} strokeWidth={2} className={cx(styles.chevron, open && styles.chevronOpen)} />
        </button>
        <p className={styles.summary}>{t('match.summary', { count: job.overlap.count })}</p>
        <dl id={detailId} className={styles.detail} hidden={!open}>
          {job.overlap.matched.length > 0 && (
            <div>
              <dt>{t('match.listed')}</dt>
              <dd>{format.list(job.overlap.matched)}</dd>
            </div>
          )}
          {missing.length > 0 && (
            <div>
              <dt>{t('match.missing')}</dt>
              <dd>{format.list(missing)}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className={styles.links}>
        <Link to={`${AI_INSIGHTS}/job-match?jobId=${job.id}`} className={styles.primaryLink}>
          {t('match.view')}
          <Icon as={ArrowRight} size={12} />
        </Link>
        <Link to={`${AI_INSIGHTS}/why-recommended?jobId=${job.id}`} className={styles.mutedLink}>
          {t('match.why')}
          <Icon as={CircleHelp} size={12} />
        </Link>
      </div>
    </Panel>
  )
}
