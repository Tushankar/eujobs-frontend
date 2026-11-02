import { useTranslation } from 'react-i18next'
import { Check, Upload } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import styles from './DocumentUpload.module.css'

/**
 * One KYC document row (M-185): while the application is editable the row is a file input that uploads at once;
 * an uploaded file shows its name and size with View and Remove.
 */
export default function DocumentUpload({ title, optional = false, description, document, accept, editable, uploading, error, onSelect, onRemove }) {
  const { t } = useTranslation()
  const format = useFormat()

  function handleChange(event) {
    const file = event.target.files?.[0]
    if (file) onSelect(file)
    event.target.value = ''
  }

  const body = (
    <>
      <span className={styles.iconTile}>
        <Icon as={document ? Check : Upload} size={19} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>
          {title}
          {optional && <span className={styles.optional}>{t('auth:onboarding.kyc.optional')}</span>}
        </span>
        <span className={styles.description}>{description}</span>
        {uploading && <span className={styles.description}>{t('auth:onboarding.kyc.uploading')}</span>}
        {document && (
          <span className={styles.fileName}>
            <Icon as={Check} size={13} strokeWidth={2.2} />
            {t('auth:onboarding.kyc.uploaded', { name: document.name, size: format.fileSize(document.size) })}
          </span>
        )}
      </span>
    </>
  )

  return (
    <div>
      <div className={styles.rowWrap}>
        {editable ? (
          <label className={styles.row}>
            <input type="file" className={styles.input} accept={accept} aria-invalid={Boolean(error) || undefined} disabled={uploading} onChange={handleChange} />
            {body}
            <span className={styles.action}>{t(document ? 'auth:onboarding.kyc.replace' : 'auth:onboarding.kyc.choose')}</span>
          </label>
        ) : (
          <div className={styles.row}>{body}</div>
        )}
        {document && (
          <div className={styles.fileActions}>
            {document.url && (
              <Button as="a" href={document.url} target="_blank" rel="noopener noreferrer" variant="ghost" size="sm">
                {t('auth:onboarding.kyc.view')}
              </Button>
            )}
            {editable && (
              <Button variant="ghost" size="sm" onClick={onRemove}>
                {t('auth:onboarding.kyc.remove')}
              </Button>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
