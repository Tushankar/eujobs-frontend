import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, ShieldCheck, X } from 'lucide-react'
import { Button, Icon, IconButton } from '@/components/ui'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import UploadDropzone from '../../cv/components/UploadDropzone.jsx'
import { CV_STORAGE_KEY, INITIAL_CV } from '../../cv/data/cvVersions.js'
import { addUpload, validateCvFile } from '../../cv/utils/cvVersions.js'
import OnboardingStep from '../components/OnboardingStep.jsx'
import { INITIAL_ONBOARDING, ONBOARDING_STORAGE_KEY } from '../data/onboarding.js'
import { formatFileSize } from '../utils/onboarding.js'
import styles from './StoryStepPage.module.css'

const NEXT_STEP = '/candidate/onboarding/preferences'

/**
 * Step 1 of 2: choose a resume (optional). Nothing is uploaded or read: only the file name and
 * size are used, and the name is recorded as the live CV when the candidate continues.
 */
export default function StoryStepPage() {
  const navigate = useNavigate()
  const [onboarding, setOnboarding] = useLocalStorage(ONBOARDING_STORAGE_KEY, INITIAL_ONBOARDING)
  const [cv, setCv] = useLocalStorage(CV_STORAGE_KEY, INITIAL_CV)
  // `recorded` marks a resume that was already added on an earlier visit (the candidate came back from step 2).
  const [resume, setResume] = useState(onboarding.resumeName ? { name: onboarding.resumeName, recorded: true } : null)
  const [error, setError] = useState('')

  function handleFile(file) {
    const problem = validateCvFile(file)
    setError(problem)
    if (!problem) setResume({ name: file.name, size: file.size, recorded: false })
  }

  function handleRemove() {
    setResume(null)
    setError('')
  }

  function goToPreferences() {
    if (resume && !resume.recorded) setCv(addUpload(cv, resume.name).cv)
    setOnboarding({ ...onboarding, resumeName: resume ? resume.name : null })
    navigate(NEXT_STEP)
  }

  return (
    <OnboardingStep
      step={1}
      stepName="Your story"
      title="A better match starts with you."
      lead="Upload your resume, review your experience, and decide what to share."
      footer={
        resume ? (
          <Button rightIcon={<Icon as={ArrowRight} size={14} />} onClick={goToPreferences}>
            Continue
          </Button>
        ) : (
          <Button variant="ghost" className={styles.skip} rightIcon={<Icon as={ArrowRight} size={12} />} onClick={goToPreferences}>
            I’ll add my resume later
          </Button>
        )
      }
    >
      <UploadDropzone onFile={handleFile} />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div role="status">
        {resume && (
          <div className={styles.file}>
            <Icon as={FileText} size={20} className={styles.fileIcon} />
            <span className={styles.fileName}>{resume.name}</span>
            {resume.size !== undefined && <span className={styles.fileSize}>{formatFileSize(resume.size)}</span>}
            <IconButton icon={X} iconSize={14} label={`Remove ${resume.name}`} className={styles.remove} onClick={handleRemove} />
          </div>
        )}
      </div>
      <p className={styles.privacy}>
        <Icon as={ShieldCheck} size={17} className={styles.privacyIcon} />
        Your resume is processed in your browser. We don’t upload the file or share it with anyone. Local text extraction
        is a preview, not a connected AI service.
      </p>
    </OnboardingStep>
  )
}
