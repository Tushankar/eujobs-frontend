import { hiringPath } from '@/app/roles.js'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Sparkles, X } from 'lucide-react'
import { Icon, IconButton } from '@/components/ui'
import AiButton from '@/features/ai/components/AiButton.jsx'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import list from './JobTalentList.module.css'
import styles from './JobAiShortlist.module.css'

/** The "AI shortlist" button beside the applicants heading (owner 2026-11-17). */
export function ShortlistButton({ onClick, loading }) {
  const { t } = useTranslation('applications')
  return (
    <AiButton variant="outline" size="sm" leftIcon={<Icon as={Sparkles} size={13} />} loading={loading} onClick={onClick} data-ai-shortlist-button>
      {t('aiShortlist.action')}
    </AiButton>
  )
}

/** The AI shortlist's result card (owner 2026-11-17); `state` comes from useShortlist. */
export default function JobAiShortlist({ jobId, state, onClose }) {
  const { t } = useTranslation('applications')
  if (!state.isLoading && !state.error && !state.data) return null
  const items = state.data?.items ?? []
  return (
    <section className={styles.panel} aria-labelledby="ai-shortlist-title" data-ai-shortlist>
      <div className={styles.head}>
        <h4 id="ai-shortlist-title" className={styles.title}>
          <Icon as={Sparkles} size={14} /> {t('aiShortlist.title')}
        </h4>
        <IconButton icon={X} label={t('aiShortlist.close')} onClick={onClose} />
      </div>
      <AiStatus isLoading={state.isLoading} error={state.error} onRetry={state.run}>
        {state.data && (
          <>
            <p className={styles.note}>
              {state.data.considered ? t('aiShortlist.from', { count: state.data.considered }) : t('aiShortlist.none')} {t('aiShortlist.disclaimer')}
            </p>
            {items.length > 0 && (
              <ol className={styles.items}>
                {items.map((item, index) => (
                  <li key={item.applicationId} data-ai-shortlist-item={item.applicationId}>
                    <Link to={`${hiringPath()}/find-candidates/${item.candidate.id}?jobId=${jobId}`} className={styles.row}>
                      <span className={styles.rank}>{index + 1}</span>
                      <span className={list.text}>
                        <span className={list.name}>{item.candidate.fullName ?? t('common:deletedUser')}</span>
                        <span className={styles.reason}>{item.reason}</span>
                      </span>
                      <Icon as={ArrowUpRight} size={14} className={list.arrow} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </AiStatus>
    </section>
  )
}
