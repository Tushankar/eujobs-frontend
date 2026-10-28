import { useId, useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { Icon } from '@/components/ui'
import aiMatchIcon from '@/assets/icons/find-candidates-ai-match.svg'
import { getMatchEvidence, summarizeMatch } from '../utils/matchEvidence.js'
import { candidateDetails } from '../data/candidateDetails.js'
import styles from './MatchInsights.module.css'

/**
 * "AI Match Insights": a collapsible, evidence-first summary of how a candidate's listed skills line up with
 * the selected job. It states what the profile shows, never a score, and says people make the decision.
 */
export default function MatchInsights({ candidate, job, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const detailsId = useId()
  const evidence = getMatchEvidence(candidate, job)
  const gaps = [
    evidence.missingSkills.length > 0 && `No evidence listed yet for ${evidence.missingSkills.join(', ')}`,
    candidateDetails[candidate.id]?.potentialGap,
  ].filter(Boolean)

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.title}>
          <img src={aiMatchIcon} alt="" width={14} height={14} />
          AI Match Insights
        </span>
        <Icon as={open ? ChevronUp : ChevronDown} size={14} />
      </button>
      <p className={styles.summary}>{summarizeMatch(candidate, evidence, Boolean(job))}</p>

      {open && (
        <div className={styles.details} id={detailsId}>
          {evidence.relevantSkills.length > 0 && (
            <>
              <p className={styles.label}>Skills evidence</p>
              <ul className={styles.chips}>
                {evidence.relevantSkills.map((skill) => (
                  <li key={skill} className={styles.chip}>
                    <Icon as={Check} size={10} strokeWidth={2} />
                    {skill}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.experience}>
            <Icon as={Check} size={13} />
            {candidate.experienceYears} years of experience reported in the profile. Verify role-specific experience
            during review.
          </p>
          {gaps.length > 0 && (
            <div className={styles.gap}>
              <p className={styles.gapTitle}>Potential gap</p>
              {gaps.map((gap) => (
                <p key={gap}>{gap}</p>
              ))}
            </div>
          )}
          <p className={styles.disclaimer}>
            Based on profile evidence and stated preferences, not a hiring decision. You remain in control.
          </p>
        </div>
      )}
    </div>
  )
}
