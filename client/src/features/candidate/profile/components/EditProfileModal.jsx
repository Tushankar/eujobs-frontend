import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, Checkbox, Icon, IconButton, Modal, SelectField, TextareaField, TextField } from '@/components/ui'
import { Field } from '@/components/ui/TextField.jsx'
import { BLANK_PROFILE, INITIAL_PROFILE, WORK_MODES } from '../data/profile.js'
import styles from './EditProfileModal.module.css'

const FORM_ID = 'edit-profile-form'
const MAX_SKILLS = 12

function toForm(profile) {
  const source = profile ?? BLANK_PROFILE
  return {
    headline: source.headline,
    location: source.location,
    openToOpportunities: source.openToOpportunities,
    about: source.about,
    yearsExperience: String(source.yearsExperience),
    skills: source.skills,
    skillDraft: '',
    degree: source.degree,
    institution: source.institution,
    workMode: source.workMode,
    salaryMin: String(source.salaryMin),
  }
}

function skillError(skill, existing) {
  if (skill.length > 30) return 'Keep each skill to 30 characters or fewer.'
  if (existing.some((item) => item.toLowerCase() === skill.toLowerCase())) return `${skill} is already in your skills.`
  if (existing.length >= MAX_SKILLS) return `You can list up to ${MAX_SKILLS} skills.`
  return ''
}

function validate(values, skills) {
  const errors = {}
  const headline = values.headline.trim()
  if (!headline) errors.headline = 'Enter your current role or headline.'
  else if (headline.length > 60) errors.headline = 'Keep your headline to 60 characters or fewer.'

  const location = values.location.trim()
  if (!location) errors.location = 'Enter where you are based.'
  else if (location.length > 60) errors.location = 'Keep your location to 60 characters or fewer.'

  const about = values.about.trim()
  if (about.length < 20) errors.about = 'Tell your story in at least 20 characters.'
  else if (about.length > 600) errors.about = 'Keep your story to 600 characters or fewer.'

  const years = values.yearsExperience.trim()
  if (years === '') errors.yearsExperience = 'Enter your years of experience.'
  else if (!/^\d+$/.test(years) || Number(years) > 50) errors.yearsExperience = 'Enter a whole number from 0 to 50.'

  if (skills.length === 0) errors.skills = 'Add at least one skill.'

  if (!values.degree.trim()) errors.degree = 'Enter your qualification, like BFA, Interaction Design.'
  if (!values.institution.trim()) errors.institution = 'Enter the institution.'

  const salary = values.salaryMin.trim()
  if (salary !== '' && (!/^\d+$/.test(salary) || Number(salary) > 1000)) {
    errors.salaryMin = 'Enter thousands as a whole number, from 0 to 1000.'
  }
  return errors
}

function ProfileForm({ profile, onSave }) {
  const [values, setValues] = useState(() => toForm(profile))
  const [errors, setErrors] = useState({})

  function setField(name) {
    return (event) => {
      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
      setValues((current) => ({ ...current, [name]: value }))
      if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }))
    }
  }

  /** Moves the typed skill into the list; returns the resulting list (or null if it was invalid). */
  function commitSkillDraft() {
    const skill = values.skillDraft.trim()
    if (!skill) return values.skills
    const problem = skillError(skill, values.skills)
    if (problem) {
      setErrors((current) => ({ ...current, skills: problem }))
      return null
    }
    const skills = [...values.skills, skill]
    setValues((current) => ({ ...current, skills, skillDraft: '' }))
    setErrors((current) => ({ ...current, skills: undefined }))
    return skills
  }

  function removeSkill(skill) {
    setValues((current) => ({ ...current, skills: current.skills.filter((item) => item !== skill) }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const skills = commitSkillDraft()
    if (skills === null) return
    const nextErrors = validate(values, skills)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    const salary = values.salaryMin.trim()
    onSave({
      name: profile?.name ?? INITIAL_PROFILE.name,
      headline: values.headline.trim(),
      location: values.location.trim(),
      openToOpportunities: values.openToOpportunities,
      about: values.about.trim(),
      yearsExperience: Number(values.yearsExperience),
      skills,
      degree: values.degree.trim(),
      institution: values.institution.trim(),
      workMode: values.workMode,
      salaryMin: salary === '' ? '' : Number(salary),
    })
  }

  return (
    <form id={FORM_ID} className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.row}>
        <TextField
          label="Current role"
          value={values.headline}
          onChange={setField('headline')}
          error={errors.headline}
          placeholder="Product Designer"
          data-autofocus
        />
        <TextField
          label="Location"
          value={values.location}
          onChange={setField('location')}
          error={errors.location}
          placeholder="San Francisco, US"
        />
      </div>
      <Checkbox checked={values.openToOpportunities} onChange={setField('openToOpportunities')}>
        Open to opportunities
      </Checkbox>
      <TextareaField
        label="A little about me"
        value={values.about}
        onChange={setField('about')}
        error={errors.about}
        hint={`${values.about.trim().length} / 600 characters`}
        rows={4}
      />
      <TextField
        label="Years of experience"
        inputMode="numeric"
        value={values.yearsExperience}
        onChange={setField('yearsExperience')}
        error={errors.yearsExperience}
      />

      <Field id="profile-skill-draft" label="Strengths" hint="Add up to 12 skills. Press Enter to add one." error={errors.skills}>
        {({ describedBy, invalid }) => (
          <div className={styles.skills}>
            <div className={styles.skillInput}>
              <input
                id="profile-skill-draft"
                className={styles.skillField}
                value={values.skillDraft}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                placeholder="Add a skill"
                onChange={setField('skillDraft')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitSkillDraft()
                  }
                }}
              />
              <Button variant="secondary" size="sm" leftIcon={<Icon as={Plus} size={14} />} onClick={commitSkillDraft}>
                Add
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
                      label={`Remove ${skill}`}
                      className={styles.chipRemove}
                      onClick={() => removeSkill(skill)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Field>

      <div className={styles.row}>
        <TextField label="Qualification" value={values.degree} onChange={setField('degree')} error={errors.degree} />
        <TextField
          label="Institution"
          value={values.institution}
          onChange={setField('institution')}
          error={errors.institution}
        />
      </div>
      <div className={styles.row}>
        <SelectField label="Work preference" options={WORK_MODES} value={values.workMode} onChange={setField('workMode')} />
        <TextField
          label="Minimum salary (thousands per year)"
          inputMode="numeric"
          value={values.salaryMin}
          onChange={setField('salaryMin')}
          error={errors.salaryMin}
          hint="Optional. 120 shows as $120k+ / year."
        />
      </div>
    </form>
  )
}

/** Edit (or create) dialog for the whole profile. Saving persists on this device only. */
export default function EditProfileModal({ open, profile, onSave, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={600}
      title={profile ? 'Edit profile' : 'Create profile'}
      description="Changes are saved on this device only."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            Save changes
          </Button>
        </>
      }
    >
      <ProfileForm profile={profile} onSave={onSave} />
    </Modal>
  )
}
