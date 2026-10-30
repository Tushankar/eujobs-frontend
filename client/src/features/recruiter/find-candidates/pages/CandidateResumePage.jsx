import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Clock, Download, Eye, FileText } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import EarlierVersionModal from '../components/EarlierVersionModal.jsx'
import ProfileSection from '../components/ProfileSection.jsx'
import ResumePreviewModal from '../components/ResumePreviewModal.jsx'
import styles from './CandidateResumePage.module.css'

export default function CandidateResumePage() {
  const { candidate, recordActivity } = useOutletContext()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [status, setStatus] = useState('')
  const fileName = `${candidate.name.replace(/\s+/g, '_')}_CV.pdf`

  function recordRequest(reason) {
    recordActivity(
      'cv-request',
      `Requested an earlier CV version (${reason.toLowerCase()}). Recorded on this device; the candidate was not contacted.`,
    )
    setRequestOpen(false)
    setStatus('Request recorded on this device. The candidate was not contacted and no earlier version is available.')
  }

  return (
    <ProfileSection labelledBy="resume-title">
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.bigIcon}>
            <Icon as={FileText} size={25} strokeWidth={2} />
          </span>
          <SectionTitle
            id="resume-title"
            title="Current live CV"
            description="The candidate’s approved live version is available to review."
          />
        </div>

        <div className={styles.file}>
          <div className={styles.fileRow}>
            <span className={styles.fileIcon}>
              <Icon as={FileText} size={20} strokeWidth={2} />
            </span>
            <div className={styles.fileText}>
              <p className={styles.fileName}>{fileName}</p>
              <p className={styles.fileMeta}>Candidate-approved · Current live version</p>
            </div>
            <PillBadge tone="success" dot>
              Live
            </PillBadge>
          </div>
          <div className={styles.fileActions}>
            <Button leftIcon={<Icon as={Eye} size={13} strokeWidth={2} />} onClick={() => setPreviewOpen(true)}>
              View live CV
            </Button>
            <Button
              variant="outline"
              leftIcon={<Icon as={Download} size={13} strokeWidth={2} />}
              onClick={() => setStatus('This demo has no CV file to download. Use View live CV to read the content on screen.')}
            >
              Download
            </Button>
          </div>
        </div>

        <p className={styles.request}>
          Need an original or earlier CV for a specific recruitment purpose? Historical versions require a separate,
          recorded request and candidate approval.
        </p>
        <div className={styles.requestAction}>
          <Button variant="outline" leftIcon={<Icon as={Clock} size={13} strokeWidth={2} />} onClick={() => setRequestOpen(true)}>
            Request earlier version
          </Button>
        </div>
        {status && (
          <p className={styles.status} role="status">
            {status}
          </p>
        )}

        <p className={styles.policy}>
          Access to earlier versions is not granted automatically. Retention periods, valid request reasons, and employer
          permissions require legal and product approval before production implementation.
        </p>
      </div>

      <ResumePreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} candidate={candidate} />
      {requestOpen && (
        <EarlierVersionModal candidate={candidate} onClose={() => setRequestOpen(false)} onRecord={recordRequest} />
      )}
    </ProfileSection>
  )
}
