import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { Icon, TextField } from '@/components/ui'
import hintStyles from '../components/compactHint.module.css'
import StepFooter from '../components/StepFooter.jsx'
import StepHeading from '../components/StepHeading.jsx'
import { DEMO_OTP, ONBOARDING_STEPS } from '../data/onboarding.js'
import { useFormState } from '../utils/useFormState.js'
import { useOnboarding } from '../utils/useOnboarding.js'
import { validateOtps } from '../utils/validation.js'
import stepStyles from './OnboardingStepPage.module.css'
import styles from './VerifyAccountPage.module.css'

/**
 * Onboarding step 4 of 5: confirm email and phone ownership (simulated OTPs, the demo code is
 * printed under each field) and review the evidence before submitting. Codes are kept in
 * memory only and cleared once the step is submitted.
 */
export default function VerifyAccountPage() {
  const navigate = useNavigate()
  const { data, completeStep, secrets, saveSecrets } = useOnboarding()
  const { values, errors, setErrors, field } = useFormState({
    emailOtp: secrets.emailOtp ?? '',
    phoneOtp: secrets.phoneOtp ?? '',
  })
  const [submitting, setSubmitting] = useState(false)

  const checklist = [
    { label: 'Company details', value: data.companyName },
    { label: 'Identity document', value: data.documents.identity },
    { label: 'Business proof', value: data.documents.registration },
    { label: 'Authorization proof', value: data.documents.authorization, fallback: 'Not provided' },
  ]

  function handleBack() {
    saveSecrets(values)
    navigate(ONBOARDING_STEPS[2].path)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateOtps(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setSubmitting(true)
    window.setTimeout(() => {
      saveSecrets({ emailOtp: '', phoneOtp: '' })
      completeStep('verify')
      navigate(ONBOARDING_STEPS[4].path)
    }, 600)
  }

  return (
    <>
      <StepHeading
        title="Verify account"
        description="Confirm your contact details and review the evidence before submitting."
      />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.intro}>
          Confirm email and phone ownership, then review the company and document checklist before submission.
        </p>
        <div className={styles.otpGrid}>
          <TextField
            className={hintStyles.compactHint}
            label="Email OTP"
            name="emailOtp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            hint={`Demo code for ${data.workEmail}: ${DEMO_OTP}`}
            value={values.emailOtp}
            onChange={field('emailOtp')}
            error={errors.emailOtp}
          />
          <TextField
            className={hintStyles.compactHint}
            label="Phone OTP"
            name="phoneOtp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            hint={`Demo code for ${data.phone}: ${DEMO_OTP}`}
            value={values.phoneOtp}
            onChange={field('phoneOtp')}
            error={errors.phoneOtp}
          />
        </div>

        <ul className={styles.checklist}>
          {checklist.map((item) => (
            <li key={item.label} className={styles.checkItem}>
              <Icon as={CircleCheck} size={16} className={item.value ? styles.checkDone : styles.checkEmpty} />
              <div className={styles.checkText}>
                <p className={styles.checkTitle}>{item.label}</p>
                <p className={styles.checkValue}>{item.value || item.fallback}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className={`${stepStyles.note} ${styles.note}`}>
          OTP delivery and automated document validation are simulated. The submitted record will enter the existing
          human admin review queue.
        </p>
        <StepFooter onBack={handleBack} submitLabel="Submit for admin review" loading={submitting} />
      </form>
    </>
  )
}
