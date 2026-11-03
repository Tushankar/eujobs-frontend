import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, ShieldCheck } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Icon, Panel } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import { checkUpload, serverFieldErrors, useErrorText, useUploadText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import {
  useConfirmSnapshotMutation,
  useCreateDraftMutation,
  useDeleteCvMutation,
  useDeleteDraftMutation,
  useGetCvDownloadUrlMutation,
  useGetCvVersionsQuery,
  useProposeSnapshotMutation,
  useSetLiveCvMutation,
  useUploadCvMutation,
} from '../api.js'
import ComparePanel from '../components/ComparePanel.jsx'
import CvRequests from '../components/CvRequests.jsx'
import SnapshotDialog from '../components/SnapshotDialog.jsx'
import UploadDropzone from '../components/UploadDropzone.jsx'
import VersionRow from '../components/VersionRow.jsx'
import styles from './CvVersionsPage.module.css'

/**
 * "CV & versions" (M-027 … M-031, U18): upload (text extracted on the server), the version history, the live
 * choice, downloads through signed URLs and deleting non-live versions; then companies' requests for earlier
 * versions and the download log (M-029, M-187). Plus adds the AI (M-027, M-061): a Plus upload proposes a profile
 * snapshot at once, which changes the profile only when confirmed (P9-Q3); assisted drafts; and the Compare panel
 * (P3-Q3, back in Phase 9) for the snapshots of two versions.
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
  const [proposeSnapshot] = useProposeSnapshotMutation()
  const [confirmSnapshot, confirming] = useConfirmSnapshotMutation()
  const [createDraft] = useCreateDraftMutation()
  const [deleteDraft] = useDeleteDraftMutation()
  const { me } = usePreferences()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [reviewError, setReviewError] = useState('')
  const [comparing, setComparing] = useState([])
  const [busy, setBusy] = useState(null)
  const [aiFailure, setAiFailure] = useState(null)
  const versions = cv?.items ?? []
  const compared = versions.filter((version) => comparing.includes(version.id))

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
      // M-027: a Plus upload with readable text gets its snapshot proposal at once.
      if (!lacksEntitlement(me, 'ai') && !items[0].noReadableText) await runAi(items[0], 'snapshot')
    } catch (failure) {
      report(failure)
    }
  }

  /** A snapshot proposal or an assisted draft; a failure shows AiStatus (unavailable, the daily limit) with Try again. */
  async function runAi(version, kind) {
    setAiFailure(null)
    setBusy({ id: version.id, kind })
    try {
      if (kind === 'snapshot') await proposeSnapshot(version.id).unwrap()
      else await createDraft(version.id).unwrap()
      setMessage(t(kind === 'snapshot' ? 'cv:snapshot.proposed' : 'cv:draft.created', { number: version.number }))
    } catch (failure) {
      setAiFailure({ failure, retry: () => runAi(version, kind) })
    } finally {
      setBusy(null)
    }
  }

  async function handleConfirm() {
    setReviewError('')
    try {
      await confirmSnapshot(reviewing.id).unwrap()
      setMessage(t('cv:snapshot.confirmed', { number: reviewing.number }))
      setReviewing(null)
    } catch (failure) {
      setReviewError(errorText.code(failure))
    }
  }

  const toggleCompare = (id) =>
    setComparing((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(-2)))

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
        {aiFailure && <AiStatus error={aiFailure.failure} onRetry={aiFailure.retry} />}
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
            <>
              <Panel padding={0} className={styles.versions}>
                {versions.map((version) => (
                  <VersionRow
                    key={version.id}
                    version={version}
                    comparing={comparing.includes(version.id)}
                    busy={busy?.id === version.id ? busy.kind : null}
                    onDownload={() => download(version)}
                    onSetLive={() => act(() => setLiveCv(version.id).unwrap(), t('cv:liveSet', { number: version.number }))}
                    onDelete={() => setDeleting(version)}
                    onToggleCompare={() => toggleCompare(version.id)}
                    onPropose={() => runAi(version, 'snapshot')}
                    onReview={() => setReviewing(version)}
                    onDraft={() => runAi(version, 'draft')}
                    onDeleteDraft={(draft) => act(() => deleteDraft(draft.id).unwrap(), t('cv:draft.deleted'))}
                  />
                ))}
              </Panel>
              <ComparePanel selected={compared} />
            </>
          )}
        </div>
      </section>

      <CvRequests versions={versions} />

      {reviewing && (
        <SnapshotDialog
          version={versions.find((version) => version.id === reviewing.id)}
          busy={confirming.isLoading}
          error={reviewError}
          onConfirm={handleConfirm}
          onClose={() => setReviewing(null)}
        />
      )}

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
