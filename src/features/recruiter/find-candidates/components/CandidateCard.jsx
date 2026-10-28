import { Link } from 'react-router-dom'
import { ArrowUpRight, Bookmark, Earth, MapPin } from 'lucide-react'
import { Checkbox, Icon, IconButton } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { cx } from '@/utils/cx.js'
import CandidateAvatar from './CandidateAvatar.jsx'
import MatchInsights from './MatchInsights.jsx'
import styles from './CandidateCard.module.css'

/** One Find candidates result: identity, listed facts, availability, collapsible match evidence and actions. */
export default function CandidateCard({
  candidate,
  job,
  shortlisted,
  onToggleShortlist,
  compared,
  compareDisabled,
  onToggleCompare,
}) {
  const profilePath = `/recruiter/find-candidates/${candidate.id}`

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <Link to={profilePath} tabIndex={-1} aria-hidden="true">
          <CandidateAvatar candidate={candidate} />
        </Link>
        <IconButton
          icon={Bookmark}
          iconSize={17}
          label={shortlisted ? `Remove ${candidate.name} from shortlist` : `Add ${candidate.name} to shortlist`}
          aria-pressed={shortlisted}
          className={cx(styles.bookmark, shortlisted && styles.bookmarkActive)}
          onClick={onToggleShortlist}
        />
      </div>

      <h2 className={styles.name}>
        <Link to={profilePath}>{candidate.name}</Link>
      </h2>
      <p className={styles.headline}>{candidate.headline}</p>

      <p className={styles.meta}>
        <span>{candidate.experienceYears} years experience</span>
        <span className={styles.metaItem}>
          <Icon as={Earth} size={11} strokeWidth={2} />
          {candidate.workMode}
        </span>
        <span className={styles.metaItem}>
          <Icon as={MapPin} size={11} strokeWidth={2} />
          {candidate.location}
        </span>
      </p>

      <ul className={styles.skills} aria-label="Listed skills">
        {candidate.skills.slice(0, 3).map((skill) => (
          <li key={skill}>
            <PillBadge>{skill}</PillBadge>
          </li>
        ))}
      </ul>

      <p className={styles.status}>
        <span className={styles.dot} aria-hidden="true" />
        {candidate.availability}
        <span className={styles.ready}>{candidate.profileStatus}</span>
      </p>

      <div className={styles.insights}>
        <MatchInsights candidate={candidate} job={job} />
      </div>

      <div className={styles.footer}>
        <Checkbox
          className={styles.compare}
          checked={compared}
          disabled={compareDisabled && !compared}
          onChange={onToggleCompare}
          aria-label={`Compare ${candidate.name}`}
        >
          Compare
        </Checkbox>
        <Link to={profilePath} className={styles.view}>
          View profile
          <Icon as={ArrowUpRight} size={12} strokeWidth={2} />
        </Link>
      </div>
    </article>
  )
}
