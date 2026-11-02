import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { refreshMe } from '@/app/session.js'
import { SelectField, TextareaField, TextField } from '@/components/ui'
import CityField from '@/components/common/CityField.jsx'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import { useSaveOnboardingCompanyMutation } from '../api.js'
import hintStyles from '../components/compactHint.module.css'
import StepFooter from '../components/StepFooter.jsx'
import StepGroup from '../components/StepGroup.jsx'
import StepHeading from '../components/StepHeading.jsx'
import { stepPath } from '../data/onboarding.js'
import { useOnboarding } from '../utils/useOnboarding.js'
import styles from './OnboardingStepPage.module.css'

/**
 * Onboarding step 2 of 5 (M-146, M-149, P4-Q3): the registered company. The city is picked through the Places
 * proxy (G-1); its country becomes the header country, currency and (unless chosen) the language.
 */
export default function CompanyInformationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const { state } = useOnboarding()
  const { data: config } = useGetConfigQuery()
  const [saveCompany, { isLoading }] = useSaveOnboardingCompanyMutation()
  const company = state.company
  const { values, set, errors, setErrors, failure, run } = useFormState({
    legalName: company?.legalName ?? '',
    website: company?.website ?? '',
    businessEmail: company?.businessEmail ?? '',
    industry: company?.industry ?? '',
    size: company?.size ?? '',
    place: company?.location ?? null,
    registrationDetails: company?.registrationDetails ?? '',
    businessAddress: company?.businessAddress ?? '',
  })
  const limits = config?.limits.company
  const field = (name) => (event) => set(name, event.target.value)
  const errorOf = (name) => errorText.field(name, errors[name])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!state.editable) return navigate(stepPath('kyc'))
    const saved = await run(
      {
        legalName: check.text(values.legalName, limits.name.max),
        website: check.text(values.website, limits.website.max),
        businessEmail: check.email(values.businessEmail),
        industry: check.text(values.industry, limits.industry.max),
        size: check.required(values.size),
        placeId: values.place ? undefined : { key: 'required' },
        businessAddress: check.text(values.businessAddress, limits.businessAddress.max),
        registrationDetails: check.maxLength(values.registrationDetails, limits.registrationDetails.max),
      },
      async () => {
        const { place, ...body } = values
        await saveCompany({ ...body, placeId: place.placeId }).unwrap()
        await refreshMe()
      },
    )
    if (saved) navigate(stepPath('kyc'))
  }

  return (
    <>
      <StepHeading title={t('auth:onboarding.company.title')} description={t('auth:onboarding.company.description')} />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <fieldset disabled={!state.editable} className={styles.fieldset}>
          <StepGroup icon={Building2} title={t('auth:onboarding.company.groupTitle')} description={t('auth:onboarding.company.groupDescription')}>
            <div className={styles.fieldGrid}>
              <TextField
                label={t('auth:onboarding.company.legalName')}
                name="legalName"
                autoComplete="organization"
                value={values.legalName}
                onChange={field('legalName')}
                error={errorOf('legalName')}
              />
              <TextField
                className={hintStyles.compactHint}
                label={t('auth:onboarding.company.website')}
                name="website"
                type="url"
                autoComplete="url"
                placeholder="https://"
                hint={t('auth:onboarding.company.websiteHint')}
                value={values.website}
                onChange={field('website')}
                error={errorOf('website')}
              />
              <TextField
                label={t('auth:onboarding.company.businessEmail')}
                name="businessEmail"
                type="email"
                autoComplete="email"
                value={values.businessEmail}
                onChange={field('businessEmail')}
                error={errorOf('businessEmail')}
              />
              <TextField label={t('auth:onboarding.company.industry')} name="industry" value={values.industry} onChange={field('industry')} error={errorOf('industry')} />
              <SelectField
                label={t('auth:onboarding.company.size')}
                name="size"
                placeholder={t('auth:onboarding.company.sizePlaceholder')}
                options={(config?.enums.companySize ?? []).map((size) => ({ value: size, label: t(`enums:companySize.${size}`) }))}
                value={values.size}
                onChange={field('size')}
                error={errorOf('size')}
              />
              <CityField
                label={t('auth:onboarding.company.city')}
                hint={t('auth:onboarding.company.cityHint')}
                name="companyCity"
                value={values.place}
                onChange={(place) => {
                  set('place', place)
                  setErrors((current) => ({ ...current, placeId: undefined }))
                }}
                error={errorOf('placeId')}
              />
              <TextField
                className={hintStyles.compactHint}
                label={t('auth:onboarding.company.registrationDetails')}
                name="registrationDetails"
                hint={t('auth:onboarding.company.registrationHint')}
                value={values.registrationDetails}
                onChange={field('registrationDetails')}
                error={errorOf('registrationDetails')}
              />
              <TextareaField
                className={styles.fullWidth}
                label={t('auth:onboarding.company.businessAddress')}
                name="businessAddress"
                autoComplete="street-address"
                value={values.businessAddress}
                onChange={field('businessAddress')}
                error={errorOf('businessAddress')}
              />
            </div>
          </StepGroup>
        </fieldset>
        {!state.editable && <p className={styles.note}>{t('auth:onboarding.locked')}</p>}
        {failure && <p role="alert">{errorText.code(failure)}</p>}
        <StepFooter onBack={() => navigate(stepPath('account'))} loading={isLoading} />
      </form>
    </>
  )
}
