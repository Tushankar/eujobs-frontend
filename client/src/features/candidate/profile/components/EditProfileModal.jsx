import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { useGetConfigQuery, useGetCountriesQuery } from '@/app/api.js'
import { Button, Icon, IconButton, SelectField, TextareaField, TextField } from '@/components/ui'
import { Field } from '@/components/ui/TextField.jsx'
import CityField from '@/components/common/CityField.jsx'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import { useUpdateProfileMutation } from '../api.js'
import FormDialog from './FormDialog.jsx'
import dialogStyles from './FormDialog.module.css'
import styles from './EditProfileModal.module.css'

const toForm = (profile) => ({
  fullName: profile.fullName,
  headline: profile.headline,
  place: profile.location,
  about: profile.about,
  yearsExperience: profile.yearsExperience == null ? '' : String(profile.yearsExperience),
  skills: profile.skills,
  workPreference: profile.workPreference ?? '',
  availability: profile.availability,
  salaryAmount: profile.salaryMin ? String(profile.salaryMin.amount) : '',
  salaryPeriod: profile.salaryMin?.period ?? 'year',
})

/** The core fields (P3-D9): name, headline, city, about, years, skills, work preference, availability, salary. */
export default function EditProfileModal({ open, profile, onSaved, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { data: countries = [] } = useGetCountriesQuery()
  const [updateProfile, { isLoading }] = useUpdateProfileMutation()
  const { values, set, errors, setErrors, failure, run } = useFormState(() => toForm(profile))
  const [skillDraft, setSkillDraft] = useState('')
  const limits = config?.limits
  const enums = config?.enums
  const currency = values.place && countries.find((country) => country.code === values.place.countryCode)?.currency
  const options = (name) => (enums?.[name] ?? []).map((key) => ({ value: key, label: t(`enums:${name}.${key}`) }))

  /** M-064: 1–12 skills, each ≤ 30 characters, unique case-insensitively. Returns the list, or null. */
  function commitSkill() {
    const skill = skillDraft.trim()
    if (!skill) return values.skills
    const { max, itemMax } = limits.profile.skills
    let problem
    if (skill.length > itemMax) problem = { key: 'too_long', params: { max: itemMax } }
    else if (values.skills.some((item) => item.toLowerCase() === skill.toLowerCase())) problem = { key: 'duplicate', params: { skill } }
    else if (values.skills.length >= max) problem = { key: 'too_many', params: { max } }
    if (problem) {
      setErrors((current) => ({ ...current, skills: problem }))
      return null
    }
    const skills = [...values.skills, skill]
    set('skills', skills)
    setSkillDraft('')
    return skills
  }

  async function handleSubmit() {
    const skills = commitSkill()
    if (skills === null) return
    const P = limits.profile
    const about = values.about.trim()
    const years = values.yearsExperience.trim()
    const amount = values.salaryAmount.trim()
    const saved = await run(
      {
        fullName: check.text(values.fullName, limits.fullName.max),
        headline: check.text(values.headline, P.headline.max),
        placeId: values.place ? undefined : { key: 'required' },
        about: about.length < P.about.min ? { key: 'too_short', params: { min: P.about.min } } : check.maxLength(about, P.about.max),
        yearsExperience: years === '' ? { key: 'required' } : check.wholeNumber(years, P.yearsExperience),
        skills: skills.length < P.skills.min ? { key: 'too_few', params: { min: P.skills.min } } : undefined,
        workPreference: values.workPreference ? undefined : { key: 'required' },
        salaryMin: check.wholeNumber(amount, P.salary),
      },
      () =>
        updateProfile({
          fullName: values.fullName.trim(),
          headline: values.headline.trim(),
          placeId: values.place.placeId,
          about,
          yearsExperience: Number(years),
          skills,
          workPreference: values.workPreference,
          availability: values.availability,
          salaryMin: amount ? { amount: Number(amount), currency, period: values.salaryPeriod } : null,
        }).unwrap(),
    )
    if (saved) onSaved()
  }

  if (!limits) return null
  const fieldError = (name) => errorText.field(name, errors[name])

  return (
    <FormDialog open={open} title={t('profile:form.core.title')} width={640} busy={isLoading} failure={failure} onClose={onClose} onSubmit={handleSubmit}>
      <div className={dialogStyles.row}>
        <TextField
          label={t('profile:form.core.fullName')}
          name="fullName"
          autoComplete="name"
          value={values.fullName}
          onChange={(event) => set('fullName', event.target.value)}
          error={fieldError('fullName')}
          data-autofocus
        />
        <TextField label={t('profile:form.core.headline')} name="headline" value={values.headline} onChange={(event) => set('headline', event.target.value)} error={fieldError('headline')} />
      </div>
      <CityField label={t('profile:form.core.city')} value={values.place} onChange={(place) => set('place', place)} error={errors.placeId && errorText.field('placeId', errors.placeId)} />
      <TextareaField
        label={t('profile:form.core.about')}
        name="about"
        rows={4}
        value={values.about}
        onChange={(event) => set('about', event.target.value)}
        error={fieldError('about')}
        hint={t('profile:form.core.count', { count: values.about.trim().length, max: limits.profile.about.max })}
      />
      <div className={dialogStyles.row}>
        <TextField
          label={t('profile:form.core.years')}
          name="yearsExperience"
          inputMode="numeric"
          value={values.yearsExperience}
          onChange={(event) => set('yearsExperience', event.target.value)}
          error={fieldError('yearsExperience')}
        />
        <SelectField
          label={t('profile:form.core.workPreference')}
          name="workPreference"
          placeholder={t('profile:form.core.workPreference')}
          options={options('workPreference')}
          value={values.workPreference}
          onChange={(event) => set('workPreference', event.target.value)}
          error={fieldError('workPreference')}
        />
      </div>

      <Field id="profile-skill-draft" label={t('profile:form.core.skills')} hint={t('profile:form.core.skillsHint', { max: limits.profile.skills.max })} error={fieldError('skills')}>
        {({ describedBy, invalid }) => (
          <div className={styles.skills}>
            <div className={styles.skillInput}>
              <input
                id="profile-skill-draft"
                name="skillDraft"
                className={styles.skillField}
                value={skillDraft}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                placeholder={t('profile:form.core.skillPlaceholder')}
                onChange={(event) => {
                  setSkillDraft(event.target.value)
                  setErrors((current) => ({ ...current, skills: undefined }))
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitSkill()
                  }
                }}
              />
              <Button variant="secondary" size="sm" leftIcon={<Icon as={Plus} size={14} />} onClick={commitSkill}>
                {t('profile:form.core.addSkill')}
              </Button>
            </div>
            {values.skills.length > 0 && (
              <ul className={styles.chips}>
                {values.skills.map((skill) => (
                  <li key={skill} className={styles.chip}>
                    {skill}
                    <IconButton
                      icon={X}
                      iconSize={12}
                      label={t('profile:form.core.removeSkill', { skill })}
                      className={styles.chipRemove}
                      onClick={() => set('skills', values.skills.filter((item) => item !== skill))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Field>

      <SelectField
        label={t('profile:form.core.availability')}
        name="availability"
        options={options('availability')}
        value={values.availability}
        onChange={(event) => set('availability', event.target.value)}
      />
      <div className={dialogStyles.row}>
        <TextField
          label={currency ? t('profile:form.core.salary', { currency }) : t('profile:form.core.salaryNoCurrency')}
          name="salaryAmount"
          inputMode="numeric"
          disabled={!currency}
          hint={currency ? undefined : t('profile:form.core.salaryNeedsCity')}
          value={values.salaryAmount}
          onChange={(event) => set('salaryAmount', event.target.value)}
          error={errorText.field('salaryMin', errors.salaryMin ?? errors['salaryMin.amount'] ?? errors['salaryMin.currency'])}
        />
        <SelectField
          label={t('profile:form.core.period')}
          name="salaryPeriod"
          disabled={!currency}
          options={options('salaryPeriod')}
          value={values.salaryPeriod}
          onChange={(event) => set('salaryPeriod', event.target.value)}
        />
      </div>
    </FormDialog>
  )
}
