import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import { Button, Icon, SelectField } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import { useGetCompanyApplicationsQuery, useGetPipelineQuery, useMoveApplicationMutation } from '@/features/recruiter/applications/api.js'
import { useGetRecruiterJobsQuery } from '@/features/recruiter/jobs/api.js'
import ApplicantCard from '../components/ApplicantCard.jsx'
import ManageStagesModal from '../components/ManageStagesModal.jsx'
import PipelineColumn from '../components/PipelineColumn.jsx'
import styles from './HiringPipelinePage.module.css'

const PIPELINE_PATH = '/recruiter/hiring-pipeline'
const MANAGE_PATH = `${PIPELINE_PATH}/manage-stage`

/**
 * Hiring pipeline board (M-069): one card per active application in the company's stages, filtered by job. Cards
 * move by dragging or with the stage menu on each card; not selected and withdrawn applications leave the board
 * (M-076, U33). "Manage stages" is a state of this page, addressable at /hiring-pipeline/manage-stage.
 */
export default function HiringPipelinePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const managing = useLocation().pathname.endsWith('/manage-stage')
  const [params, setParams] = useSearchParams()
  const jobId = params.get('jobId') ?? ''
  const { data: pipeline } = useGetPipelineQuery()
  const { data } = useGetCompanyApplicationsQuery(jobId ? { jobId } : {})
  const { data: jobs } = useGetRecruiterJobsQuery()
  const [move] = useMoveApplicationMutation()
  const [draggingId, setDraggingId] = useState(null)
  const [dropStageId, setDropStageId] = useState(null)
  const stages = pipeline?.items ?? []
  const applications = data?.items ?? []

  function drop(event, stageId) {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain') || draggingId
    const application = applications.find((item) => item.id === id)
    if (application && application.stage.id !== stageId) move({ id, stageId })
    setDraggingId(null)
    setDropStageId(null)
  }

  const jobOptions = [{ value: '', label: t('applications:recruiter.allJobs') }, ...(jobs?.items ?? []).filter((job) => job.status !== 'draft').map((job) => ({ value: job.id, label: job.title }))]

  return (
    <div>
      <PageTitle
        title={t('applications:board.title')}
        description={t('applications:board.description')}
        actions={
          <Button variant="outline" leftIcon={<Icon as={Settings2} size={14} />} onClick={() => navigate(MANAGE_PATH)}>
            {t('applications:board.manage')}
          </Button>
        }
      />

      <div className={styles.summary}>
        <SelectField
          className={styles.jobFilter}
          aria-label={t('applications:recruiter.jobFilter')}
          name="jobId"
          options={jobOptions}
          value={jobId}
          onChange={(event) => setParams(event.target.value ? { jobId: event.target.value } : {}, { replace: true })}
        />
        <p className={styles.count}>{t('applications:board.summary', { count: applications.length, stages: stages.length })}</p>
      </div>

      <div className={styles.board} role="region" aria-label={t('applications:board.label')} tabIndex={0}>
        {stages.map((stage) => {
          const cards = applications.filter((application) => application.stage.id === stage.id)
          return (
            <PipelineColumn
              key={stage.id}
              stage={stage}
              count={cards.length}
              isDropTarget={draggingId !== null && dropStageId === stage.id}
              onDragOver={(event) => {
                if (draggingId === null) return
                event.preventDefault()
                setDropStageId(stage.id)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDropStageId(null)
              }}
              onDrop={(event) => drop(event, stage.id)}
            >
              {cards.map((application) => (
                <ApplicantCard
                  key={application.id}
                  application={application}
                  stages={stages}
                  dragging={draggingId === application.id}
                  onDragStart={setDraggingId}
                  onDragEnd={() => {
                    setDraggingId(null)
                    setDropStageId(null)
                  }}
                />
              ))}
            </PipelineColumn>
          )
        })}
      </div>

      <ManageStagesModal open={managing} onClose={() => navigate(PIPELINE_PATH)} stages={stages} />
    </div>
  )
}
