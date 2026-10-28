import { useState } from 'react'
import { Button, Modal, TextareaField } from '@/components/ui'

/**
 * "Start a conversation": write an introduction. Nothing is sent anywhere; confirming only creates a local
 * preview (the caller records it). Mount it only while it is open so the draft resets each time.
 */
export default function MessageModal({ candidate, job, onClose, onCreate }) {
  const firstName = candidate.name.split(' ')[0]
  const [message, setMessage] = useState(
    `Hi ${firstName}, your profile stood out for ${job ? `our ${job.title} role` : 'a role we are hiring for'}. I’d like to learn more about your work. Would you be open to a short conversation?`,
  )
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    if (!message.trim()) {
      setError('Write a message before creating the preview.')
      return
    }
    onCreate(message.trim())
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Start a conversation with ${firstName}`}
      description="This is a local preview on this device. Nothing is sent to the candidate."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="candidate-message-form">
            Create message preview
          </Button>
        </>
      }
    >
      <form id="candidate-message-form" onSubmit={handleSubmit} noValidate>
        <TextareaField
          label="Message"
          rows={6}
          value={message}
          error={error}
          data-autofocus
          onChange={(event) => {
            setMessage(event.target.value)
            setError('')
          }}
        />
      </form>
    </Modal>
  )
}
