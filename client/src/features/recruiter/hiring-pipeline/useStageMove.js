import { useState } from 'react'
import { useMoveApplicationMutation } from '@/features/recruiter/applications/api.js'

/**
 * Dragging an application onto a stage, shared by the board columns and the funnel stages: the same move call
 * (stage emails, history, M-070) whichever view it comes from. `applications` are the rows that can be dragged.
 */
export function useStageMove(applications) {
  const [move] = useMoveApplicationMutation()
  const [draggingId, setDraggingId] = useState(null)
  const [dropStageId, setDropStageId] = useState(null)

  function end() {
    setDraggingId(null)
    setDropStageId(null)
  }

  return {
    draggingId,
    dropStageId,
    start: setDraggingId,
    end,
    over(event, stageId) {
      if (draggingId === null) return
      event.preventDefault()
      setDropStageId(stageId)
    },
    leave(event) {
      if (!event.currentTarget.contains(event.relatedTarget)) setDropStageId(null)
    },
    drop(event, stageId) {
      event.preventDefault()
      const id = event.dataTransfer.getData('text/plain') || draggingId
      const application = applications.find((item) => item.id === id)
      if (application && application.stage.id !== stageId) move({ id, stageId })
      end()
    },
  }
}
