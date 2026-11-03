import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Modal, SelectField, TextField } from '@/components/ui'
import CityField from '@/components/common/CityField.jsx'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useCreateJobAlertMutation, useUpdateJobAlertMutation } from '../api.js'
import styles from './JobAlertModal.module.css'

const FORM_ID = 'job-alert-form'

function AlertForm({ alert, onClose }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { me } = usePreferences()
  const { data: config } = useGetConfigQuery()
  const [createAlert] = useCreateJobAlertMutation()
  const [updateAlert] = useUpdateJobAlertMutation()
  const limits = config?.limits.jobAlert
  // U35: a new alert takes the header country; an existing one keeps its own. Remote alerts have no city.
  const country = alert?.country ?? me.pickerCountry ?? 'REMOTE'
  const { values, set, errors, failure, run } = useFormState({
    name: alert?.name ?? '',
    keywords: alert?.keywords ?? '',
    place: alert?.location ?? null,
    frequency: alert?.frequency ?? config?.enums.alertFrequency[0],
  })

  async function handleSubmit(event) {
    event.preventDefault()
    const body = { name: values.name.trim(), keywords: values.keywords.trim(), placeId: values.place?.placeId ?? null, frequency: values.frequency }
    const saved = await run({ name: check.text(values.name, limits.name.max), keywords: check.text(values.keywords, limits.keywords.max) }, () =>
      (alert ? updateAlert({ id: alert.id, ...body }) : createAlert(body)).unwrap(),
    )
    if (saved) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t(alert ? 'jobAlerts:form.editTitle' : 'jobAlerts:form.createTitle')}
      description={t('jobAlerts:form.description', { country: format.country(country) })}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" form={FORM_ID}>
            {t(alert ? 'jobAlerts:form.save' : 'jobAlerts:form.submit')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label={t('jobAlerts:form.name')}
          name="alertName"
          data-autofocus
          placeholder={t('jobAlerts:form.namePlaceholder')}
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          error={errorText.field('alertName', errors.name)}
        />
        <TextField
          label={t('jobAlerts:form.keywords')}
          name="keywords"
          placeholder={t('jobAlerts:form.keywordsPlaceholder')}
          hint={t('jobAlerts:form.keywordsHint')}
          value={values.keywords}
          onChange={(event) => set('keywords', event.target.value)}
          error={errorText.field('alertKeywords', errors.keywords)}
        />
        <div className={styles.row}>
          {country !== 'REMOTE' && (
            <CityField
              label={t('jobAlerts:form.city')}
              hint={t('jobAlerts:form.cityHint')}
              name="alertCity"
              value={values.place}
              onChange={(place) => set('place', place)}
              error={errorText.field('placeIdAlert', errors.placeId)}
            />
          )}
          <SelectField
            label={t('jobAlerts:form.frequency')}
            name="frequency"
            options={config.enums.alertFrequency.map((value) => ({ value, label: t(`jobAlerts:frequency.${value}`) }))}
            value={values.frequency}
            onChange={(event) => set('frequency', event.target.value)}
          />
        </div>
        {errors.alerts && (
          <p className={styles.failure} role="alert">
            {errorText.field('alerts', errors.alerts)}
          </p>
        )}
        {failure && (
          <p className={styles.failure} role="alert">
            {errorText.code(failure)}
          </p>
        )}
      </form>
    </Modal>
  )
}

/** Create / edit dialog for a job alert (§3.6, G-1). Rendered only while open, so the form always starts fresh. */
export default function JobAlertModal({ open, alert, onClose }) {
  const { data: config } = useGetConfigQuery()
  if (!open || !config) return null
  return <AlertForm alert={alert} onClose={onClose} />
}
