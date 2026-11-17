import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Modal, SelectField, TextField } from '@/components/ui'
import CityField from '@/components/common/CityField.jsx'
import { useDraftJobAlertMutation } from '@/features/ai/api.js'
import AiFillButton from '@/features/ai/components/AiFillButton.jsx'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useCreateJobAlertMutation, useUpdateJobAlertMutation } from '../api.js'
import styles from './JobAlertModal.module.css'

const FORM_ID = 'job-alert-form'

function AlertForm({ alert, onClose }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { view } = usePreferences()
  const { data: config } = useGetConfigQuery()
  const [createAlert] = useCreateJobAlertMutation()
  const [updateAlert] = useUpdateJobAlertMutation()
  const [draftJobAlert] = useDraftJobAlertMutation()
  // 2026-11-17: "Describe it in a sentence" (Plus) fills the fields below.
  const [sentence, setSentence] = useState('')
  const limits = config?.limits.jobAlert
  // U35: a new alert takes the header view (Worldwide, Remote or a country); an existing one keeps its own. Remote
  // alerts have no city; a Worldwide alert's city can be anywhere.
  const country = alert?.country ?? view ?? 'REMOTE'
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
      description={t('jobAlerts:form.description', { country: country === 'WORLDWIDE' ? t('common:allCountries') : format.country(country) })}
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
        {!alert && (
          <div className={styles.sentence} data-job-alert-ai>
            <TextField
              label={t('jobAlerts:form.sentence')}
              placeholder={t('jobAlerts:form.sentencePlaceholder')}
              name="alertSentence"
              maxLength={config?.limits.ai?.notes?.max}
              value={sentence}
              onChange={(event) => setSentence(event.target.value)}
            />
            <AiFillButton
              label={t('jobAlerts:form.sentenceAction')}
              disabled={sentence.trim().length < 3}
              request={() => draftJobAlert({ text: sentence.trim(), country }).unwrap()}
              apply={(draft) => {
                set('name', draft.name)
                set('keywords', draft.keywords)
                set('frequency', draft.frequency)
                if (country !== 'REMOTE' && draft.place) set('place', draft.place)
              }}
              snapshot={() => ({ ...values })}
              restore={(before) => ['name', 'keywords', 'frequency', 'place'].forEach((field) => set(field, before[field]))}
              done={t('jobAlerts:form.sentenceDone')}
              data-job-alert-ai-button
            />
          </div>
        )}
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
