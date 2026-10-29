import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Button, Icon, PasswordField, TextField } from '@/components/ui'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import { WORKSPACES } from '@/app/workspaces.js'
import AuthIntro from '../components/AuthIntro.jsx'
import AuthSwitchPrompt from '../components/AuthSwitchPrompt.jsx'
import DemoNote from '../components/DemoNote.jsx'
import WorkspacePicker from '../components/WorkspacePicker.jsx'
import { LOCAL_WORKMAN_HERO } from '../data/hero.js'
import { ADMIN_CHOICES, SIGN_IN_CHOICES } from '../data/workspaceChoices.js'
import { startSession } from '../utils/session.js'
import { useFormState } from '../utils/useFormState.js'
import { validateSignIn } from '../utils/validation.js'
import styles from './SignInPage.module.css'

/** Copy per workspace, taken from the Figma sign-in frames. */
const SIGN_IN_COPY = {
  candidate: {
    choices: SIGN_IN_CHOICES,
    helper: 'Find opportunities that fit your skills, experience, and ambitions.',
    lead: 'Sign in to your workspace. Your next chapter is waiting.',
    emailPlaceholder: 'you@example.com',
    signUpPath: '/sign-up',
  },
  recruiter: {
    choices: SIGN_IN_CHOICES,
    helper: 'Discover relevant talent and build your next great team.',
    lead: 'Sign in to your workspace. Your next chapter is waiting.',
    emailPlaceholder: 'you@company.com',
    signUpPath: '/recruiter/sign-up',
    hero: LOCAL_WORKMAN_HERO,
  },
  admin: {
    choices: ADMIN_CHOICES,
    helper: 'Manage your marketplace, people, and responsible AI policies.',
    emailPlaceholder: 'you@company.com',
    notice:
      'Admin access is for authorized workspace owners. Production accounts require an invitation and server-side approval; this opens the demo only.',
    hero: { ...LOCAL_WORKMAN_HERO, brand: true },
  },
}

/**
 * Sign-in for a workspace (candidate, recruiter or admin). Demo only (as stated in the
 * Figma frames): credentials are never sent or stored; a valid form starts a browser-only
 * session and opens the chosen workspace.
 */
export default function SignInPage({ workspace = 'candidate' }) {
  const navigate = useNavigate()
  const copy = SIGN_IN_COPY[workspace]
  const { values, errors, setErrors, field } = useFormState({ email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateSignIn(values, copy.emailPlaceholder)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setSubmitting(true)
    startSession(workspace)
    window.setTimeout(() => navigate(WORKSPACES[workspace].basePath), 500)
  }

  return (
    <AuthLayout hero={copy.hero} showLogo={workspace !== 'admin'} logoTo={WORKSPACES[workspace].signInPath}>
      <AuthIntro title="Welcome back." lead={copy.lead} />
      <WorkspacePicker choices={copy.choices} activeId={workspace} helper={copy.helper} />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={copy.emailPlaceholder}
          value={values.email}
          onChange={field('email')}
          error={errors.email}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={values.password}
          onChange={field('password')}
          error={errors.password}
        />
        {copy.notice && (
          <p className={styles.notice}>
            <Icon as={ShieldCheck} size={16} className={styles.noticeIcon} />
            {copy.notice}
          </p>
        )}
        <Button type="submit" fullWidth loading={submitting} rightIcon={<Icon as={ArrowRight} size={14} />}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {copy.signUpPath && (
        <AuthSwitchPrompt linkTo={copy.signUpPath} linkLabel="Sign up">
          New to matchpoint?
        </AuthSwitchPrompt>
      )}

      <DemoNote />
    </AuthLayout>
  )
}
