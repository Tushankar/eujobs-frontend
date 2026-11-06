import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { errorCode, useGetConfigQuery, useGetCountriesQuery } from '@/app/api.js'
import { Button, Icon, TextField } from '@/components/ui'
import CityField from '@/components/common/CityField.jsx'
import { check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { cx } from '@/utils/cx.js'
import { useGetProfileQuery } from '../../profile/api.js'
import { useSavePreferencesMutation } from '../api.js'
import OnboardingStep from '../components/OnboardingStep.jsx'
import SetupSummary from '../components/SetupSummary.jsx'
import WorkModePicker from '../components/WorkModePicker.jsx'
import styles from './PreferencesStepPage.module.css'

/** Step 2 (M-014, P3-D2): work preference and city required, minimum salary optional in the city's currency. */
export default function PreferencesStepPage() {
  const { data: profile } = useGetProfileQuery()
  return profile ? <PreferencesForm profile={profile} /> : null
}

/** Per year / per month as a two-option pill switch (native radios). */
function PeriodSwitch({ legend, options, value, disabled, onChange }) {
  const { t } = useTranslation()
  return (
    <fieldset className={styles.period} disabled={disabled}>
      <legend className={styles.periodLegend}>{legend}</legend>
      <div className={styles.switch}>
        {options.map((period) => (
          <label key={period} className={cx(styles.switchOption, value === period && styles.switchOn)}>
            <input type="radio" className="sr-only" name="salaryPeriod" value={period} checked={value === period} onChange={() => onChange(period)} />
            {t(`enums:salaryPeriod.${period}`)}
          </label>
        ))}
      </div>
    </fieldset>
  )
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
  const amount = salary.amount.trim()

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

  // The side card follows the form as it is filled in; a salary shows once it is a whole number with a currency.
  const draft = { workPreference, place, salary: currency && /^\d+$/.test(amount) ? { amount: Number(amount), currency, period: salary.period } : null }

  return (
    <OnboardingStep
      step={2}
      title={t('onboarding:preferences.title')}
      lead={t('onboarding:preferences.lead')}
      aside={<SetupSummary draft={draft} />}
      actions={
        <>
          <Button as={Link} to="/candidate/onboarding/story" variant="outline" leftIcon={<Icon as={ArrowLeft} size={14} />}>
            {t('onboarding:preferences.back')}
          </Button>
          <Button type="submit" form="preferences-form" loading={isLoading} rightIcon={<Icon as={ArrowRight} size={14} />}>
            {t('onboarding:preferences.submit')}
          </Button>
        </>
      }
    >
      <form id="preferences-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        <section className={styles.section}>
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
        </section>

        <section className={styles.section}>
          <CityField
            label={t('onboarding:preferences.city')}
            value={place}
            onChange={(value) => {
              setPlace(value)
              setErrors((current) => ({ ...current, placeId: undefined }))
            }}
            error={errorText.field('placeId', errors.placeId)}
          />
        </section>

        <section className={styles.section}>
          <div className={styles.salary}>
            <TextField
              label={currency ? t('onboarding:preferences.salary', { currency }) : t('onboarding:preferences.salaryNoCurrency')}
              name="salaryAmount"
              inputMode="numeric"
              disabled={!currency}
              placeholder={currency ? t('onboarding:preferences.salaryPlaceholder') : undefined}
              rightSlot={currency && <span className={styles.currency}>{currency}</span>}
              hint={currency ? t('onboarding:preferences.salaryHint') : t('onboarding:preferences.salaryNeedsCity')}
              value={salary.amount}
              onChange={(event) => {
                setSalary((current) => ({ ...current, amount: event.target.value }))
                setErrors((current) => ({ ...current, salaryMin: undefined }))
              }}
              error={errorText.field('salaryMin', errors.salaryMin)}
            />
            <PeriodSwitch
              legend={t('onboarding:preferences.period')}
              options={config?.enums.salaryPeriod ?? []}
              value={salary.period}
              disabled={!currency}
              onChange={(period) => setSalary((current) => ({ ...current, period }))}
            />
          </div>
        </section>

        {failure && (
          <p className={styles.failure} role="alert">
            {errorText.code(failure)}
          </p>
        )}
      </form>
    </OnboardingStep>
  )
}
