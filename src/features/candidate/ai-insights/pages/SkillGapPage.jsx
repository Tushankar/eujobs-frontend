import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, CheckCheck, FileText, Layers } from 'lucide-react'
import StatCard from '@/components/common/StatCard.jsx'
import { Button, Icon, Panel } from '@/components/ui'
import AiPageShell from '../components/AiPageShell.jsx'
import GapCard from '../components/GapCard.jsx'
import LearningPlanCard from '../components/LearningPlanCard.jsx'
import ReviewSkillModal from '../components/ReviewSkillModal.jsx'
import RolePicker from '../components/RolePicker.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import SourceEvidenceModal from '../components/SourceEvidenceModal.jsx'
import { PROFILE } from '../data/insights.js'
import { useAddedSkills, useLearningPlan, useSelectedRole } from '../hooks/useInsightsState.js'
import { compareRole } from '../utils/matching.js'
import styles from './SkillGapPage.module.css'

/** Skill gap: which required skills are not listed yet, and what the candidate may do about each one. */
export default function SkillGapPage() {
  const [role, selectRole] = useSelectedRole('stripe')
  const { added, skills, add, undo } = useAddedSkills()
  const { plan, toggle: togglePlan } = useLearningPlan()
  const [reviewing, setReviewing] = useState(null)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const match = compareRole(role, skills)
  // Cards come from the reviewed profile, so a skill added here stays visible (with an undo).
  const gapSkills = role.requiredSkills.filter((skill) => !PROFILE.skills.includes(skill))

  function confirmSkill(skill) {
    add(skill)
    setReviewing(null)
    setAnnouncement(`${skill} added to your reviewed skills. Saved on this device.`)
  }

  function undoSkill(skill) {
    undo(skill)
    setAnnouncement(`${skill} removed from your reviewed skills.`)
  }

  return (
    <AiPageShell
      eyebrow="Skill Gap"
      title="Know the gaps. Find your next step."
      description="A skill not listed is an open question—not a judgment about your potential."
    >
      <RolePicker role={role} onChange={selectRole} />

      <div className={styles.stats}>
        <StatCard
          icon={CheckCheck}
          label="Listed skills that align"
          value={`${match.listed.length} of ${role.requiredSkills.length}`}
          caption="Compared with this role’s required skills"
        />
        <StatCard
          icon={Layers}
          label="Required skills not listed"
          value={match.missing.length}
          caption="Missing evidence, not a measure of ability"
        />
        <StatCard
          icon={BriefcaseBusiness}
          label="Experience to review"
          value={match.yearsMet ? 'Aligned' : 'To review'}
          caption={
            match.yearsMet
              ? 'Reported years meet the listed target'
              : `Role lists ${role.minYears}+ years; you reported ${PROFILE.yearsReported}`
          }
        />
      </div>

      <SectionHeading
        className={styles.heading}
        title="The gaps worth exploring"
        description="Prioritize role-relevant evidence. You don’t need to tick every nice-to-have."
      >
        <Button variant="outline" onClick={() => setSourceOpen(true)} leftIcon={<Icon as={FileText} size={14} strokeWidth={2} />}>
          View source evidence
        </Button>
      </SectionHeading>

      {gapSkills.length > 0 ? (
        <div className={styles.gaps}>
          {gapSkills.map((skill) => (
            <GapCard
              key={skill}
              skill={skill}
              added={added.includes(skill)}
              planned={plan.includes(skill)}
              onReview={setReviewing}
              onUndo={undoSkill}
              onTogglePlan={togglePlan}
            />
          ))}
        </div>
      ) : (
        <Panel className={styles.empty} padding={24}>
          <p className={styles.emptyText}>
            No required skills are missing from your reviewed profile for this role. Role-specific depth, proficiency, and team fit still
            need human review.
          </p>
          <Link to={`/candidate/ai-insights/job-match?role=${role.id}`} className={styles.link}>
            See the evidence side by side
            <Icon as={ArrowRight} size={13} strokeWidth={2} />
          </Link>
        </Panel>
      )}

      <div className={styles.plan}>
        <LearningPlanCard plan={plan} onRemove={togglePlan} exploreLabel="Explore learning courses" exploreTo="/candidate/learning" />
      </div>

      <ReviewSkillModal skill={reviewing} onClose={() => setReviewing(null)} onConfirm={confirmSkill} />
      <SourceEvidenceModal open={sourceOpen} onClose={() => setSourceOpen(false)} role={role} skills={skills} />
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </AiPageShell>
  )
}
