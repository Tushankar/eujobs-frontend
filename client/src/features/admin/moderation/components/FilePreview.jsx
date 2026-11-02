import { useTranslation } from 'react-i18next'
import { errorCode } from '@/app/api.js'
import { useGetAdminFileUrlQuery } from '../api.js'
import detailStyles from './ReviewDetails.module.css'
import styles from './VerificationReview.module.css'

/** A sensitive file for review (§2.6, `documents.view`): an image inline, every file as a link. `file` = { id, name, mime }. */
export default function FilePreview({ file }) {
  const { t } = useTranslation()
  const { data, error } = useGetAdminFileUrlQuery(file.id)
  if (errorCode(error) === 'PERMISSION_DENIED') return <p className={detailStyles.contextText}>{t('moderation:verification.dialog.noPreview', error.data.error.params)}</p>
  if (!data) return null
  const url = `${import.meta.env.VITE_API_URL ?? ''}${data.url}`
  return (
    <div className={styles.preview}>
      {file.mime.startsWith('image/') && <img src={url} alt={t('moderation:verification.dialog.previewAlt', { name: file.name })} />}
      <a href={url} target="_blank" rel="noopener noreferrer">
        {t('moderation:verification.dialog.openFile', { name: file.name })}
      </a>
    </div>
  )
}
