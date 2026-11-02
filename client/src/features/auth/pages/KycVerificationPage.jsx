import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Icon } from '@/components/ui'
import { checkUpload, useErrorText, useUploadText } from '@/lib/forms.js'
import { useDeleteKycDocumentMutation, useUploadKycDocumentMutation } from '../api.js'
import DocumentUpload from '../components/DocumentUpload.jsx'
import StepFooter from '../components/StepFooter.jsx'
import StepHeading from '../components/StepHeading.jsx'
import { stepPath } from '../data/onboarding.js'
import { useOnboarding } from '../utils/useOnboarding.js'
import stepStyles from './OnboardingStepPage.module.css'
import styles from './KycVerificationPage.module.css'

// §3.12: identity and registration are required; authorization is optional.
const DOCUMENTS = [{ type: 'identity' }, { type: 'registration' }, { type: 'authorization', optional: true }]

/** Onboarding step 3 of 5 (M-185): uploads go to the server at once and lock when the application is submitted. */
export default function KycVerificationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const { state } = useOnboarding()
  const { data: config } = useGetConfigQuery()
  const rule = config?.limits.uploads.kyc
  const uploadText = useUploadText(rule)
  const [uploadDocument] = useUploadKycDocumentMutation()
  const [deleteDocument] = useDeleteKycDocumentMutation()
  const [uploading, setUploading] = useState(null)
  const [errors, setErrors] = useState({})
  const documentOf = (type) => state.documents.find((document) => document.type === type)

  async function handleSelect(type, file) {
    const problem = checkUpload(file, rule)
    setErrors((current) => ({ ...current, [type]: problem ? uploadText.problem(problem, file) : undefined }))
    if (problem) return
    setUploading(type)
    try {
      await uploadDocument({ type, file }).unwrap()
    } catch (failure) {
      setErrors((current) => ({ ...current, [type]: errorText.code(failure) }))
    } finally {
      setUploading(null)
    }
  }

  async function handleRemove(type) {
    try {
      await deleteDocument(documentOf(type).id).unwrap()
    } catch (failure) {
      setErrors((current) => ({ ...current, [type]: errorText.code(failure) }))
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const missing = DOCUMENTS.filter((document) => !document.optional && !documentOf(document.type))
    setErrors(Object.fromEntries(missing.map(({ type }) => [type, t(`auth:onboarding.kyc.missing.${type}`)])))
    if (missing.length === 0) navigate(stepPath('verify'))
  }

  return (
    <>
      <StepHeading title={t('auth:onboarding.kyc.title')} description={t('auth:onboarding.kyc.description')} />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.intro}>{t('auth:onboarding.kyc.intro')}</p>
        <div className={styles.documents}>
          {DOCUMENTS.map(({ type, optional }) => (
            <DocumentUpload
              key={type}
              title={t(`auth:onboarding.kyc.documents.${type}.title`)}
              description={`${t(`auth:onboarding.kyc.documents.${type}.description`)} ${uploadText.limits}`}
              optional={optional}
              document={documentOf(type)}
              accept={rule?.types.map((ext) => `.${ext}`).join(',')}
              editable={state.editable}
              uploading={uploading === type}
              error={errors[type]}
              onSelect={(file) => handleSelect(type, file)}
              onRemove={() => handleRemove(type)}
            />
          ))}
        </div>
        <p className={styles.banner}>
          <Icon as={ShieldCheck} size={16} />
          {t('auth:onboarding.privacyText')}
        </p>
        {!state.editable && <p className={stepStyles.note}>{t('auth:onboarding.locked')}</p>}
        <StepFooter onBack={() => navigate(stepPath('company'))} />
      </form>
    </>
  )
}
