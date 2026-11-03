import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { useGetConfigQuery } from '@/app/api.js'
import { checkUpload, useErrorText, useUploadText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { uploadCourseFile } from '../api.js'
import styles from './builder.module.css'

const ACCEPT = { course_cover: 'image/jpeg,image/png,image/webp', lesson_video: 'video/mp4,video/webm', lesson_document: 'application/pdf' }

/**
 * Uploads one course file (M-102, M-107) with a progress bar. The type and size limits come from GET /meta/config;
 * the server checks them again. `onUploaded(file, localFile)` gets the stored file and the chosen one.
 */
export default function FileUpload({ purpose, label, current, onUploaded, disabled = false }) {
  const { t } = useTranslation('courses')
  const format = useFormat()
  const errorText = useErrorText()
  const id = useId()
  const { data: config } = useGetConfigQuery()
  const rule = config?.limits.uploads[purpose]
  const uploadText = useUploadText(rule)
  const [progress, setProgress] = useState(null)
  const [problem, setProblem] = useState('')

  async function handleChange(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file || !rule) return
    const local = checkUpload(file, rule)
    if (local) return setProblem(uploadText.problem(local, file))
    setProblem('')
    setProgress(0)
    try {
      onUploaded(await uploadCourseFile(purpose, file, setProgress), file)
    } catch (error) {
      setProblem(errorText.code(error))
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className={styles.upload} data-upload={purpose}>
      <p className={styles.label}>{label}</p>
      {current && (
        <p className={styles.current} data-upload-current>
          {current.name} · {format.fileSize(current.size)}
        </p>
      )}
      <Button as="label" htmlFor={id} variant="outline" leftIcon={<Icon as={Upload} size={14} />} disabled={disabled || progress !== null}>
        {t(current ? 'upload.replace' : 'upload.choose')}
      </Button>
      <input id={id} type="file" accept={ACCEPT[purpose]} className="sr-only" onChange={handleChange} disabled={disabled || progress !== null} />
      <p className={styles.hint}>{uploadText.limits}</p>
      {progress !== null && (
        <div className={styles.progress} role="progressbar" aria-label={t('upload.progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} data-upload-progress>
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {problem && (
        <p className={styles.error} role="alert" data-upload-error>
          {problem}
        </p>
      )}
    </div>
  )
}
