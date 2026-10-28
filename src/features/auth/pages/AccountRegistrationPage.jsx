import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import RecruiterAccountFields from '../components/RecruiterAccountFields.jsx'
import StepFooter from '../components/StepFooter.jsx'
import StepGroup from '../components/StepGroup.jsx'
import StepHeading from '../components/StepHeading.jsx'
import TermsConsent from '../components/TermsConsent.jsx'
import { ONBOARDING_STEPS } from '../data/onboarding.js'
import { useFormState } from '../utils/useFormState.js'
import { useOnboarding } from '../utils/useOnboarding.js'
import { validateRecruiterAccount } from '../utils/validation.js'
import styles from './OnboardingStepPage.module.css'

/** Onboarding step 1 of 5: who will manage the recruiter account. */
export default function AccountRegistrationPage() {
  const navigate = useNavigate()
  const { data, saveData, completed, completeStep, secrets, saveSecrets } = useOnboarding()
  const { values, errors, setErrors, field } = useFormState({
    fullName: data.fullName,
    jobTitle: data.jobTitle,
    workEmail: data.workEmail,
    phone: data.phone,
    terms: data.terms,
    password: secrets.password ?? '',
    confirmPassword: secrets.confirmPassword ?? '',
  })

  function save() {
    const { password, confirmPassword, fullName, jobTitle, workEmail, phone, terms } = values
    saveData({ fullName: fullName.trim(), jobTitle: jobTitle.trim(), workEmail: workEmail.trim(), phone: phone.trim(), terms })
    saveSecrets({ password, confirmPassword })
  }

  function handleSubmit(event) {
    event.preventDefault()
    // Passwords are never stored, so once this step is complete they are only re-checked if retyped.
    const nextErrors = validateRecruiterAccount(values, { optional: completed.includes('account') })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    save()
    completeStep('account')
    navigate(ONBOARDING_STEPS[1].path)
  }

  return (
    <>
      <StepHeading title="Account registration" description="Tell us who will manage this recruiter account." />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <StepGroup
          icon={Users}
          title="Account owner"
          description="Use professional contact details for the authorised representative."
        >
          <RecruiterAccountFields values={values} errors={errors} onChange={field} />
        </StepGroup>
        <div className={styles.afterGroup}>
          <TermsConsent checked={values.terms} onChange={field('terms')} error={errors.terms} />
        </div>
        <StepFooter backDisabled />
      </form>
    </>
  )
}
