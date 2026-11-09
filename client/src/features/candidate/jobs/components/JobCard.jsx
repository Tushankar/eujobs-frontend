import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness, ChartNoAxesColumnIncreasing, ChevronDown, Crown, Globe, MapPin } from 'lucide-react'
import { openUpgrade } from '@/app/upgrade.js'
import { cx } from '@/utils/cx.js'
import { Button, CompanyLogo, Icon, IconButton, Skeleton } from '@/components/ui'
import SkillPills from '@/components/common/SkillPills.jsx'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import aiGlyph from '@/assets/icons/ai-glyph-blue.svg'
import JobSummaryButton from '@/features/ai/components/JobSummaryButton.jsx'
import { ApplyButton } from '@/features/candidate/applications/components/ApplyFlow.jsx'
import { lacksEntitlement, usePlan } from '@/features/candidate/billing/usePlan.js'
import { useJobText } from '@/lib/jobText.js'
import VerifiedCompany from '@/components/common/VerifiedCompany.jsx'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import JobExplanation from './JobExplanation.jsx'
import MatchBadge from './MatchBadge.jsx'
import styles from './JobCard.module.css'

/**
 * Without Plus, the skill overlap is all the card can show: this panel under it says what AI adds for this job (the
 * match score, why it fits, the gaps) and opens the upgrade dialog (M-118).
 */
function AiUnlock() {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { plus } = usePlan()
  const plan = plus?.name ?? t('enums:planKey.plus')
  return (
    <div className={styles.unlock} data-ai-unlock>
      <div className={styles.unlockText}>
        <p className={styles.unlockTitle}>
          <Icon as={Crown} size={15} strokeWidth={2} className={styles.crown} />
          {t('findJobs:card.unlock.title', { plan })}
        </p>
        <p>{t('findJobs:card.unlock.text')}</p>
      </div>
      <Button size="sm" onClick={() => dispatch(openUpgrade('ai'))} rightIcon={<Icon as={ArrowRight} size={13} />}>
        {t('findJobs:card.unlock.action')}
      </Button>
    </div>
  )
}

/**
 * Job listing card (Overview and Find jobs). Every candidate sees the skill overlap (M-050, M-052); Plus candidates
 * see the match score and label instead (C6), and the AI explanation in the disclosure (M-057). The AI job summary sits
 * on every card (M-059; locked for Free, M-118). Apply goes through the gate (§3.4).
 */
export default function JobCard({ job, onToggleSave }) {
  const { t } = useTranslation()
  const format = useFormat()
  const jobText = useJobText()
  const { me } = usePreferences()
  const [whyOpen, setWhyOpen] = useState(false)
  const whyId = `why-${job.id}`
  const detailsPath = `/candidate/jobs/${job.id}`
  const company = job.company.displayName
  const eligible = jobText.eligible(job)

  return (
    <article className={styles.card} data-job={job.id}>
      <div className={styles.head}>
        <CompanyLogo name={company} id={job.company.id} src={job.company.logoUrl ?? undefined} size={44} />
        <div className={styles.headText}>
          <div className={styles.eyebrow}>
            <VerifiedCompany className={styles.company} name={company} verified={job.company.verified} />
            <MatchBadge job={job} />
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
        {job.level && (
          <span className={styles.metaItem}>
            <Icon as={ChartNoAxesColumnIncreasing} size={12} />
            {t('findJobs:card.level', { level: t(`enums:jobLevel.${job.level}`), years: job.experienceYears ?? 0 })}
          </span>
        )}
        {job.salary && <span className={styles.salary}>{jobText.salary(job)}</span>}
      </div>
      {eligible && <p className={styles.eligible}>{t('findJobs:card.eligible', { countries: eligible })}</p>}

      {job.requiredSkills.length > 0 && (
        <SkillPills skills={job.requiredSkills} label={t('findJobs:card.requirements')} className={styles.tags} />
      )}

      <div className={styles.footer}>
        <button type="button" className={styles.why} aria-expanded={whyOpen} aria-controls={whyId} onClick={() => setWhyOpen((open) => !open)}>
          <img src={aiGlyph} alt="" width={12} height={12} />
          {t('findJobs:card.matching', { count: job.overlap.count })}
          <Icon as={ChevronDown} size={11} className={cx(styles.chevron, whyOpen && styles.chevronOpen)} />
        </button>
        <div className={styles.actions}>
          {job.publishedAt && <span className={styles.posted}>{format.relative(job.publishedAt)}</span>}
          <JobSummaryButton job={job} />
          <Link to={detailsPath} className={styles.viewJob} aria-label={t('findJobs:card.viewLabel', { title: job.title, company })}>
            {t('findJobs:card.view')}
            <Icon as={ArrowUpRight} size={12} />
          </Link>
          <ApplyButton job={job} size="sm" />
        </div>
      </div>
      {whyOpen && (
        <div id={whyId} className={styles.whyText} data-explanation>
          <p>{job.overlap.count > 0 ? t('findJobs:card.why', { skills: format.list(job.overlap.matched) }) : t('findJobs:card.whyNone')}</p>
          {job.match && <JobExplanation jobId={job.id} />}
          {!job.match && lacksEntitlement(me, 'ai') && <AiUnlock />}
        </div>
      )}
    </article>
  )
}

/** The card's shape while jobs load: logo, company, title, meta, tags and footer. Wrap the cards in one SkeletonRegion. */
export function JobCardSkeleton() {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <Skeleton shape="block" width={44} height={44} />
        <div className={styles.headText}>
          <div className={styles.eyebrow}>
            <Skeleton width={110} />
          </div>
          <div className={styles.title}>
            <Skeleton width="55%" height={16} />
          </div>
        </div>
        <Skeleton shape="circle" width={36} height={36} />
      </div>
      <div className={styles.meta}>
        <Skeleton width={96} />
        <Skeleton width={56} />
        <Skeleton width={64} />
      </div>
      <div className={styles.tags}>
        {[84, 56, 72, 64].map((width) => (
          <Skeleton key={width} shape="pill" width={width} height={28} />
        ))}
      </div>
      <div className={styles.footer}>
        <Skeleton width={120} />
        <div className={styles.actions}>
          <Skeleton width={72} />
          <Skeleton shape="pill" width={76} height={32} />
        </div>
      </div>
    </div>
  )
}
