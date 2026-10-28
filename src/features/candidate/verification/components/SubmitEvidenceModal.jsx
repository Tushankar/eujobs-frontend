import { useState } from 'react'
import { Button, Checkbox, Modal, SelectField } from '@/components/ui'
import { Field } from '@/components/ui/TextField.jsx'
import { EVIDENCE_EXTENSIONS, MAX_EVIDENCE_SIZE_MB } from '../data/verification.js'
import styles from './SubmitEvidenceModal.module.css'

const FORM_ID = 'submit-evidence-form'

function fileProblem(file) {
  if (!file) return 'Choose the evidence file you want to submit.'
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : ''
  if (!EVIDENCE_EXTENSIONS.includes(extension)) return `${file.name} must be a PDF, JPG, or PNG file.`
  if (file.size === 0) return `${file.name} is empty. Choose a different file.`
  if (file.size > MAX_EVIDENCE_SIZE_MB * 1024 * 1024) return `${file.name} is larger than ${MAX_EVIDENCE_SIZE_MB} MB.`
  return ''
}

function EvidenceForm({ check, onSubmit }) {
  const [evidenceType, setEvidenceType] = useState(check.evidenceTypes[0])
  const [file, setFile] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState({})

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    const problem = fileProblem(file)
    if (problem) nextErrors.file = problem
    if (!confirmed) nextErrors.confirmed = 'Confirm that this evidence is yours and accurate.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit({ evidenceType, fileName: file.name })
  }

  return (
    <form id={FORM_ID} className={styles.form} onSubmit={handleSubmit} noValidate>
      <SelectField
        label="Evidence type"
        options={check.evidenceTypes}
        value={evidenceType}
        onChange={(event) => setEvidenceType(event.target.value)}
        data-autofocus
      />
      <Field
        id="evidence-file"
        label="Evidence file"
        hint={`PDF, JPG, or PNG, up to ${MAX_EVIDENCE_SIZE_MB} MB.`}
        error={errors.file}
      >
        {({ describedBy, invalid }) => (
          <input
            id="evidence-file"
            type="file"
            className={styles.file}
            accept={EVIDENCE_EXTENSIONS.join(',')}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setErrors((current) => ({ ...current, file: undefined }))
            }}
          />
        )}
      </Field>
      <div>
        <Checkbox
          checked={confirmed}
          onChange={(event) => {
            setConfirmed(event.target.checked)
            setErrors((current) => ({ ...current, confirmed: undefined }))
          }}
        >
          This evidence is mine and accurate.
        </Checkbox>
        {errors.confirmed && (
          <p className={styles.error} role="alert">
            {errors.confirmed}
          </p>
        )}
      </div>
    </form>
  )
}

/** Collects the evidence type and file for one credential check. The file never leaves this device. */
export default function SubmitEvidenceModal({ check, onSubmit, onClose }) {
  return (
    <Modal
      open={Boolean(check)}
      onClose={onClose}
      width={480}
      title={check ? `Submit ${check.label.toLowerCase()} for review` : ''}
      description="Demo only. The file stays on this device and no reviewer receives it. Only the file name is kept."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            Submit for review
          </Button>
        </>
      }
    >
      {check && <EvidenceForm check={check} onSubmit={onSubmit} />}
    </Modal>
  )
}
