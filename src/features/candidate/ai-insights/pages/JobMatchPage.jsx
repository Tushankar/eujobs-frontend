import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Bookmark, BookmarkCheck, Check, CircleCheck, CircleHelp, FileText } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import AiPageShell from '../components/AiPageShell.jsx'
import RolePicker from '../components/RolePicker.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import SourceEvidenceModal from '../components/SourceEvidenceModal.jsx'
import { PROFILE } from '../data/insights.js'
import { useAddedSkills, useSavedRoles, useSelectedRole } from '../hooks/useInsightsState.js'
import { buildEvidenceRows, compareRole } from '../utils/matching.js'
import styles from './JobMatchPage.module.css'

const AI_INSIGHTS = '/candidate/ai-insights'

function AlignmentBadge({ aligned, label }) {
  return aligned ? (
    <PillBadge tone="success">
      <Icon as={Check} size={11} strokeWidth={2} />
      {label}
    </PillBadge>
  ) : (
    <PillBadge tone="warning">{label}</PillBadge>
  )
}

/** Job match: skills, experience and preferences compared side by side, with no score. */
export default function JobMatchPage() {
  const [role, selectRole] = useSelectedRole('linear')
  const { skills } = useAddedSkills()
  const { saved, toggle: toggleSaved } = useSavedRoles()
  const [sourceOpen, setSourceOpen] = useState(false)

  const match = compareRole(role, skills)
  const rows = buildEvidenceRows(role, match)
  const strong = match.allSkillsListed && match.yearsMet && match.workAligned
  const isSaved = saved.includes(role.id)

  const tiles = [
    {
      label: 'Required skills',
      value: `${match.listed.length} of ${role.requiredSkills.length} listed`,
      aligned: match.allSkillsListed,
    },
    { label: 'Relevant experience', value: `${PROFILE.yearsReported} years reported`, aligned: match.yearsMet },
    { label: 'Work preference', value: `${PROFILE.workPreference} → ${role.workMode}`, aligned: match.workAligned },
  ]

  return (
    <AiPageShell
      eyebrow="Job Match Insights"
      title="See the fit. Understand the evidence."
      description="Skills, experience, preferences, and open questions. More useful than a percentage."
    >
      <RolePicker role={role} onChange={selectRole} />

      <div className={styles.layout}>
        <div className={styles.main}>
          <Panel padding={24} aria-labelledby="fit-title">
            <div className={styles.fitHead}>
              <SectionHeading
                id="fit-title"
                className={styles.fitTitle}
                title="Why this role may fit"
                description="A starting point for your review, not a hiring decision."
              />
              {strong ? <StatusBadge tone="success">Strong match</StatusBadge> : <PillBadge tone="warning" dot>Partial overlap</PillBadge>}
            </div>
            <ul className={styles.tiles}>
              {tiles.map((tile) => (
                <li key={tile.label} className={styles.tile}>
                  <p className={styles.tileLabel}>{tile.label}</p>
                  <p className={styles.tileValue}>{tile.value}</p>
                  <AlignmentBadge aligned={tile.aligned} label={tile.aligned ? 'Aligned' : 'To review'} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel padding={24} aria-labelledby="evidence-title">
            <div className={styles.evidenceHead}>
              <h2 className={styles.title} id="evidence-title">
                The evidence, side by side
              </h2>
              <Button variant="ghost" className={styles.quiet} onClick={() => setSourceOpen(true)} leftIcon={<Icon as={FileText} size={13} strokeWidth={2} />}>
                View source
              </Button>
            </div>
            <ul className={styles.rows}>
              {rows.map((row) => (
                <li key={row.label} className={styles.row}>
                  <div className={styles.rowLabel}>
                    <p className={styles.rowName}>{row.label}</p>
                    <AlignmentBadge aligned={row.aligned} label={row.statusLabel} />
                  </div>
                  <dl className={styles.rowValue}>
                    <dt>Your profile</dt>
                    <dd>{row.profile}</dd>
                  </dl>
                  <dl className={styles.rowValue}>
                    <dt>Role requirement</dt>
                    <dd>{row.requirement}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel padding={24} aria-labelledby="gaps-title">
            <SectionHeading
              id="gaps-title"
              title="Potential gaps & open questions"
              description="Missing evidence is not the same as missing capability."
            />
            <div className={styles.gapText}>
              <span className={match.missing.length === 0 ? styles.gapIconOk : styles.gapIcon}>
                <Icon as={match.missing.length === 0 ? CircleCheck : CircleHelp} size={17} strokeWidth={2} />
              </span>
              <p>
                {match.missing.length === 0
                  ? 'No gaps were detected in these basic listed fields. Role-specific depth, proficiency, and team fit still need human review.'
                  : `${match.missing.join(', ')} ${match.missing.length === 1 ? 'is' : 'are'} listed by this role but not in your reviewed profile. That is missing evidence, not missing capability, and role-specific depth still needs human review.`}
              </p>
            </div>
            <Link to={`${AI_INSIGHTS}/skill-gap?role=${role.id}`} className={styles.link}>
              Explore the skill gap analysis
              <Icon as={ArrowRight} size={13} strokeWidth={2} />
            </Link>
          </Panel>
        </div>

        <aside className={styles.side} aria-label="Next step">
          <Panel padding={24}>
            <h2 className={styles.title}>Your next step is yours.</h2>
            <p className={styles.sideText}>Read the full brief, check the evidence, and decide whether this opportunity feels right.</p>
            <div className={styles.sideActions}>
              <Button as={Link} to={`/candidate/jobs/${role.jobId}`} fullWidth rightIcon={<Icon as={ArrowUpRight} size={13} strokeWidth={2} />}>
                View role &amp; apply
              </Button>
              <Button
                variant="outline"
                fullWidth
                aria-pressed={isSaved}
                onClick={() => toggleSaved(role.id)}
                leftIcon={<Icon as={isSaved ? BookmarkCheck : Bookmark} size={13} strokeWidth={2} />}
              >
                {isSaved ? 'Saved on this device' : 'Save this opportunity'}
              </Button>
              <Link to={`${AI_INSIGHTS}/why-recommended?role=${role.id}`} className={styles.centerLink}>
                Why was this recommended?
                <Icon as={ArrowRight} size={13} strokeWidth={2} />
              </Link>
            </div>
          </Panel>
          <Panel className={styles.context} padding={24}>
            <h2 className={styles.title}>A useful match has context.</h2>
            <p className={styles.contextText}>
              No single percentage can explain a career decision. These insights don’t verify your skills, infer protected
              characteristics, or guarantee an interview.
            </p>
          </Panel>
        </aside>
      </div>

      <SourceEvidenceModal open={sourceOpen} onClose={() => setSourceOpen(false)} role={role} skills={skills} />
    </AiPageShell>
  )
}
