import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { Download, FileText, Mail, Newspaper, Plus } from 'lucide-react'
import { can } from '@/app/permissions.js'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import Pagination from '@/components/common/Pagination.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SegmentedTabs from '@/components/common/SegmentedTabs.jsx'
import { tableState } from '@/components/common/tableState.js'
import { Button, Icon } from '@/components/ui'
import QueueTabs from '@/features/admin/moderation/components/QueueTabs.jsx'
import { downloadFromApi } from '@/lib/download.js'
import { useErrorText } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useDeletePostMutation, useGetAdminPostsQuery, useGetSubscribersQuery, useSetPostStatusMutation } from '../api.js'
import styles from './WebsitePage.module.css'

const SUBSCRIBER_STATUSES = ['confirmed', 'pending', 'unsubscribed']
const SUBSCRIBER_TONES = { confirmed: 'success', pending: 'warning', unsubscribed: 'neutral' }

/** Website › Blog: every post, newest edit first, with publish, edit and delete (`content.manage`). */
function BlogTab({ manage, onNotice }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const result = useGetAdminPostsQuery()
  const table = tableState(result, result.data?.items ?? [])
  const [setStatus] = useSetPostStatusMutation()
  const [deletePost] = useDeletePostMutation()
  const [deleting, setDeleting] = useState(null)

  async function toggle(post) {
    const status = post.status === 'published' ? 'draft' : 'published'
    try {
      await setStatus({ id: post.id, status }).unwrap()
      onNotice(t(`website:admin.notice.${status}`, { title: post.title }))
    } catch (error) {
      onNotice(error?.data?.error?.code === 'VALIDATION_FAILED' ? t('website:admin.notice.needsCover') : errorText.code(error))
    }
  }

  async function confirmDelete() {
    const post = deleting
    setDeleting(null)
    try {
      await deletePost(post.id).unwrap()
      onNotice(t('website:admin.notice.deleted', { title: post.title }))
    } catch (error) {
      onNotice(errorText.code(error))
    }
  }

  if (!table.loading && !result.data?.items.length) {
    return (
      <EmptyState
        icon={Newspaper}
        title={t('website:admin.blog.empty')}
        description={t('website:admin.blog.emptyText')}
        action={
          manage && (
            <Button as={Link} to="/admin/website/blog/new" leftIcon={<Icon as={Plus} size={14} />}>
              {t('website:admin.blog.new')}
            </Button>
          )
        }
      />
    )
  }

  const columns = [
    {
      key: 'title',
      header: t('website:admin.blog.post'),
      render: (post) => (
        <span className={styles.post}>
          {post.coverUrl ? (
            <img src={post.coverUrl} alt="" className={styles.thumb} />
          ) : (
            <span className={styles.thumb}>
              <Icon as={FileText} size={16} />
            </span>
          )}
          <span>
            <strong className={styles.postTitle}>{post.title}</strong>
            <span className={styles.postMeta}>/blog/{post.slug}</span>
          </span>
        </span>
      ),
    },
    { key: 'language', header: t('website:admin.blog.language'), render: (post) => format.languageName(post.language) },
    {
      key: 'status',
      header: t('website:admin.blog.status'),
      skeleton: 'pill',
      render: (post) => <PillBadge tone={post.status === 'published' ? 'success' : 'neutral'}>{t(`website:admin.blog.statuses.${post.status}`)}</PillBadge>,
    },
    { key: 'published', header: t('website:admin.blog.published'), render: (post) => (post.publishedAt ? format.date(post.publishedAt) : '—') },
    {
      key: 'actions',
      header: '',
      label: t('website:admin.blog.actions'),
      render: (post) =>
        manage && (
          <span className={styles.actions}>
            <Button variant="outline" size="sm" as={Link} to={`/admin/website/blog/${post.id}/edit`}>
              {t('website:admin.blog.edit')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => toggle(post)}>
              {t(post.status === 'published' ? 'website:admin.blog.unpublish' : 'website:admin.blog.publish')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(post)}>
              {t('website:admin.blog.delete')}
            </Button>
          </span>
        ),
    },
  ]

  return (
    <>
      {manage && (
        <div className={styles.toolbar}>
          <Button as={Link} to="/admin/website/blog/new" leftIcon={<Icon as={Plus} size={14} />}>
            {t('website:admin.blog.new')}
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={result.data?.items ?? []}
        getRowKey={(post) => post.id}
        loading={table.loading}
        busy={table.busy}
        caption={t('website:admin.blog.caption')}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('website:admin.blog.deleteTitle')}
        description={deleting && t('website:admin.blog.deleteText', { title: deleting.title })}
        confirmLabel={t('website:admin.blog.delete')}
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

/** Website › Subscribers: the double opt-in list by status; confirmed addresses export as CSV (`reports.export`). */
function SubscribersTab({ canExport, onNotice }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const [status, setStatus] = useState('confirmed')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const result = useGetSubscribersQuery({ status, page })
  const table = tableState(result, result.data?.items ?? [])

  async function exportCsv() {
    setExporting(true)
    try {
      await downloadFromApi('/admin/content/subscribers/export')
    } catch (error) {
      onNotice(errorText.code(error))
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    { key: 'email', header: t('website:admin.subscribers.email'), render: (row) => <strong className={styles.postTitle}>{row.email}</strong> },
    { key: 'language', header: t('website:admin.blog.language'), render: (row) => format.languageName(row.language) },
    {
      key: 'status',
      header: t('website:admin.blog.status'),
      skeleton: 'pill',
      render: (row) => <PillBadge tone={SUBSCRIBER_TONES[row.status]}>{t(`website:admin.subscribers.statuses.${row.status}`)}</PillBadge>,
    },
    { key: 'since', header: t('website:admin.subscribers.since'), render: (row) => format.date(row.confirmedAt ?? row.unsubscribedAt ?? row.createdAt) },
  ]

  return (
    <>
      <div className={styles.toolbar}>
        <SegmentedTabs
          label={t('website:admin.subscribers.filter')}
          tabs={SUBSCRIBER_STATUSES.map((id) => ({ id, label: `${t(`website:admin.subscribers.statuses.${id}`)} (${result.data?.counts[id] ?? 0})` }))}
          value={status}
          onChange={(next) => {
            setStatus(next)
            setPage(1)
          }}
        />
        {canExport && (
          <Button
            variant="outline"
            leftIcon={<Icon as={Download} size={14} />}
            onClick={exportCsv}
            loading={exporting}
            disabled={!result.data?.counts.confirmed}
          >
            {t('website:admin.subscribers.export')}
          </Button>
        )}
      </div>
      {!table.loading && !result.data?.items.length ? (
        <EmptyState icon={Mail} title={t(`website:admin.subscribers.empty.${status}`)} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={result.data?.items ?? []}
            getRowKey={(row) => row.id}
            loading={table.loading}
            busy={table.busy}
            caption={t('website:admin.subscribers.caption')}
          />
          {result.data && <Pagination page={page} pageSize={result.data.pageSize} total={result.data.total} onChange={setPage} />}
        </>
      )}
    </>
  )
}

/** Admin › Website (2026-11-13): /admin/website (Blog) and /admin/website/subscribers. */
export default function WebsitePage() {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const tab = useLocation().pathname.endsWith('/subscribers') ? 'subscribers' : 'blog'
  const [notice, setNotice] = useState('')
  const posts = useGetAdminPostsQuery()
  const subscribers = useGetSubscribersQuery({ status: 'confirmed', page: 1 })

  return (
    <>
      <PageTitle title={t('website:admin.title')} description={t('website:admin.description')} />
      <QueueTabs
        value={tab}
        tabs={[
          { id: 'blog', label: t('website:admin.tabs.blog'), icon: Newspaper, count: posts.data?.total ?? 0, loading: posts.isLoading, to: '/admin/website' },
          {
            id: 'subscribers',
            label: t('website:admin.tabs.subscribers'),
            icon: Mail,
            count: subscribers.data?.counts.confirmed ?? 0,
            loading: subscribers.isLoading,
            to: '/admin/website/subscribers',
          },
        ]}
      />
      {notice && <NoticeBanner>{notice}</NoticeBanner>}
      <div className={styles.body}>
        {tab === 'blog' ? (
          <BlogTab manage={can(me, 'content.manage')} onNotice={setNotice} />
        ) : (
          <SubscribersTab canExport={can(me, 'reports.export')} onNotice={setNotice} />
        )}
      </div>
    </>
  )
}
