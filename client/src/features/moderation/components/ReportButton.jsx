import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flag } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Icon, Modal, SelectField, TextareaField } from '@/components/ui'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import { useReportContentMutation } from '../api.js'
import styles from './ReportButton.module.css'

const REASONS = ['spam', 'scam_or_fraud', 'discriminatory', 'offensive', 'misleading', 'other']

/** The reason and details form (U20); a repeat report and the daily limit are explained in place. */
function ReportDialog({ targetType, targetId, onClose, onReported }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const max = config?.limits.report.details.max
  const [reportContent, { isLoading }] = useReportContentMutation()
  const { values, set, errors, failure, run } = useFormState({ reason: '', details: '' })
  const failureParams = failure?.data?.error?.params
  const failureText = failure && (failureParams?.reason === 'already_reported' ? t('common:report.already') : failureParams?.reason === 'reports_per_day' ? t('common:report.limit', { count: failureParams.limit }) : errorText.code(failure))

  async function submit(event) {
    event.preventDefault()
    const done = await run({ reason: check.required(values.reason), details: check.maxLength(values.details, max) }, () =>
      reportContent({ targetType, targetId, reason: values.reason, details: values.details.trim() }).unwrap(),
    )
    if (done) onReported()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t(`common:report.title.${targetType}`)}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:report.cancel')}
          </Button>
          <Button type="submit" form="report-form" loading={isLoading}>
            {t('common:report.submit')}
          </Button>
        </>
      }
    >
      <form id="report-form" className={styles.form} onSubmit={submit} noValidate data-report-form>
        <p className={styles.intro}>{t('common:report.intro')}</p>
        <SelectField
          name="reason"
          label={t('common:report.reason')}
          value={values.reason}
          onChange={(event) => set('reason', event.target.value)}
          error={errorText.field('reason', errors.reason)}
          options={[{ value: '', label: t('common:report.chooseReason') }, ...REASONS.map((reason) => ({ value: reason, label: t(`enums:reportReason.${reason}`) }))]}
        />
        <TextareaField
          name="details"
          label={t('common:report.details')}
          hint={t('common:report.detailsHint', { count: values.details.length, max })}
          value={values.details}
          onChange={(event) => set('details', event.target.value)}
          error={errorText.field('details', errors.details)}
          rows={4}
        />
        {failureText && (
          <p className={styles.error} role="alert">
            {failureText}
          </p>
        )}
      </form>
    </Modal>
  )
}

/**
 * "Report" (M-164): opens the reason form for a job, a company, a candidate profile or a message. After sending, the
 * button says so for the rest of the visit; the server keeps one open report per person and target.
 */
export default function ReportButton({ targetType, targetId, size, fullWidth, className }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reported, setReported] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size={size}
        fullWidth={fullWidth}
        className={className}
        leftIcon={<Icon as={Flag} size={13} />}
        disabled={reported}
        onClick={() => setOpen(true)}
        data-report={targetType}
      >
        {t(reported ? 'common:report.sent' : `common:report.button.${targetType}`)}
      </Button>
      {open && (
        <ReportDialog
          targetType={targetType}
          targetId={targetId}
          onClose={() => setOpen(false)}
          onReported={() => {
            setOpen(false)
            setReported(true)
          }}
        />
      )}
    </>
  )
}
