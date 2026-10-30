import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Icon, IconButton, SelectField, TextField } from '@/components/ui'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { useSetRightToWorkMutation } from '../api.js'
import FormDialog from './FormDialog.jsx'
import dialogStyles from './FormDialog.module.css'

/** M-021, P3-D4: one entry per region (EU, UK); a visa or permit needs its expiry date. Nationality is never asked. */
export default function RightToWorkDialog({ open, rightToWork, onSaved, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [setRightToWork, { isLoading }] = useSetRightToWorkMutation()
  const { values, set, errors, failure, run } = useFormState(() => ({
    rows: rightToWork.map(({ region, status, permitExpiresOn }) => ({ region, status, permitExpiresOn: permitExpiresOn ?? '' })),
  }))
  const regions = config?.enums.rtwRegion ?? []
  const statusOptions = (config?.enums.rtwStatus ?? []).map((status) => ({ value: status, label: t(`enums:rtwStatus.${status}`) }))
  const missing = regions.filter((region) => !values.rows.some((row) => row.region === region))
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
            label={t(`enums:rtwRegion.${row.region}`)}
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
            label={t('profile:form.rightToWork.remove', { region: t(`enums:rtwRegion.${row.region}`) })}
            onClick={() => set('rows', values.rows.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      {missing.length > 0 && (
        <div className={dialogStyles.row}>
          {missing.map((region) => (
            <div key={region}>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Icon as={Plus} size={14} />}
                onClick={() => set('rows', [...values.rows, { region, status: '', permitExpiresOn: '' }])}
              >
                {t('profile:form.rightToWork.add', { region: t(`enums:rtwRegion.${region}`) })}
              </Button>
            </div>
          ))}
        </div>
      )}
    </FormDialog>
  )
}
