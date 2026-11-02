import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Modal, SelectField, TextareaField } from '@/components/ui'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import { useRequestCvMutation } from '../api.js'
import styles from './EarlierVersionModal.module.css'

/**
 * "Request earlier version" (M-029, U19): a reason and optional details (≤ 1,000). The candidate is emailed and
 * chooses which version, if any, to share. Mount it only while it is open so the form resets each time.
 */
export default function EarlierVersionModal({ candidate, onClose, onSent }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [requestCv, { isLoading }] = useRequestCvMutation()
  const { values, set, errors, failure, run } = useFormState({ reason: '', details: '' })
  const max = config?.limits.cvRequestDetails.max

  async function handleSubmit(event) {
    event.preventDefault()
    const sent = await run({ reason: check.required(values.reason), details: check.maxLength(values.details, max) }, () =>
      requestCv({ id: candidate.id, reason: values.reason, details: values.details.trim() }).unwrap(),
    )
    if (sent) onSent()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('discovery:resumeTab.modalTitle')}
      description={t('discovery:resumeTab.modalDescription', { name: candidate.fullName })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('discovery:resumeTab.cancel')}
          </Button>
          <Button type="submit" form="earlier-version-form" loading={isLoading}>
            {t('discovery:resumeTab.send')}
          </Button>
        </>
      }
    >
      <form id="earlier-version-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        <SelectField
          label={t('discovery:resumeTab.reason')}
          name="reason"
          placeholder={t('discovery:resumeTab.reasonPlaceholder')}
          value={values.reason}
          error={errorText.field('reason', errors.reason)}
          options={(config?.enums.cvRequestReason ?? []).map((reason) => ({ value: reason, label: t(`enums:cvRequestReason.${reason}`) }))}
          data-autofocus
          onChange={(event) => set('reason', event.target.value)}
        />
        <TextareaField
          label={t('discovery:resumeTab.details')}
          name="details"
          hint={t('discovery:resumeTab.detailsHint', { max })}
          rows={4}
          value={values.details}
          error={errorText.field('details', errors.details)}
          onChange={(event) => set('details', event.target.value)}
        />
        {failure && <p role="alert">{errorText.code(failure)}</p>}
      </form>
    </Modal>
  )
}
