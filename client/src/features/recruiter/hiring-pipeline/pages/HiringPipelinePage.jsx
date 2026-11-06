import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Columns3, Layers, Settings2 } from 'lucide-react'
import { Button, Icon, SelectField, Skeleton, SkeletonRegion } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import ViewToggle from '@/components/common/ViewToggle.jsx'
import { useGetCompanyApplicationsQuery, useGetPipelineFunnelQuery, useGetPipelineQuery } from '@/features/recruiter/applications/api.js'
import { useGetRecruiterJobsQuery } from '@/features/recruiter/jobs/api.js'
import ApplicantCard, { ApplicantCardSkeleton } from '../components/ApplicantCard.jsx'
import ApplicantPanel from '../components/ApplicantPanel.jsx'
import FunnelStageList from '../components/FunnelStageList.jsx'
import ManageStagesModal from '../components/ManageStagesModal.jsx'
import PipelineColumn, { PipelineColumnSkeleton } from '../components/PipelineColumn.jsx'
import PipelineFunnel from '../components/PipelineFunnel.jsx'
import { useInterviewMove } from '@/features/interviews/useInterviewMove.jsx'
import { useStageMove } from '../useStageMove.js'
import styles from './HiringPipelinePage.module.css'

const PIPELINE_PATH = '/recruiter/hiring-pipeline'
const MANAGE_PATH = `${PIPELINE_PATH}/manage-stage`
const FUNNEL_PATH = `${PIPELINE_PATH}/funnel`
// Placeholder cards per column while the board loads (the default pipeline has six stages).
const SKELETON_COLUMNS = [2, 3, 1, 2, 1, 0]
// The funnel's stage shapes (width, height) while it loads, narrowing like the drawing.
const SKELETON_FUNNEL = [
  [150, 250],
  [160, 204],
  [120, 168],
  [94, 140],
  [74, 108],
  [58, 64],
]

/**
 * Hiring pipeline (M-069): the company's active applications in its own stages, filtered by job, as a Board
 * (/hiring-pipeline) or a Funnel (/hiring-pipeline/funnel, owner decision 2026-11-05). Both move people the same way
 * (drag or the stage menu) and open the same candidate panel with notes and stage history (`?application=`). Not
 * selected and withdrawn applications leave both (M-076, U33). "Manage stages" is addressable at
 * /hiring-pipeline/manage-stage.
 */
export default function HiringPipelinePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const managing = pathname.endsWith('/manage-stage')
  const view = pathname.endsWith('/funnel') ? 'funnel' : 'board'
  const [params, setParams] = useSearchParams()
  const jobId = params.get('jobId') ?? ''
  const { data: pipeline, isLoading: pipelineLoading } = useGetPipelineQuery()
  const { data, isLoading: applicationsLoading, isFetching: applicationsFetching, currentData } = useGetCompanyApplicationsQuery(jobId ? { jobId } : {})
  const { data: jobs } = useGetRecruiterJobsQuery()
  const { data: funnel, isLoading: funnelLoading } = useGetPipelineFunnelQuery(jobId ? { jobId } : {}, { skip: view !== 'funnel' })
  const stages = pipeline?.items ?? []
  const applications = data?.items ?? []
  // P11d-A6: a drop into or out of an Interview stage keeps the interview consistent.
  const interviewMove = useInterviewMove()
  const move = useStageMove(applications, (application, stageId) => interviewMove.request(application, stageId, stages))
  const opened = applications.find((application) => application.id === params.get('application'))
  const funnelStages = funnel?.items ?? []
  // `boardLoading`: nothing to show yet. `busy`: another job's applications are loading; the board stays, dimmed.
  const boardLoading = pipelineLoading || applicationsLoading
  const busy = applicationsFetching && !currentData && !boardLoading
  const selectedStage = funnelStages.find((stage) => stage.id === params.get('stage')) ?? funnelStages.find((stage) => stage.now > 0) ?? funnelStages[0]

  /** Sets or clears one query value, keeping the others (job filter, selected stage, open panel). */
  function setParam(name, value) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(name, value)
        else next.delete(name)
        return next
      },
      { replace: true },
    )
  }

  const jobOptions = [{ value: '', label: t('applications:recruiter.allJobs') }, ...(jobs?.items ?? []).filter((job) => job.status !== 'draft').map((job) => ({ value: job.id, label: job.title }))]
  const openPanel = (id) => setParam('application', id)

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

      <div className={styles.summary} data-tour="pipeline-filters">
        <SelectField variant="filter"
          className={styles.jobFilter}
          aria-label={t('applications:recruiter.jobFilter')}
          name="jobId"
          options={jobOptions}
          value={jobId}
          onChange={(event) => setParam('jobId', event.target.value)}
        />
        <p className={styles.count}>{boardLoading ? <Skeleton width={180} /> : t('applications:board.summary', { count: applications.length, stages: stages.length })}</p>
        <ViewToggle
          className={styles.views}
          label={t('applications:board.views.label')}
          items={[
            { id: 'board', label: t('applications:board.views.board'), icon: Columns3, iconSize: 13 },
            { id: 'funnel', label: t('applications:board.views.funnel'), icon: Layers, iconSize: 13 },
          ]}
          value={view}
          onChange={(next) => navigate(`${next === 'funnel' ? FUNNEL_PATH : PIPELINE_PATH}${search}`)}
        />
      </div>

      {view === 'funnel' ? (
        funnelLoading ? (
          <SkeletonRegion as="section" className={styles.funnelCard}>
            <div className={styles.skeletonFunnel}>
              {SKELETON_FUNNEL.map(([width, height], index) => (
                <div key={index} className={styles.skeletonStage}>
                  <span className={styles.skeletonShape}>
                    <Skeleton shape="circle" width={width} height={height} />
                  </span>
                  <Skeleton width={64} />
                  <Skeleton width={14} height={12} />
                  <Skeleton width={84} height={8} />
                </div>
              ))}
            </div>
            <div className={styles.funnelStats}>
              {[0, 1, 2].map((index) => (
                <p key={index}>
                  <Skeleton width={32} height={20} /> <Skeleton width={64} />
                </p>
              ))}
            </div>
            <p className={styles.funnelHint}>{t('applications:funnel.hint')}</p>
          </SkeletonRegion>
        ) : funnel && (
          <section className={styles.funnelCard} aria-label={t('applications:funnel.label')}>
            <PipelineFunnel stages={funnelStages} selectedId={selectedStage?.id} onSelect={(id) => setParam('stage', id)} move={move} />
            <div className={styles.funnelStats}>
              <p>
                <strong>{funnel.applicants}</strong> {t('applications:funnel.applicants', { count: funnel.applicants })}
              </p>
              <p>
                <strong>{funnel.hired}</strong> {t('applications:funnel.hired')}
              </p>
              <p>
                <strong>{funnel.applicants ? `${Math.round((funnel.hired / funnel.applicants) * 1000) / 10}%` : '0%'}</strong> {t('applications:funnel.conversion')}
              </p>
            </div>
            <p className={styles.funnelHint}>{t('applications:funnel.hint')}</p>
            {selectedStage && (
              <FunnelStageList
                stage={selectedStage}
                applications={applications.filter((application) => application.stage.id === selectedStage.id)}
                stages={stages}
                move={move}
                onOpen={openPanel}
              />
            )}
          </section>
        )
      ) : (
        <div className={`${styles.board} ${busy ? styles.busy : ''}`} role="region" aria-label={t('applications:board.label')} aria-busy={busy || undefined} tabIndex={0}>
          {boardLoading && (
            <SkeletonRegion className={styles.skeletonBoard}>
              {SKELETON_COLUMNS.map((cards, index) => (
                <PipelineColumnSkeleton key={index}>
                  {Array.from({ length: cards }, (_, card) => (
                    <ApplicantCardSkeleton key={card} />
                  ))}
                </PipelineColumnSkeleton>
              ))}
            </SkeletonRegion>
          )}
          {(boardLoading ? [] : stages).map((stage) => {
            const cards = applications.filter((application) => application.stage.id === stage.id)
            return (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                count={cards.length}
                isDropTarget={move.draggingId !== null && move.dropStageId === stage.id}
                onDragOver={(event) => move.over(event, stage.id)}
                onDragLeave={move.leave}
                onDrop={(event) => move.drop(event, stage.id)}
              >
                {cards.map((application) => (
                  <ApplicantCard
                    key={application.id}
                    application={application}
                    stages={stages}
                    dragging={move.draggingId === application.id}
                    onDragStart={move.start}
                    onDragEnd={move.end}
                    onOpen={openPanel}
                  />
                ))}
              </PipelineColumn>
            )
          })}
        </div>
      )}

      <ApplicantPanel application={opened} stages={stages} onClose={() => setParam('application', '')} />
      {interviewMove.element}
      <ManageStagesModal open={managing} onClose={() => navigate(PIPELINE_PATH)} stages={stages} />
    </div>
  )
}
