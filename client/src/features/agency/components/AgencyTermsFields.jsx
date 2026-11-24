import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { CompanyLogo, DatePicker, Dropdown, Field, Icon, TextField } from '@/components/ui'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useSectors } from '@/lib/sectors.js'
import { addDays, shiftMonth } from '@/utils/calendarDays.js'
import { cx } from '@/utils/cx.js'
import ClientDialog from '../clients/components/ClientDialog.jsx'
import { useGetClientsQuery } from '../api.js'
import { useAiFilled } from '@/features/recruiter/jobs/aiFilled.js'
import { useDuration } from '../useDuration.js'
import ContractCard from './ContractCard.jsx'
import JobRules from './JobRules.jsx'
import fieldStyles from '@/components/ui/Field.module.css'
import styles from './AgencyTermsFields.module.css'

// Quick lengths from the start date: the end date is the last day of the length (both days count).
const LENGTHS = [
  ['week', (start) => addDays(start, 6)],
  ['twoWeeks', (start) => addDays(start, 13)],
  ['month', (start) => addDays(shiftMonth(start, 1), -1)],
  ['threeMonths', (start) => addDays(shiftMonth(start, 3), -1)],
]

/** The currency's symbol in the reader's language (£, €, zł…), for the pay rate's field. */
function currencySymbol(currency, language) {
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

/** A two-option pill switch (radio group). */
function Segmented({ label, value, options, onChange, name }) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label} data-segmented={name}>
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={cx(styles.segment, value === option.value && styles.segmentActive)} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** The client: a list with logos and sectors, and "Add a client" opening the client dialog right here. `onChange` gets the client. */
function ClientPicker({ value, onChange, error }) {
  const { t } = useTranslation()
  const sectors = useSectors()
  const { data, isLoading } = useGetClientsQuery()
  const [adding, setAdding] = useState(false)
  const clients = data?.items ?? []
  const chosen = clients.find((client) => client.id === value)

  return (
    <>
      <Field id="agency-client" error={error}>
        {({ describedBy, invalid }) => (
          <Dropdown
            align="start"
            className={styles.pickerRoot}
            panelClassName={styles.pickerPanel}
            trigger={(props) => (
              <button
                {...props}
                id="agency-client"
                type="button"
                className={cx(fieldStyles.control, styles.picker, invalid && fieldStyles.invalid)}
                aria-labelledby="terms-client agency-client"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                data-client-picker
              >
                {chosen ? (
                  <span className={styles.pickerChosen}>
                    <CompanyLogo name={chosen.name} src={chosen.logoUrl ?? undefined} size={28} />
                    <span className={styles.pickerText}>
                      <span className={styles.pickerName}>{chosen.name}</span>
                      {sectors.industry(chosen) && <span className={styles.pickerMeta}>{sectors.industry(chosen)}</span>}
                    </span>
                  </span>
                ) : (
                  <span className={fieldStyles.input} data-placeholder>
                    <span className={styles.pickerPlaceholder}>{t(isLoading ? 'common:loading' : clients.length ? 'agency:terms.clientPlaceholder' : 'agency:terms.noClients')}</span>
                  </span>
                )}
                <Icon as={ChevronDown} size={16} className={styles.chevron} />
              </button>
            )}
          >
            {({ close }) => (
              <div role="listbox" aria-label={t('agency:terms.client')}>
                {clients.length === 0 && <p className={styles.pickerEmpty}>{t('agency:terms.clientSearchEmpty')}</p>}
                {clients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    role="option"
                    aria-selected={client.id === value}
                    className={cx(styles.option, client.id === value && styles.optionActive)}
                    onClick={() => {
                      onChange(client)
                      close()
                    }}
                    data-client-option={client.name}
                  >
                    <CompanyLogo name={client.name} src={client.logoUrl ?? undefined} size={32} />
                    <span className={styles.pickerText}>
                      <span className={styles.pickerName}>{client.name}</span>
                      {(sectors.industry(client) || client.location?.city) && <span className={styles.pickerMeta}>{[sectors.industry(client), client.location?.city].filter(Boolean).join(' · ')}</span>}
                    </span>
                    {client.id === value && <Icon as={Check} size={16} className={styles.optionCheck} />}
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.addOption}
                  onClick={() => {
                    close()
                    setAdding(true)
                  }}
                  data-add-client-inline
                >
                  <Icon as={Plus} size={16} />
                  {t('agency:terms.addClient')}
                </button>
              </div>
            )}
          </Dropdown>
        )}
      </Field>
      {adding && <ClientDialog open client={null} onClose={() => setAdding(false)} onSaved={(client) => onChange(client)} />}
    </>
  )
}

/**
 * The job wizard's "Agency terms" step (2026-11-20; laid out by the owner's choice 2026-11-23): Client (the picker and
 * what candidates see), Dates (calendar pickers, quick lengths, the length), Pay and hours (the rate in the job's
 * currency, per hour or per day, the hours and a weekly estimate) and the job's own Contract once the draft exists.
 */
export default function AgencyTermsFields({ values, bind, setValue, errorOf, currency, job }) {
  const { t } = useTranslation()
  const aiFilled = useAiFilled()
  const format = useFormat()
  const { language } = usePreferences()
  const { data: config } = useGetConfigQuery()
  const { data: clients } = useGetClientsQuery()
  const duration = useDuration()
  const defaultHours = config?.limits.job.agency.defaultHours[values.employmentType]
  const client = clients?.items.find((entry) => entry.id === values.clientId)
  const hours = String(values.hoursPerWeek).trim() === '' ? defaultHours : Number(values.hoursPerWeek)
  const rate = Number(String(values.rateAmount).trim())
  const weekly = currency && values.ratePeriod === 'hour' && rate > 0 && hours > 0 ? format.money(Math.round(rate * hours * 100), currency) : ''
  const length = duration(values.startDate, values.endDate)
  const rateField = bind('rateAmount')
  const hoursField = bind('hoursPerWeek')

  return (
    <div className={styles.sections}>
      <section className={styles.section} aria-labelledby="terms-client">
        <h3 id="terms-client" className={cx(styles.sectionTitle, aiFilled('clientId'))}>
          {t('agency:terms.sectionClient')}
        </h3>
        <ClientPicker
          value={values.clientId}
          onChange={(picked) => {
            setValue('clientId', picked.id)
            // 2026-11-24: a job without a sector takes its client's.
            if (!values.sector && picked.sector) setValue('sector', picked.sector)
          }}
          error={errorOf('clientId')}
        />
        <div className={styles.visibility}>
          <span className={styles.visibilityLabel}>{t('agency:terms.visibility')}</span>
          <Segmented
            name="showClient"
            label={t('agency:terms.visibility')}
            value={values.showClient ? 'name' : 'confidential'}
            onChange={(choice) => setValue('showClient', choice === 'name')}
            options={[
              { value: 'name', label: t('agency:terms.visibilityName') },
              { value: 'confidential', label: t('agency:terms.visibilityConfidential') },
            ]}
          />
        </div>
        <p className={styles.note} data-client-shown>
          {t('agency:terms.visibility')}: {values.showClient && client ? t('agency:candidate.forClient', { client: client.name }) : t('agency:candidate.confidentialClient')}
          {'. '}
          {t('agency:terms.agencyAlwaysShows')}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="terms-dates">
        <h3 id="terms-dates" className={styles.sectionTitle}>
          {t('agency:terms.sectionDates')}
        </h3>
        <div className={styles.pair}>
          <DatePicker className={aiFilled('startDate')} label={t('agency:terms.startDate')} name="startDate" value={values.startDate} onChange={(key) => setValue('startDate', key)} error={errorOf('startDate')} />
          <DatePicker className={aiFilled('endDate')} label={t('agency:terms.endDate')} name="endDate" value={values.endDate} min={values.startDate || undefined} onChange={(key) => setValue('endDate', key)} error={errorOf('endDate')} />
        </div>
        <div className={styles.lengths}>
          <span className={styles.visibilityLabel}>{t('agency:terms.quickLength')}</span>
          <div className={styles.chips}>
            {LENGTHS.map(([key, end]) => {
              const target = values.startDate && end(values.startDate)
              return (
                <button
                  key={key}
                  type="button"
                  className={cx(styles.chip, target && target === values.endDate && styles.chipActive)}
                  disabled={!values.startDate}
                  title={values.startDate ? undefined : t('agency:terms.lengthNeedsStart')}
                  onClick={() => setValue('endDate', target)}
                  data-length={key}
                >
                  {t(`agency:terms.length.${key}`)}
                </button>
              )
            })}
          </div>
          {length && (
            <span className={styles.length} data-length-text>
              {length}
            </span>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="terms-pay">
        <h3 id="terms-pay" className={styles.sectionTitle}>
          {t('agency:terms.sectionPay')}
        </h3>
        <div className={styles.payRow}>
          <TextField
            className={cx(styles.rate, aiFilled('rateAmount'))}
            label={currency ? t('agency:terms.rate', { currency }) : t('agency:terms.rateNoCurrency')}
            hint={currency ? undefined : t('jobs:fields.salaryNeedsPlace')}
            inputMode="decimal"
            disabled={!currency}
            leftIcon={currency && <span className={styles.currency}>{currencySymbol(currency, language)}</span>}
            {...rateField}
          />
          <div className={styles.period}>
            <span className={styles.periodLabel}>{t('agency:terms.ratePeriod')}</span>
            <Segmented
              name="ratePeriod"
              label={t('agency:terms.ratePeriod')}
              value={values.ratePeriod}
              onChange={(period) => setValue('ratePeriod', period)}
              options={(config?.enums.ratePeriod ?? ['hour', 'day']).map((key) => ({ value: key, label: t(key === 'hour' ? 'agency:terms.perHour' : 'agency:terms.perDay') }))}
            />
          </div>
        </div>
        <TextField
          className={cx(styles.hours, aiFilled('hoursPerWeek'))}
          label={t('agency:terms.hoursPerWeek')}
          hint={defaultHours ? t('agency:terms.hoursHint', { count: defaultHours, type: t(`enums:employmentType.${values.employmentType}`).toLowerCase() }) : undefined}
          inputMode="numeric"
          rightSlot={<span className={styles.suffix}>{t('agency:terms.hoursSuffix')}</span>}
          {...hoursField}
        />
        {weekly && (
          <p className={styles.estimate} data-weekly-pay>
            {t('agency:terms.weekly', { amount: weekly, hours })}
          </p>
        )}
      </section>

      {/* 2026-11-23: the agreement and this job's own contract, side by side in one place. */}
      <section className={styles.section} aria-labelledby="terms-contract">
        <h3 id="terms-contract" className={styles.sectionTitle}>
          {t('agency:terms.sectionContract')}
        </h3>
        <p className={styles.note}>{t('agency:terms.contractHint')}</p>
        <JobRules job={job} />
        {job ? <ContractCard job={job} error={errorOf('contract')} /> : <p className={styles.note}>{t('agency:terms.contractAfterSave')}</p>}
      </section>
    </div>
  )
}
