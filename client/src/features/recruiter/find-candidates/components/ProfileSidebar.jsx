import { useTranslation } from 'react-i18next'
import { Bookmark, ShieldCheck } from 'lucide-react'
import { Icon, Panel, SelectField, Skeleton, SkeletonRegion } from '@/components/ui'
import PlanButton from '@/features/candidate/billing/components/PlanButton.jsx'
import { useGetPipelineQuery } from '@/features/recruiter/applications/api.js'
import ApplicationStageSelect from '@/features/recruiter/applications/components/ApplicationStageSelect.jsx'
import { MessageCandidateButton } from '@/features/messages/components/StartConversation.jsx'
import ReportButton from '@/features/moderation/components/ReportButton.jsx'
import { useFormat } from '@/lib/preferences.js'
import MatchInsights from './MatchInsights.jsx'
import styles from './ProfileSidebar.module.css'

/** M-071: one stage select per application to this company; a non-applicant has none. */
function CompanyApplications({ candidate }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { data: pipeline, isLoading } = useGetPipelineQuery()
  if (!candidate.applications.length) return null
  if (isLoading) {
    return (
      <Panel padding={20} className={styles.applications}>
        <h2 className={styles.applicationsTitle}>{t('applications:profile.title')}</h2>
        <SkeletonRegion className={styles.applicationList}>
          {candidate.applications.map((application) => (
            <div key={application.id} className={styles.application}>
              <p className={styles.applicationJob}>{t('applications:profile.row', { job: application.job.title, date: format.date(application.appliedAt) })}</p>
              <Skeleton shape="block" height={32} />
            </div>
          ))}
        </SkeletonRegion>
      </Panel>
    )
  }
  if (!pipeline) return null
  return (
    <Panel padding={20} className={styles.applications} data-profile-applications>
      <h2 className={styles.applicationsTitle}>{t('applications:profile.title')}</h2>
      <ul className={styles.applicationList}>
        {candidate.applications.map((application) => (
          <li key={application.id} className={styles.application}>
            <p className={styles.applicationJob}>{t('applications:profile.row', { job: application.job.title, date: format.date(application.appliedAt) })}</p>
            <ApplicationStageSelect
              application={application}
              stages={pipeline.items}
              variant="card"
              candidateName={candidate.fullName}
              jobTitle={application.job.title}
              label={t('applications:profile.stage', { job: application.job.title })}
            />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/**
 * Right column of the candidate profile: the shortlist and message actions, the stage of each application to this
 * company, the job to match against (also the job the outreach template names) and the evidence panel.
 */
export default function ProfileSidebar({ candidate, jobs, job, onJobChange, onToggleShortlist }) {
  const { t } = useTranslation()
  return (
    <aside className={`${styles.sidebar} sticky-side`}>
      <Panel padding={20}>
        <div className={styles.actions}>
          {/* §3.22: the shortlist needs Recruiter Plus (`discovery`). */}
          <PlanButton
            entitlement="discovery"
            roles={['recruiter']}
            variant="outline"
            fullWidth
            leftIcon={<Icon as={Bookmark} size={14} strokeWidth={2} />}
            aria-pressed={candidate.shortlisted}
            onClick={onToggleShortlist}
          >
            {t(candidate.shortlisted ? 'discovery:profile.removeShortlist' : 'discovery:profile.addShortlist')}
          </PlanButton>
          <MessageCandidateButton candidate={candidate} job={job} />
          <ReportButton targetType="candidate_profile" targetId={candidate.id} size="sm" fullWidth />
        </div>
      </Panel>

      <CompanyApplications candidate={candidate} />

      <Panel padding={20} className={styles.evidence}>
        <SelectField
          className={styles.job}
          label={t('discovery:profile.matchFor')}
          value={job?.id ?? ''}
          disabled={jobs.length === 0}
          onChange={(event) => onJobChange(event.target.value)}
          options={jobs.length > 0 ? jobs.map((item) => ({ value: item.id, label: item.title })) : [{ value: '', label: t('discovery:toolbar.noJobs') }]}
        />
        <MatchInsights candidate={candidate} jobId={job?.id ?? null} defaultOpen />
      </Panel>

      <p className={styles.reminder}>
        <Icon as={ShieldCheck} size={17} strokeWidth={2} />
        {t('discovery:profile.reminder')}
      </p>
    </aside>
  )
}

/** The sidebar's shape while the profile loads: the action buttons, the match job select and the evidence box. */
export function ProfileSidebarSkeleton() {
  const { t } = useTranslation()
  return (
    <aside className={`${styles.sidebar} sticky-side`}>
      <Panel as="div" padding={20} aria-hidden="true">
        <div className={styles.actions}>
          <Skeleton shape="pill" width="100%" height={40} />
          <Skeleton shape="pill" width="100%" height={40} />
          <Skeleton shape="pill" width="100%" height={32} />
        </div>
      </Panel>
      <Panel as="div" padding={20} className={styles.evidence} aria-hidden="true">
        <div className={styles.skeletonField}>
          <p className={styles.skeletonLabel}>{t('discovery:profile.matchFor')}</p>
          <Skeleton shape="block" height={44} />
        </div>
        <div className={styles.skeletonInsights}>
          <Skeleton width="45%" />
          <Skeleton width="90%" />
          <Skeleton width="70%" />
        </div>
      </Panel>
      <p className={styles.reminder}>
        <Icon as={ShieldCheck} size={17} strokeWidth={2} />
        {t('discovery:profile.reminder')}
      </p>
    </aside>
  )
}
