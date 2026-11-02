import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Bookmark, ChevronDown, Earth, MapPin, ShieldCheck } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Avatar, Icon, IconButton } from '@/components/ui'
import aiSparkle from '@/assets/icons/ai-sparkle-blue.svg'
import { useFormat } from '@/lib/preferences.js'
import { useCandidateText } from '@/features/recruiter/find-candidates/utils/candidateText.js'
import styles from './TalentCard.module.css'

/**
 * "Talent worth meeting" card (A: recruiter A9): profile summary, the skill evidence for the role it is relevant to
 * (M-052, until Phase 9) and View profile. The Compare checkbox is gone (M-201).
 */
export default function TalentCard({ person, onToggleSaved }) {
  const { t } = useTranslation()
  const format = useFormat()
  const text = useCandidateText()
  const [insightOpen, setInsightOpen] = useState(false)
  const matched = person.overlap?.matched ?? []
  const profilePath = `/recruiter/find-candidates/${person.id}?jobId=${person.bestJob.id}`

  return (
    <article className={styles.card} data-candidate={person.id}>
      <div className={styles.top}>
        <Avatar name={person.fullName} src={person.photoUrl ?? undefined} size={48} />
        <IconButton
          icon={Bookmark}
          label={t(person.shortlisted ? 'discovery:card.unshortlist' : 'discovery:card.shortlist', { name: person.fullName })}
          aria-pressed={person.shortlisted}
          className={cx(styles.bookmark, person.shortlisted && styles.bookmarkSaved)}
          onClick={onToggleSaved}
        />
      </div>

      <h3 className={styles.name}>
        <Link to={profilePath} className={styles.nameLink}>
          {person.fullName}
        </Link>
      </h3>
      <p className={styles.headline}>{person.headline}</p>

      <div className={styles.meta}>
        <span>{t('discovery:card.years', { count: person.yearsExperience })}</span>
        <span className={styles.metaItem}>
          <Icon as={Earth} size={11} />
          {t(`enums:workPreference.${person.workPreference}`)}
        </span>
        <span className={styles.metaItem}>
          <Icon as={MapPin} size={11} />
          {text.location(person)}
        </span>
      </div>

      <ul className={styles.skills}>
        {person.skills.slice(0, 3).map((skill) => (
          <li key={skill}>
            <PillBadge>{skill}</PillBadge>
          </li>
        ))}
      </ul>

      <p className={styles.status}>
        <span className={styles.dot} aria-hidden="true" />
        {t(`enums:availability.${person.availability}`)}
        <span className={styles.ready}>
          <Icon as={ShieldCheck} size={11} /> {text.verification(person)}
        </span>
      </p>

      <div className={styles.insight}>
        <button type="button" className={styles.insightButton} aria-expanded={insightOpen} onClick={() => setInsightOpen((open) => !open)}>
          <span className={styles.insightTitle}>
            <img src={aiSparkle} alt="" width={14} height={14} />
            {t('discovery:match.title')}
          </span>
          <Icon as={ChevronDown} size={14} className={cx(insightOpen && styles.flipped)} />
        </button>
        <p className={styles.insightText}>
          {[t('discovery:match.relevant', { count: matched.length }), t('discovery:match.years', { count: person.yearsExperience }), t(`enums:workPreference.${person.workPreference}`)].join(' · ')}
        </p>
        {insightOpen && (
          <p className={styles.insightDetail}>
            {t('discovery:overview.bestJob', { job: person.bestJob.title })}: {format.list(matched)}. {t('discovery:match.disclaimer')}
          </p>
        )}
      </div>

      <div className={styles.footer}>
        <Link to={profilePath} className={styles.view}>
          {t('discovery:card.view')}
          <Icon as={ArrowUpRight} size={12} />
        </Link>
      </div>
    </article>
  )
}
