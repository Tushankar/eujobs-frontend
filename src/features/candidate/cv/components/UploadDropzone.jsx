import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Icon } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import { ACCEPTED_CV_EXTENSIONS, MAX_CV_SIZE_MB } from '../data/cvVersions.js'
import styles from './UploadDropzone.module.css'

/** Real file picker + drag-and-drop target. Hands the chosen file to `onFile`; nothing is uploaded anywhere. */
export default function UploadDropzone({ onFile }) {
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
    if (file) onFile(file)
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
      <input type="file" className="sr-only" accept={ACCEPTED_CV_EXTENSIONS.join(',')} onChange={handleChange} />
      <span className={styles.iconTile}>
        <Icon as={Upload} size={25} />
      </span>
      <span className={styles.title}>Drop your resume here</span>
      <span className={styles.hint}>or click to choose a file</span>
      <span className={styles.limits}>PDF or DOCX · Up to {MAX_CV_SIZE_MB} MB</span>
    </label>
  )
}
