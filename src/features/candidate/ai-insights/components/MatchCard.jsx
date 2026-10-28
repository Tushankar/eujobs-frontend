import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, CircleHelp } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import sparkle from '@/assets/icons/ai-sparkle-blue.svg'
import { PROFILE } from '../data/insights.js'
import { cx } from '@/utils/cx.js'
import RoleLogo from './RoleLogo.jsx'
import styles from './MatchCard.module.css'

const AI_INSIGHTS = '/candidate/ai-insights'

/** One role in "The evidence behind your matches", with expandable evidence for the AI match summary. */
export default function MatchCard({ role, match }) {
  const [open, setOpen] = useState(false)
  const detailId = useId()
  const count = match.listed.length
  return (
    <Panel as="article" padding={20}>
      <Link to="/candidate/jobs" className={styles.role}>
        <RoleLogo role={role} />
        <span>
          <span className={styles.title}>{role.title}</span>
          <span className={styles.company}>{role.company}</span>
        </span>
      </Link>
      <div className={styles.insight}>
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={detailId} onClick={() => setOpen((value) => !value)}>
          <span className={styles.toggleLabel}>
            <img src={sparkle} alt="" width={14} height={14} />
            AI Match Insights
          </span>
          <Icon as={ChevronDown} size={14} strokeWidth={2} className={cx(styles.chevron, open && styles.chevronOpen)} />
        </button>
        <p className={styles.summary}>
          {count} {count === 1 ? 'skill aligns' : 'skills align'} with your profile ·{' '}
          {match.workAligned ? 'Matches your work preference' : 'Review work preference'}
        </p>
        <dl id={detailId} className={styles.detail} hidden={!open}>
          <div>
            <dt>Listed skills that align</dt>
            <dd>{match.listed.join(', ')}</dd>
          </div>
          {match.missing.length > 0 && (
            <div>
              <dt>Required, not listed</dt>
              <dd>{match.missing.join(', ')}</dd>
            </div>
          )}
          <div>
            <dt>Work preference</dt>
            <dd>
              You: {PROFILE.workPreference} · Role: {role.workMode}
            </dd>
          </div>
          <div>
            <dt>Experience</dt>
            <dd>
              {PROFILE.yearsReported} years reported · Role lists {role.minYears}+
            </dd>
          </div>
        </dl>
      </div>
      <div className={styles.links}>
        <Link to={`${AI_INSIGHTS}/job-match?role=${role.id}`} className={styles.primaryLink}>
          View match insights
          <Icon as={ArrowRight} size={12} />
        </Link>
        <Link to={`${AI_INSIGHTS}/why-recommended?role=${role.id}`} className={styles.mutedLink}>
          Why recommended?
          <Icon as={CircleHelp} size={12} />
        </Link>
      </div>
    </Panel>
  )
}
