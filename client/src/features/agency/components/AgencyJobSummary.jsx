import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { hiringPath } from '@/app/roles.js'
import PillBadge from '@/components/common/PillBadge.jsx'
import { jobSteps } from '@/features/recruiter/jobs/utils/jobForm.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetClientsQuery } from '../api.js'
import styles from './AgencyJobSummary.module.css'

/** 2026-11-20: an agency job's terms on its details page: client, dates, pay, hours and the contract's state. */
export default function AgencyJobSummary({ job }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { data: clients } = useGetClientsQuery()
  const terms = job.agency
  const client = clients?.items.find((item) => item.id === terms.clientId)
  const rows = [
    ['client', client ? `${client.name}${terms.showClient ? '' : ` · ${t('agency:summary.confidential')}`}` : t('agency:summary.missing')],
    ['dates', terms.startDate && terms.endDate ? t('agency:placements.range', { start: format.date(terms.startDate), end: format.date(terms.endDate) }) : t('agency:summary.missing')],
    ['pay', terms.rate ? t('agency:placements.rate', { amount: format.money(terms.rate.amountMinor, terms.rate.currency), period: t(`enums:ratePeriod.${terms.rate.period}`) }) : t('agency:summary.missing')],
    ['hours', terms.hoursPerWeek ? t('agency:rules.hours', { count: terms.hoursPerWeek }) : t('agency:summary.defaultHours')],
  ]
  const contract = terms.contract
  return (
    <section className={styles.card} aria-labelledby="agency-terms-title" data-agency-terms>
      <div className={styles.head}>
        <h2 className={styles.title} id="agency-terms-title">
          {t('agency:summary.title')}
        </h2>
        <Link to={`${hiringPath()}/jobs/${job.id}/edit?step=${jobSteps().indexOf('agency')}`} className={styles.edit}>
          {t('agency:summary.edit')}
        </Link>
      </div>
      <dl className={styles.rows}>
        {rows.map(([key, value]) => (
          <div key={key} className={styles.row}>
            <dt>{t(`agency:summary.${key}`)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div className={styles.row}>
          <dt>{t('agency:summary.contract')}</dt>
          <dd>
            {contract ? (
              <PillBadge tone={contract.confirmedAt ? 'success' : 'warning'}>{t(contract.confirmedAt ? 'agency:contract.confirmed' : 'agency:contract.toConfirm')}</PillBadge>
            ) : (
              t('agency:summary.noContract')
            )}
          </dd>
        </div>
      </dl>
    </section>
  )
}
