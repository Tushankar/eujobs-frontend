import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import AuthIntro from '../components/AuthIntro.jsx'
import AuthSwitchPrompt from '../components/AuthSwitchPrompt.jsx'
import CreateAccountButton from '../components/CreateAccountButton.jsx'
import RecruiterAccountFields from '../components/RecruiterAccountFields.jsx'
import TermsConsent from '../components/TermsConsent.jsx'
import WorkspacePicker from '../components/WorkspacePicker.jsx'
import { LOCAL_WORKMAN_HERO } from '../data/hero.js'
import { ONBOARDING_STEPS } from '../data/onboarding.js'
import { SIGN_UP_CHOICES } from '../data/workspaceChoices.js'
import { useFormState } from '../utils/useFormState.js'
import { useOnboardingState } from '../utils/useOnboardingState.js'
import { validateRecruiterAccount } from '../utils/validation.js'
import styles from './RecruiterSignUpPage.module.css'

/**
 * Recruiter sign-up (Figma frame "Sign in _Recruiter_2"). It is step 1 of the recruiter
 * onboarding in the split layout: a valid form saves the non-sensitive fields on this
 * device, marks "Account registration" complete and continues to "Company information".
 */
export default function RecruiterSignUpPage() {
  const navigate = useNavigate()
  const { data, saveData, completeStep } = useOnboardingState()
  const { values, errors, setErrors, field } = useFormState({
    fullName: data.fullName,
    jobTitle: data.jobTitle,
    workEmail: data.workEmail,
    phone: data.phone,
    password: '',
    confirmPassword: '',
    terms: false,
  })
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateRecruiterAccount(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setSubmitting(true)
    window.setTimeout(() => {
      const { fullName, jobTitle, workEmail, phone, terms } = values
      saveData({ fullName: fullName.trim(), jobTitle: jobTitle.trim(), workEmail: workEmail.trim(), phone: phone.trim(), terms })
      completeStep('account')
      navigate(ONBOARDING_STEPS[1].path)
    }, 500)
  }

  return (
    <AuthLayout hero={LOCAL_WORKMAN_HERO} logoTo="/recruiter/sign-in">
      <AuthIntro title="Create your account." lead="One platform. The right workspace for your next move." />
      <WorkspacePicker
        choices={SIGN_UP_CHOICES}
        activeId="recruiter"
        helper="Discover relevant talent and build your next great team."
      />

      <h2 className={styles.heading}>Account registration</h2>
      <p className={styles.description}>Tell us who will manage this recruiter account.</p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <RecruiterAccountFields values={values} errors={errors} onChange={field} columns={1} showPlaceholders />
        <TermsConsent checked={values.terms} onChange={field('terms')} error={errors.terms} />
        <CreateAccountButton loading={submitting} disabled={!values.terms} />
      </form>

      <AuthSwitchPrompt linkTo="/recruiter/sign-in" linkLabel="Sign in">
        Already have an account?
      </AuthSwitchPrompt>
    </AuthLayout>
  )
}
