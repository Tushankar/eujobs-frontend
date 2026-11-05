import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, CheckCheck, FileText, Layers } from 'lucide-react'
import StatCard from '@/components/common/StatCard.jsx'
import { Button, Icon, Panel, SkeletonRegion } from '@/components/ui'
import {
  useAddPlanSkillMutation,
  useAddProfileSkillMutation,
  useGetInsightNarrativeQuery,
  useGetInsightPageQuery,
  useRemovePlanSkillMutation,
  useRemoveProfileSkillMutation,
} from '@/features/ai/api.js'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import { useGetProfileQuery } from '@/features/candidate/profile/api.js'
import { serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { cx } from '@/utils/cx.js'
import AiPageShell from '../components/AiPageShell.jsx'
import GapCard, { GapCardSkeleton } from '../components/GapCard.jsx'
import LearningPlanCard from '../components/LearningPlanCard.jsx'
import ReviewSkillModal from '../components/ReviewSkillModal.jsx'
import RolePicker from '../components/RolePicker.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import SourceEvidenceModal from '../components/SourceEvidenceModal.jsx'
import { useChosenJob } from '../hooks/useChosenJob.js'
import styles from './SkillGapPage.module.css'

/** Skill gap (M-064, P9-Q2): the chosen role's required skills the profile does not list, and what to do about each. */
export default function SkillGapPage() {
  const { t } = useTranslation('aiInsights')
  const errorText = useErrorText()
  const { roles, jobId, choose, loading: rolesLoading } = useChosenJob()
  const page = useGetInsightPageQuery({ page: 'skill-gap', jobId }, { skip: !jobId })
  const { data } = page
  const loading = rolesLoading || page.isLoading
  // Another role: the previous role's evidence stays dimmed until the new one arrives.
  const busy = page.isFetching && !page.currentData
  const { data: profile } = useGetProfileQuery()
  const [addSkill, adding] = useAddProfileSkillMutation()
  const [removeSkill] = useRemoveProfileSkillMutation()
  const [addPlan] = useAddPlanSkillMutation()
  const [removePlan] = useRemovePlanSkillMutation()
  const [added, setAdded] = useState([])
  const [reviewing, setReviewing] = useState(null)
  const [reviewError, setReviewError] = useState('')
  const [sourceOpen, setSourceOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const evidence = data?.evidence
  const plan = data?.learningPlan ?? []
  // Skills added here stay on screen with an undo, although the profile now lists them.
  const gaps = evidence ? [...new Set([...evidence.missingSkills, ...added.filter((skill) => data.job.requiredSkills.includes(skill))])] : []
  // The AI tips are a separate request: the gap cards (code evidence) show whatever happens to it (§2.9).
  const narrative = useGetInsightNarrativeQuery({ section: 'skill_gap', jobId }, { skip: !jobId || !evidence?.missingSkills.length })

  async function confirmSkill(skill) {
    setReviewError('')
    try {
      await addSkill(skill).unwrap()
      setAdded((current) => [...current, skill])
      setReviewing(null)
      setAnnouncement(t('gap.addedAnnouncement', { skill }))
    } catch (failure) {
      const field = serverFieldErrors(failure).skill
      setReviewError(field ? errorText.field('skills', field) : errorText.code(failure))
    }
  }

  async function undoSkill(skill) {
    await removeSkill(skill).unwrap()
    setAdded((current) => current.filter((item) => item !== skill))
    setAnnouncement(t('gap.removedAnnouncement', { skill }))
  }

  const togglePlan = (skill) => (plan.includes(skill) ? removePlan(skill) : addPlan(skill))

  return (
    <AiPageShell eyebrow={t('gap.eyebrow')} title={t('gap.title')} description={t('gap.description')}>
      <RolePicker roles={roles} jobId={jobId} onChange={choose} loading={rolesLoading} />

      {loading && (
        <>
          <div className={styles.stats}>
            <StatCard icon={CheckCheck} label={t('gap.aligned')} loading />
            <StatCard icon={Layers} label={t('gap.missing')} loading />
            <StatCard icon={BriefcaseBusiness} label={t('gap.experience')} loading />
          </div>
          <SectionHeading className={styles.heading} title={t('gap.heading')} description={t('gap.headingLead')} />
          <SkeletonRegion className={styles.gaps}>
            <GapCardSkeleton />
            <GapCardSkeleton />
          </SkeletonRegion>
        </>
      )}

      {evidence && (
        <div className={cx(styles.evidence, busy && styles.busy)} aria-busy={busy || undefined}>
          <div className={styles.stats}>
            <StatCard
              icon={CheckCheck}
              label={t('gap.aligned')}
              value={t('gap.alignedValue', { count: evidence.requiredSkills - evidence.missingSkills.length, total: evidence.requiredSkills })}
              caption={t('gap.alignedCaption')}
            />
            <StatCard icon={Layers} label={t('gap.missing')} value={evidence.missingSkills.length} caption={t('gap.missingCaption')} />
            <StatCard
              icon={BriefcaseBusiness}
              label={t('gap.experience')}
              value={t(evidence.years.met ? 'gap.experienceAligned' : 'gap.experienceReview')}
              caption={evidence.years.met ? t('gap.experienceMet') : t('gap.experienceShort', { required: evidence.years.required, candidate: evidence.years.candidate ?? 0 })}
            />
          </div>

          <SectionHeading className={styles.heading} title={t('gap.heading')} description={t('gap.headingLead')}>
            <Button variant="outline" onClick={() => setSourceOpen(true)} leftIcon={<Icon as={FileText} size={14} strokeWidth={2} />}>
              {t('gap.source')}
            </Button>
          </SectionHeading>

          {gaps.length > 0 ? (
            <>
              <div data-narrative="skill_gap">
                <AiStatus error={narrative.error} onRetry={narrative.refetch} />
              </div>
              <div className={styles.gaps}>
                {gaps.map((skill) => (
                  <GapCard
                    key={skill}
                    skill={skill}
                    guidance={narrative.data?.guidance.find((item) => item.skill === skill)?.text}
                    guidanceLoading={narrative.isFetching}
                    added={added.includes(skill)}
                    planned={plan.includes(skill)}
                    onReview={setReviewing}
                    onUndo={undoSkill}
                    onTogglePlan={togglePlan}
                  />
                ))}
              </div>
            </>
          ) : (
            <Panel className={styles.empty} padding={24}>
              <p className={styles.emptyText}>{t('gap.none')}</p>
              <Link to={`/candidate/ai-insights/job-match?jobId=${jobId}`} className={styles.link}>
                {t('gap.sideBySide')}
                <Icon as={ArrowRight} size={13} strokeWidth={2} />
              </Link>
            </Panel>
          )}
        </div>
      )}

      <div className={styles.plan}>
        <LearningPlanCard loading={loading} plan={plan} onRemove={(skill) => removePlan(skill)} exploreLabel={t('plan.explore')} exploreTo="/candidate/learning" />
      </div>

      <ReviewSkillModal skill={reviewing} error={reviewError} busy={adding.isLoading} onClose={() => setReviewing(null)} onConfirm={confirmSkill} />
      <SourceEvidenceModal open={sourceOpen} onClose={() => setSourceOpen(false)} job={data?.job} evidence={evidence} skills={profile?.skills ?? []} />
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </AiPageShell>
  )
}
