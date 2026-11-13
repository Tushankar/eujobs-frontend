import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { CircleCheck, MessageSquareQuote, ShieldCheck, TriangleAlert, Users } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import QueueTabs from '../components/QueueTabs.jsx'
import { useGetAccountQueueQuery, useGetModerationSummaryQuery, useGetReviewQueueQuery, useGetVerificationQueueQuery } from '../api.js'
import AccountQueue from '../components/AccountQueue.jsx'
import ContentQueue from '../components/ContentQueue.jsx'
import ReviewQueue from '../components/ReviewQueue.jsx'
import VerificationQueue from '../components/VerificationQueue.jsx'
import styles from './ModerationPage.module.css'

const BASE_PATH = '/admin/moderation'
const TABS = {
  content: { path: BASE_PATH },
  accounts: { path: `${BASE_PATH}/accounts` },
  verification: { path: `${BASE_PATH}/verification` },
  reviews: { path: `${BASE_PATH}/reviews` },
}

/**
 * Moderation. One page serves six URLs: /admin/moderation (content cases, M-164, M-167), /admin/moderation/accounts
 * (recruiter account review, M-165), /admin/moderation/verification (candidate verification, M-166),
 * /admin/moderation/reviews (landing page reviews, 2026-11-13), and
 * .../content/:caseId, .../accounts/:accountId and .../verification/:submissionId, which open the matching review
 * dialog over its queue. Closing a dialog returns to the queue. Every queue and count comes from the server.
 */
export default function ModerationPage() {
  const { t } = useTranslation()
  const [kind, openId] = (useParams()['*'] ?? '').split('/').filter(Boolean)
  const tabId = ['accounts', 'verification', 'reviews'].includes(kind) ? kind : 'content'
  const { data: inReview, isLoading: inReviewLoading } = useGetVerificationQueueQuery('in_review')
  const [accountStatus, setAccountStatus] = useState('pending_review')
  const { data: accounts, isLoading: accountsLoading } = useGetAccountQueueQuery(accountStatus)
  const { data: summary, isLoading: summaryLoading } = useGetModerationSummaryQuery()
  const pendingAccounts = accounts?.counts.pending_review ?? 0
  const openContent = summary?.contentOpen ?? 0
  const [status, setStatus] = useState('')
  const [reviewStatus, setReviewStatus] = useState('pending')
  const { data: pendingReviews, isLoading: reviewsLoading } = useGetReviewQueueQuery('pending')

  return (
    <>
      <PageTitle title={t('moderation:title')} description={t('moderation:description')} />
      <div className={styles.stats}>
        <StatCard label={t('moderation:accounts.stat.label')} value={pendingAccounts} caption={t('moderation:accounts.stat.caption')} icon={Users} loading={accountsLoading} />
        <StatCard label={t('moderation:content.stat.label')} value={openContent} caption={t('moderation:content.stat.caption')} icon={TriangleAlert} loading={summaryLoading} />
        <StatCard
          label={t('moderation:verification.stat.label')}
          value={inReview?.total ?? 0}
          caption={t('moderation:verification.stat.caption')}
          icon={ShieldCheck}
          loading={inReviewLoading}
        />
        <StatCard
          label={t('moderation:content.decisions.label')}
          value={summary?.contentDecided ?? 0}
          caption={t('moderation:content.decisions.caption')}
          icon={CircleCheck}
          loading={summaryLoading}
        />
      </div>
      <QueueTabs
        value={tabId}
        tabs={[
          { id: 'content', label: t('moderation:content.tab'), icon: TriangleAlert, count: openContent, loading: summaryLoading, to: TABS.content.path },
          { id: 'accounts', label: t('moderation:accounts.tab'), icon: Users, count: pendingAccounts, loading: accountsLoading, to: TABS.accounts.path },
          { id: 'verification', label: t('moderation:verification.tab'), icon: ShieldCheck, count: inReview?.total ?? 0, loading: inReviewLoading, to: TABS.verification.path },
          { id: 'reviews', label: t('moderation:reviews.tab'), icon: MessageSquareQuote, count: pendingReviews?.counts.pending ?? 0, loading: reviewsLoading, to: TABS.reviews.path },
        ]}
      />
      <div role="status">{status && <p className={styles.status}>{status}</p>}</div>
      {tabId === 'reviews' ? (
        <ReviewQueue status={reviewStatus} onStatusChange={setReviewStatus} onDecided={setStatus} />
      ) : tabId === 'verification' ? (
        <VerificationQueue basePath={TABS.verification.path} openId={openId} onDecided={setStatus} />
      ) : tabId === 'accounts' ? (
        <AccountQueue basePath={TABS.accounts.path} openId={openId} status={accountStatus} onStatusChange={setAccountStatus} onDecided={setStatus} />
      ) : (
        <ContentQueue basePath={BASE_PATH} openId={kind === 'content' ? openId : undefined} onDecided={setStatus} />
      )}
    </>
  )
}
