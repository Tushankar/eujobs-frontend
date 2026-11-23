import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUpRight, FileText } from 'lucide-react'
import { hiringPath } from '@/app/roles.js'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { useGetAgreementQuery } from '../api.js'
import { RULES, useRuleText } from '../rules.js'
import styles from './JobRules.module.css'

/**
 * 2026-11-23 (owner: "how are the agreement and a job's contract related? show it properly"): the rules a placement
 * on this job will follow and where each comes from, in the order the server applies them: the job's confirmed
 * contract, else the agency's published agreement, else the default (no other agency job at the same time).
 */
export default function JobRules({ job }) {
  const { t } = useTranslation()
  const ruleText = useRuleText()
  const { data, isLoading } = useGetAgreementQuery()
  const agreement = data?.current ?? null
  const contract = job?.agency?.contract?.confirmedAt ? job.agency.contract.rules : null

  if (isLoading) {
    return (
      <SkeletonRegion className={styles.card}>
        <Skeleton width="60%" />
        <Skeleton width="90%" />
      </SkeletonRegion>
    )
  }

  const rows = RULES.map((name) => {
    const fromContract = contract?.[name]?.value
    const fromAgreement = agreement?.rules?.[name]?.value
    if (fromContract != null) return { name, value: fromContract, source: 'contract' }
    if (fromAgreement != null) return { name, value: fromAgreement, source: 'agreement' }
    return { name, value: null, source: name === 'exclusivity' ? 'default' : null }
  })

  return (
    <div className={styles.card} data-job-rules>
      {agreement ? (
        <p className={styles.lead}>
          <Icon as={FileText} size={16} className={styles.icon} />
          <span>
            {t('agency:jobRules.applies', { version: agreement.version })} <span className={styles.file}>{agreement.file.name}</span>
          </span>
        </p>
      ) : (
        <div className={styles.missing} role="note" data-job-rules-missing>
          <p className={styles.missingTitle}>{t('agency:jobRules.noAgreementTitle')}</p>
          <p className={styles.text}>{t('agency:jobRules.noAgreementText')}</p>
        </div>
      )}
      <dl className={styles.rows}>
        {rows.map(({ name, value, source }) => (
          <div key={name} className={styles.row} data-job-rule={name} data-source={source ?? 'none'}>
            <dt className={styles.label}>{t(`agency:rules.labels.${name}`)}</dt>
            <dd className={styles.value}>
              <span className={value == null && source !== 'default' ? styles.muted : undefined}>{source === 'default' ? t('agency:jobRules.defaultExclusivity') : ruleText(name, value)}</span>
              {source && <PillBadge tone={source === 'contract' ? 'info' : 'neutral'}>{t(`enums:ruleSource.${source}`)}</PillBadge>}
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.text}>{t('agency:jobRules.order')}</p>
      <Link to={`${hiringPath('talent')}?tab=agreement`} className={styles.link} target="_blank" rel="noreferrer">
        {t(agreement ? 'agency:jobRules.openAgreement' : 'agency:jobRules.uploadAgreement')}
        <Icon as={ArrowUpRight} size={14} />
      </Link>
    </div>
  )
}
