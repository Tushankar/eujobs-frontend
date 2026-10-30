import { useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { SelectField, TextareaField, TextField } from '@/components/ui'
import hintStyles from '../components/compactHint.module.css'
import StepFooter from '../components/StepFooter.jsx'
import StepGroup from '../components/StepGroup.jsx'
import StepHeading from '../components/StepHeading.jsx'
import { COMPANY_SIZES, ONBOARDING_STEPS } from '../data/onboarding.js'
import { useFormState } from '../utils/useFormState.js'
import { useOnboarding } from '../utils/useOnboarding.js'
import { validateCompany } from '../utils/validation.js'
import styles from './OnboardingStepPage.module.css'

/** Onboarding step 2 of 5: registered company details. */
export default function CompanyInformationPage() {
  const navigate = useNavigate()
  const { data, saveData, completeStep } = useOnboarding()
  const { values, errors, setErrors, field } = useFormState({
    companyName: data.companyName,
    website: data.website,
    businessEmail: data.businessEmail,
    industry: data.industry,
    companySize: data.companySize,
    country: data.country,
    registrationDetails: data.registrationDetails,
    businessAddress: data.businessAddress,
  })

  function handleBack() {
    saveData(values)
    navigate(ONBOARDING_STEPS[0].path)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateCompany(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    saveData(values)
    completeStep('company')
    navigate(ONBOARDING_STEPS[2].path)
  }

  return (
    <>
      <StepHeading
        title="Company information"
        description="Add the registered details we will use to verify your organisation."
      />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <StepGroup
          icon={Building2}
          title="Organisation details"
          description="Enter details exactly as they appear on official records."
        >
          <div className={styles.fieldGrid}>
            <TextField
              label="Legal company name"
              name="companyName"
              autoComplete="organization"
              value={values.companyName}
              onChange={field('companyName')}
              error={errors.companyName}
            />
            <TextField
              label="Company website"
              name="website"
              type="url"
              autoComplete="url"
              placeholder="https://"
              value={values.website}
              onChange={field('website')}
              error={errors.website}
            />
            <TextField
              label="Business email"
              name="businessEmail"
              type="email"
              autoComplete="email"
              value={values.businessEmail}
              onChange={field('businessEmail')}
              error={errors.businessEmail}
            />
            <TextField
              label="Industry"
              name="industry"
              value={values.industry}
              onChange={field('industry')}
              error={errors.industry}
            />
            <SelectField
              label="Company size"
              name="companySize"
              placeholder="Select size"
              options={COMPANY_SIZES}
              value={values.companySize}
              onChange={field('companySize')}
              error={errors.companySize}
            />
            <TextField
              label="Country"
              name="country"
              autoComplete="country-name"
              value={values.country}
              onChange={field('country')}
              error={errors.country}
            />
            <TextField
              className={hintStyles.compactHint}
              label="Company registration details"
              name="registrationDetails"
              hint="Optional where your country does not issue a registration number."
              value={values.registrationDetails}
              onChange={field('registrationDetails')}
            />
            <TextareaField
              className={styles.fullWidth}
              label="Business address"
              name="businessAddress"
              autoComplete="street-address"
              value={values.businessAddress}
              onChange={field('businessAddress')}
              error={errors.businessAddress}
            />
          </div>
        </StepGroup>
        <StepFooter onBack={handleBack} />
      </form>
    </>
  )
}
