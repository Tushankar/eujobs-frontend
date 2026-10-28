import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Icon } from '@/components/ui'
import DocumentUpload from '../components/DocumentUpload.jsx'
import StepFooter from '../components/StepFooter.jsx'
import StepHeading from '../components/StepHeading.jsx'
import { ONBOARDING_STEPS } from '../data/onboarding.js'
import { useOnboarding } from '../utils/useOnboarding.js'
import { checkDocumentFileName, validateKyc } from '../utils/validation.js'
import styles from './KycVerificationPage.module.css'

const DOCUMENTS = [
  {
    id: 'identity',
    title: 'Government-issued identity document',
    description: 'Required for the responsible person. PDF, JPG, or PNG.',
  },
  {
    id: 'registration',
    title: 'Company registration certificate',
    description: 'Required business proof or local equivalent. PDF, JPG, or PNG.',
  },
  {
    id: 'authorization',
    title: 'Authorization proof',
    optional: true,
    description: 'Optional unless your authority to represent the company needs evidence. PDF, JPG, or PNG.',
  },
]

/**
 * Onboarding step 3 of 5: identity and business documents. Files are not uploaded or
 * stored; only their names are kept (as the page itself states).
 */
export default function KycVerificationPage() {
  const navigate = useNavigate()
  const { data, saveData, completeStep } = useOnboarding()
  const [documents, setDocuments] = useState(data.documents)
  const [errors, setErrors] = useState({})

  function handleSelect(id, fileName) {
    const typeError = checkDocumentFileName(fileName)
    setErrors((current) => ({ ...current, [id]: typeError }))
    if (!typeError) setDocuments((current) => ({ ...current, [id]: fileName }))
  }

  function handleBack() {
    saveData({ documents })
    navigate(ONBOARDING_STEPS[1].path)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateKyc(documents)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    saveData({ documents })
    completeStep('kyc')
    navigate(ONBOARDING_STEPS[3].path)
  }

  return (
    <>
      <StepHeading
        title="KYC & business verification"
        description="Provide evidence that confirms your identity and authority to hire."
      />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.intro}>
          Requirements vary by country. Collect only appropriate identity and business evidence for this review.
        </p>
        <div className={styles.documents}>
          {DOCUMENTS.map((document) => (
            <DocumentUpload
              key={document.id}
              title={document.title}
              optional={document.optional}
              description={document.description}
              fileName={documents[document.id]}
              error={errors[document.id]}
              onSelect={(fileName) => handleSelect(document.id, fileName)}
            />
          ))}
        </div>
        <p className={styles.banner}>
          <Icon as={ShieldCheck} size={16} />
          This local prototype retains file names only. It does not upload or store document contents.
        </p>
        <StepFooter onBack={handleBack} />
      </form>
    </>
  )
}
