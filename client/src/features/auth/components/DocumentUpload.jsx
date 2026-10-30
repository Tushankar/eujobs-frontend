import { Check, Upload } from 'lucide-react'
import { Icon } from '@/components/ui'
import styles from './DocumentUpload.module.css'

/**
 * One KYC document row: a real file input (the whole row is its label). The file is never
 * uploaded anywhere; only the chosen file's name is reported to the parent via `onSelect`.
 */
export default function DocumentUpload({ title, optional = false, description, fileName, error, onSelect }) {
  function handleChange(event) {
    const file = event.target.files?.[0]
    if (file) onSelect(file.name)
    event.target.value = ''
  }

  return (
    <div>
      <label className={styles.row}>
        <input
          type="file"
          className={styles.input}
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          aria-invalid={Boolean(error) || undefined}
          onChange={handleChange}
        />
        <span className={styles.iconTile}>
          <Icon as={Upload} size={19} />
        </span>
        <span className={styles.text}>
          <span className={styles.title}>
            {title}
            {optional && <span className={styles.optional}>Optional</span>}
          </span>
          <span className={styles.description}>{description}</span>
          {fileName && (
            <span className={styles.fileName}>
              <Icon as={Check} size={13} strokeWidth={2.2} />
              {fileName}
            </span>
          )}
        </span>
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
