import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Bookmark, ChevronDown, Earth, MapPin } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Checkbox, Icon, IconButton } from '@/components/ui'
import aiSparkle from '@/assets/icons/ai-sparkle-blue.svg'
import styles from './TalentCard.module.css'

/** "Talent worth meeting" card: profile summary, collapsible AI match insight, compare and view profile. */
export default function TalentCard({ person, saved, onToggleSaved }) {
  const [insightOpen, setInsightOpen] = useState(false)
  const [comparing, setComparing] = useState(false)
  const { matchedSkills } = person

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <span className={cx(styles.avatar, styles[person.tone])} aria-hidden="true">
          {person.initials}
        </span>
        <IconButton
          icon={Bookmark}
          label={saved ? `Remove ${person.name} from your shortlist` : `Shortlist ${person.name}`}
          aria-pressed={saved}
          className={cx(styles.bookmark, saved && styles.bookmarkSaved)}
          onClick={onToggleSaved}
        />
      </div>

      <h3 className={styles.name}>
        <Link to="/recruiter/find-candidates" className={styles.nameLink}>
          {person.name}
        </Link>
      </h3>
      <p className={styles.headline}>{person.headline}</p>

      <div className={styles.meta}>
        <span>{person.years} years experience</span>
        <span className={styles.metaItem}>
          <Icon as={Earth} size={11} />
          {person.workPreference}
        </span>
        <span className={styles.metaItem}>
          <Icon as={MapPin} size={11} />
          {person.location}
        </span>
      </div>

      <ul className={styles.skills}>
        {person.skills.map((skill) => (
          <li key={skill}>
            <PillBadge>{skill}</PillBadge>
          </li>
        ))}
      </ul>

      <p className={styles.status}>
        <span className={styles.dot} aria-hidden="true" />
        {person.availability}
        <span className={styles.ready}>Core profile ready</span>
      </p>

      <div className={styles.insight}>
        <button
          type="button"
          className={styles.insightButton}
          aria-expanded={insightOpen}
          onClick={() => setInsightOpen((open) => !open)}
        >
          <span className={styles.insightTitle}>
            <img src={aiSparkle} alt="" width={14} height={14} />
            AI Match Insights
          </span>
          <Icon as={ChevronDown} size={14} className={cx(insightOpen && styles.flipped)} />
        </button>
        <p className={styles.insightText}>
          {matchedSkills.length} relevant skills · {person.years} years of experience · {person.workPreference}
        </p>
        {insightOpen && (
          <p className={styles.insightDetail}>
            Matched on listed skills: {matchedSkills.join(', ')}. Based on profile information only; this is not a
            hiring decision.
          </p>
        )}
      </div>

      <div className={styles.footer}>
        <Checkbox
          checked={comparing}
          onChange={(event) => setComparing(event.target.checked)}
          className={styles.compare}
        >
          Compare
        </Checkbox>
        <Link to="/recruiter/find-candidates" className={styles.view}>
          View profile
          <Icon as={ArrowUpRight} size={12} />
        </Link>
      </div>
    </article>
  )
}
