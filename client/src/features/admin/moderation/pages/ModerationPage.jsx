import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CircleCheck, ShieldCheck, TriangleAlert, Users } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { useAuditLog } from '@/features/admin/audit-logs/hooks/useAuditLog.js'
import { formatDate, formatDateTime } from '@/features/admin/audit-logs/utils/formatDate.js'
import { useJobs } from '@/features/recruiter/jobs/hooks/useJobs.js'
import QueueRow from '../components/QueueRow.jsx'
import QueueTabs from '../components/QueueTabs.jsx'
import ReviewDialog from '../components/ReviewDialog.jsx'
import { AccountDetails, ContentDetails } from '../components/ReviewDetails.jsx'
import {
  ACCOUNT_ACTIONS,
  CONTENT_ACTIONS,
  CONTENT_ITEMS,
  DECISION_BADGES,
  PENDING_ACCOUNTS,
} from '../data/moderation.js'
import { useGetVerificationQueueQuery } from '../api.js'
import VerificationQueue from '../components/VerificationQueue.jsx'
import { useModerationDecisions } from '../hooks/useModerationDecisions.js'
import { jobToReviewItem } from '../utils/jobReviewItem.js'
import styles from './ModerationPage.module.css'

const BASE_PATH = '/admin/moderation'

const AUDIT_TITLES = {
  dismissed: 'Content report dismissed',
  restricted: 'Content restricted',
  approved: 'Account approved',
  suspended: 'Account suspended for review',
}

const TABS = {
  content: {
    key: 'content',
    path: BASE_PATH,
    title: 'Content moderation queue',
    description:
      'Review reported jobs, candidate profiles, and company content. Reports are signals for human review, not automatic findings.',
  },
  accounts: {
    key: 'account',
    path: `${BASE_PATH}/accounts`,
    title: 'Account review queue',
    description: 'Approve or suspend new candidate and recruiter accounts after reviewing their registration details.',
  },
  // Server data (M-166); its texts are in the moderation namespace.
  verification: { key: 'verification', path: `${BASE_PATH}/verification` },
}

/**
 * Moderation. One page serves six URLs: /admin/moderation (content queue), /admin/moderation/accounts (account
 * queue), /admin/moderation/verification (candidate verification, from the server since Phase 3), and
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
  const { decisions, decide } = useModerationDecisions()
  const { record } = useAuditLog()
  const { getJob } = useJobs()
  const [status, setStatus] = useState('')

  const items = tabId === 'content' ? CONTENT_ITEMS : PENDING_ACCOUNTS
  const keyOf = (item) => `${tab.key}:${item.id}`
  const queued = openId && tabId !== 'verification' ? items.find((item) => item.id === openId) : null
  const job = tabId === 'content' && openId && !queued ? getJob(openId) : null
  const openItem = queued ?? (job ? jobToReviewItem(job) : null)

  const openContent = CONTENT_ITEMS.filter((item) => !decisions[`content:${item.id}`]).length
  const openAccounts = PENDING_ACCOUNTS.filter((item) => !decisions[`account:${item.id}`]).length
  const contentDecisions = Object.keys(decisions).filter((key) => key.startsWith('content:')).length

  if (openId && !openItem && tabId !== 'verification') return <Navigate to={tab.path} replace />

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

    if (tabId === 'accounts') {
      return (
        <QueueRow
          key={item.id}
          icon={Users}
          title={item.name}
          lines={[
            { text: item.email, tone: 'sub' },
            {
              text: `${item.type} account · Joined ${formatDate(item.joinedAt)} · Registration details require human review.`,
              tone: 'summary',
            },
          ]}
          status={badge}
          note={note}
          actionLabel="Review account"
          to={`${BASE_PATH}/accounts/${item.id}`}
        />
      )
    }
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
        <StatCard label="Pending accounts" value={openAccounts} caption="Registration decisions needed" icon={Users} />
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
          { id: 'accounts', label: 'Account review', icon: Users, count: openAccounts, to: TABS.accounts.path },
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
      {openItem && tabId === 'accounts' && (
        <ReviewDialog
          title="Review pending account"
          actions={ACCOUNT_ACTIONS}
          actionsAlign="start"
          previous={decisions[keyOf(openItem)] && previousOf(decisions[keyOf(openItem)])}
          onDecide={handleDecide}
          onClose={() => navigate(tab.path)}
        >
          <AccountDetails account={openItem} />
        </ReviewDialog>
      )}
    </>
  )
}

function previousOf(decision) {
  return { label: `Previous decision: ${DECISION_BADGES[decision.status].label}`, reason: decision.reason }
}
