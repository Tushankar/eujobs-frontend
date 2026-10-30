import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Button, Icon, PasswordField, TextField } from '@/components/ui'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import { errorCode } from '@/app/api.js'
import { BRAND } from '@/app/brand.js'
import { landingPath, signIn, SIGN_IN_PATH } from '@/app/session.js'
import { browserTimeZone, check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useLoginMutation } from '../api.js'
import AuthIntro from '../components/AuthIntro.jsx'
import AuthSwitchPrompt from '../components/AuthSwitchPrompt.jsx'
import FormAlert from '../components/FormAlert.jsx'
import ResendVerification from '../components/ResendVerification.jsx'
import WorkspacePicker from '../components/WorkspacePicker.jsx'
import { ADMIN_CHOICES, SIGN_IN_CHOICES } from '../data/workspaceChoices.js'
import { useFormState } from '../utils/useFormState.js'
import styles from './SignInPage.module.css'

/** Per portal: tiles, sign-up link and hero variant (from the Figma sign-in frames). */
const PORTALS = {
  candidate: { choices: SIGN_IN_CHOICES, signUpPath: '/sign-up' },
  recruiter: { choices: SIGN_IN_CHOICES, signUpPath: '/recruiter/sign-up' },
  admin: { choices: ADMIN_CHOICES, hero: { brand: true } },
}

/**
 * Sign-in for a portal (M-005). One login for every account: a candidate on the recruiter page
 * (or the reverse) lands in their own workspace with a notice; the admin page is for admins only.
 */
export default function SignInPage({ workspace = 'candidate' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const portal = PORTALS[workspace]
  const errorText = useErrorText()
  const { values, errors, setErrors, field } = useFormState({ email: '', password: '' })
  const [login, { isLoading }] = useLoginMutation()
  const [failure, setFailure] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = compact({ email: check.email(values.email), password: check.required(values.password) })
    setErrors(nextErrors)
    setFailure(null)
    if (Object.keys(nextErrors).length > 0) return
    try {
      const { token, me } = await login({ ...values, portal: workspace, timezone: browserTimeZone() }).unwrap()
      await signIn(token, me)
      const wrongPortal = workspace !== 'admin' && me.role !== workspace
      navigate(landingPath(me, searchParams.get('next')), { replace: true, state: wrongPortal ? { notice: 'wrongPortal' } : undefined })
    } catch (error) {
      setErrors(serverFieldErrors(error))
      setFailure(error)
    }
  }

  const failureCode = failure && errorCode(failure)

  return (
    <AuthLayout hero={portal.hero} showLogo={workspace !== 'admin'} logoTo={SIGN_IN_PATH[workspace]}>
      <AuthIntro title={t('auth:signIn.title')} lead={workspace !== 'admin' ? t('auth:signIn.lead') : undefined} />
      <WorkspacePicker choices={portal.choices} activeId={workspace} helper={t(`auth:signIn.helper.${workspace}`)} />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {failureCode === 'EMAIL_UNVERIFIED' && (
          <FormAlert>
            <span>{t('auth:signIn.unverified', { email: values.email })}</span>
            <ResendVerification email={values.email} />
          </FormAlert>
        )}
        {failureCode && failureCode !== 'EMAIL_UNVERIFIED' && failureCode !== 'VALIDATION_FAILED' && <FormAlert>{errorText.code(failure)}</FormAlert>}
        <TextField
          label={t('auth:fields.email')}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t(`auth:fields.emailPlaceholder.${workspace}`)}
          value={values.email}
          onChange={field('email')}
          error={errorText.field('email', errors.email)}
        />
        <PasswordField
          label={t('auth:fields.password')}
          name="password"
          autoComplete="current-password"
          placeholder={t('auth:fields.passwordPlaceholder')}
          value={values.password}
          onChange={field('password')}
          error={errorText.field('password', errors.password)}
        />
        <Link to="/forgot-password" className={styles.forgot}>
          {t('auth:signIn.forgot')}
        </Link>
        {workspace === 'admin' && (
          <p className={styles.notice}>
            <Icon as={ShieldCheck} size={16} className={styles.noticeIcon} />
            {t('auth:signIn.adminNotice')}
          </p>
        )}
        <Button type="submit" fullWidth loading={isLoading} rightIcon={<Icon as={ArrowRight} size={14} />}>
          {isLoading ? t('auth:signIn.submitting') : t('auth:signIn.submit')}
        </Button>
      </form>

      {portal.signUpPath && (
        <AuthSwitchPrompt linkTo={portal.signUpPath} linkLabel={t('auth:signIn.signUpLink')}>
          {t('auth:signIn.newHere', { brand: BRAND.name })}
        </AuthSwitchPrompt>
      )}
    </AuthLayout>
  )
}
