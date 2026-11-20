import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Users } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import { CompanyLogo } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import FilterChips from '@/components/common/FilterChips.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import SegmentedTabs from '@/components/common/SegmentedTabs.jsx'
import { tableState } from '@/components/common/tableState.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useGetAccountQueueQuery } from '../api.js'
import { ACCOUNT_STATUSES, ACCOUNT_TONES } from '../tones.js'
import AccountReview from './AccountReview.jsx'
import QueueRow, { QueueSkeleton } from './QueueRow.jsx'
import pageStyles from '../pages/ModerationPage.module.css'

const KINDS = ['recruiter', 'agency']

/**
 * Moderation › Account review (M-165, OQ-2, P4-Q2): recruiters or (2026-11-20) agencies by status, pending oldest first,
 * and the review dialog. The kind is in the URL (?kind=agency) so a link or a reload keeps it.
 */
export default function AccountQueue({ basePath, openId, status, onStatusChange, onDecided }) {
  const { t } = useTranslation()
  const format = useFormat()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const kind = KINDS.includes(params.get('kind')) ? params.get('kind') : 'recruiter'
  const result = useGetAccountQueueQuery({ status, role: kind })
  const { data: queue, error } = result
  const list = tableState(result, queue?.items ?? [])
  const denied = errorCode(error) === 'PERMISSION_DENIED'

  return (
    <>
      <section className={pageStyles.queue} role="tabpanel" aria-label={t('moderation:accounts.title')}>
        <FilterChips
          className={pageStyles.kinds}
          label={t('moderation:accounts.kindFilter')}
          options={KINDS.map((id) => ({ id, label: t(`moderation:accounts.kinds.${id}`), count: queue?.pending?.[id] }))}
          value={kind}
          onChange={(id) => setParams(id === 'recruiter' ? {} : { kind: id }, { replace: true })}
        />
        <div className={pageStyles.header}>
          <SectionTitle title={t('moderation:accounts.title')} description={t('moderation:accounts.description')} />
          {!denied && (
            <SegmentedTabs
              className={pageStyles.filter}
              label={t('moderation:accounts.statusFilter')}
              tabs={ACCOUNT_STATUSES.map((id) => ({ id, label: t(`moderation:accounts.status.${id}`) }))}
              value={status}
              onChange={onStatusChange}
            />
          )}
        </div>
        {list.loading ? (
          <QueueSkeleton />
        ) : denied ? (
          <EmptyState icon={Lock} title={t('errors:PERMISSION_DENIED')} description={t('moderation:verification.noPermission', error.data.error.params)} />
        ) : queue?.items.length === 0 ? (
          <EmptyState icon={Users} title={t('moderation:accounts.empty')} />
        ) : (
          <ul className={cx(pageStyles.list, list.busy && pageStyles.busy)} aria-busy={list.busy || undefined}>
            {queue?.items.map((item) => (
              <QueueRow
                key={item.id}
                icon={Users}
                media={item.company && <CompanyLogo name={item.company.displayName} id={item.company.id} src={item.company.logoUrl ?? undefined} size={44} />}
                title={item.fullName}
                badge={<PillBadge tone="neutral">{t(`enums:role.${item.role ?? kind}`)}</PillBadge>}
                lines={[
                  { text: [item.email, item.company?.legalName, item.company?.countryCode && format.country(item.company.countryCode)].filter(Boolean).join(' · '), tone: 'sub' },
                  {
                    text: item.submittedAt ? t('moderation:accounts.submitted', { date: format.dateTime(item.submittedAt) }) : t('moderation:accounts.joined', { date: format.date(item.createdAt) }),
                    tone: 'meta',
                  },
                ]}
                status={{ tone: ACCOUNT_TONES[item.status], label: t(`moderation:accounts.status.${item.status}`) }}
                actionLabel={t('moderation:accounts.review')}
                to={`${basePath}/${item.id}${kind === 'agency' ? '?kind=agency' : ''}`}
              />
            ))}
          </ul>
        )}
      </section>
      {openId && <AccountReview userId={openId} onDecided={onDecided} onClose={() => navigate(`${basePath}${kind === 'agency' ? '?kind=agency' : ''}`)} />}
    </>
  )
}
