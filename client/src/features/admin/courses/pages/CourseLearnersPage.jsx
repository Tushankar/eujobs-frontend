import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, Icon, Modal, TextareaField } from '@/components/ui'
import { useGetConfigQuery } from '@/app/api.js'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetCourseLearnersQuery, useRevokeCertificateMutation } from '../api.js'
import styles from './CourseLearnersPage.module.css'

const FORM_ID = 'revoke-certificate'
const CERTIFICATE_TONE = { valid: 'success', revoked: 'danger', no_longer_valid: 'neutral' }

/** M-105: an audited revoke needs a reason; the public check then answers Revoked. */
function RevokeDialog({ courseId, learner, onClose }) {
  const { t } = useTranslation('courses')
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [revoke, { isLoading }] = useRevokeCertificateMutation()
  const form = useFormState({ reason: '' })
  const max = config?.limits.certificate.revokeReason.max

  async function handleSubmit(event) {
    event.preventDefault()
    const reason = form.values.reason.trim()
    const ok = await form.run({ reason: !reason ? { key: 'required' } : reason.length > max ? { key: 'too_long', params: { max } } : undefined }, () =>
      revoke({ courseId, certificateId: learner.certificate.id, reason }).unwrap(),
    )
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('learners.revokeTitle')}
      description={t('learners.revokeDescription', { code: learner.certificate.code, name: learner.user?.name ?? '' })}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} variant="danger" loading={isLoading} data-confirm-revoke>
            {t('learners.revoke')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
        <TextareaField
          label={t('learners.reason')}
          name="reason"
          rows={3}
          value={form.values.reason}
          onChange={(event) => form.set('reason', event.target.value)}
          error={errorText.field('reason', form.errors.reason)}
          autoFocus
        />
        {form.failure && <p role="alert">{errorText.code(form.failure)}</p>}
      </form>
    </Modal>
  )
}

/** /admin/courses/:courseId/learners (M-110, M-111): every enrollment with progress, best score and certificate. */
export default function CourseLearnersPage() {
  const { t } = useTranslation('courses')
  const format = useFormat()
  const errorText = useErrorText()
  const { courseId } = useParams()
  const { data, error } = useGetCourseLearnersQuery(courseId)
  const [revoking, setRevoking] = useState(null)
  const listPath = data?.course.audience === 'recruiter' ? '/admin/courses/recruiter' : '/admin/courses'

  const columns = [
    {
      key: 'learner',
      header: t('learners.learner'),
      width: 220,
      render: (row) => (
        <>
          <p className={styles.name}>{row.user?.name ?? t('learners.deleted')}</p>
          {row.user && <p className={styles.muted}>{row.user.email}</p>}
        </>
      ),
    },
    { key: 'source', header: t('learners.source'), width: 110, render: (row) => <span className={styles.muted}>{t(`learners.sources.${row.source}`)}</span> },
    { key: 'enrolled', header: t('learners.enrolled'), width: 120, render: (row) => <span className={styles.muted}>{format.date(row.enrolledAt)}</span> },
    { key: 'progress', header: t('learners.progress'), width: 120, render: (row) => <span className={styles.muted}>{t('learners.lessons', { done: row.lessonsDone, total: data.course.lessons })}</span> },
    {
      key: 'score',
      header: t('learners.bestScore'),
      width: 100,
      render: (row) => <span className={styles.muted}>{row.quizBestScore === null ? '—' : format.number(row.quizBestScore / 100, { style: 'percent' })}</span>,
    },
    {
      key: 'certificate',
      header: t('learners.certificate'),
      render: (row) =>
        row.certificate ? (
          <div className={styles.certificate} data-learner-certificate={row.certificate.code}>
            <span className={styles.code}>{row.certificate.code}</span>
            <PillBadge tone={CERTIFICATE_TONE[row.certificate.status]}>{t(`learners.status.${row.certificate.status}`)}</PillBadge>
            {row.certificate.status === 'valid' && (
              <Button variant="ghost" size="sm" onClick={() => setRevoking(row)} data-revoke={row.certificate.code}>
                {t('learners.revoke')}
              </Button>
            )}
          </div>
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
  ]

  return (
    <>
      <Link to={listPath} className={styles.back}>
        <Icon as={ArrowLeft} size={14} />
        {t('builder.back')}
      </Link>
      {error && <NoticeBanner>{errorText.code(error)}</NoticeBanner>}
      {data && (
        <>
          <PageTitle eyebrow={t('learners.eyebrow')} title={data.course.title} description={t('learners.description', { count: data.total })} />
          <div className={styles.results}>
            {data.items.length > 0 ? (
              <DataTable columns={columns} rows={data.items} getRowKey={(row) => row.id} caption={t('learners.caption')} />
            ) : (
              <EmptyState icon={Users} title={t('learners.emptyTitle')} description={t('learners.emptyText')} />
            )}
          </div>
        </>
      )}
      {revoking && <RevokeDialog courseId={courseId} learner={revoking} onClose={() => setRevoking(null)} />}
    </>
  )
}
