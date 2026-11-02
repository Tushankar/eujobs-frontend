import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Bookmark, BriefcaseBusiness, ChevronDown, Globe, MapPin } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { CompanyLogo, Icon, IconButton } from '@/components/ui'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import aiGlyph from '@/assets/icons/ai-glyph-blue.svg'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './JobCard.module.css'

/**
 * Job listing card (Overview and Find jobs). Every candidate sees the skill-overlap label (M-050, M-052), never a
 * percentage; Plus adds the score in Phase 9. Apply comes with applications in Phase 6 (P4-Q1).
 */
export default function JobCard({ job, onToggleSave }) {
  const { t } = useTranslation()
  const format = useFormat()
  const jobText = useJobText()
  const [whyOpen, setWhyOpen] = useState(false)
  const whyId = `why-${job.id}`
  const detailsPath = `/candidate/jobs/${job.id}`
  const company = job.company.displayName
  const eligible = jobText.eligible(job)
  const tags = [job.level && t('findJobs:card.level', { level: t(`enums:jobLevel.${job.level}`), years: job.experienceYears ?? 0 }), ...job.requiredSkills].filter(Boolean)

  return (
    <article className={styles.card} data-job={job.id}>
      <div className={styles.head}>
        <CompanyLogo name={company} id={job.company.id} src={job.company.logoUrl ?? undefined} size={44} />
        <div className={styles.headText}>
          <div className={styles.eyebrow}>
            <span className={styles.company}>{company}</span>
            <StatusBadge tone={job.overlap.count > 0 ? 'info' : 'neutral'}>{t('findJobs:card.overlap', { count: job.overlap.count, total: job.overlap.total })}</StatusBadge>
            {job.accepting === false && <StatusBadge tone="warning">{t('findJobs:card.notAccepting')}</StatusBadge>}
          </div>
          <h3 className={styles.title}>
            <Link to={detailsPath} className={styles.titleLink}>
              {job.title}
            </Link>
          </h3>
        </div>
        <IconButton
          icon={Bookmark}
          label={t(job.saved ? 'findJobs:card.unsave' : 'findJobs:card.save', { title: job.title, company })}
          className={cx(styles.bookmark, job.saved && styles.bookmarkSaved)}
          aria-pressed={job.saved}
          onClick={() => onToggleSave(job)}
        />
      </div>

      <div className={styles.meta}>
        <span className={styles.metaItem}>
          <Icon as={MapPin} size={12} />
          {jobText.place(job)}
        </span>
        <span className={styles.metaItem}>
          <Icon as={Globe} size={12} />
          {t(`enums:workPreference.${job.workPreference}`)}
        </span>
        <span className={styles.metaItem}>
          <Icon as={BriefcaseBusiness} size={12} />
          {t(`enums:employmentType.${job.employmentType}`)}
        </span>
        {job.salary && <span className={styles.salary}>{jobText.salary(job)}</span>}
      </div>
      {eligible && <p className={styles.eligible}>{t('findJobs:card.eligible', { countries: eligible })}</p>}

      <ul className={styles.tags} aria-label={t('findJobs:card.requirements')}>
        {tags.map((tag) => (
          <li key={tag} className={styles.tag}>
            {tag}
          </li>
        ))}
      </ul>

      <div className={styles.footer}>
        <button type="button" className={styles.why} aria-expanded={whyOpen} aria-controls={whyId} onClick={() => setWhyOpen((open) => !open)}>
          <img src={aiGlyph} alt="" width={12} height={12} />
          {t('findJobs:card.matching', { count: job.overlap.count })}
          <Icon as={ChevronDown} size={11} className={cx(styles.chevron, whyOpen && styles.chevronOpen)} />
        </button>
        <div className={styles.actions}>
          {job.publishedAt && <span className={styles.posted}>{format.relative(job.publishedAt)}</span>}
          <Link to={detailsPath} className={styles.viewJob} aria-label={t('findJobs:card.viewLabel', { title: job.title, company })}>
            {t('findJobs:card.view')}
            <Icon as={ArrowUpRight} size={12} />
          </Link>
        </div>
      </div>
      {whyOpen && (
        <p id={whyId} className={styles.whyText}>
          {job.overlap.count > 0 ? t('findJobs:card.why', { skills: format.list(job.overlap.matched) }) : t('findJobs:card.whyNone')}
        </p>
      )}
    </article>
  )
}
