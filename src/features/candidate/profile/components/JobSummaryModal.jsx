import { useState } from 'react'
import { Copy } from 'lucide-react'
import { Button, Icon, Modal } from '@/components/ui'
import { buildJobSummary } from '../utils/profileText.js'
import styles from './JobSummaryModal.module.css'

/** Plain-language summary composed on this device from the profile fields. No AI service is connected. */
export default function JobSummaryModal({ open, profile, onClose }) {
  const [copyStatus, setCopyStatus] = useState('')
  const summary = profile ? buildJobSummary(profile) : ''

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summary)
      setCopyStatus('Summary copied to your clipboard.')
    } catch {
      setCopyStatus('Copying is blocked in this browser. Select the text and copy it instead.')
    }
  }

  function handleClose() {
    setCopyStatus('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      width={560}
      title="Ai Job Summary"
      description="Composed on this device from your profile fields. No AI service is connected."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button leftIcon={<Icon as={Copy} size={14} />} onClick={handleCopy}>
            Copy summary
          </Button>
        </>
      }
    >
      <div className={styles.summary}>
        {summary.split('\n\n').map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {copyStatus && (
        <p className={styles.status} role="status">
          {copyStatus}
        </p>
      )}
    </Modal>
  )
}
