import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, Check, ChevronDown, FileText, MessageSquare, ShieldCheck, Users } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import sparkle from '@/assets/icons/ai-sparkle-blue.svg'
import { cx } from '@/utils/cx.js'
import AiPageShell from '../components/AiPageShell.jsx'
import RolePicker from '../components/RolePicker.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import SourceEvidenceModal from '../components/SourceEvidenceModal.jsx'
import { PROFILE } from '../data/insights.js'
import { useAddedSkills, useExplanationFeedback, useSelectedRole } from '../hooks/useInsightsState.js'
import { compareRole, rankRoles } from '../utils/matching.js'
import styles from './WhyRecommendedPage.module.css'

const AI_INSIGHTS = '/candidate/ai-insights'

const SOURCES = [
  { icon: Users, label: 'Reviewed profile fields and preferences' },
  { icon: BriefcaseBusiness, label: 'Current listed job requirements' },
  { icon: ShieldCheck, label: 'No protected-characteristic inference' },
]

function buildReasons(role, match) {
  const total = role.requiredSkills.length
  return [
    {
      title: 'Your listed skills overlap',
      text:
        match.listed.length > 0
          ? `${match.listed.join(', ')} appear in both your profile and this role’s required skills.`
          : 'None of this role’s required skills are listed in your profile yet.',
      tag: `${match.listed.length} of ${total} required skills`,
    },
    {
      title: 'Your experience provides context',
      text: `Your profile reports ${PROFILE.yearsReported} years. The role lists ${role.minYears}+ years. ${
        match.yearsMet
          ? 'The reported years meet that target, but role-specific depth is not verified.'
          : 'The reported years are below that target; role-specific depth is not verified either way.'
      }`,
      tag: 'Candidate-provided',
    },
    {
      title: 'Your preferences stay part of the picture',
      text: `You prefer ${PROFILE.workPreference}; this role lists ${role.workMode}. ${
        match.workAligned ? 'These stated preferences align.' : 'These stated preferences differ, so review whether this works for you.'
      } Location eligibility still needs review.`,
      tag: match.workAligned ? 'Work preference aligned' : 'Work preference to review',
    },
  ]
}

const FEEDBACK = [
  { value: 'helpful', label: 'Helpful', icon: Check },
  { value: 'needs-review', label: 'Needs review', icon: MessageSquare },
]

/** Why recommended: what was compared, what was not assessed, and how to change the evidence. */
export default function WhyRecommendedPage() {
  const [role, selectRole] = useSelectedRole('linear')
  const { skills } = useAddedSkills()
  const { feedback, choose } = useExplanationFeedback()
  const [sourceOpen, setSourceOpen] = useState(false)
  const [open, setOpen] = useState({ ordered: true })

  const match = compareRole(role, skills)
  const rank = rankRoles(skills).findIndex((entry) => entry.role.id === role.id) + 1
  const current = feedback[role.id]

  const details = [
    {
      id: 'ordered',
      title: 'How this preview is ordered',
      body: (
        <>
          <p className={styles.detailText}>
            Roles with at least one listed skill in common are included in the profile preview. They’re ordered by the number of
            required skills listed in your profile, then work preference alignment, then whether reported years meet the listed target.
            Ties retain their existing order.
          </p>
          <p className={styles.detailNote}>
            This is a transparent local comparison, not semantic AI ranking, a statistical confidence score, or a hiring decision.
          </p>
        </>
      ),
    },
    {
      id: 'not-assessed',
      title: 'What was not assessed',
      body: (
        <p className={styles.detailText}>
          Skill proficiency, role-specific achievements, interview performance, references, availability, work authorization, and team
          fit are not verified. Protected characteristics are not inputs. A resume file name does not prove the contents of a resume.
        </p>
      ),
    },
    {
      id: 'change',
      title: 'How to change the evidence',
      body: (
        <>
          <p className={styles.detailText}>
            You can review skills, experience, and your summary before saving any change. New evidence updates these local comparisons.
            Matching consent can be paused in privacy settings.
          </p>
          <Link to="/candidate/profile" className={styles.link}>
            Review my profile
            <Icon as={ArrowRight} size={13} strokeWidth={2} />
          </Link>
        </>
      ),
    },
  ]

  return (
    <AiPageShell
      eyebrow="AI Recommendation Explanation"
      title="A recommendation you can question."
      description="Understand what was compared, what wasn’t assessed, and why a role appears."
    >
      <RolePicker role={role} onChange={selectRole} />

      <div className={styles.layout}>
        <div className={styles.main}>
          <Panel padding={24} aria-labelledby="why-title">
            <div className={styles.badges}>
              <PillBadge tone="primary">
                <img src={sparkle} alt="" width={14} height={14} />
                Evidence-led explanation
              </PillBadge>
              {rank > 0 && <PillBadge>Role {rank} in this profile preview</PillBadge>}
            </div>
            <SectionHeading
              id="why-title"
              className={styles.whyHeading}
              title="Why this opportunity is here"
              description="Visible signals. No hidden claims about your ability."
            />
            <ol className={styles.reasons}>
              {buildReasons(role, match).map((reason, index) => (
                <li key={reason.title} className={styles.reason}>
                  <span className={styles.index} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className={styles.reasonTitle}>{reason.title}</h3>
                    <p className={styles.reasonText}>{reason.text}</p>
                    <div className={styles.tagRow}>
                      <PillBadge>{reason.tag}</PillBadge>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel padding="0 24px">
            <ul>
              {details.map((detail) => {
                const expanded = Boolean(open[detail.id])
                return (
                  <li key={detail.id} className={styles.detail}>
                    <h3>
                      <button
                        type="button"
                        className={styles.trigger}
                        aria-expanded={expanded}
                        aria-controls={`detail-${detail.id}`}
                        onClick={() => setOpen((previous) => ({ ...previous, [detail.id]: !previous[detail.id] }))}
                      >
                        {detail.title}
                        <Icon as={ChevronDown} size={16} strokeWidth={2} className={cx(styles.chevron, expanded && styles.chevronOpen)} />
                      </button>
                    </h3>
                    <div id={`detail-${detail.id}`} className={styles.detailBody} hidden={!expanded}>
                      {detail.body}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel padding={24} aria-labelledby="feedback-title">
            <SectionHeading
              id="feedback-title"
              title="Was this explanation useful?"
              description="Your feedback is a local note, not a model training submission."
            />
            <div className={styles.feedback}>
              {FEEDBACK.map((option) => (
                <Button
                  key={option.value}
                  variant="outline"
                  className={cx(styles.choice, current === option.value && styles.chosen)}
                  aria-pressed={current === option.value}
                  onClick={() => choose(role.id, option.value)}
                  leftIcon={<Icon as={option.icon} size={14} strokeWidth={2} />}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className={styles.feedbackNote} role="status">
              {current ? 'Saved as a local note on this device. Nothing was sent.' : ''}
            </p>
          </Panel>
        </div>

        <aside className={styles.side} aria-label="Sources and context">
          <Panel padding={24}>
            <h2 className={styles.title}>Know the source.</h2>
            <ul className={styles.sources}>
              {SOURCES.map((source) => (
                <li key={source.label}>
                  <span className={styles.sourceIcon}>
                    <Icon as={source.icon} size={15} strokeWidth={2} />
                  </span>
                  {source.label}
                </li>
              ))}
            </ul>
            <Button variant="outline" fullWidth onClick={() => setSourceOpen(true)} leftIcon={<Icon as={FileText} size={13} strokeWidth={2} />}>
              Inspect source evidence
            </Button>
          </Panel>
          <Panel className={styles.context} padding={24}>
            <PillBadge tone="primary" className={styles.frosted}>
              Context, not confidence
            </PillBadge>
            <p className={styles.contextText}>
              No AI confidence score is available. A connected model would need evaluated, calibrated outputs before a confidence claim
              could be useful.
            </p>
            <Link to={`${AI_INSIGHTS}/job-match?role=${role.id}`} className={styles.link}>
              View complete match evidence
              <Icon as={ArrowRight} size={13} strokeWidth={2} />
            </Link>
          </Panel>
        </aside>
      </div>

      <SourceEvidenceModal open={sourceOpen} onClose={() => setSourceOpen(false)} role={role} skills={skills} />
    </AiPageShell>
  )
}
