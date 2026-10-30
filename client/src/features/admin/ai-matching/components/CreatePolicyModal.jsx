import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import aiSparkle from '@/assets/icons/ai-sparkle-blue-16.svg'
import { Button, Icon, Modal, TextareaField, TextField } from '@/components/ui'
import { suggestDescription } from '../data/matching.js'
import styles from './CreatePolicyModal.module.css'

function validate({ name, description }, existingNames) {
  const errors = {}
  const trimmedName = name.trim()
  if (!trimmedName) errors.name = 'Enter a policy name.'
  else if (trimmedName.length < 3) errors.name = 'Policy name must be at least 3 characters.'
  else if (trimmedName.length > 60) errors.name = 'Policy name must be 60 characters or fewer.'
  else if (existingNames.includes(trimmedName.toLowerCase())) {
    errors.name = 'A policy with this name already exists. Choose a different name.'
  }

  const trimmedDescription = description.trim()
  if (!trimmedDescription) errors.description = 'Describe the roles, market, or review context this policy supports.'
  else if (trimmedDescription.length < 20) errors.description = 'Add more detail: at least 20 characters.'
  else if (trimmedDescription.length > 500) errors.description = 'Keep the description to 500 characters or fewer.'
  return errors
}

/**
 * "Create matching policy" dialog. Creates a named draft with every approved signal on; human review
 * stays required. "Improve description" is a local template rewrite, not a model call.
 */
export default function CreatePolicyModal({ existingNames, onClose, onCreate }) {
  const [values, setValues] = useState({ name: '', description: '' })
  const [errors, setErrors] = useState({})
  const [suggested, setSuggested] = useState(false)

  const hasText = values.name.trim() !== '' && values.description.trim() !== ''

  function update(field) {
    return (event) => {
      setValues((current) => ({ ...current, [field]: event.target.value }))
      setErrors((current) => ({ ...current, [field]: undefined }))
      setSuggested(false)
    }
  }

  function handleImprove() {
    setValues((current) => ({ ...current, description: suggestDescription(current.name, current.description) }))
    setErrors((current) => ({ ...current, description: undefined }))
    setSuggested(true)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate(values, existingNames)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onCreate({ name: values.name.trim(), description: values.description.trim() })
  }

  return (
    <Modal open onClose={onClose} title="Create matching policy" width={512} divided>
      <form onSubmit={handleSubmit} noValidate>
        <p className={styles.intro}>
          Start a named draft with all approved evidence signals enabled. Human review is always required and cannot be
          disabled.
        </p>

        <TextField
          className={styles.field}
          label="Policy name"
          placeholder="For example, UK product roles"
          value={values.name}
          onChange={update('name')}
          error={errors.name}
          maxLength={80}
          autoComplete="off"
          data-autofocus
        />
        <TextareaField
          className={styles.descriptionField}
          label="Policy description"
          placeholder="Describe the roles, market, or review context this policy supports."
          hint="Explain when this policy should be used."
          value={values.description}
          onChange={update('description')}
          error={errors.description}
          rows={4}
        />

        <div className={styles.assist}>
          <span className={styles.assistIcon}>
            <img src={aiSparkle} alt="" width={16} height={16} />
          </span>
          <div className={styles.assistBody}>
            <p className={styles.assistTitle}>AI-assisted policy suggestion</p>
            <p className={styles.assistText}>
              {suggested
                ? 'Suggestion added to the description. Review and edit it before creating the draft.'
                : 'Add a policy name and description to receive a tailored suggestion.'}
            </p>
            <Button
              variant="outline"
              className={styles.improve}
              disabled={!hasText}
              onClick={handleImprove}
              leftIcon={<Icon as={Sparkles} size={13} />}
            >
              Improve description
            </Button>
            <p className={styles.assistNote}>Local suggestion only. Review and edit the result before creating the draft.</p>
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={styles.create} disabled={!hasText}>
            Create draft policy
          </Button>
        </div>
      </form>
    </Modal>
  )
}
