import { hiringPath } from '@/app/roles.js'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useParams } from 'react-router-dom'
import { ArrowLeft, UserX } from 'lucide-react'
import { Button, Icon, SkeletonRegion } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import { useBackTo } from '@/lib/urlState.js'
import { useGetCandidateProfileQuery, useShortlistToggle } from '../api.js'
import { useMatchJob } from '../hooks/useMatchJob.js'
import { ProfileSectionSkeleton } from '../components/ProfileSection.jsx'
import ProfileSidebar, { ProfileSidebarSkeleton } from '../components/ProfileSidebar.jsx'
import ProfileSummary, { ProfileSummarySkeleton } from '../components/ProfileSummary.jsx'
import ProfileTabs from '../components/ProfileTabs.jsx'
import styles from './CandidateProfilePage.module.css'
import { useMarkSeen } from '@/features/notifications/api.js'

const listPath = () => hiringPath('find-candidates')

/**
 * Shared layout of the candidate profile (M-026): summary, tabs (nested routes) and the evidence sidebar. Opening
 * it records one profile view per day (M-184); a candidate who is not discoverable is not found (P4-D11).
 */
export default function CandidateProfilePage() {
  const { t } = useTranslation()
  const { candidateId } = useParams()
  // P11b-Q10: opening this item marks its notifications read.
  useMarkSeen('candidate', candidateId)
  const { jobs, job, setJobId, ready, loading: jobsLoading } = useMatchJob()
  const toggleShortlist = useShortlistToggle()
  const { data: candidate, error, isLoading } = useGetCandidateProfileQuery({ id: candidateId, jobId: job?.id }, { skip: !ready })

  if (error) {
    return (
      <>
        <BackLink />
        <EmptyState
          icon={UserX}
          title={t('discovery:profile.notFound')}
          description={t('discovery:profile.notFoundText')}
          action={
            <Button as={Link} to={listPath()} variant="outline">
              {t('discovery:profile.back')}
            </Button>
          }
        />
      </>
    )
  }
  if (!candidate && (jobsLoading || isLoading)) {
    return (
      <>
        <BackLink />
        <SkeletonRegion className={styles.layout}>
          <div className={styles.main}>
            <ProfileSummarySkeleton />
            <div className={styles.tabs}>
              <ProfileTabs basePath={`${listPath()}/${candidateId}`} />
            </div>
            <ProfileSectionSkeleton />
          </div>
          <ProfileSidebarSkeleton />
        </SkeletonRegion>
      </>
    )
  }
  if (!candidate) return <BackLink />

  return (
    <>
      <BackLink />
      <div className={styles.layout}>
        <div className={`${styles.main} sticky-side`}>
          <ProfileSummary candidate={candidate} />
          <div className={styles.tabs}>
            <ProfileTabs basePath={`${listPath()}/${candidate.id}`} />
          </div>
          <Outlet key={candidate.id} context={{ candidate }} />
        </div>
        <ProfileSidebar candidate={candidate} jobs={jobs} job={job} onJobChange={setJobId} onToggleShortlist={() => toggleShortlist(candidate)} />
      </div>
    </>
  )
}

function BackLink() {
  const { t } = useTranslation()
  // Back to the list it was opened from, with its search and filters (perf 2026-11-24).
  const backTo = useBackTo(listPath())
  return (
    <Link to={backTo} className={styles.back}>
      <Icon as={ArrowLeft} size={14} strokeWidth={2} />
      {t('discovery:profile.back')}
    </Link>
  )
}
