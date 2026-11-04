import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, CircleCheck, ShieldCheck, Upload } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, CompanyLogo, Icon, Panel, SelectField, TextareaField, TextField } from '@/components/ui'
import CityField from '@/components/common/CityField.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { check, checkUpload, useErrorText, useFormState, useUploadText } from '@/lib/forms.js'
import { useGetCompanyQuery, useRemoveLogoMutation, useUpdateCompanyMutation, useUploadLogoMutation } from '../api.js'
import styles from './CompanyPage.module.css'

/** The Company page (M-146, M-147, M-150): public fields only; the legal name stays as verified in KYC. */
export default function CompanyPage() {
  const { data: company } = useGetCompanyQuery()
  return company ? <CompanyForm company={company} /> : null
}

function CompanyForm({ company }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [updateCompany, { isLoading }] = useUpdateCompanyMutation()
  const [uploadLogo, { isLoading: uploading }] = useUploadLogoMutation()
  const [removeLogo] = useRemoveLogoMutation()
  const fileInput = useRef(null)
  const logoRule = config?.limits.uploads.company_logo
  const uploadText = useUploadText(logoRule)
  const [logoError, setLogoError] = useState(null)
  const [saved, setSaved] = useState(false)
  const { values, set, errors, setErrors, failure, run } = useFormState({
    displayName: company.displayName,
    industry: company.industry ?? '',
    place: company.location,
    website: company.website ?? '',
    size: company.size ?? '',
    description: company.description ?? '',
  })
  const limits = config?.limits.company
  const field = (name) => (event) => {
    set(name, event.target.value)
    setSaved(false)
  }
  const errorOf = (name) => errorText.field(name, errors[name])

  async function handleLogo(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const problem = checkUpload(file, logoRule)
    if (problem) return setLogoError(uploadText.problem(problem, file))
    setLogoError(null)
    try {
      await uploadLogo(file).unwrap()
    } catch (error) {
      setLogoError(errorText.code(error))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const { min: descriptionMin, max: descriptionMax } = limits.description
    const description = values.description.trim()
    const ok = await run(
      {
        displayName: check.text(values.displayName, limits.name.max),
        industry: check.text(values.industry, limits.industry.max),
        placeId: values.place ? undefined : { key: 'required' },
        website: check.text(values.website, limits.website.max),
        size: check.required(values.size),
        description:
          check.text(description, descriptionMax) ?? (description.length < descriptionMin ? { key: 'too_short', params: { min: descriptionMin } } : undefined),
      },
      () =>
        updateCompany({
          displayName: values.displayName,
          industry: values.industry,
          placeId: values.place.placeId,
          website: values.website,
          size: values.size,
          description,
        }).unwrap(),
    )
    setSaved(ok)
  }

  return (
    <>
      <div className={styles.pageTitle}>
        <div>
          <h1 className={styles.title}>{t('company:title')}</h1>
          <p className={styles.lead}>{t('company:lead')}</p>
        </div>
        <Button as={Link} to="/recruiter/jobs/new" rightIcon={<Icon as={ArrowRight} size={13} />}>
          {t('company:createRole')}
        </Button>
      </div>

      <Panel className={styles.panel} padding="clamp(20px, 4vw, 32px)">
        <div className={styles.identity}>
          <CompanyLogo name={company.displayName} id={company.id} src={company.logoUrl ?? undefined} size={64} />
          <div className={styles.identityText}>
            <h2 className={styles.companyName}>{company.displayName}</h2>
            <p className={styles.legal}>
              {t('company:legalName')}: {company.legalName}
            </p>
            <div className={styles.badgeRow}>
              {company.verifiedAt && (
                <PillBadge tone="success">
                  <Icon as={ShieldCheck} size={10} />
                  {t('common:verifiedCompany')}
                </PillBadge>
              )}
            </div>
          </div>
          <div className={styles.logoActions}>
            <input ref={fileInput} type="file" hidden accept={logoRule?.types.map((ext) => `.${ext}`).join(',')} onChange={handleLogo} />
            <Button variant="outline" size="sm" loading={uploading} leftIcon={<Icon as={Upload} size={13} />} onClick={() => fileInput.current.click()}>
              {t(company.logoUrl ? 'company:logo.replace' : 'company:logo.upload')}
            </Button>
            {company.logoUrl && (
              <Button variant="ghost" size="sm" onClick={() => removeLogo()}>
                {t('company:logo.remove')}
              </Button>
            )}
            <p className={styles.logoHint}>{uploadText.limits}</p>
          </div>
        </div>
        {logoError && (
          <p className={styles.error} role="alert">
            {logoError}
          </p>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.grid}>
            <TextField
              label={t('company:fields.displayName')}
              name="displayName"
              autoComplete="organization"
              hint={t('company:fields.displayNameHint')}
              value={values.displayName}
              onChange={field('displayName')}
              error={errorOf('displayName')}
            />
            <TextField label={t('company:fields.industry')} name="industry" value={values.industry} onChange={field('industry')} error={errorOf('industry')} />
            <CityField
              label={t('company:fields.city')}
              name="companyCity"
              value={values.place}
              onChange={(place) => {
                set('place', place)
                setErrors((current) => ({ ...current, placeId: undefined }))
                setSaved(false)
              }}
              error={errorOf('placeId')}
            />
            <TextField
              label={t('company:fields.website')}
              name="website"
              type="url"
              autoComplete="url"
              value={values.website}
              onChange={field('website')}
              error={errorOf('website')}
            />
            <SelectField
              label={t('company:fields.size')}
              name="size"
              options={(config?.enums.companySize ?? []).map((size) => ({ value: size, label: t(`enums:companySize.${size}`) }))}
              value={values.size}
              onChange={field('size')}
              error={errorOf('size')}
            />
          </div>

          <TextareaField
            className={styles.description}
            label={t('company:fields.description')}
            name="description"
            value={values.description}
            onChange={field('description')}
            error={errorOf('description')}
          />

          {failure && <p role="alert">{errorText.code(failure)}</p>}
          <div className={styles.actions}>
            <Button type="submit" loading={isLoading} rightIcon={<Icon as={Check} size={14} />}>
              {t('company:save')}
            </Button>
            {saved && (
              <p className={styles.success} role="status">
                <Icon as={CircleCheck} size={16} />
                {t('company:saved')}
              </p>
            )}
          </div>
        </form>
      </Panel>
    </>
  )
}
