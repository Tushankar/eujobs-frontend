import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Icon } from '@/components/ui'
import { useUploadText } from '@/lib/forms.js'
import { cx } from '@/utils/cx.js'
import styles from './UploadDropzone.module.css'

/** File picker + drag-and-drop target for a CV (types and size from GET /meta/config). Hands the chosen file to `onFile`. */
export default function UploadDropzone({ onFile, disabled = false }) {
  const { t } = useTranslation()
  const { data: config } = useGetConfigQuery()
  const rule = config?.limits.uploads.cv
  const uploadText = useUploadText(rule)
  const [dragging, setDragging] = useState(false)

  function handleChange(event) {
    const file = event.target.files?.[0]
    if (file) onFile(file)
    event.target.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file && !disabled) onFile(file)
  }

  return (
    <label
      className={cx(styles.zone, dragging && styles.dragging)}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        className="sr-only"
        accept={rule?.types.map((type) => `.${type}`).join(',')}
        disabled={disabled}
        onChange={handleChange}
      />
      <span className={styles.iconTile}>
        <Icon as={Upload} size={25} />
      </span>
      <span className={styles.title}>{t('common:cvUpload.title')}</span>
      <span className={styles.hint}>{t('common:cvUpload.hint')}</span>
      <span className={styles.limits}>{uploadText.limits}</span>
    </label>
  )
}
