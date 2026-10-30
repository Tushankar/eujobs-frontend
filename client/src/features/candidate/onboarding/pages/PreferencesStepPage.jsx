import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { errorCode, useGetConfigQuery, useGetCountriesQuery } from '@/app/api.js'
import { Button, Icon, SelectField, TextField } from '@/components/ui'
import CityField from '@/components/common/CityField.jsx'
import { check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useGetProfileQuery } from '../../profile/api.js'
import { useSavePreferencesMutation } from '../api.js'
import OnboardingStep from '../components/OnboardingStep.jsx'
import WorkModePicker from '../components/WorkModePicker.jsx'
import styles from './PreferencesStepPage.module.css'

/** Step 2 of 2 (M-014, P3-D2): work preference and city required, minimum salary optional in the city's currency. */
export default function PreferencesStepPage() {
  const { data: profile } = useGetProfileQuery()
  return profile ? <PreferencesForm profile={profile} /> : null
}

function PreferencesForm({ profile }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { data: countries = [] } = useGetCountriesQuery()
  const [savePreferences, { isLoading }] = useSavePreferencesMutation()
  const [workPreference, setWorkPreference] = useState(profile.workPreference)
  const [place, setPlace] = useState(profile.location)
  const [salary, setSalary] = useState({ amount: profile.salaryMin ? String(profile.salaryMin.amount) : '', period: profile.salaryMin?.period ?? 'year' })
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState(null)
  const currency = place && countries.find((country) => country.code === place.countryCode)?.currency

  function validate() {
    return compact({
      workPreference: workPreference ? undefined : { key: 'required' },
      placeId: place ? undefined : { key: 'required' },
      salaryMin: check.wholeNumber(salary.amount, config.limits.profile.salary),
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    setFailure(null)
    if (Object.keys(nextErrors).length > 0) return
    const amount = salary.amount.trim()
    try {
      await savePreferences({
        workPreference,
        placeId: place.placeId,
        salaryMin: amount ? { amount: Number(amount), currency, period: salary.period } : null,
      }).unwrap()
      navigate('/candidate/onboarding/plan')
    } catch (error) {
      const fields = serverFieldErrors(error)
      setErrors({ ...fields, salaryMin: fields['salaryMin.amount'] ?? fields['salaryMin.currency'] })
      if (errorCode(error) !== 'VALIDATION_FAILED') setFailure(error)
    }
  }

  return (
    <OnboardingStep
      step={2}
      stepName={t('onboarding:preferences.name')}
      title={t('onboarding:preferences.title')}
      lead={t('onboarding:preferences.lead')}
      size="narrow"
      footer={
        <Button as={Link} to="/candidate/onboarding/story" variant="ghost" className={styles.back} leftIcon={<Icon as={ArrowLeft} size={12} />}>
          {t('onboarding:preferences.back')}
        </Button>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <WorkModePicker
          legend={t('onboarding:preferences.workMode')}
          name="workPreference"
          options={config?.enums.workPreference ?? []}
          value={workPreference}
          onChange={(value) => {
            setWorkPreference(value)
            setErrors((current) => ({ ...current, workPreference: undefined }))
          }}
          error={errorText.field('workPreference', errors.workPreference)}
        />
        <CityField
          label={t('onboarding:preferences.city')}
          value={place}
          onChange={(value) => {
            setPlace(value)
            setErrors((current) => ({ ...current, placeId: undefined }))
          }}
          error={errorText.field('placeId', errors.placeId)}
        />
        <div className={styles.salary}>
          <TextField
            label={currency ? t('onboarding:preferences.salary', { currency }) : t('onboarding:preferences.salaryNoCurrency')}
            name="salaryAmount"
            inputMode="numeric"
            disabled={!currency}
            hint={currency ? undefined : t('onboarding:preferences.salaryNeedsCity')}
            value={salary.amount}
            onChange={(event) => {
              setSalary((current) => ({ ...current, amount: event.target.value }))
              setErrors((current) => ({ ...current, salaryMin: undefined }))
            }}
            error={errorText.field('salaryMin', errors.salaryMin)}
          />
          <SelectField
            label={t('onboarding:preferences.period')}
            name="salaryPeriod"
            disabled={!currency}
            options={(config?.enums.salaryPeriod ?? []).map((period) => ({ value: period, label: t(`enums:salaryPeriod.${period}`) }))}
            value={salary.period}
            onChange={(event) => setSalary((current) => ({ ...current, period: event.target.value }))}
          />
        </div>
        {failure && <p role="alert">{errorText.code(failure)}</p>}
        <Button type="submit" fullWidth loading={isLoading} rightIcon={<Icon as={Sparkles} size={14} />}>
          {t('onboarding:preferences.submit')}
        </Button>
      </form>
    </OnboardingStep>
  )
}
