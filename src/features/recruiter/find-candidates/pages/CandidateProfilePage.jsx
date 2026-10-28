import { useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { ArrowLeft, UserX } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import { REJECTED } from '@/features/recruiter/hiring-pipeline/data/pipeline.js'
import { usePipeline } from '@/features/recruiter/hiring-pipeline/hooks/usePipeline.js'
import { getCandidate } from '../data/candidates.js'
import { useCandidateActivity } from '../hooks/useCandidateActivity.js'
import { useMatchJob } from '../hooks/useMatchJob.js'
import { useShortlist } from '../hooks/useShortlist.js'
import MessageModal from '../components/MessageModal.jsx'
import ProfileSidebar from '../components/ProfileSidebar.jsx'
import ProfileSummary from '../components/ProfileSummary.jsx'
import ProfileTabs from '../components/ProfileTabs.jsx'
import styles from './CandidateProfilePage.module.css'

const LIST_PATH = '/recruiter/find-candidates'

/** Shared layout of the candidate profile: summary, tabs (nested routes) and the evidence / actions sidebar. */
export default function CandidateProfilePage() {
  const { candidateId } = useParams()
  const candidate = getCandidate(candidateId)
  const { jobs, job, setJobId } = useMatchJob()
  const { isShortlisted, toggle } = useShortlist()
  const { stages, applicants, moveTo } = usePipeline()
  const { getActivity, addActivity } = useCandidateActivity()
  const [messageOpen, setMessageOpen] = useState(false)
  const [notice, setNotice] = useState('')

  if (!candidate) {
    return (
      <>
        <BackLink />
        <EmptyState
          icon={UserX}
          title="Candidate not found"
          description="This profile does not exist or is no longer available."
          action={
            <Button as={Link} to={LIST_PATH} variant="outline">
              Back to talent discovery
            </Button>
          }
        />
      </>
    )
  }

  const stageId = applicants.find((applicant) => applicant.id === candidate.id)?.stageId ?? stages[0].id
  const stageOptions = [
    ...stages.map((stage) => ({ value: stage.id, label: stage.name })),
    ...(stageId === REJECTED ? [{ value: REJECTED, label: 'Rejected' }] : []),
  ]
  const stageName = stageOptions.find((option) => option.value === stageId)?.label ?? stages[0].name
  const recordActivity = (type, text) => addActivity(candidate.id, type, text)

  function changeStage(nextStageId) {
    moveTo(candidate.id, nextStageId)
    const name = stages.find((stage) => stage.id === nextStageId)?.name
    recordActivity('stage', `Moved to ${name}.`)
  }

  function createMessagePreview() {
    recordActivity('outreach', 'Message preview created. Nothing was sent to the candidate.')
    setMessageOpen(false)
    setNotice('Message preview created; nothing was sent.')
  }

  return (
    <>
      <BackLink />
      <div className={styles.layout}>
        <div className={styles.main}>
          <ProfileSummary candidate={candidate} />
          <div className={styles.tabs}>
            <ProfileTabs basePath={`${LIST_PATH}/${candidate.id}`} />
          </div>
          <Outlet
            key={candidate.id}
            context={{ candidate, stageName, activity: getActivity(candidate.id), recordActivity }}
          />
        </div>
        <ProfileSidebar
          candidate={candidate}
          jobs={jobs}
          job={job}
          onJobChange={setJobId}
          shortlisted={isShortlisted(candidate.id)}
          onToggleShortlist={() => toggle(candidate.id)}
          stageId={stageId}
          stageOptions={stageOptions}
          onStageChange={changeStage}
          onStartConversation={() => setMessageOpen(true)}
          notice={notice}
        />
      </div>
      {messageOpen && (
        <MessageModal
          candidate={candidate}
          job={job}
          onClose={() => setMessageOpen(false)}
          onCreate={createMessagePreview}
        />
      )}
    </>
  )
}

function BackLink() {
  return (
    <Link to={LIST_PATH} className={styles.back}>
      <Icon as={ArrowLeft} size={14} strokeWidth={2} />
      Back to talent discovery
    </Link>
  )
}
