import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { PasswordField, SelectField, TextField } from '@/components/ui'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { signIn } from '@/app/session.js'
import { browserCountry, useCountryOptions } from '@/lib/countries.js'
import { browserTimeZone, check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { readAnonymousPreference } from '@/lib/preferences.js'
import { useRegisterRecruiterMutation } from '../api.js'
import AuthIntro from '../components/AuthIntro.jsx'
import AuthSwitchPrompt from '../components/AuthSwitchPrompt.jsx'
import CreateAccountButton from '../components/CreateAccountButton.jsx'
import FormAlert from '../components/FormAlert.jsx'
import TermsConsent from '../components/TermsConsent.jsx'
import WorkspacePicker from '../components/WorkspacePicker.jsx'
import { SIGN_UP_CHOICES } from '../data/workspaceChoices.js'
import hintStyles from '../components/compactHint.module.css'
import { useFormState } from '../utils/useFormState.js'
import styles from './RecruiterSignUpPage.module.css'

/**
 * Recruiter sign-up (U37): creates the account, signs in and emails a code, which is entered next
 * (M-002). A registered email answers EMAIL_TAKEN with sign-in and reset links (OQ-6h).
 */
export default function RecruiterSignUpPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const countries = useCountryOptions()
  const { values, errors, setErrors, field } = useFormState({
    fullName: '',
    jobTitle: '',
    email: '',
    phone: '',
    country: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  })
  const [register, { isLoading }] = useRegisterRecruiterMutation()
  const [failure, setFailure] = useState(null)
  const country = values.country || (countries.length ? browserCountry(countries) : '')

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = compact({
      fullName: check.required(values.fullName),
      jobTitle: check.required(values.jobTitle),
      email: check.email(values.email),
      phone: check.required(values.phone),
      country: check.required(country),
      password: check.newPassword(values.password, config?.limits),
      confirmPassword: check.confirm(values.confirmPassword, values.password),
      acceptTerms: values.acceptTerms ? undefined : { key: 'required' },
    })
    setErrors(nextErrors)
    setFailure(null)
    if (Object.keys(nextErrors).length > 0) return
    try {
      const { fullName, jobTitle, email, phone, password, acceptTerms } = values
      const { token, me } = await register({
        fullName,
        jobTitle,
        email,
        phone,
        password,
        acceptTerms,
        country,
        language: i18n.language,
        languageExplicit: Boolean(readAnonymousPreference('language')),
        timezone: browserTimeZone(),
      }).unwrap()
      await signIn(token, me)
      navigate('/recruiter/onboarding/email-code', { replace: true })
    } catch (error) {
      setErrors(serverFieldErrors(error))
      setFailure(error)
    }
  }

  const failureCode = failure && errorCode(failure)

  return (
    <AuthLayout logoTo="/recruiter/sign-in">
      <AuthIntro title={t('auth:signUp.title')} lead={t('auth:signUp.lead')} />
      <WorkspacePicker choices={SIGN_UP_CHOICES} activeId="recruiter" helper={t('auth:signIn.helper.recruiter')} />

      <h2 className={styles.heading}>{t('auth:recruiterSignUp.heading')}</h2>
      <p className={styles.description}>{t('auth:recruiterSignUp.description')}</p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {failureCode === 'EMAIL_TAKEN' && (
          <FormAlert>
            <span>{errorText.code(failure)}</span>
            <Link to="/recruiter/sign-in">{t('auth:recruiterSignUp.takenSignIn')}</Link>
            <Link to="/forgot-password">{t('auth:recruiterSignUp.takenReset')}</Link>
          </FormAlert>
        )}
        {failureCode && failureCode !== 'EMAIL_TAKEN' && failureCode !== 'VALIDATION_FAILED' && <FormAlert>{errorText.code(failure)}</FormAlert>}
        <TextField
          label={t('auth:fields.fullName')}
          name="fullName"
          autoComplete="name"
          value={values.fullName}
          onChange={field('fullName')}
          error={errorText.field('fullName', errors.fullName)}
        />
        <TextField
          label={t('auth:fields.jobTitle')}
          name="jobTitle"
          autoComplete="organization-title"
          value={values.jobTitle}
          onChange={field('jobTitle')}
          error={errorText.field('jobTitle', errors.jobTitle)}
        />
        <TextField
          label={t('auth:fields.workEmail')}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t('auth:fields.emailPlaceholder.recruiter')}
          value={values.email}
          onChange={field('email')}
          error={errorText.field('email', errors.email)}
        />
        <SelectField
          label={t('auth:fields.country')}
          name="country"
          hint={t('auth:fields.countryHint')}
          options={countries.map((option) => ({ value: option.code, label: option.name }))}
          value={country}
          onChange={field('country')}
          error={errorText.field('country', errors.country)}
        />
        <TextField
          label={t('auth:fields.phone')}
          name="phone"
          type="tel"
          autoComplete="tel"
          hint={t('auth:fields.phoneHint')}
          value={values.phone}
          onChange={field('phone')}
          error={errorText.field('phone', errors.phone)}
        />
        <PasswordField
          className={hintStyles.compactHint}
          label={t('auth:fields.password')}
          name="password"
          autoComplete="new-password"
          placeholder={t('auth:fields.passwordPlaceholder')}
          hint={t('auth:fields.passwordHint', { min: config?.limits.password.min })}
          value={values.password}
          onChange={field('password')}
          error={errorText.field('password', errors.password)}
        />
        <PasswordField
          label={t('auth:fields.confirmPassword')}
          name="confirmPassword"
          autoComplete="new-password"
          placeholder={t('auth:fields.confirmPlaceholder')}
          value={values.confirmPassword}
          onChange={field('confirmPassword')}
          error={errorText.field('confirmPassword', errors.confirmPassword)}
        />
        <TermsConsent checked={values.acceptTerms} onChange={field('acceptTerms')} error={errorText.field('acceptTerms', errors.acceptTerms)} />
        <CreateAccountButton loading={isLoading} disabled={!values.acceptTerms} />
      </form>

      <AuthSwitchPrompt linkTo="/recruiter/sign-in" linkLabel={t('auth:signUp.signInLink')}>
        {t('auth:signUp.haveAccount')}
      </AuthSwitchPrompt>
    </AuthLayout>
  )
}
