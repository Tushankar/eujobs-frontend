import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import { useCheckJobQuery } from '../api.js'
import styles from './PlacementRules.module.css'

const RULE_ORDER = ['exclusivity', 'noticeDays', 'coolingOffDays', 'maxWeeklyHours']

/** Each rule of a placement on `job` in plain words: sentences on the job page, short phrases in the apply dialog. */
function usePlacementRuleWords() {
  const { t } = useTranslation()
  const jobText = useJobText()
  return (job, name, value, short = false) => {
    const key = short ? 'agency:candidate.before.short' : 'agency:candidate.before.rules'
    const client = job.agency.client?.name ?? t('agency:candidate.before.theClient')
    if (name === 'exclusivity') return value ? t(`${key}.exclusivity.${value}`, { client, dates: jobText.dates(job.agency) }) : null
    if (value == null) return short ? null : t(`${key}.${name}None`)
    return t(`${key}.${name}`, { count: value, client })
  }
}

/** Where the candidate stands: can they take the job, and what being placed still needs (books, agreement). */
function Eligibility({ job, result }) {
  const { t } = useTranslation()
  const format = useFormat()
  const agency = job.company.displayName
  const { status, agreementVersion, agreementPending } = result.books
  let tone = 'todo'
  let text
  let link = null
  if (!result.allowed) {
    tone = 'blocked'
    text = t(job.agency.endDate && result.freeFrom > job.agency.endDate ? 'agency:candidate.before.blockedNever' : 'agency:candidate.before.blocked', { date: format.date(result.freeFrom) })
  } else if (status === 'active' && agreementPending) {
    text = t('agency:candidate.before.pending', { agency, version: agreementVersion })
  } else if (status === 'active') {
    tone = 'ok'
    text = t('agency:candidate.before.ok')
  } else if (status === 'awaiting_agreement') {
    text = t('agency:candidate.before.awaiting', { agency })
    if (job.agencyMembership) link = `/candidate/agencies/memberships/${job.agencyMembership.id}/agreement`
  } else if (status === 'requested') {
    text = t('agency:candidate.before.requested', { agency })
  } else {
    text = agreementVersion ? t('agency:candidate.before.notOnBooks', { agency, version: agreementVersion }) : t('agency:candidate.before.noAgreement', { agency })
  }
  return (
    <div className={`${styles.eligibility} ${styles[tone]}`} data-eligibility={tone}>
      <span className={styles.mark} aria-hidden="true">
        {tone === 'ok' ? '✓' : tone === 'blocked' ? '✕' : '!'}
      </span>
      <p className={styles.eligibilityText}>
        {text}
        {link && (
          <>
            {' '}
            <Link to={link}>{t('agency:candidate.before.readAgreement')}</Link>
          </>
        )}
      </p>
    </div>
  )
}

/**
 * 2026-11-23 (owner: "before applying it does not show if I am eligible, or what the job's rules are"): on an agency
 * job, whether the candidate can take it and what being placed needs, then each rule a placement would follow in plain
 * words, where it comes from (the job's contract, the agency's agreement, the default) and its exact clause.
 */
export function PlacementRules({ job }) {
  const { t } = useTranslation()
  const words = usePlacementRuleWords()
  const { data: result } = useCheckJobQuery(job.id)
  if (!result?.rules) return null
  return (
    <section className={styles.before} aria-labelledby="placement-rules" data-placement-rules>
      <h2 id="placement-rules" className={styles.h2}>
        {t('agency:candidate.before.title')}
      </h2>
      <Eligibility job={job} result={result} />
      <p className={styles.ifPlaced}>{t('agency:candidate.before.ifPlaced')}</p>
      <ul className={styles.rules}>
        {RULE_ORDER.map((name) => {
          const rule = result.rules[name]
          const text = words(job, name, rule.value)
          return (
            <li key={name} className={styles.rule} data-placement-rule={name} data-source={rule.source ?? 'none'}>
              <p className={styles.label}>
                {t(`agency:rules.labels.${name}`)}
                {rule.source && <PillBadge tone={rule.source === 'contract' ? 'info' : 'neutral'}>{t(`enums:ruleSource.${rule.source}`)}</PillBadge>}
              </p>
              <p className={rule.value == null ? styles.muted : styles.text}>{text}</p>
              {rule.clause && (
                <details className={styles.toggle}>
                  <summary>{t('agency:candidate.before.readClause')}</summary>
                  <blockquote className={styles.clause}>“{rule.clause}”</blockquote>
                </details>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The apply dialog's short version: what being placed would mean, and what is still missing. */
export function PlacementSummary({ job }) {
  const { t } = useTranslation()
  const words = usePlacementRuleWords()
  const { data: result } = useCheckJobQuery(job.id)
  if (!result?.rules) return null
  const parts = RULE_ORDER.map((name) => words(job, name, result.rules[name].value, true)).filter(Boolean)
  return (
    <div className={styles.summary} data-placement-summary>
      <p className={styles.summaryTitle}>{t('agency:candidate.before.ifPlacedShort')}</p>
      <p className={styles.summaryText}>{parts.join(' · ')}</p>
      {result.books.status !== 'active' && <p className={styles.hint}>{t('agency:candidate.before.summaryBooks', { agency: job.company.displayName })}</p>}
    </div>
  )
}
