import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { SelectField, TextField } from '@/components/ui'
import { useCountryOptions } from '@/lib/countries.js'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { useUpdateOnboardingAccountMutation } from '../api.js'
import hintStyles from '../components/compactHint.module.css'
import StepFooter from '../components/StepFooter.jsx'
import StepGroup from '../components/StepGroup.jsx'
import StepHeading from '../components/StepHeading.jsx'
import { stepPath } from '../data/onboarding.js'
import { useOnboarding } from '../utils/useOnboarding.js'
import styles from './OnboardingStepPage.module.css'

/** Onboarding step 1 of 5 (M-153, P4-D1): who manages the account; sign-up filled it, the email cannot change. */
export default function AccountRegistrationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const { state } = useOnboarding()
  const { data: config } = useGetConfigQuery()
  const { country: pickerCountry } = usePreferences()
  const countries = useCountryOptions().filter((option) => !option.isRemote)
  const [updateAccount, { isLoading }] = useUpdateOnboardingAccountMutation()
  const { account, editable } = state
  const { values, set, errors, failure, run } = useFormState({
    fullName: account.fullName,
    jobTitle: account.jobTitle,
    phone: account.phone.e164 ?? '',
    country: pickerCountry && pickerCountry !== 'REMOTE' ? pickerCountry : '',
  })

  async function handleSubmit(event) {
    event.preventDefault()
    if (!editable) return navigate(stepPath('company'))
    const saved = await run(
      {
        fullName: check.text(values.fullName, config.limits.fullName.max),
        jobTitle: check.text(values.jobTitle, config.limits.jobTitle.max),
        phone: check.required(values.phone),
      },
      () => updateAccount({ fullName: values.fullName, jobTitle: values.jobTitle, phone: values.phone, country: values.country || undefined }).unwrap(),
    )
    if (saved) navigate(stepPath('company'))
  }

  return (
    <>
      <StepHeading title={t('auth:onboarding.account.title')} description={t('auth:onboarding.account.description')} />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <StepGroup icon={Users} title={t('auth:onboarding.account.groupTitle')} description={t('auth:onboarding.account.groupDescription')}>
          <div className={styles.fieldGrid}>
            <TextField
              label={t('auth:fields.fullName')}
              name="fullName"
              autoComplete="name"
              disabled={!editable}
              value={values.fullName}
              onChange={(event) => set('fullName', event.target.value)}
              error={errorText.field('fullName', errors.fullName)}
            />
            <TextField
              label={t('auth:fields.jobTitle')}
              name="jobTitle"
              autoComplete="organization-title"
              disabled={!editable}
              value={values.jobTitle}
              onChange={(event) => set('jobTitle', event.target.value)}
              error={errorText.field('jobTitle', errors.jobTitle)}
            />
            <TextField
              className={hintStyles.compactHint}
              label={t('auth:fields.workEmail')}
              name="email"
              type="email"
              value={account.email}
              hint={t('auth:onboarding.account.emailHint')}
              readOnly
              disabled
            />
            <SelectField
              label={t('auth:onboarding.account.phoneCountry')}
              name="phoneCountry"
              placeholder={t('auth:onboarding.account.phoneCountry')}
              disabled={!editable}
              options={countries.map((option) => ({ value: option.code, label: option.name }))}
              value={values.country}
              onChange={(event) => set('country', event.target.value)}
            />
            <TextField
              className={hintStyles.compactHint}
              label={t('auth:fields.phone')}
              name="phone"
              type="tel"
              autoComplete="tel"
              hint={t('auth:onboarding.account.phoneHint')}
              disabled={!editable}
              value={values.phone}
              onChange={(event) => set('phone', event.target.value)}
              error={errorText.field('phone', errors.phone)}
            />
          </div>
        </StepGroup>
        {!editable && <p className={styles.note}>{t('auth:onboarding.locked')}</p>}
        {failure && <p role="alert">{errorText.code(failure)}</p>}
        <StepFooter backDisabled loading={isLoading} />
      </form>
    </>
  )
}
