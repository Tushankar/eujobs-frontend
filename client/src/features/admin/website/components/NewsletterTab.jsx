import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Plus } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { tableState } from '@/components/common/tableState.js'
import { Button, Icon } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useCreateNewsletterIssueMutation, useDeleteNewsletterIssueMutation, useGetNewsletterIssuesQuery } from '../api.js'
import styles from '../pages/WebsitePage.module.css'

export const ISSUE_TONES = { draft: 'neutral', sending: 'warning', sent: 'success' }

/** Website › Newsletter: the issues, newest first. A new issue starts as a draft with the latest jobs and posts (`content.manage`). */
export default function NewsletterTab({ manage, onNotice }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const navigate = useNavigate()
  const result = useGetNewsletterIssuesQuery()
  const table = tableState(result, result.data?.items ?? [])
  const [create, { isLoading: creating }] = useCreateNewsletterIssueMutation()
  const [remove] = useDeleteNewsletterIssueMutation()
  const [deleting, setDeleting] = useState(null)

  async function start() {
    try {
      const issue = await create().unwrap()
      navigate(`/admin/website/newsletter/${issue.id}`)
    } catch (error) {
      onNotice(errorText.code(error))
    }
  }

  async function confirmDelete() {
    const issue = deleting
    setDeleting(null)
    try {
      await remove(issue.id).unwrap()
      onNotice(t('website:admin.newsletter.notice.deleted'))
    } catch (error) {
      onNotice(errorText.code(error))
    }
  }

  const newButton = manage && (
    <Button onClick={start} loading={creating} leftIcon={<Icon as={Plus} size={14} />}>
      {t('website:admin.newsletter.new')}
    </Button>
  )

  if (!table.loading && !result.data?.items.length) {
    return <EmptyState icon={Mail} title={t('website:admin.newsletter.empty')} description={t('website:admin.newsletter.emptyText')} action={newButton} />
  }

  const columns = [
    {
      key: 'subject',
      header: t('website:admin.newsletter.subject'),
      render: (issue) => (
        <span>
          <strong className={styles.postTitle}>{issue.translations.en.subject || t('website:admin.newsletter.untitled')}</strong>
          <span className={styles.postMeta}>{t('website:admin.newsletter.items', { jobs: issue.jobIds.length, posts: issue.postIds.length })}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: t('website:admin.blog.status'),
      skeleton: 'pill',
      render: (issue) => <PillBadge tone={ISSUE_TONES[issue.status]}>{t(`website:admin.newsletter.statuses.${issue.status}`)}</PillBadge>,
    },
    {
      key: 'delivery',
      header: t('website:admin.newsletter.delivery'),
      render: (issue) =>
        issue.status === 'draft'
          ? '—'
          : t('website:admin.newsletter.deliveryText', { sent: issue.deliveries.sent, total: issue.recipients, failed: issue.deliveries.failed }),
    },
    { key: 'date', header: t('website:admin.newsletter.date'), render: (issue) => format.date(issue.sentAt ?? issue.updatedAt) },
    {
      key: 'actions',
      header: <span className="sr-only">{t('website:admin.blog.actions')}</span>,
      render: (issue) => (
        <span className={styles.actions}>
          <Button variant="outline" size="sm" as={Link} to={`/admin/website/newsletter/${issue.id}`}>
            {t(issue.status === 'draft' && manage ? 'website:admin.blog.edit' : 'website:admin.newsletter.open')}
          </Button>
          {manage && issue.status === 'draft' && (
            <Button variant="ghost" size="sm" onClick={() => setDeleting(issue)}>
              {t('website:admin.blog.delete')}
            </Button>
          )}
        </span>
      ),
    },
  ]

  return (
    <>
      {newButton && <div className={styles.toolbar}>{newButton}</div>}
      <DataTable
        columns={columns}
        rows={result.data?.items ?? []}
        getRowKey={(issue) => issue.id}
        loading={table.loading}
        busy={table.busy}
        caption={t('website:admin.newsletter.caption')}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('website:admin.newsletter.deleteTitle')}
        description={t('website:admin.newsletter.deleteText')}
        confirmLabel={t('website:admin.blog.delete')}
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}
