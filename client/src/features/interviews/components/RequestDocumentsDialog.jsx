import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, X } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Checkbox, Icon, IconButton, Modal, SelectField, TextareaField, TextField } from '@/components/ui'
import { checkUpload, useErrorText, useFormState, useUploadText } from '@/lib/forms.js'
import { useRequestDocumentsMutation } from '../api.js'
import styles from './Dialogs.module.css'

const FORM_ID = 'request-documents-form'

/**
 * Request documents in the thread (P11d-Q7, Q19): the application (when several are active), the documents, a label
 * for "Other", a note and an optional file for the candidate (an offer letter to sign).
 */
export default function RequestDocumentsDialog({ applications, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const rule = config?.limits.uploads.document_attachment
  const uploadText = useUploadText(rule)
  const [send] = useRequestDocumentsMutation()
  const input = useRef(null)
  const { values, set, errors, setErrors, failure, run } = useFormState({ applicationId: applications[0]?.id ?? '', kinds: [], label: '', note: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const toggle = (kind, on) => set('kinds', on ? [...values.kinds, kind] : values.kinds.filter((item) => item !== kind))

  function onFile(event) {
    const picked = event.target.files[0]
    event.target.value = ''
    if (!picked) return
    const problem = checkUpload(picked, rule)
    if (problem) return setErrors((current) => ({ ...current, file: { text: uploadText.problem(problem, picked) } }))
    setErrors((current) => ({ ...current, file: undefined }))
    setFile(picked)
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    const items = values.kinds.map((kind) => (kind === 'other' ? { kind, label: values.label.trim() } : { kind }))
    const ok = await run(
      {
        kinds: values.kinds.length ? undefined : { key: 'required' },
        label: values.kinds.includes('other') && !values.label.trim() ? { key: 'required' } : undefined,
      },
      () => send({ applicationId: values.applicationId, items, note: values.note.trim(), file }).unwrap(),
    )
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('interviews:requestDocuments.title')}
      description={t('interviews:requestDocuments.description')}
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={busy} data-request-submit>
            {t('interviews:requestDocuments.send')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className={styles.form} onSubmit={submit} noValidate>
        {applications.length > 1 && (
          <SelectField
            label={t('interviews:offer.application')}
            value={values.applicationId}
            onChange={(event) => set('applicationId', event.target.value)}
            options={applications.map((application) => ({ value: application.id, label: application.job.title }))}
          />
        )}
        <fieldset className={styles.slots}>
          <legend className={styles.legend}>{t('interviews:requestDocuments.documents')}</legend>
          <div className={styles.kinds}>
            {(config?.enums.documentKind ?? []).map((kind) => (
              <Checkbox key={kind} checked={values.kinds.includes(kind)} onChange={(event) => toggle(kind, event.target.checked)} data-document-kind={kind}>
                {t(`enums:documentKind.${kind}`)}
              </Checkbox>
            ))}
          </div>
          {errors.kinds && <p className={styles.error}>{t('interviews:requestDocuments.pickOne')}</p>}
        </fieldset>
        {values.kinds.includes('other') && (
          <TextField label={t('interviews:requestDocuments.otherLabel')} value={values.label} maxLength={config?.limits.documentRequest.otherLabel.max} onChange={(event) => set('label', event.target.value)} error={errorText.field('label', errors.label)} />
        )}
        <TextareaField label={t('interviews:requestDocuments.note')} rows={3} maxLength={config?.limits.documentRequest.note.max} value={values.note} onChange={(event) => set('note', event.target.value)} />
        <div className={styles.section}>
          <p className={styles.legend}>{t('interviews:requestDocuments.attachment')}</p>
          <p className={styles.hint}>{uploadText.limits}</p>
          <input ref={input} type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={onFile} data-request-attachment />
          {file ? (
            <p className={styles.paragraph}>
              <Icon as={Paperclip} size={14} /> {file.name}
              <IconButton icon={X} label={t('interviews:requestDocuments.removeFile')} onClick={() => setFile(null)} />
            </p>
          ) : (
            <Button variant="outline" leftIcon={<Icon as={Paperclip} size={14} />} onClick={() => input.current?.click()}>
              {t('interviews:requestDocuments.attach')}
            </Button>
          )}
          {errors.file && <p className={styles.error}>{errors.file.text}</p>}
        </div>
        {failure && <p className={styles.error}>{errorText.code(failure)}</p>}
      </form>
    </Modal>
  )
}
