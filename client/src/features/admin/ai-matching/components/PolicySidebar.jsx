import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useGetAiStatusQuery } from '../api.js'
import styles from './PolicySidebar.module.css'

const STATUS_TONES = { active: 'success', draft: 'neutral', archived: 'warning' }

/** The OpenAI models in use and the last successful and failed calls (A: admin §1.18). */
function ServiceStatus() {
  const { t } = useTranslation('aiMatching')
  const format = useFormat()
  const { data: status, isLoading } = useGetAiStatusQuery()
  if (isLoading)
    return (
      <Panel padding={24}>
        <SkeletonRegion>
          <h3 className={styles.statusTitle}>{t('status.title')}</h3>
          <Skeleton shape="pill" width={160} />
          <p className={styles.statusText}>{t('status.models')}</p>
          <div className={styles.models}>
            {[0, 1, 2].map((index) => (
              <div key={index} className={styles.modelRow}>
                <Skeleton width={72} />
                <Skeleton width={96} />
              </div>
            ))}
          </div>
        </SkeletonRegion>
      </Panel>
    )
  if (!status) return null
  return (
    <Panel padding={24} data-ai-status>
      <h3 className={styles.statusTitle}>{t('status.title')}</h3>
      <PillBadge tone={status.lastSuccessAt ? 'success' : 'warning'} dot>
        {status.lastSuccessAt ? t('status.connected', { time: format.relative(status.lastSuccessAt) }) : t('status.noCalls')}
      </PillBadge>
      {status.lastErrorAt && <p className={styles.statusText}>{t('status.lastError', { time: format.relative(status.lastErrorAt) })}</p>}
      <p className={styles.statusText}>{t('status.models')}</p>
      <dl className={styles.models}>
        {Object.entries(status.models).map(([key, model]) => (
          <div key={key} className={styles.modelRow}>
            <dt>{t(`status.model.${key}`)}</dt>
            <dd>{model}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

/** Right column: the policy library (select a policy), the guidance card and the AI service status. `loading` shows placeholder policies. */
export default function PolicySidebar({ policies, selectedId, onSelect, loading }) {
  const { t } = useTranslation('aiMatching')
  const format = useFormat()
  return (
    <div className={styles.column}>
      <Panel padding={24}>
        <SectionTitle title={t('library.title')} description={t('library.description')} />
        {loading ? (
          <SkeletonRegion className={styles.list}>
            {[120, 96].map((width) => (
              <div key={width} className={styles.policy}>
                <span className={styles.policyText}>
                  <span className={styles.policyName}>
                    <Skeleton width={width} height={12} />
                  </span>
                  <span className={styles.policyMeta}>
                    <Skeleton width={88} height={8} />
                  </span>
                </span>
                <Skeleton shape="pill" width={56} />
              </div>
            ))}
          </SkeletonRegion>
        ) : (
          <ul className={styles.list}>
            {policies.map((policy) => (
              <li key={policy.id}>
                <button
                  type="button"
                  className={cx(styles.policy, policy.id === selectedId && styles.selected)}
                  aria-pressed={policy.id === selectedId}
                  onClick={() => onSelect(policy.id)}
                >
                  <span className={styles.policyText}>
                    <span className={styles.policyName}>{policy.name}</span>
                    <span className={styles.policyMeta}>{t('library.updated', { date: format.date(policy.updatedAt) })}</span>
                  </span>
                  <PillBadge tone={STATUS_TONES[policy.status]}>{t(`enums:policyStatus.${policy.status}`)}</PillBadge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel padding={24} selected>
        <span className={styles.shield}>
          <Icon as={ShieldCheck} size={25} strokeWidth={2} />
        </span>
        <h3 className={styles.guidanceTitle}>{t('guidance.title')}</h3>
        <p className={styles.guidanceText}>{t('guidance.text')}</p>
      </Panel>

      <ServiceStatus />
    </div>
  )
}
