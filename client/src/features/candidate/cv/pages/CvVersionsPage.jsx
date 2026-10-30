import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, ShieldCheck } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Icon, Panel } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { checkUpload, serverFieldErrors, useErrorText, useUploadText } from '@/lib/forms.js'
import { useDeleteCvMutation, useGetCvDownloadUrlMutation, useGetCvVersionsQuery, useSetLiveCvMutation, useUploadCvMutation } from '../api.js'
import UploadDropzone from '../components/UploadDropzone.jsx'
import VersionRow from '../components/VersionRow.jsx'
import styles from './CvVersionsPage.module.css'

/**
 * "CV & versions" (M-027 … M-031, U18): upload (text extracted on the server), the version history, the live
 * choice, downloads through signed URLs and deleting non-live versions. The AI snapshot, assisted draft and
 * Compare panel come with Phase 9 (P3-Q3).
 */
export default function CvVersionsPage() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const rule = config?.limits.uploads.cv
  const uploadText = useUploadText(rule)
  const { data: cv } = useGetCvVersionsQuery()
  const [uploadCv, { isLoading: uploading, originalArgs: uploadingFile }] = useUploadCvMutation()
  const [setLiveCv] = useSetLiveCvMutation()
  const [deleteCv] = useDeleteCvMutation()
  const [getDownloadUrl] = useGetCvDownloadUrlMutation()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(null)
  const versions = cv?.items ?? []

  const report = (failure) => {
    const fields = serverFieldErrors(failure)
    setError(fields.file ? errorText.field('file', fields.file) : errorText.code(failure))
  }

  async function handleFile(file) {
    setMessage('')
    const problem = checkUpload(file, rule)
    setError(problem ? uploadText.problem(problem, file) : '')
    if (problem) return
    try {
      const { items } = await uploadCv(file).unwrap()
      setMessage(t('cv:uploaded', { name: file.name, number: items[0].number }))
    } catch (failure) {
      report(failure)
    }
  }

  async function act(work, success) {
    setError('')
    setMessage('')
    try {
      await work()
      if (success) setMessage(success)
    } catch (failure) {
      report(failure)
    }
  }

  async function download(version) {
    await act(async () => {
      const { url } = await getDownloadUrl(version.id).unwrap()
      window.location.assign(`${import.meta.env.VITE_API_URL ?? ''}${url}`)
    })
  }

  return (
    <>
      <PageTitle eyebrow={t('cv:eyebrow')} title={t('cv:title')} description={t('cv:description')} />

      <Panel padding={40} className={styles.upload}>
        <UploadDropzone onFile={handleFile} disabled={uploading || !rule} />
        <div role="status">
          {uploading && <p className={styles.success}>{t('cv:uploading', { name: uploadingFile.name })}</p>}
          {message && <p className={styles.success}>{message}</p>}
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <p className={styles.privacy}>
          <Icon as={ShieldCheck} size={17} className={styles.privacyIcon} />
          {t('cv:privacy')}
        </p>
      </Panel>

      <section className={styles.history} aria-labelledby="cv-history-heading">
        <div className={styles.historyHeader}>
          <div className={styles.historyText}>
            <h2 className={styles.historyTitle} id="cv-history-heading">
              {t('cv:history.title')}
            </h2>
            <p className={styles.historyLead}>{t('cv:history.lead')}</p>
          </div>
        </div>
        <div className={styles.historyBody}>
          {cv && versions.length === 0 ? (
            <EmptyState icon={FileText} title={t('cv:history.empty')} description={t('cv:history.emptyLead')} />
          ) : (
            <Panel padding={0} className={styles.versions}>
              {versions.map((version) => (
                <VersionRow
                  key={version.id}
                  version={version}
                  onDownload={() => download(version)}
                  onSetLive={() => act(() => setLiveCv(version.id).unwrap(), t('cv:liveSet', { number: version.number }))}
                  onDelete={() => setDeleting(version)}
                />
              ))}
            </Panel>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('cv:deleteDialog.title')}
        confirmLabel={t('cv:deleteDialog.confirm')}
        tone="danger"
        onConfirm={() => {
          const version = deleting
          setDeleting(null)
          act(() => deleteCv(version.id).unwrap(), t('cv:deleted', { number: version.number }))
        }}
        onClose={() => setDeleting(null)}
      >
        <p className={styles.historyLead}>{deleting && t('cv:deleteDialog.body', { number: deleting.number })}</p>
      </ConfirmDialog>
    </>
  )
}
