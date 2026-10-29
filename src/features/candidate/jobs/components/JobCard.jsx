import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness, Check, ChevronDown, Globe, MapPin } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Button, Icon, IconButton } from '@/components/ui'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import aiGlyph from '@/assets/icons/ai-glyph-blue.svg'
import aiGlyphDark from '@/assets/icons/ai-glyph-blue-dark.svg'
import { experienceTag, formatPosted, formatSalary, matchTone } from '../data/jobUtils.js'
import JobLogo from './JobLogo.jsx'
import styles from './JobCard.module.css'

/** Plain-language reason shown when the "matching skills" disclosure is opened. */
function whyItMatches(job) {
  const matched = job.skills.slice(0, job.matchingSkills)
  const skills = matched.length ? `Matching skills: ${matched.join(', ')}. ` : ''
  const reason =
    job.alignment === 'Work preference aligned'
      ? `Your profile lists a preference for ${job.workMode.toLowerCase()} work, which this role offers.`
      : 'Your reported experience lines up with what this role asks for.'
  return `${skills}${reason} Evidence, not a hiring decision.`
}

/**
 * Job listing card (Overview recommendations and Find jobs).
 * `showAiMatch` adds the "% AI match" badge and `onApply` adds the Apply now / Applied button (Overview variant).
 */
export default function JobCard({ job, saved, applied, onToggleSave, onApply, showAiMatch = false, detailsPath }) {
  const [whyOpen, setWhyOpen] = useState(false)
  const whyId = `why-${job.id}`

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <JobLogo company={job.company} logo={job.logo} />
        <div className={styles.headText}>
          <div className={styles.eyebrow}>
            <span className={styles.company}>{job.company}</span>
            <StatusBadge tone={matchTone(job)}>{job.matchLabel}</StatusBadge>
            {showAiMatch && (
              <span className={styles.aiBadge}>
                <img src={aiGlyphDark} alt="" width={12} height={12} />
                {job.aiMatch}% AI match
              </span>
            )}
          </div>
          <h3 className={styles.title}>
            <Link to={detailsPath} className={styles.titleLink}>
              {job.title}
            </Link>
          </h3>
        </div>
        <IconButton
          icon={Bookmark}
          label={saved ? `Remove ${job.title} at ${job.company} from saved jobs` : `Save ${job.title} at ${job.company}`}
          className={cx(styles.bookmark, saved && styles.bookmarkSaved)}
          aria-pressed={saved}
          onClick={() => onToggleSave(job.id)}
        />
      </div>

      <div className={styles.meta}>
        <span className={styles.metaItem}>
          <Icon as={MapPin} size={12} />
          {job.location}
        </span>
        <span className={styles.metaItem}>
          <Icon as={Globe} size={12} />
          {job.workMode}
        </span>
        <span className={styles.metaItem}>
          <Icon as={BriefcaseBusiness} size={12} />
          {job.type}
        </span>
        {job.salaryMin != null && (
          <span className={styles.salary}>
            {formatSalary(job)} <span className={styles.salaryUnit}>/ year</span>
          </span>
        )}
      </div>

      <ul className={styles.tags} aria-label="Role requirements">
        {[experienceTag(job), ...job.skills].map((tag) => (
          <li key={tag} className={styles.tag}>
            {tag}
          </li>
        ))}
      </ul>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.why}
          aria-expanded={whyOpen}
          aria-controls={whyId}
          onClick={() => setWhyOpen((open) => !open)}
        >
          <img src={aiGlyph} alt="" width={12} height={12} />
          {job.matchingSkills} matching skills
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          {job.alignment}
          <Icon as={ChevronDown} size={11} className={cx(styles.chevron, whyOpen && styles.chevronOpen)} />
        </button>
        <div className={styles.actions}>
          <span className={styles.posted}>{formatPosted(job.postedHoursAgo)}</span>
          <Link to={detailsPath} className={styles.viewJob} aria-label={`View job: ${job.title} at ${job.company}`}>
            View job
            <Icon as={ArrowUpRight} size={12} />
          </Link>
          {onApply &&
            (applied ? (
              <Button className={styles.applied} disabled leftIcon={<Icon as={Check} size={13} />}>
                Applied
              </Button>
            ) : (
              <Button rightIcon={<Icon as={ArrowRight} size={13} />} onClick={() => onApply(job.id)}>
                Apply now
              </Button>
            ))}
        </div>
      </div>
      {whyOpen && (
        <p id={whyId} className={styles.whyText}>
          {whyItMatches(job)}
        </p>
      )}
    </article>
  )
}
