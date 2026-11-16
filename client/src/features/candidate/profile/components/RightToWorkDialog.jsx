import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { IconButton, SelectField, TextField } from '@/components/ui'
import { countryChoices, useCountryOptions } from '@/lib/countries.js'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useSetRightToWorkMutation } from '../api.js'
import FormDialog from './FormDialog.jsx'
import dialogStyles from './FormDialog.module.css'
import CountryField from '@/components/common/CountryField.jsx'

/**
 * M-021, P3-D4: one entry per region, the whole EU or any country (worldwide since 2026-11-16); a visa or permit needs
 * its expiry date. Nationality is never asked.
 */
export default function RightToWorkDialog({ open, rightToWork, onSaved, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const format = useFormat()
  const { data: config } = useGetConfigQuery()
  const countries = useCountryOptions()
  const [setRightToWork, { isLoading }] = useSetRightToWorkMutation()
  const { values, set, errors, failure, run } = useFormState(() => ({
    rows: rightToWork.map(({ region, status, permitExpiresOn }) => ({ region, status, permitExpiresOn: permitExpiresOn ?? '' })),
  }))
  const statusOptions = (config?.enums.rtwStatus ?? []).map((status) => ({ value: status, label: t(`enums:rtwStatus.${status}`) }))
  const max = config?.limits.profile.rightToWork.max ?? 0
  // The EU group, then the countries (EU + UK first, then the world), less those already added.
  const choices = [
    ...(config?.enums.rtwRegion ?? []).map((region) => ({ value: region, label: format.region(region) })),
    ...countryChoices(countries.filter((country) => !country.isRemote)),
  ].filter((choice) => !values.rows.some((row) => row.region === choice.value))
  const update = (index, change) => set('rows', values.rows.map((row, i) => (i === index ? { ...row, ...change } : row)))

  async function handleSubmit() {
    const checks = {}
    values.rows.forEach((row, index) => {
      if (!row.status) checks[`${index}.status`] = { key: 'required' }
      if (row.status === 'visa_permit' && !row.permitExpiresOn) checks[`${index}.permitExpiresOn`] = { key: 'required' }
    })
    const body = values.rows.map(({ region, status, permitExpiresOn }) => ({ region, status, permitExpiresOn: status === 'visa_permit' ? permitExpiresOn : null }))
    if (await run(checks, () => setRightToWork(body).unwrap())) onSaved()
  }

  return (
    <FormDialog open={open} title={t('profile:form.rightToWork.title')} busy={isLoading} failure={failure} onClose={onClose} onSubmit={handleSubmit}>
      <p className={dialogStyles.note}>{t('profile:form.rightToWork.hint')}</p>
      {values.rows.map((row, index) => (
        <div key={row.region} className={dialogStyles.listRow}>
          <SelectField
            label={format.region(row.region)}
            name={`status-${row.region}`}
            placeholder={t('profile:form.rightToWork.status')}
            options={statusOptions}
            value={row.status}
            onChange={(event) => update(index, { status: event.target.value })}
            error={errorText.field('status', errors[`${index}.status`])}
          />
          {row.status === 'visa_permit' ? (
            <TextField
              label={t('profile:form.rightToWork.expires')}
              name={`expires-${row.region}`}
              type="date"
              value={row.permitExpiresOn}
              onChange={(event) => update(index, { permitExpiresOn: event.target.value })}
              error={errorText.field('permitExpiresOn', errors[`${index}.permitExpiresOn`] ?? errors[`rightToWork.${index}.permitExpiresOn`])}
            />
          ) : (
            <span />
          )}
          <IconButton
            icon={X}
            className={dialogStyles.remove}
            label={t('profile:form.rightToWork.remove', { region: format.region(row.region) })}
            onClick={() => set('rows', values.rows.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      {values.rows.length < max && (
        <CountryField
          label={t('profile:form.rightToWork.addLabel')}
          name="rightToWorkAdd"
          placeholder={t('profile:form.rightToWork.addPlaceholder')}
          options={choices}
          value=""
          onChange={(region) => region && set('rows', [...values.rows, { region, status: '', permitExpiresOn: '' }])}
        />
      )}
    </FormDialog>
  )
}
