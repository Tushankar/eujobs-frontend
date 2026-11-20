import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { hiringPath } from '@/app/roles.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import FilterChips from '@/components/common/FilterChips.jsx'
import GetStartedCard from '@/components/common/GetStartedCard.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Avatar, Button, Modal, SelectField, Skeleton, SkeletonRegion, TextField } from '@/components/ui'
import { useGetRecruiterJobsQuery } from '@/features/recruiter/jobs/api.js'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useEndPlacementMutation, useGetPlacementsQuery, useRehireMutation, useWithdrawOfferMutation } from '../../api.js'
import { RulesList } from '../../components/ContractRules.jsx'
import styles from './PlacementsPage.module.css'

const TABS = ['running', 'upcoming', 'offered', 'over']
const PHASE_TONE = { running: 'success', upcoming: 'info', over: 'neutral' }
const tabOf = (placement) => (placement.status === 'offered' ? 'offered' : placement.phase)
const todayText = () => new Date().toISOString().slice(0, 10)

/** Dates of a placement: start → end, and the earlier real end (notice, agency end) when there is one. */
function useDates() {
  const { t } = useTranslation()
  const format = useFormat()
  return (placement) => {
    const range = t('agency:placements.range', { start: format.date(placement.startDate), end: format.date(placement.endDate) })
    if (!placement.effectiveEnd || placement.effectiveEnd === placement.endDate) return range
    const why = placement.noticeGivenOn ? 'notice' : 'endedEarly'
    return `${range} · ${t(`agency:placements.${why}`, { date: format.date(placement.effectiveEnd) })}`
  }
}

/** The placement in full: who, the job and client, the terms and its rules with their clauses and sources. */
function PlacementDetails({ placement, onClose }) {
  const { t } = useTranslation()
  const format = useFormat()
  const dates = useDates()
  if (!placement) return null
  const rate = placement.rate && t('agency:placements.rate', { amount: format.money(placement.rate.amountMinor, placement.rate.currency), period: t(`enums:ratePeriod.${placement.rate.period}`) })
  return (
    <Modal open placement="right" width={560} title={placement.candidate.name ?? t('common:deletedUser')} description={placement.job.title} onClose={onClose}>
      <dl className={styles.facts}>
        <div>
          <dt>{t('agency:placements.client')}</dt>
          <dd>{placement.client?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('agency:placements.dates')}</dt>
          <dd>{dates(placement)}</dd>
        </div>
        <div>
          <dt>{t('agency:placements.hours')}</dt>
          <dd>{t('agency:rules.hours', { count: placement.hoursPerWeek })}</dd>
        </div>
        {rate && (
          <div>
            <dt>{t('agency:placements.pay')}</dt>
            <dd>{rate}</dd>
          </div>
        )}
      </dl>
      {placement.rules ? (
        <>
          <h3 className={styles.rulesTitle}>{t('agency:placements.rules')}</h3>
          <RulesList rules={placement.rules} sources={placement.sources} />
        </>
      ) : (
        <p className={styles.note}>{t('agency:placements.rulesOnAccept')}</p>
      )}
    </Modal>
  )
}

/** End a running or upcoming placement earlier (today at the soonest). */
function EndDialog({ placement, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [date, setDate] = useState(todayText())
  const [error, setError] = useState(null)
  const [end, { isLoading }] = useEndPlacementMutation()
  async function submit(event) {
    event.preventDefault()
    try {
      await end({ id: placement.id, endDate: date }).unwrap()
      onClose()
    } catch (failure) {
      setError(failure)
    }
  }
  return (
    <Modal
      open
      title={t('agency:placements.endTitle', { name: placement.candidate.name })}
      description={t('agency:placements.endText')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" form="end-placement" variant="danger" loading={isLoading}>
            {t('agency:placements.end')}
          </Button>
        </>
      }
    >
      <form id="end-placement" onSubmit={submit} noValidate>
        <TextField
          type="date"
          label={t('agency:placements.endDate')}
          name="endDate"
          value={date}
          min={todayText()}
          onChange={(event) => setDate(event.target.value)}
          error={error && (error.data?.error?.fields?.endDate ? t('agency:placements.endDateInvalid') : errorText.code(error))}
        />
      </form>
    </Modal>
  )
}

/** Offer the same person another of the agency's published jobs (its dates, rate and contract). */
function RehireDialog({ placement, onClose }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { data: jobs } = useGetRecruiterJobsQuery()
  const open = (jobs?.items ?? []).filter((job) => job.status === 'published' && job.agency && job.agency.startDate >= todayText())
  const [jobId, setJobId] = useState('')
  const [error, setError] = useState(null)
  const [rehire, { isLoading }] = useRehireMutation()
  async function submit(event) {
    event.preventDefault()
    try {
      await rehire({ id: placement.id, jobId: jobId || open[0]?.id }).unwrap()
      onClose()
    } catch (failure) {
      setError(failure)
    }
  }
  return (
    <Modal
      open
      title={t('agency:placements.rehireTitle', { name: placement.candidate.name })}
      description={t('agency:placements.rehireText')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" form="rehire" loading={isLoading} disabled={open.length === 0}>
            {t('agency:placements.sendOffer')}
          </Button>
        </>
      }
    >
      <form id="rehire" onSubmit={submit} noValidate className={styles.dialogForm}>
        {open.length === 0 ? (
          <p className={styles.note}>{t('agency:placements.noOpenJobs')}</p>
        ) : (
          <SelectField
            label={t('agency:placements.job')}
            name="jobId"
            value={jobId || open[0].id}
            onChange={(event) => setJobId(event.target.value)}
            options={open.map((job) => ({ value: job.id, label: `${job.title} · ${t('agency:placements.range', { start: format.date(job.agency.startDate), end: format.date(job.agency.endDate) })}` }))}
          />
        )}
        {error && (
          <p className={styles.failure} role="alert">
            {errorText.code(error)}
          </p>
        )}
      </form>
    </Modal>
  )
}

/** 2026-11-20: Agency › Placements: running, upcoming, re-hire offers and placements that are over. */
export default function PlacementsPage() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const dates = useDates()
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'running'
  const { data, isLoading } = useGetPlacementsQuery()
  const [withdraw] = useWithdrawOfferMutation()
  const [details, setDetails] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [failure, setFailure] = useState(null)
  const placements = data?.items ?? []
  const visible = placements.filter((placement) => tabOf(placement) === tab)
  const none = Boolean(data) && placements.length === 0

  return (
    <>
      <PageTitle title={t('agency:placements.title')} description={t('agency:placements.description')} />
      {none ? (
        <GetStartedCard
          id="placements-start-title"
          title={t('agency:placements.start.title')}
          text={t('agency:placements.start.text')}
          steps={t('agency:placements.start.steps', { returnObjects: true })}
          action={
            <Button as={Link} to={hiringPath('talent?tab=agreement')}>
              {t('agency:placements.start.action')}
            </Button>
          }
        />
      ) : (
        <>
          <div data-tour="placements-tabs">
            <FilterChips
              className={styles.tabs}
              label={t('agency:placements.tabsLabel')}
              options={TABS.map((id) => ({ id, label: t(`agency:placements.tabs.${id}`), count: data ? placements.filter((placement) => tabOf(placement) === id).length : undefined }))}
              value={tab}
              onChange={(id) => setParams(id === 'running' ? {} : { tab: id }, { replace: true })}
            />
          </div>
          {failure && (
            <p className={styles.failure} role="alert">
              {errorText.code(failure)}
            </p>
          )}
          {isLoading ? (
            <SkeletonRegion className={styles.card}>
              {[0, 1, 2].map((key) => (
                <div key={key} className={styles.row}>
                  <Skeleton shape="circle" width={40} height={40} />
                  <div className={styles.text}>
                    <Skeleton width={160} height={14} />
                    <Skeleton width={240} height={12} />
                  </div>
                </div>
              ))}
            </SkeletonRegion>
          ) : visible.length === 0 ? (
            <EmptyState icon={CalendarClock} title={t(`agency:placements.empty.${tab}.title`)} description={t(`agency:placements.empty.${tab}.text`)} />
          ) : (
            <section className={styles.card} aria-label={t(`agency:placements.tabs.${tab}`)}>
              <ul className={styles.list}>
                {visible.map((placement) => (
                  <li key={placement.id} className={styles.row} data-placement={placement.candidate.name}>
                    <Avatar name={placement.candidate.name ?? ''} size={40} />
                    <button type="button" className={styles.text} onClick={() => setDetails(placement)}>
                      <span className={styles.name}>{placement.candidate.name ?? t('common:deletedUser')}</span>
                      <span className={styles.meta}>{[placement.job.title, placement.client?.name].filter(Boolean).join(' · ')}</span>
                      <span className={styles.meta}>{dates(placement)}</span>
                    </button>
                    {placement.phase && <PillBadge tone={PHASE_TONE[placement.phase]}>{t(`agency:placements.phase.${placement.phase}`)}</PillBadge>}
                    {placement.status === 'offered' && <PillBadge tone="info">{t('enums:placementStatus.offered')}</PillBadge>}
                    <div className={styles.actions}>
                      {['running', 'upcoming'].includes(placement.phase) && (
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'end', placement })}>
                          {t('agency:placements.end')}
                        </Button>
                      )}
                      {placement.phase === 'over' && (
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'rehire', placement })}>
                          {t('agency:placements.rehire')}
                        </Button>
                      )}
                      {placement.status === 'offered' && (
                        <Button size="sm" variant="ghost" onClick={() => withdraw(placement.id).unwrap().catch(setFailure)}>
                          {t('agency:placements.withdraw')}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <PlacementDetails placement={details} onClose={() => setDetails(null)} />
      {dialog?.kind === 'end' && <EndDialog placement={dialog.placement} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'rehire' && <RehireDialog placement={dialog.placement} onClose={() => setDialog(null)} />}
    </>
  )
}
