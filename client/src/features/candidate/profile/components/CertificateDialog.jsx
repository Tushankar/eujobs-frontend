import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { Checkbox, TextField } from '@/components/ui'
import { Field } from '@/components/ui/TextField.jsx'
import { check, checkUpload, useErrorText, useFormState, useUploadText } from '@/lib/forms.js'
import { useAddCertificateMutation, useRemoveCertificateFileMutation, useSetCertificateFileMutation, useUpdateCertificateMutation } from '../api.js'
import FormDialog from './FormDialog.jsx'
import dialogStyles from './FormDialog.module.css'
import MonthField from './MonthField.jsx'

const HTTPS = /^https:\/\/[^\s/$.?#].[^\s]*$/i
// How far ahead the expiry year list reaches.
const EXPIRY_YEARS_AHEAD = 15

/** M-025, P3-D3: a self-declared certificate with an optional link and file; with a file it can be verified. */
export default function CertificateDialog({ open, certificate, onSaved, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const rule = config?.limits.uploads.certificate_file
  const uploadText = useUploadText(rule)
  const [addCertificate, { isLoading: adding }] = useAddCertificateMutation()
  const [updateCertificate, { isLoading: updating }] = useUpdateCertificateMutation()
  const [setCertificateFile, { isLoading: uploading }] = useSetCertificateFileMutation()
  const [removeCertificateFile] = useRemoveCertificateFileMutation()
  const { values, set, errors, setErrors, failure, run } = useFormState(() => ({
    name: certificate?.name ?? '',
    issuer: certificate?.issuer ?? '',
    issuedOn: certificate?.issuedOn ?? '',
    expiresOn: certificate?.expiresOn ?? '',
    url: certificate?.url ?? '',
    file: null,
    removeFile: false,
  }))
  const label = (name) => t(`profile:form.certificate.${name}`)

  async function handleSubmit() {
    const max = config.limits.profile.entryText.max
    const url = values.url.trim()
    const checks = {
      name: check.text(values.name, max),
      issuer: check.text(values.issuer, max),
      issuedOn: values.issuedOn ? undefined : { key: 'required' },
      expiresOn: values.expiresOn && values.issuedOn && values.expiresOn < values.issuedOn ? { key: 'before_start' } : undefined,
      url: check.maxLength(url, config.limits.profile.url.max) ?? (url && !HTTPS.test(url) ? { key: 'invalid' } : undefined),
    }
    const body = { name: values.name.trim(), issuer: values.issuer.trim(), issuedOn: values.issuedOn, expiresOn: values.expiresOn || null, url }
    const saved = await run(checks, async () => {
      const profile = await (certificate ? updateCertificate({ id: certificate.id, body }) : addCertificate(body)).unwrap()
      const id = certificate?.id ?? profile.certificates.at(-1).id
      if (values.file) await setCertificateFile({ id, file: values.file }).unwrap()
      else if (values.removeFile) await removeCertificateFile(id).unwrap()
    })
    if (saved) onSaved()
  }

  if (!rule) return null

  return (
    <FormDialog open={open} title={label(certificate ? 'editTitle' : 'addTitle')} busy={adding || updating || uploading} failure={failure} onClose={onClose} onSubmit={handleSubmit}>
      <div className={dialogStyles.row}>
        <TextField label={label('name')} name="name" value={values.name} onChange={(event) => set('name', event.target.value)} error={errorText.field('name', errors.name)} data-autofocus />
        <TextField label={label('issuer')} name="issuer" value={values.issuer} onChange={(event) => set('issuer', event.target.value)} error={errorText.field('issuer', errors.issuer)} />
      </div>
      <div className={dialogStyles.row}>
        <MonthField label={label('issuedOn')} name="issuedOn" value={values.issuedOn} onChange={(month) => set('issuedOn', month)} error={errorText.field('issuedOn', errors.issuedOn)} />
        <MonthField
          label={label('expiresOn')}
          name="expiresOn"
          optional
          futureYears={EXPIRY_YEARS_AHEAD}
          value={values.expiresOn}
          onChange={(month) => set('expiresOn', month)}
          error={errorText.field('expiresOn', errors.expiresOn)}
        />
      </div>
      <TextField label={label('url')} name="url" type="url" value={values.url} onChange={(event) => set('url', event.target.value)} error={errorText.field('url', errors.url)} />
      <Field id="certificate-file" label={label('file')} hint={t('profile:form.certificate.fileHint', { limits: uploadText.limits })} error={errors.file && (errors.file.text ?? errorText.field('file', errors.file))}>
        {({ describedBy, invalid }) => (
          <input
            id="certificate-file"
            type="file"
            name="certificateFile"
            accept={rule.types.map((type) => `.${type}`).join(',')}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              const problem = file && checkUpload(file, rule)
              set('file', problem ? null : file)
              if (problem) setErrors((current) => ({ ...current, file: { text: uploadText.problem(problem, file) } }))
            }}
          />
        )}
      </Field>
      {certificate?.file && !values.file && (
        <Checkbox name="removeFile" checked={values.removeFile} onChange={(event) => set('removeFile', event.target.checked)}>
          {label('removeFile')} ({t('profile:form.certificate.currentFile', { name: certificate.file.name })})
        </Checkbox>
      )}
    </FormDialog>
  )
}
