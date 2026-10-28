import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Checkbox, PasswordField, TextField } from '@/components/ui'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import { WORKSPACES } from '@/app/workspaces.js'
import AuthIntro from '../components/AuthIntro.jsx'
import AuthSwitchPrompt from '../components/AuthSwitchPrompt.jsx'
import CreateAccountButton from '../components/CreateAccountButton.jsx'
import DemoNote from '../components/DemoNote.jsx'
import WorkspacePicker from '../components/WorkspacePicker.jsx'
import { SIGN_UP_CHOICES } from '../data/workspaceChoices.js'
import hintStyles from '../components/compactHint.module.css'
import { useFormState } from '../utils/useFormState.js'
import { validateCandidateSignUp } from '../utils/validation.js'
import styles from './SignUpPage.module.css'

/**
 * Candidate sign-up. Demo only (as stated in the Figma frame): no account is created and
 * nothing is stored; a valid form opens the candidate workspace.
 */
export default function SignUpPage() {
  const navigate = useNavigate()
  const { values, errors, setErrors, field } = useFormState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [understood, setUnderstood] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateCandidateSignUp(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setSubmitting(true)
    window.setTimeout(() => navigate(`${WORKSPACES.candidate.basePath}/onboarding`), 500)
  }

  return (
    <AuthLayout>
      <AuthIntro title="Create your account." lead="One platform. The right workspace for your next move." />
      <WorkspacePicker
        choices={SIGN_UP_CHOICES}
        activeId="candidate"
        helper="Find opportunities that fit your skills, experience, and ambitions."
      />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Full name"
          name="fullName"
          autoComplete="name"
          placeholder="Alex Morgan"
          value={values.fullName}
          onChange={field('fullName')}
          error={errors.fullName}
        />
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={field('email')}
          error={errors.email}
        />
        <PasswordField
          className={hintStyles.compactHint}
          label="Password"
          name="password"
          autoComplete="new-password"
          placeholder="Enter your password"
          hint="Use at least 8 characters. Don’t use a real password in this demo."
          value={values.password}
          onChange={field('password')}
          error={errors.password}
        />
        <PasswordField
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={values.confirmPassword}
          onChange={field('confirmPassword')}
          error={errors.confirmPassword}
        />
        <Checkbox className={styles.consent} checked={understood} onChange={(event) => setUnderstood(event.target.checked)}>
          I understand that this demo saves profile changes on this device. No real account is created.
        </Checkbox>
        <CreateAccountButton loading={submitting} disabled={!understood} />
      </form>

      <AuthSwitchPrompt linkTo="/sign-in" linkLabel="Sign in">
        Already have an account?
      </AuthSwitchPrompt>

      <DemoNote />
    </AuthLayout>
  )
}
