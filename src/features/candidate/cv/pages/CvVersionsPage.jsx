import { useState } from 'react'
import { FileText, ShieldCheck } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import aiSparkle from '@/assets/icons/cv-ai-sparkle-ink.svg'
import ComparePanel from '../components/ComparePanel.jsx'
import UploadDropzone from '../components/UploadDropzone.jsx'
import VersionRow from '../components/VersionRow.jsx'
import { CV_STORAGE_KEY, INITIAL_CV } from '../data/cvVersions.js'
import { addDraft, addUpload, approveVersion, validateCvFile } from '../utils/cvVersions.js'
import styles from './CvVersionsPage.module.css'

/** "CV & versions": upload a resume, review the snapshot history, compare versions and approve one as live. */
export default function CvVersionsPage() {
  const [cv, setCv] = useLocalStorage(CV_STORAGE_KEY, INITIAL_CV)
  const [compareIds, setCompareIds] = useState([])
  const [uploadError, setUploadError] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [historyMessage, setHistoryMessage] = useState('')

  const compared = cv.versions.filter((version) => compareIds.includes(version.id))

  function handleFile(file) {
    const problem = validateCvFile(file)
    setUploadError(problem)
    if (problem) {
      setUploadMessage('')
      return
    }
    const { entry, cv: next } = addUpload(cv, file.name)
    setCv(next)
    setUploadMessage(`${file.name} was added as Version ${entry.version} and is now your live CV. Only the file name is kept in this browser.`)
  }

  function handleCreateDraft() {
    const { entry, cv: next } = addDraft(cv)
    setCv(next)
    setHistoryMessage(`Version ${entry.version} was drafted on this device. It stays pending until you approve it as your live CV.`)
  }

  function handleApprove(version) {
    setCv(approveVersion(cv, version.id))
    setHistoryMessage(`Version ${version.version} is now your live CV.`)
  }

  function toggleCompare(id) {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      return [...current, id].slice(-2)
    })
  }

  return (
    <>
      <PageTitle
        eyebrow="Your experience, understood"
        title="A better match starts with you."
        description="Upload your resume, review your experience, and decide what to share."
      />

      <Panel padding={40} className={styles.upload}>
        <UploadDropzone onFile={handleFile} />
        {uploadError && (
          <p className={styles.error} role="alert">
            {uploadError}
          </p>
        )}
        {uploadMessage && (
          <p className={styles.success} role="status">
            {uploadMessage}
          </p>
        )}
        <p className={styles.privacy}>
          <Icon as={ShieldCheck} size={17} className={styles.privacyIcon} />
          Your resume is processed in your browser. We don’t upload the file or share it with anyone. Local text
          extraction is a preview, not a connected AI service.
        </p>
      </Panel>

      <section className={styles.history} aria-labelledby="cv-history-heading">
        <div className={styles.historyHeader}>
          <div className={styles.historyText}>
            <h2 className={styles.historyTitle} id="cv-history-heading">
              CV version history
            </h2>
            <p className={styles.historyLead}>
              Every approved upload is a separate snapshot. AI-assisted drafts stay pending until you explicitly approve
              one as your live CV.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={cv.versions.length === 0}
            onClick={handleCreateDraft}
          >
            <img src={aiSparkle} alt="" width={16} height={16} />
            Create assisted draft
          </Button>
        </div>
        {historyMessage && (
          <p className={styles.success} role="status">
            {historyMessage}
          </p>
        )}

        {cv.versions.length === 0 ? (
          <div className={styles.historyBody}>
            <EmptyState
              icon={FileText}
              title="No CV versions on this device"
              description="Upload a resume above to create the first snapshot."
            />
          </div>
        ) : (
          <div className={styles.historyBody}>
            <Panel padding={0} className={styles.versions}>
              {cv.versions.map((version) => (
                <VersionRow
                  key={version.id}
                  version={version}
                  live={version.id === cv.liveId}
                  comparing={compareIds.includes(version.id)}
                  onToggleCompare={() => toggleCompare(version.id)}
                  onApprove={() => handleApprove(version)}
                />
              ))}
            </Panel>
            <ComparePanel selected={compared} />
          </div>
        )}
      </section>
    </>
  )
}
