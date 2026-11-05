import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, FileText } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { useGetAdminFileUrlQuery } from '../api.js'
import styles from './DocumentViewer.module.css'

/**
 * A sensitive file shown in the review dialog (§2.6, `documents.view`): images and PDFs inside the dialog, any file
 * in a new tab. The signed file is fetched once and shown from a local blob: URL, so the API's frame and content
 * policies (helmet) never block the inline view. `file` = { id, name, mime }.
 */
export default function DocumentViewer({ file }) {
  const { t } = useTranslation()
  const { data, error } = useGetAdminFileUrlQuery(file.id)
  const url = data && `${import.meta.env.VITE_API_URL ?? ''}${data.url}`
  const [local, setLocal] = useState({ url: null, failed: false })
  const image = file.mime.startsWith('image/')
  const pdf = file.mime === 'application/pdf'

  useEffect(() => {
    if (!url || !(image || pdf)) return undefined
    let objectUrl = null
    let cancelled = false
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.blob()
      })
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setLocal({ url: objectUrl, failed: false })
      })
      .catch(() => !cancelled && setLocal({ url: null, failed: true }))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, image, pdf])

  if (errorCode(error) === 'PERMISSION_DENIED') {
    return (
      <div className={styles.viewer}>
        <p className={styles.message}>{t('moderation:verification.dialog.noPreview', error.data.error.params)}</p>
      </div>
    )
  }

  let content
  if (!(image || pdf) || local.failed || error) content = <p className={styles.message}>{t('moderation:verification.dialog.noInline')}</p>
  else if (!local.url)
    content = (
      <SkeletonRegion className={styles.skeletonPage}>
        {[90, 75, 85, 60, 80, 70].map((width) => (
          <Skeleton key={width} width={`${width}%`} />
        ))}
      </SkeletonRegion>
    )
  else if (image) content = <img className={styles.image} src={local.url} alt={t('moderation:verification.dialog.previewAlt', { name: file.name })} />
  // PDF viewer: fit to width, page thumbnails closed (the whole pane shows the page).
  else content = <iframe className={styles.pdf} src={`${local.url}#navpanes=0&view=FitH`} title={t('moderation:verification.dialog.previewAlt', { name: file.name })} />

  return (
    <div className={styles.viewer} data-document-viewer>
      <div className={styles.bar}>
        <Icon as={FileText} size={15} />
        <span className={styles.name} title={file.name}>
          {file.name}
        </span>
        {url && (
          <a className={styles.open} href={url} target="_blank" rel="noopener noreferrer">
            {t('moderation:verification.dialog.openNewTab')}
            <Icon as={ExternalLink} size={13} />
          </a>
        )}
      </div>
      <div className={styles.stage}>{content}</div>
    </div>
  )
}
