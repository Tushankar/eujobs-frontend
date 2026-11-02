import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CircleCheck, ShieldCheck, TriangleAlert, Users } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { useAuditLog } from '@/features/admin/audit-logs/hooks/useAuditLog.js'
import { formatDateTime } from '@/features/admin/audit-logs/utils/formatDate.js'
import { useJobs } from '@/features/recruiter/jobs/hooks/useJobs.js'
import QueueRow from '../components/QueueRow.jsx'
import QueueTabs from '../components/QueueTabs.jsx'
import ReviewDialog from '../components/ReviewDialog.jsx'
import { ContentDetails } from '../components/ReviewDetails.jsx'
import { CONTENT_ACTIONS, CONTENT_ITEMS, DECISION_BADGES } from '../data/moderation.js'
import { useGetAccountQueueQuery, useGetVerificationQueueQuery } from '../api.js'
import AccountQueue from '../components/AccountQueue.jsx'
import VerificationQueue from '../components/VerificationQueue.jsx'
import { useModerationDecisions } from '../hooks/useModerationDecisions.js'
import { jobToReviewItem } from '../utils/jobReviewItem.js'
import styles from './ModerationPage.module.css'

const BASE_PATH = '/admin/moderation'

const AUDIT_TITLES = {
  dismissed: 'Content report dismissed',
  restricted: 'Content restricted',
}

const TABS = {
  content: {
    key: 'content',
    path: BASE_PATH,
    title: 'Content moderation queue',
    description:
      'Review reported jobs, candidate profiles, and company content. Reports are signals for human review, not automatic findings.',
  },
  // Server data (M-165, M-166); their texts are in the moderation namespace.
  accounts: { key: 'account', path: `${BASE_PATH}/accounts` },
  verification: { key: 'verification', path: `${BASE_PATH}/verification` },
}

/**
 * Moderation. One page serves six URLs: /admin/moderation (content queue), /admin/moderation/accounts (recruiter
 * account review, from the server since Phase 4), /admin/moderation/verification (candidate verification, from the
 * server since Phase 3), and
 * .../content/:itemId, .../accounts/:accountId and .../verification/:submissionId, which open the matching review
 * dialog over its queue (the Figma frames show those dialogs over the page). Closing a dialog returns to the queue.
 * The Jobs page links every recruiter job to .../content/:jobId: a job with no queue entry is reviewed from its own details.
 */
export default function ModerationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [kind, openId] = (useParams()['*'] ?? '').split('/').filter(Boolean)
  const tabId = ['accounts', 'verification'].includes(kind) ? kind : 'content'
  const tab = TABS[tabId]
  const { data: inReview } = useGetVerificationQueueQuery('in_review')
  const [accountStatus, setAccountStatus] = useState('pending_review')
  const { data: accounts } = useGetAccountQueueQuery(accountStatus)
  const pendingAccounts = accounts?.counts.pending_review ?? 0
  const { decisions, decide } = useModerationDecisions()
  const { record } = useAuditLog()
  const { getJob } = useJobs()
  const [status, setStatus] = useState('')

  const items = CONTENT_ITEMS
  const keyOf = (item) => `${tab.key}:${item.id}`
  const queued = openId && tabId === 'content' ? items.find((item) => item.id === openId) : null
  const job = tabId === 'content' && openId && !queued ? getJob(openId) : null
  const openItem = queued ?? (job ? jobToReviewItem(job) : null)

  const openContent = CONTENT_ITEMS.filter((item) => !decisions[`content:${item.id}`]).length
  const contentDecisions = Object.keys(decisions).filter((key) => key.startsWith('content:')).length

  if (openId && !openItem && tabId === 'content') return <Navigate to={tab.path} replace />

  function handleDecide(action, reason) {
    const title = openItem.title ?? openItem.name
    decide(keyOf(openItem), action.id, reason)
    record({
      title: AUDIT_TITLES[action.id],
      category: 'Moderation',
      detail: `${title}: ${DECISION_BADGES[action.id].label.toLowerCase()}. ${reason ? `Reason: ${reason}` : 'No reason was added.'}`,
    })
    setStatus(`${title}: ${DECISION_BADGES[action.id].label.toLowerCase()}. The decision is saved on this device.`)
    navigate(tab.path)
  }

  function renderRow(item) {
    const decision = decisions[keyOf(item)]
    const badge = DECISION_BADGES[decision?.status ?? 'pending']
    const note = decision
      ? `Decision recorded ${formatDateTime(decision.decidedAt)}${decision.reason ? ` · Reason: ${decision.reason}` : ''}`
      : null

    return (
      <QueueRow
        key={item.id}
        icon={TriangleAlert}
        alert={item.priority === 'high'}
        title={item.title}
        badge={
          <PillBadge tone={item.priority === 'high' ? 'warning' : 'neutral'}>
            {item.priority === 'high' ? 'High priority' : 'Standard priority'}
          </PillBadge>
        }
        lines={[
          { text: `${item.kind} · ${item.reason}`, tone: 'sub' },
          { text: item.summary, tone: 'summary' },
          { text: `Reported ${formatDateTime(item.reportedAt)}`, tone: 'meta' },
        ]}
        status={badge}
        note={note}
        actionLabel="Review content"
        to={`${BASE_PATH}/content/${item.id}`}
      />
    )
  }

  return (
    <>
      <PageTitle
        title="Trust is an ongoing practice."
        description="Review reported content, accounts, and candidate credentials with care, context, and a clear record of every decision."
      />

      <div className={styles.stats}>
        <StatCard label={t('moderation:accounts.stat.label')} value={pendingAccounts} caption={t('moderation:accounts.stat.caption')} icon={Users} />
        <StatCard label="Content reports" value={openContent} caption="Reported content awaiting review" icon={TriangleAlert} />
        <StatCard
          label={t('moderation:verification.stat.label')}
          value={inReview?.total ?? 0}
          caption={t('moderation:verification.stat.caption')}
          icon={ShieldCheck}
        />
        <StatCard label="Content decisions" value={contentDecisions} caption="Human-reviewed moderation cases" icon={CircleCheck} />
      </div>

      <QueueTabs
        value={tabId}
        tabs={[
          { id: 'content', label: 'Content moderation', icon: TriangleAlert, count: openContent, to: TABS.content.path },
          { id: 'accounts', label: t('moderation:accounts.tab'), icon: Users, count: pendingAccounts, to: TABS.accounts.path },
          {
            id: 'verification',
            label: t('moderation:verification.tab'),
            icon: ShieldCheck,
            count: inReview?.total ?? 0,
            to: TABS.verification.path,
          },
        ]}
      />

      <div role="status">{status && <p className={styles.status}>{status}</p>}</div>

      {tabId === 'verification' ? (
        <VerificationQueue basePath={TABS.verification.path} openId={openId} onDecided={setStatus} />
      ) : tabId === 'accounts' ? (
        <AccountQueue basePath={TABS.accounts.path} openId={openId} status={accountStatus} onStatusChange={setAccountStatus} onDecided={setStatus} />
      ) : (
        <section className={styles.queue} role="tabpanel" aria-label={tab.title}>
          <div className={styles.header}>
            <SectionTitle title={tab.title} description={tab.description} />
          </div>
          <ul className={styles.list}>{items.map(renderRow)}</ul>
        </section>
      )}

      {openItem && tabId === 'content' && (
        <ReviewDialog
          title="Review reported content"
          actions={CONTENT_ACTIONS}
          previous={decisions[keyOf(openItem)] && previousOf(decisions[keyOf(openItem)])}
          onDecide={handleDecide}
          onClose={() => navigate(tab.path)}
        >
          <ContentDetails item={openItem} />
        </ReviewDialog>
      )}
    </>
  )
}

function previousOf(decision) {
  return { label: `Previous decision: ${DECISION_BADGES[decision.status].label}`, reason: decision.reason }
}
