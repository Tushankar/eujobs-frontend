import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoaderCircle, X } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { Button, CompanyLogo, Icon, Modal, SelectField, TextField } from '@/components/ui'
import CityField from '@/components/common/CityField.jsx'
import { check, checkUpload, compact, serverFieldErrors, useErrorText, useUploadText } from '@/lib/forms.js'
import { useSectors } from '@/lib/sectors.js'
import { useCreateClientMutation, useRemoveClientLogoMutation, useSearchClientCompaniesQuery, useUpdateClientMutation, useUploadClientLogoMutation } from '../../api.js'
import styles from './ClientDialog.module.css'

/** Picks the EU Jobs company a client is (optional), searched by name; shows the chosen one with a remove button. */
function CompanyLink({ value, onChange }) {
  const { t } = useTranslation('agency')
  const sectors = useSectors()
  const [query, setQuery] = useState('')
  const term = query.trim()
  const { data: found = [], isFetching } = useSearchClientCompaniesQuery(term, { skip: term.length < 2 })
  if (value) {
    return (
      <div className={styles.linked} data-linked-company>
        <span className={styles.linkedName}>{value.displayName}</span>
        <Button variant="ghost" size="sm" leftIcon={<Icon as={X} size={13} />} onClick={() => onChange(null)}>
          {t('clients.dialog.unlink')}
        </Button>
      </div>
    )
  }
  return (
    <div className={styles.search}>
      <TextField label={t('clients.dialog.link')} hint={t('clients.dialog.linkHint')} name="companySearch" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
      {term.length >= 2 && (
        <ul className={styles.results} aria-busy={isFetching || undefined}>
          {found.length === 0 && !isFetching && <li className={styles.none}>{t('clients.dialog.noCompanies')}</li>}
          {found.map((company) => (
            <li key={company.id}>
              <button type="button" className={styles.result} onClick={() => onChange(company)}>
                <CompanyLogo name={company.displayName} src={company.logoUrl ?? undefined} size={28} />
                <span className={styles.resultText}>
                  <span className={styles.resultName}>{company.displayName}</span>
                  {sectors.industry(company) && <span className={styles.resultMeta}>{sectors.industry(company)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Add or edit a client: name, sector, city, the EU Jobs company it is, and (once saved) its logo. */
export default function ClientDialog({ client, open, onClose, onSaved }) {
  const { t } = useTranslation()
  const sectors = useSectors()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const logoRule = config?.limits.uploads.client_logo
  const uploadText = useUploadText(logoRule)
  const [values, setValues] = useState(() => ({
    name: client?.name ?? '',
    // 2026-11-24: a sector instead of a typed industry; a client from before keeps its text until a sector is picked.
    sector: client?.sector ?? '',
    place: client?.location ?? null,
    linked: client?.linkedCompany ?? null,
  }))
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState(null)
  const [create, { isLoading: creating }] = useCreateClientMutation()
  const [update, { isLoading: updating }] = useUpdateClientMutation()
  const [uploadLogo, { isLoading: uploading }] = useUploadClientLogoMutation()
  const [removeLogo, { isLoading: removing }] = useRemoveClientLogoMutation()
  // 2026-11-23: a spinner on the logo while it uploads or is removed.
  const logoBusy = uploading || removing
  const [logoProblem, setLogoProblem] = useState('')
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = compact({ name: check.required(values.name) })
    setErrors(nextErrors)
    setFailure(null)
    if (Object.keys(nextErrors).length) return
    const body = { name: values.name.trim(), sector: values.sector || null, placeId: values.place?.placeId ?? null, linkedCompanyId: values.linked?.id ?? null }
    try {
      const saved = await (client ? update({ id: client.id, body }) : create(body)).unwrap()
      // 2026-11-23: the job wizard picks a client added from it.
      onSaved?.(saved)
      onClose()
    } catch (error) {
      setErrors(serverFieldErrors(error))
      if (errorCode(error) !== 'VALIDATION_FAILED') setFailure(error)
    }
  }

  async function handleLogo(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const problem = checkUpload(file, logoRule)
    setLogoProblem(problem ? uploadText.problem(problem, file) : '')
    if (!problem) await uploadLogo({ id: client.id, file }).unwrap().catch((error) => setLogoProblem(errorText.code(error)))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(client ? 'agency:clients.dialog.editTitle' : 'agency:clients.dialog.addTitle')}
      description={t('agency:clients.dialog.description')}
      width={520}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" form="client-form" loading={creating || updating}>
            {t(client ? 'agency:clients.dialog.save' : 'agency:clients.dialog.add')}
          </Button>
        </>
      }
    >
      <form id="client-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        {client && (
          <div className={styles.logoRow}>
            <span className={styles.logoBox} aria-busy={logoBusy || undefined} data-logo-busy={logoBusy || undefined}>
              <CompanyLogo name={client.name} src={client.logoUrl ?? undefined} size={48} />
              {logoBusy && (
                <span className={styles.logoSpinner}>
                  <Icon as={LoaderCircle} size={20} />
                </span>
              )}
            </span>
            <div className={styles.logoActions}>
              <label className={styles.upload} data-disabled={logoBusy || undefined}>
                <input type="file" accept={logoRule?.types.map((type) => `.${type}`).join(',')} onChange={handleLogo} disabled={logoBusy} />
                {uploading ? t('company:logo.uploading') : t(client.logoUrl ? 'agency:clients.dialog.replaceLogo' : 'agency:clients.dialog.addLogo')}
              </label>
              {client.logoUrl && !uploading && (
                <button type="button" className={styles.removeLogo} onClick={() => removeLogo(client.id)} disabled={logoBusy}>
                  {t('agency:clients.dialog.removeLogo')}
                </button>
              )}
              <span className={logoProblem ? styles.logoError : styles.logoHint}>{logoProblem || uploadText.limits}</span>
            </div>
          </div>
        )}
        <TextField label={t('agency:clients.fields.name')} name="name" value={values.name} onChange={set('name')} error={errorText.field('name', errors.name)} />
        <SelectField
          label={t('agency:clients.fields.sector')}
          name="sector"
          hint={!values.sector && client?.industry && !client.sector ? t('agency:clients.fields.sectorBefore', { industry: client.industry }) : undefined}
          options={[{ value: '', label: t('agency:clients.fields.noSector') }, ...sectors.options(client?.sector)]}
          value={values.sector}
          onChange={set('sector')}
          error={errorText.field('sector', errors.sector)}
        />
        <CityField label={t('agency:clients.fields.city')} name="clientCity" value={values.place} onChange={(place) => setValues((current) => ({ ...current, place }))} error={errorText.field('placeId', errors.placeId)} />
        {/* A linked company's sector fills an empty one. */}
        <CompanyLink value={values.linked} onChange={(linked) => setValues((current) => ({ ...current, linked, sector: current.sector || linked?.sector || '' }))} />
        {errors.linkedCompanyId && <p className={styles.error}>{errorText.field('linkedCompanyId', errors.linkedCompanyId)}</p>}
        {failure && (
          <p className={styles.error} role="alert">
            {errorText.code(failure)}
          </p>
        )}
      </form>
    </Modal>
  )
}
