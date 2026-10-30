import { useState } from 'react'
import { Button, Modal, SelectField, TextareaField } from '@/components/ui'
import styles from './EarlierVersionModal.module.css'

const REASONS = [
  'Verify employment history',
  'Review an earlier role-specific CV',
  'Compliance or audit check',
  'Other recruitment purpose',
]

/**
 * "Request earlier version": a recorded request for a historical CV. Access is never granted here; confirming
 * only records the request on this device. Mount it only while it is open so the form resets each time.
 */
export default function EarlierVersionModal({ candidate, onClose, onRecord }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    if (!reason) {
      setError('Choose a reason for the request.')
      return
    }
    onRecord(reason, details.trim())
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Request earlier version"
      description={`Access to earlier versions is not granted automatically. This request is recorded on this device only; ${candidate.name} is not contacted.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="earlier-version-form">
            Record request
          </Button>
        </>
      }
    >
      <form id="earlier-version-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        <SelectField
          label="Reason for the request"
          placeholder="Choose a reason"
          value={reason}
          error={error}
          options={REASONS}
          data-autofocus
          onChange={(event) => {
            setReason(event.target.value)
            setError('')
          }}
        />
        <TextareaField
          label="Details (optional)"
          rows={4}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
      </form>
    </Modal>
  )
}
