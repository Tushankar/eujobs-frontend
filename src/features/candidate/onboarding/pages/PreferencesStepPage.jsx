import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Button, Icon, TextField } from '@/components/ui'
import { LOCATIONS } from '@/components/layout/preferencesContext.js'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { INITIAL_PROFILE, PROFILE_STORAGE_KEY, WORK_MODES } from '../../profile/data/profile.js'
import OnboardingStep from '../components/OnboardingStep.jsx'
import WorkModePicker from '../components/WorkModePicker.jsx'
import { INITIAL_ONBOARDING, ONBOARDING_STORAGE_KEY } from '../data/onboarding.js'
import { validatePreferences } from '../utils/onboarding.js'
import styles from './PreferencesStepPage.module.css'

const LOCATION_LIST_ID = 'onboarding-locations'

/**
 * Step 2 of 2: work mode, preferred location and minimum salary. Saving records them on this
 * device and on the candidate profile ("The right next step" on My profile), then opens Find jobs.
 */
export default function PreferencesStepPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useLocalStorage(PROFILE_STORAGE_KEY, INITIAL_PROFILE)
  const [, setOnboarding] = useLocalStorage(ONBOARDING_STORAGE_KEY, INITIAL_ONBOARDING)
  const [values, setValues] = useState(() => {
    const source = profile ?? INITIAL_PROFILE
    return { workMode: source.workMode, location: source.location, salaryMin: String(source.salaryMin) }
  })
  const [errors, setErrors] = useState({})

  function setField(name) {
    return (event) => {
      setValues((current) => ({ ...current, [name]: event.target.value }))
      if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }))
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validatePreferences(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const preferences = { workMode: values.workMode, location: values.location.trim(), salaryMin: Number(values.salaryMin.trim()) }
    setOnboarding((current) => ({ ...current, ...preferences }))
    // A profile deleted from this device stays deleted; the choices are still kept under the onboarding key.
    setProfile((current) => (current ? { ...current, ...preferences } : current))
    navigate('/candidate/onboarding/plan')
  }

  return (
    <OnboardingStep
      step={2}
      stepName="Your preferences"
      title="What does your next chapter look like?"
      lead="Tell us what matters. You can change your preferences anytime."
      size="narrow"
      footer={
        <Button as={Link} to="/candidate/onboarding/story" variant="ghost" className={styles.back} leftIcon={<Icon as={ArrowLeft} size={12} />}>
          Back
        </Button>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <WorkModePicker
          legend="How do you like to work?"
          name="workMode"
          options={WORK_MODES}
          value={values.workMode}
          onChange={(workMode) => setValues((current) => ({ ...current, workMode }))}
        />
        <TextField
          label="Preferred location"
          name="location"
          autoComplete="off"
          list={LOCATION_LIST_ID}
          value={values.location}
          onChange={setField('location')}
          error={errors.location}
        />
        <datalist id={LOCATION_LIST_ID}>
          {LOCATIONS.map((location) => (
            <option key={location} value={location} />
          ))}
        </datalist>
        <TextField
          label="Minimum annual salary ($k)"
          name="salaryMin"
          inputMode="numeric"
          value={values.salaryMin}
          onChange={setField('salaryMin')}
          error={errors.salaryMin}
        />
        <Button type="submit" fullWidth rightIcon={<Icon as={Sparkles} size={14} />}>
          Find my next chapter
        </Button>
      </form>
    </OnboardingStep>
  )
}
