import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, CircleCheck, ShieldCheck } from 'lucide-react'
import { Badge, Button, Icon, Panel, SelectField, TextareaField, TextField } from '@/components/ui'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { COMPANY_SIZES, COMPANY_STORAGE_KEY, INITIAL_COMPANY } from '../data/company.js'
import styles from './CompanyPage.module.css'

const URL_PATTERN = /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i

function validate(values) {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Enter your company name.'
  if (!values.industry.trim()) errors.industry = 'Enter your industry, for example Enterprise SaaS.'
  if (!values.location.trim()) errors.location = 'Enter where your company is based, for example San Francisco, US.'
  if (!values.website.trim()) errors.website = 'Enter your company website.'
  else if (!URL_PATTERN.test(values.website.trim())) {
    errors.website = 'Enter a valid website address starting with https://, like https://acme.example.'
  }
  if (!values.size) errors.size = 'Choose your company size.'
  if (!values.description.trim()) errors.description = 'Tell candidates what you’re building.'
  else if (values.description.trim().length < 20) {
    errors.description = 'Write at least 20 characters so candidates understand what you’re building.'
  }
  return errors
}

/** Editable company profile. Fields start from the saved profile; Save validates and persists on this device. */
export default function CompanyPage() {
  const [company, setCompany] = useLocalStorage(COMPANY_STORAGE_KEY, INITIAL_COMPANY)
  const [values, setValues] = useState(company)
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)

  function setField(name) {
    return (event) => {
      setValues((current) => ({ ...current, [name]: event.target.value }))
      if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }))
      setSaved(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    const firstInvalid = Object.keys(nextErrors)[0]
    if (firstInvalid) {
      event.currentTarget.elements[firstInvalid]?.focus()
      setSaved(false)
      return
    }
    const trimmed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))
    setValues(trimmed)
    setCompany(trimmed)
    setSaved(true)
  }

  return (
    <>
      <div className={styles.pageTitle}>
        <div>
          <h1 className={styles.title}>Tell the story behind your team.</h1>
          <p className={styles.lead}>Help the right people understand what you’re building, and why it matters.</p>
        </div>
        <Button as={Link} to="/recruiter/jobs/new" rightIcon={<Icon as={ArrowRight} size={13} />}>
          Create your next role
        </Button>
      </div>

      <Panel className={styles.panel} padding="clamp(20px, 4vw, 32px)">
        <div className={styles.identity}>
          <span className={styles.logo} aria-hidden="true">
            {(company.name.trim()[0] || '?').toUpperCase()}
          </span>
          <div>
            <h2 className={styles.companyName}>{company.name}</h2>
            <div className={styles.badgeRow}>
              <Badge tone="green" className={styles.demoBadge}>
                <Icon as={ShieldCheck} size={10} />
                Demo company
              </Badge>
            </div>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.grid}>
            <TextField
              label="Company name"
              name="name"
              autoComplete="organization"
              value={values.name}
              onChange={setField('name')}
              error={errors.name}
            />
            <TextField
              label="Industry"
              name="industry"
              value={values.industry}
              onChange={setField('industry')}
              error={errors.industry}
            />
            <TextField
              label="Location"
              name="location"
              value={values.location}
              onChange={setField('location')}
              error={errors.location}
            />
            <TextField
              label="Website"
              name="website"
              type="url"
              autoComplete="url"
              value={values.website}
              onChange={setField('website')}
              error={errors.website}
            />
            <SelectField
              label="Company size"
              name="size"
              options={COMPANY_SIZES}
              value={values.size}
              onChange={setField('size')}
              error={errors.size}
            />
          </div>

          <TextareaField
            className={styles.description}
            label="What you’re building"
            name="description"
            value={values.description}
            onChange={setField('description')}
            error={errors.description}
          />

          <div className={styles.actions}>
            <Button type="submit" rightIcon={<Icon as={Check} size={14} />}>
              Save company profile
            </Button>
            {saved && (
              <p className={styles.success} role="status">
                <Icon as={CircleCheck} size={16} />
                Company profile saved on this device.
              </p>
            )}
          </div>
        </form>
      </Panel>
    </>
  )
}
