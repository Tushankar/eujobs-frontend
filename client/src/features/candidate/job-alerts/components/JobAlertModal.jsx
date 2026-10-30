import { useState } from 'react'
import { Button, Modal, SelectField, TextField } from '@/components/ui'
import { FREQUENCIES } from '../data/alerts.js'
import styles from './JobAlertModal.module.css'

function validate(values) {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Give the alert a name, like “Remote product design roles”.'
  if (!values.keywords.trim()) errors.keywords = 'Add a job title, skill or company to watch for.'
  return errors
}

function AlertForm({ alert, onSave, onClose }) {
  const [values, setValues] = useState({
    name: alert?.name ?? '',
    keywords: alert?.keywords ?? '',
    location: alert?.location ?? '',
    frequency: alert?.frequency ?? FREQUENCIES[0],
  })
  const [errors, setErrors] = useState({})
  const formId = 'job-alert-form'

  function setField(name) {
    return (event) => {
      setValues((current) => ({ ...current, [name]: event.target.value }))
      if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }))
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSave({
      id: alert?.id ?? `alert-${Date.now()}`,
      name: values.name.trim(),
      keywords: values.keywords.trim(),
      location: values.location.trim(),
      frequency: values.frequency,
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={alert ? 'Edit job alert' : 'Create job alert'}
      description="Get a digest of new roles that match. Demo alerts are saved on this device only."
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId}>
            {alert ? 'Save changes' : 'Create alert'}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Alert name"
          data-autofocus
          placeholder="Remote product design roles"
          value={values.name}
          onChange={setField('name')}
          error={errors.name}
        />
        <TextField
          label="Keywords"
          placeholder="Job title, skills, or company"
          value={values.keywords}
          onChange={setField('keywords')}
          error={errors.keywords}
        />
        <div className={styles.row}>
          <TextField label="Location (optional)" placeholder="Anywhere" value={values.location} onChange={setField('location')} />
          <SelectField label="How often" options={FREQUENCIES.map((value) => ({ value, label: `${value} digest` }))} value={values.frequency} onChange={setField('frequency')} />
        </div>
      </form>
    </Modal>
  )
}

/** Create / edit dialog for a job alert. Rendered only while open, so the form always starts fresh. */
export default function JobAlertModal({ open, alert, onSave, onClose }) {
  if (!open) return null
  return <AlertForm alert={alert} onSave={onSave} onClose={onClose} />
}
