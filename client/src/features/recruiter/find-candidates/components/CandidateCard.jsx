import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { ArrowUpRight, Bookmark, Earth, Lock, MapPin, ShieldCheck } from 'lucide-react'
import { openUpgrade } from '@/app/upgrade.js'
import PlanButton from '@/features/candidate/billing/components/PlanButton.jsx'
import { Avatar, Checkbox, Icon, IconButton, Skeleton } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useCandidateText } from '../utils/candidateText.js'
import MatchInsights from './MatchInsights.jsx'
import styles from './CandidateCard.module.css'

/**
 * One Find candidates or Shortlists result (A: recruiter B2): photo, listed facts, availability, verification,
 * right to work in the picker country, languages, match evidence and actions. `extra` adds a line (shortlist date).
 */
export default function CandidateCard({ candidate, hasJob, jobId, locked, onToggleShortlist, compared, compareDisabled, onToggleCompare, extra }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const { country } = usePreferences()
  const text = useCandidateText()
  const profilePath = `/recruiter/find-candidates/${candidate.id}${jobId ? `?jobId=${jobId}` : ''}`
  const rightToWork = country && country !== 'REMOTE' ? text.rightToWork(candidate, country) : null

  return (
    <article className={styles.card} data-candidate={candidate.id}>
      <div className={styles.top}>
        <Link to={profilePath} tabIndex={-1} aria-hidden="true">
          <Avatar name={candidate.fullName} src={candidate.photoUrl ?? undefined} size={48} />
        </Link>
        {/* §3.22: without Recruiter Plus the shortlist button keeps its label and opens the upgrade dialog. */}
        <IconButton
          icon={locked ? Lock : Bookmark}
          iconSize={17}
          label={t(candidate.shortlisted ? 'discovery:card.unshortlist' : 'discovery:card.shortlist', { name: candidate.fullName })}
          aria-pressed={candidate.shortlisted}
          className={cx(styles.bookmark, candidate.shortlisted && styles.bookmarkActive)}
          onClick={locked ? () => dispatch(openUpgrade('discovery')) : onToggleShortlist}
          data-plan-locked={locked ? 'discovery' : undefined}
        />
      </div>

      <h2 className={styles.name}>
        <Link to={profilePath}>{candidate.fullName}</Link>
      </h2>
      <p className={styles.headline}>{candidate.headline}</p>

      <p className={styles.meta}>
        <span>{t('discovery:card.years', { count: candidate.yearsExperience })}</span>
        {candidate.workPreference && (
          <span className={styles.metaItem}>
            <Icon as={Earth} size={11} strokeWidth={2} />
            {t(`enums:workPreference.${candidate.workPreference}`)}
          </span>
        )}
        <span className={styles.metaItem}>
          <Icon as={MapPin} size={11} strokeWidth={2} />
          {text.location(candidate)}
        </span>
      </p>

      <ul className={styles.skills} aria-label={t('discovery:card.skills')}>
        {candidate.skills.slice(0, 3).map((skill) => (
          <li key={skill}>
            <PillBadge>{skill}</PillBadge>
          </li>
        ))}
      </ul>

      <p className={styles.status}>
        <span className={styles.dot} aria-hidden="true" />
        {t(`enums:availability.${candidate.availability}`)}
        <span className={styles.ready}>
          <Icon as={ShieldCheck} size={11} strokeWidth={2} /> {text.verification(candidate)}
        </span>
      </p>
      {(rightToWork || candidate.languages.length > 0) && <p className={styles.facts}>{[rightToWork, text.languages(candidate, 2)].filter(Boolean).join(' · ')}</p>}
      {extra && <p className={styles.facts}>{extra}</p>}

      <div className={styles.insights}>
        <MatchInsights candidate={candidate} jobId={hasJob ? jobId : null} />
      </div>

      <div className={styles.footer}>
        {locked ? (
          <PlanButton variant="ghost" size="sm" entitlement="discovery" roles={['recruiter']} aria-label={t('discovery:compare.toggle', { name: candidate.fullName })}>
            {t('discovery:compare.label')}
          </PlanButton>
        ) : (
        <Checkbox
          className={styles.compare}
          checked={compared}
          disabled={compareDisabled && !compared}
          onChange={onToggleCompare}
          aria-label={t('discovery:compare.toggle', { name: candidate.fullName })}
        >
          {t('discovery:compare.label')}
        </Checkbox>
        )}
        <Link to={profilePath} className={styles.view}>
          {t('discovery:card.view')}
          <Icon as={ArrowUpRight} size={12} strokeWidth={2} />
        </Link>
      </div>
    </article>
  )
}

/** A CandidateCard's shape while the list loads: the same card with placeholders for its data. */
export function CandidateCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.top}>
        <Skeleton shape="circle" width={48} height={48} />
      </div>
      <p className={styles.name}>
        <Skeleton width="55%" height={14} />
      </p>
      <p className={styles.headline}>
        <Skeleton width="80%" />
      </p>
      <p className={styles.meta}>
        <Skeleton width={44} />
        <Skeleton width={52} />
        <Skeleton width={68} />
      </p>
      <div className={styles.skills}>
        <Skeleton shape="pill" width={64} />
        <Skeleton shape="pill" width={52} />
        <Skeleton shape="pill" width={72} />
      </div>
      <p className={styles.status}>
        <Skeleton width={72} />
        <span className={styles.ready}>
          <Skeleton width={60} />
        </span>
      </p>
      <p className={styles.facts}>
        <Skeleton width="60%" />
      </p>
      <div className={styles.insights}>
        <div className={styles.skeletonInsights}>
          <Skeleton width="40%" />
          <Skeleton width="85%" />
        </div>
      </div>
      <div className={styles.footer}>
        <Skeleton width={56} />
        <Skeleton width={64} />
      </div>
    </div>
  )
}
