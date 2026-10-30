import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { Checkbox, SelectField } from '@/components/ui'
import { Field } from '@/components/ui/TextField.jsx'
import FormDialog from '@/features/candidate/profile/components/FormDialog.jsx'
import { checkUpload, useErrorText, useFormState, useUploadText } from '@/lib/forms.js'
import { useSubmitEvidenceMutation } from '../api.js'
import styles from './SubmitEvidenceModal.module.css'

/**
 * Evidence for one check (M-166): the type (identity, academic, employment), the profile entry it supports
 * (academic, employment), or a fixed entry (right to work); then the file and the accuracy confirmation.
 * `request` = { category, title, evidenceTypes?, entries? [{ id, label }], entryId? }.
 */
export default function SubmitEvidenceModal({ open, request, onSubmitted, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const rule = config?.limits.uploads.evidence
  const uploadText = useUploadText(rule)
  const [submitEvidence, { isLoading }] = useSubmitEvidenceMutation()
  const { values, set, errors, setErrors, failure, run } = useFormState(() => ({
    evidenceType: request?.evidenceTypes?.[0] ?? '',
    entryId: request?.entryId ?? request?.entries?.[0]?.id ?? '',
    file: null,
    confirmed: false,
  }))
  if (!request || !rule) return null
  const { category, evidenceTypes, entries } = request

  async function handleSubmit() {
    const checks = {
      entryId: entries && !values.entryId ? { key: 'required' } : undefined,
      file: values.file ? undefined : { key: 'required' },
      confirmed: values.confirmed ? undefined : { key: 'required' },
    }
    const body = { category, evidenceType: evidenceTypes ? values.evidenceType : undefined, entryId: values.entryId || undefined, file: values.file }
    if (await run(checks, () => submitEvidence(body).unwrap())) onSubmitted()
  }

  return (
    <FormDialog
      open={open}
      title={t('verification:dialog.title', { check: request.title })}
      description={t('verification:dialog.description')}
      submitLabel={t('verification:dialog.submit')}
      width={520}
      busy={isLoading}
      failure={failure}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      {evidenceTypes && (
        <SelectField
          label={t('verification:dialog.type')}
          name="evidenceType"
          options={evidenceTypes.map((type) => ({ value: type, label: t(`enums:evidenceType.${type}`) }))}
          value={values.evidenceType}
          onChange={(event) => set('evidenceType', event.target.value)}
          error={errorText.field('evidenceType', errors.evidenceType)}
          data-autofocus
        />
      )}
      {entries && (
        <SelectField
          label={t('verification:dialog.entry')}
          name="entryId"
          options={entries.map((entry) => ({ value: entry.id, label: entry.label }))}
          value={values.entryId}
          onChange={(event) => set('entryId', event.target.value)}
          error={errorText.field('entryId', errors.entryId)}
        />
      )}
      <Field id="evidence-file" label={t('verification:dialog.file')} hint={uploadText.limits} error={errors.file && (errors.file.text ?? errorText.field('file', errors.file))}>
        {({ describedBy, invalid }) => (
          <input
            id="evidence-file"
            type="file"
            name="evidenceFile"
            className={styles.file}
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
      <div>
        <Checkbox name="confirmed" checked={values.confirmed} onChange={(event) => set('confirmed', event.target.checked)}>
          {t('verification:dialog.confirm')}
        </Checkbox>
        {errors.confirmed && (
          <p className={styles.error} role="alert">
            {errorText.field('confirmed', errors.confirmed)}
          </p>
        )}
      </div>
    </FormDialog>
  )
}
