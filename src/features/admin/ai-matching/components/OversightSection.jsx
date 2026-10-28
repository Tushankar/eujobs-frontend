import { useId, useState } from 'react'
import { Check, ChevronUp, Sparkles } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { MATCH_EVIDENCE, OVERSIGHT_CANDIDATES } from '../data/matching.js'
import { cx } from '@/utils/cx.js'
import styles from './OversightSection.module.css'

/** Recruiter match-summary oversight: the evidence-derived summaries recruiters see for one role. */
export function MatchSummaryOversight() {
  return (
    <section className={styles.section} aria-labelledby="oversight-title">
      <SectionTitle
        id="oversight-title"
        title="Recruiter match-summary oversight"
        description="The same evidence-derived percentages recruiters see for Senior Product Designer."
      />
      <div className={styles.cards}>
        {OVERSIGHT_CANDIDATES.map((candidate) => (
          <Panel as="article" key={candidate.id} padding={20}>
            <div className={styles.person}>
              <span className={cx(styles.avatar, styles[candidate.tone])} aria-hidden="true">
                {candidate.initials}
              </span>
              <div className={styles.personText}>
                <p className={styles.name}>{candidate.name}</p>
                <p className={styles.role}>{candidate.role}</p>
              </div>
            </div>
            <p className={styles.percent}>{candidate.percent}%</p>
            <p className={styles.caption}>Skills, preference, and reported experience. Human review remains required.</p>
          </Panel>
        ))}
      </div>
    </section>
  )
}

/** A reusable evidence-led explanation: the collapsible "AI Match Insights" panel. */
export function EvidenceExplanation() {
  const [open, setOpen] = useState(true)
  const detailId = useId()

  return (
    <section className={styles.section} aria-labelledby="explanation-title">
      <SectionTitle id="explanation-title" title="A reusable evidence-led explanation" />
      <Panel padding={16} selected className={styles.insight}>
        <button
          type="button"
          className={styles.insightToggle}
          aria-expanded={open}
          aria-controls={detailId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className={styles.insightTitle}>
            <Icon as={Sparkles} size={13} />
            AI Match Insights
          </span>
          <Icon as={ChevronUp} size={14} className={cx(styles.chevron, !open && styles.chevronClosed)} />
        </button>
        <p className={styles.summary}>{MATCH_EVIDENCE.summary}</p>

        {open && (
          <div className={styles.detail} id={detailId}>
            <p className={styles.eyebrow}>Skills evidence</p>
            <div className={styles.skills}>
              {MATCH_EVIDENCE.skills.map((skill) => (
                <PillBadge tone="success" key={skill}>
                  <Icon as={Check} size={10} />
                  {skill}
                </PillBadge>
              ))}
            </div>
            <p className={styles.experience}>
              <Icon as={Check} size={13} />
              {MATCH_EVIDENCE.experience}
            </p>
            <div className={styles.gap}>
              <p className={styles.gapTitle}>Potential gap</p>
              <p className={styles.gapText}>{MATCH_EVIDENCE.gap}</p>
            </div>
            <p className={styles.disclaimer}>{MATCH_EVIDENCE.disclaimer}</p>
          </div>
        )}
      </Panel>
    </section>
  )
}
