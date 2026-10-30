import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PasswordField, SelectField, TextField } from '@/components/ui'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { browserCountry, useCountryOptions } from '@/lib/countries.js'
import { browserTimeZone, check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { readAnonymousPreference } from '@/lib/preferences.js'
import { useRegisterCandidateMutation } from '../api.js'
import AuthIntro from '../components/AuthIntro.jsx'
import AuthSwitchPrompt from '../components/AuthSwitchPrompt.jsx'
import CreateAccountButton from '../components/CreateAccountButton.jsx'
import FormAlert from '../components/FormAlert.jsx'
import TermsConsent from '../components/TermsConsent.jsx'
import WorkspacePicker from '../components/WorkspacePicker.jsx'
import { SIGN_UP_CHOICES } from '../data/workspaceChoices.js'
import hintStyles from '../components/compactHint.module.css'
import { useFormState } from '../utils/useFormState.js'
import styles from './SignUpPage.module.css'

/** M-001: no account is signed in here; the email link must be opened first. */
export default function SignUpPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const countries = useCountryOptions()
  const { values, errors, setErrors, field } = useFormState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    country: '',
    acceptTerms: false,
  })
  const [register, { isLoading }] = useRegisterCandidateMutation()
  const [failure, setFailure] = useState(null)
  const country = values.country || (countries.length ? browserCountry(countries) : '')

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = compact({
      fullName: check.required(values.fullName),
      email: check.email(values.email),
      password: check.newPassword(values.password, config?.limits),
      confirmPassword: check.confirm(values.confirmPassword, values.password),
      country: check.required(country),
      acceptTerms: values.acceptTerms ? undefined : { key: 'required' },
    })
    setErrors(nextErrors)
    setFailure(null)
    if (Object.keys(nextErrors).length > 0) return
    try {
      const { email } = await register({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        acceptTerms: true,
        language: i18n.language,
        languageExplicit: Boolean(readAnonymousPreference('language')),
        country,
        timezone: browserTimeZone(),
      }).unwrap()
      navigate('/sign-up/check-email', { state: { email } })
    } catch (error) {
      setErrors(serverFieldErrors(error))
      setFailure(error)
    }
  }

  return (
    <AuthLayout>
      <AuthIntro title={t('auth:signUp.title')} lead={t('auth:signUp.lead')} />
      <WorkspacePicker choices={SIGN_UP_CHOICES} activeId="candidate" helper={t('auth:signIn.helper.candidate')} />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {failure && errorCode(failure) !== 'VALIDATION_FAILED' && <FormAlert>{errorText.code(failure)}</FormAlert>}
        <TextField
          label={t('auth:fields.fullName')}
          name="fullName"
          autoComplete="name"
          value={values.fullName}
          onChange={field('fullName')}
          error={errorText.field('fullName', errors.fullName)}
        />
        <TextField
          label={t('auth:fields.email')}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t('auth:fields.emailPlaceholder.candidate')}
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

      <AuthSwitchPrompt linkTo="/sign-in" linkLabel={t('auth:signUp.signInLink')}>
        {t('auth:signUp.haveAccount')}
      </AuthSwitchPrompt>
    </AuthLayout>
  )
}
