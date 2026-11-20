import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, Icon } from '@/components/ui'
import { useRuleText } from '@/features/agency/rules.js'
import { useErrorText } from '@/lib/forms.js'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import { useCheckJobQuery, useGetMyPlacementsQuery, useJoinAgencyMutation } from '../api.js'
import styles from './JobAgency.module.css'

/*
 * 2026-11-20 (agencies, phase 5): an agency job on its details page: the placement terms, joining the agency's books,
 * and why the candidate's own placements keep them from taking it (GET /candidate/placements/check).
 */

const DAY_MS = 24 * 60 * 60 * 1000
const daysBetween = (start, end) => Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS) + 1

/** Client, dates (and how many days), hours a week and the pay rate. */
export function AgencyTerms({ job }) {
  const { t } = useTranslation()
  const jobText = useJobText()
  const terms = job.agency
  const rows = [
    ['client', terms.client?.name ?? t('agency:candidate.confidentialClient')],
    ['dates', terms.startDate && `${jobText.dates(terms)} · ${t('agency:candidate.terms.days', { count: daysBetween(terms.startDate, terms.endDate) })}`],
    ['hours', terms.hoursPerWeek && t('agency:rules.hours', { count: terms.hoursPerWeek })],
    ['pay', jobText.rate(terms)],
  ].filter(([, value]) => value)
  return (
    <section className={styles.terms} aria-labelledby="agency-terms" data-agency-terms>
      <h2 id="agency-terms" className={styles.h2}>
        {t('agency:candidate.terms.title')}
      </h2>
      <dl className={styles.rows}>
        {rows.map(([key, value]) => (
          <div key={key} className={styles.row}>
            <dt>{t(`agency:candidate.terms.${key}`)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Join the agency's books from its job, or where the candidate stands with it. */
export function JoinAgency({ job }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [join, { isLoading, error }] = useJoinAgencyMutation()
  const agency = job.company.displayName
  const membership = job.agencyMembership
  let content
  if (!membership || ['declined', 'ended'].includes(membership.status)) {
    content = (
      <Button variant="outline" fullWidth loading={isLoading} onClick={() => join(job.company.id)} data-join-agency>
        {t('agency:candidate.join.action', { agency })}
      </Button>
    )
  } else if (membership.status === 'awaiting_agreement') {
    content = (
      <Button as={Link} to={`/candidate/agencies/memberships/${membership.id}/agreement`} variant="outline" fullWidth data-read-agreement>
        {t('agency:candidate.join.read', { agency })}
      </Button>
    )
  } else {
    content = (
      <p className={styles.state} data-membership={membership.status}>
        <PillBadge tone={membership.status === 'active' ? 'success' : 'info'}>{t(`agency:candidate.membership.status.${membership.status}`)}</PillBadge>
        {t(membership.status === 'active' ? 'agency:candidate.join.active' : 'agency:candidate.join.sent', { agency })}
      </p>
    )
  }
  return (
    <div className={styles.join}>
      {content}
      {error && (
        <p className={styles.error} role="alert">
          {errorText.code(error)}
        </p>
      )}
      {membership?.status !== 'active' && <p className={styles.hint}>{t('agency:candidate.join.hint')}</p>}
    </div>
  )
}

/** Why the candidate cannot take this job yet: each blocking rule, its clause and the placement it comes from. */
export function LockBanner({ job }) {
  const { t } = useTranslation()
  const format = useFormat()
  const jobText = useJobText()
  const ruleText = useRuleText()
  const { data: result } = useCheckJobQuery(job.id, { skip: !job.lock })
  const { data: placements } = useGetMyPlacementsQuery(undefined, { skip: !job.lock })
  if (!job.lock || !result || result.allowed) return null
  const placementOf = (id) => placements?.items.find((placement) => placement.id === id)
  return (
    <section className={styles.lock} role="status" data-lock-banner>
      <p className={styles.lockTitle}>
        <Icon as={CalendarClock} size={16} />
        {t('agency:candidate.lock.title', { date: format.date(result.freeFrom) })}
      </p>
      <ul className={styles.blocks}>
        {result.blocks.map((block) => {
          const placement = placementOf(block.placementId)
          return (
            <li key={`${block.placementId}-${block.rule}`} className={styles.block} data-block={block.rule}>
              <p className={styles.blockFrom}>
                {placement
                  ? t('agency:candidate.lock.placement', { job: placement.job.title, agency: placement.agency.displayName, dates: jobText.dates({ startDate: placement.startDate, endDate: placement.effectiveEnd ?? placement.endDate }) })
                  : t('agency:candidate.lock.otherPlacement')}
              </p>
              <p className={styles.blockRule}>
                <strong>{t(`agency:rules.labels.${block.rule}`)}:</strong> {ruleText(block.rule, block.value)}
                {block.source && <PillBadge tone="neutral">{t(`enums:ruleSource.${block.source}`)}</PillBadge>}
              </p>
              {block.clause && <blockquote className={styles.clause}>“{block.clause}”</blockquote>}
              <p className={styles.freeFrom}>{t('agency:candidate.lock.freeFrom', { date: format.date(block.freeFrom) })}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
