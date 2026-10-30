import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, ShieldCheck } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Icon } from '@/components/ui'
import { checkUpload, serverFieldErrors, useErrorText, useUploadText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetCvVersionsQuery, useUploadCvMutation } from '../../cv/api.js'
import UploadDropzone from '../../cv/components/UploadDropzone.jsx'
import OnboardingStep from '../components/OnboardingStep.jsx'
import styles from './StoryStepPage.module.css'

const NEXT_STEP = '/candidate/onboarding/preferences'

/** Step 1 of 2 (M-014): a CV upload becomes version 1, the live CV. The CV can also be added later. */
export default function StoryStepPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const format = useFormat()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const rule = config?.limits.uploads.cv
  const uploadText = useUploadText(rule)
  const { data: cv } = useGetCvVersionsQuery()
  const [uploadCv, { isLoading: uploading, originalArgs: uploadingFile }] = useUploadCvMutation()
  const [error, setError] = useState('')
  const live = cv?.items.find((version) => version.live)

  async function handleFile(file) {
    const problem = checkUpload(file, rule)
    setError(problem ? uploadText.problem(problem, file) : '')
    if (problem) return
    try {
      await uploadCv(file).unwrap()
    } catch (failure) {
      const fields = serverFieldErrors(failure)
      setError(fields.file ? errorText.field('file', fields.file) : errorText.code(failure))
    }
  }

  return (
    <OnboardingStep
      step={1}
      stepName={t('onboarding:story.name')}
      title={t('onboarding:story.title')}
      lead={t('onboarding:story.lead')}
      footer={
        live ? (
          <Button rightIcon={<Icon as={ArrowRight} size={14} />} onClick={() => navigate(NEXT_STEP)}>
            {t('onboarding:story.continue')}
          </Button>
        ) : (
          <Button variant="ghost" className={styles.skip} rightIcon={<Icon as={ArrowRight} size={12} />} onClick={() => navigate(NEXT_STEP)}>
            {t('onboarding:story.skip')}
          </Button>
        )
      }
    >
      <UploadDropzone onFile={handleFile} disabled={uploading || !rule} />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div role="status">
        {uploading && <p className={styles.progress}>{t('onboarding:story.uploading', { name: uploadingFile.name })}</p>}
        {!uploading && live && (
          <>
            <div className={styles.file}>
              <Icon as={FileText} size={20} className={styles.fileIcon} />
              <span className={styles.fileName}>{live.originalName}</span>
              <span className={styles.fileSize}>{format.fileSize(live.size)}</span>
            </div>
            <p className={styles.progress}>{t('onboarding:story.uploaded', { name: live.originalName, number: live.number })}</p>
          </>
        )}
      </div>
      <p className={styles.privacy}>
        <Icon as={ShieldCheck} size={17} className={styles.privacyIcon} />
        {t('onboarding:story.privacy')}
      </p>
    </OnboardingStep>
  )
}
