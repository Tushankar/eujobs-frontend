import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { hiringPath } from '@/app/roles.js'
import { useGetConfigQuery } from '@/app/api.js'
import { Checkbox, SelectField, TextField } from '@/components/ui'
import { useGetClientsQuery } from '../api.js'
import ContractCard from './ContractCard.jsx'
import styles from './AgencyTermsFields.module.css'

/**
 * 2026-11-20: the job wizard's "Agency terms" step: the client (and whether candidates see its name), the dates, the
 * pay rate in the job's currency, the hours per week, and the contract (once the draft exists).
 */
export default function AgencyTermsFields({ values, bind, setValue, errorOf, currency, job }) {
  const { t } = useTranslation()
  const { data: config } = useGetConfigQuery()
  const { data: clients, isLoading } = useGetClientsQuery()
  const options = (clients?.items ?? []).map((client) => ({ value: client.id, label: client.name }))
  const defaultHours = config?.limits.job.agency.defaultHours[values.employmentType]

  return (
    <div className={styles.stack}>
      <div className={styles.pair}>
        <SelectField
          label={t('agency:terms.client')}
          placeholder={t(isLoading ? 'common:loading' : options.length ? 'agency:terms.clientPlaceholder' : 'agency:terms.noClients')}
          options={options}
          {...bind('clientId')}
        />
        <p className={styles.addClient}>
          <Link to={hiringPath('clients')} target="_blank" rel="noreferrer">
            {t('agency:terms.addClient')}
          </Link>
        </p>
      </div>
      <Checkbox name="showClient" checked={values.showClient} onChange={(event) => setValue('showClient', event.target.checked)}>
        {t('agency:terms.showClient')}
      </Checkbox>
      <p className={styles.note}>{t('agency:terms.showClientHint')}</p>
      <div className={styles.pair}>
        <TextField type="date" label={t('agency:terms.startDate')} {...bind('startDate')} />
        <TextField type="date" label={t('agency:terms.endDate')} min={values.startDate || undefined} {...bind('endDate')} />
      </div>
      <div className={styles.pair}>
        <TextField
          label={currency ? t('agency:terms.rate', { currency }) : t('agency:terms.rateNoCurrency')}
          hint={currency ? undefined : t('jobs:fields.salaryNeedsPlace')}
          inputMode="decimal"
          disabled={!currency}
          {...bind('rateAmount')}
        />
        <SelectField label={t('agency:terms.ratePeriod')} options={(config?.enums.ratePeriod ?? []).map((key) => ({ value: key, label: t(`enums:ratePeriod.${key}`) }))} {...bind('ratePeriod')} />
      </div>
      <TextField
        label={t('agency:terms.hoursPerWeek')}
        hint={defaultHours ? t('agency:terms.hoursHint', { count: defaultHours, type: t(`enums:employmentType.${values.employmentType}`).toLowerCase() }) : undefined}
        inputMode="numeric"
        {...bind('hoursPerWeek')}
      />
      {job && <ContractCard job={job} error={errorOf('contract')} />}
    </div>
  )
}
