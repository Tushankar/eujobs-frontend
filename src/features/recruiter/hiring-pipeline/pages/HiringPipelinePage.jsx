import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import ApplicantCard from '../components/ApplicantCard.jsx'
import ManageStagesModal from '../components/ManageStagesModal.jsx'
import PipelineColumn from '../components/PipelineColumn.jsx'
import { usePipeline } from '../hooks/usePipeline.js'
import styles from './HiringPipelinePage.module.css'

const PIPELINE_PATH = '/recruiter/hiring-pipeline'
const MANAGE_PATH = `${PIPELINE_PATH}/manage-stage`

/**
 * Hiring pipeline board. Cards move between stages by dragging or with the stage menu on each card.
 * The "Manage stages" dialog is a state of this page, addressable at /hiring-pipeline/manage-stage.
 */
export default function HiringPipelinePage() {
  const { stages, openApplicants, moveTo, addStage, renameStage, moveStage, removeStage } = usePipeline()
  const navigate = useNavigate()
  const managing = useLocation().pathname.endsWith('/manage-stage')
  const [draggingId, setDraggingId] = useState(null)
  const [dropStageId, setDropStageId] = useState(null)

  function drop(event, stageId) {
    event.preventDefault()
    const applicantId = event.dataTransfer.getData('text/plain') || draggingId
    if (applicantId) moveTo(applicantId, stageId)
    setDraggingId(null)
    setDropStageId(null)
  }

  return (
    <div>
      <PageTitle
        className={styles.pageTitle}
        title="Keep good people moving forward."
        description="A clear, human-led hiring process. Drag to move, or use the stage menu on each card."
        actions={
          <Button variant="outline" leftIcon={<Icon as={Settings2} size={14} />} onClick={() => navigate(MANAGE_PATH)}>
            Manage stages
          </Button>
        }
      />

      <div className={styles.summary}>
        <span className={styles.chip}>All open roles</span>
        <p className={styles.count}>
          {openApplicants.length} candidates · {stages.length} stages
        </p>
      </div>

      <div className={styles.board} role="region" aria-label="Hiring pipeline board" tabIndex={0}>
        {stages.map((stage) => {
          const cards = openApplicants.filter((applicant) => applicant.stageId === stage.id)
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
              {cards.map((applicant) => (
                <ApplicantCard
                  key={applicant.id}
                  applicant={applicant}
                  stages={stages}
                  dragging={draggingId === applicant.id}
                  onStageChange={(stageId) => moveTo(applicant.id, stageId)}
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

      <ManageStagesModal
        open={managing}
        onClose={() => navigate(PIPELINE_PATH)}
        stages={stages}
        onAdd={addStage}
        onRename={renameStage}
        onMove={moveStage}
        onRemove={removeStage}
      />
    </div>
  )
}
