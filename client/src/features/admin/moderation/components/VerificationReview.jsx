import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { Avatar, Button, Icon, Modal, TextareaField } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useDecideVerificationMutation, useGetAdminFileUrlQuery, useGetVerificationSubmissionQuery } from '../api.js'
import dialogStyles from './ReviewDialog.module.css'
import detailStyles from './ReviewDetails.module.css'
import styles from './VerificationReview.module.css'

const STATUS_TONES = { in_review: 'warning', approved: 'success', rejected: 'danger' }

/** The file preview needs `documents.view` (§2.6): an image inline, a PDF as a link. */
function EvidenceFile({ file }) {
  const { t } = useTranslation()
  const { data, error } = useGetAdminFileUrlQuery(file.id)
  if (errorCode(error) === 'PERMISSION_DENIED') return <p className={detailStyles.contextText}>{t('moderation:verification.dialog.noPreview', error.data.error.params)}</p>
  if (!data) return null
  const url = `${import.meta.env.VITE_API_URL ?? ''}${data.url}`
  return (
    <div className={styles.preview}>
      {file.mime.startsWith('image/') && <img src={url} alt={t('moderation:verification.dialog.previewAlt', { name: file.name })} />}
      <a href={url} target="_blank" rel="noopener noreferrer">
        {t('moderation:verification.dialog.openFile', { name: file.name })}
      </a>
    </div>
  )
}

/** The profile claim the evidence must match (A: admin §9.2), as it is now. */
function Claim({ category, claim }) {
  const { t } = useTranslation()
  const format = useFormat()
  if (!claim) return t('moderation:verification.dialog.claimMissing')
  const period = (start, end) => t('moderation:verification.dialog.period', { start: format.month(start), end: end ? format.month(end) : t('moderation:verification.dialog.present') })
  switch (category) {
    case 'identity':
      return t('moderation:verification.dialog.claimName', { name: claim.fullName })
    case 'academic':
      return `${claim.degree} · ${claim.institution} · ${period(claim.start, claim.end)}`
    case 'employment':
      return `${claim.title} · ${claim.employer} · ${period(claim.start, claim.end)}`
    case 'right_to_work':
      return [
        t(`enums:rtwRegion.${claim.region}`),
        t(`enums:rtwStatus.${claim.status}`),
        claim.permitExpiresOn && t('moderation:verification.dialog.validUntil', { date: format.date(claim.permitExpiresOn) }),
      ]
        .filter(Boolean)
        .join(' · ')
    default:
      return `${claim.name} · ${claim.issuer} · ${format.month(claim.issuedOn)}`
  }
}

/** Review dialog of one submission (M-166): details, then Approve or Reject with a reason (≤ 300). */
export default function VerificationReview({ id, onDecided, onClose }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { data: item, error } = useGetVerificationSubmissionQuery(id)
  const [decideVerification, { isLoading }] = useDecideVerificationMutation()
  const [pending, setPending] = useState(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(null)
  const [failure, setFailure] = useState(null)
  const max = config?.limits.verificationReason.max
  const dialog = (key, params) => t(`moderation:verification.dialog.${key}`, params)

  async function confirm() {
    const trimmed = reason.trim()
    if (pending === 'rejected' && !trimmed) return setReasonError({ key: 'required' })
    if (trimmed.length > max) return setReasonError({ key: 'too_long', params: { max } })
    try {
      await decideVerification({ id, decision: pending, ...(pending === 'rejected' && { reason: trimmed }) }).unwrap()
      onDecided(dialog('decidedNow'))
      onClose()
    } catch (failed) {
      setReasonError(serverFieldErrors(failed).reason ?? null)
      if (errorCode(failed) !== 'VALIDATION_FAILED') setFailure(failed)
    }
  }

  let body
  if (!item) body = <p className={detailStyles.contextText}>{error ? errorText.code(error) : t('common:loading')}</p>
  else if (pending)
    body = (
      <div>
        <h3 className={dialogStyles.confirmTitle}>{dialog(pending === 'approved' ? 'approveTitle' : 'rejectTitle')}</h3>
        <p className={dialogStyles.confirmText}>{dialog(pending === 'approved' ? 'approveText' : 'rejectText')}</p>
        {pending === 'rejected' && (
          <TextareaField
            className={dialogStyles.reason}
            label={dialog('reasonLabel')}
            name="reason"
            hint={dialog('reasonHint', { max })}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setReasonError(null)
            }}
            error={errorText.field('reason', reasonError)}
            rows={3}
            data-autofocus
          />
        )}
        {failure && (
          <p className={styles.failure} role="alert">
            {errorText.code(failure)}
          </p>
        )}
        <div className={dialogStyles.actions}>
          <Button variant="outline" onClick={() => setPending(null)}>
            {dialog('back')}
          </Button>
          <Button variant={pending === 'rejected' ? 'danger' : 'primary'} loading={isLoading} onClick={confirm}>
            {dialog(pending === 'approved' ? 'confirmApprove' : 'confirmReject')}
          </Button>
        </div>
      </div>
    )
  else {
    const open = item.status === 'in_review' && !item.reset
    body = (
      <div>
        <div className={styles.candidate}>
          <Avatar name={item.candidate.fullName} src={item.candidate.photoUrl ?? undefined} size={40} />
          <div>
            <h3 className={detailStyles.accountName}>{item.candidate.fullName}</h3>
            <p className={detailStyles.accountMeta}>{item.candidate.email}</p>
          </div>
          <PillBadge tone={STATUS_TONES[item.status]}>{t(`enums:verificationStatus.${item.status}`)}</PillBadge>
        </div>
        <dl className={detailStyles.facts}>
          <dt>{dialog('check')}</dt>
          <dd>{t(`enums:verificationCategory.${item.category}`)}</dd>
          {item.evidenceType && (
            <>
              <dt>{dialog('evidence')}</dt>
              <dd>{t(`enums:evidenceType.${item.evidenceType}`)}</dd>
            </>
          )}
          <dt>{dialog('submitted')}</dt>
          <dd>{format.dateTime(item.submittedAt)}</dd>
        </dl>
        <div className={detailStyles.context}>
          <p className={detailStyles.eyebrow}>{dialog('claim')}</p>
          <p className={cx(detailStyles.contextText, styles.claim)} data-claim>
            <Claim category={item.category} claim={item.claim} />
          </p>
        </div>
        {item.file && (
          <div className={detailStyles.context}>
            <p className={detailStyles.eyebrow}>{dialog('file')}</p>
            <EvidenceFile file={item.file} />
          </div>
        )}
        {!open && item.reviewedAt && (
          <p className={dialogStyles.previous}>
            {dialog('decided', { status: t(`enums:verificationStatus.${item.status}`), name: item.reviewedBy, date: format.dateTime(item.reviewedAt) })}
            {item.reason && ` ${dialog('reason', { reason: item.reason })}`}
          </p>
        )}
        {item.history.length > 0 && (
          <div className={styles.history}>
            <p className={detailStyles.eyebrow}>{dialog('history')}</p>
            <ul>
              {item.history.map((previous) => (
                <li key={previous.id}>
                  {t(`enums:verificationStatus.${previous.status}`)} · {format.dateTime(previous.submittedAt)}
                  {previous.reason && ` · ${dialog('reason', { reason: previous.reason })}`}
                </li>
              ))}
            </ul>
          </div>
        )}
        {open && (
          <div className={dialogStyles.actions}>
            <Button variant="outline" className={dialogStyles.danger} leftIcon={<Icon as={X} size={13} />} onClick={() => setPending('rejected')}>
              {dialog('reject')}
            </Button>
            <Button leftIcon={<Icon as={Check} size={13} />} onClick={() => setPending('approved')}>
              {dialog('approve')}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Modal open onClose={onClose} title={dialog('title')} width={600} divided>
      {body}
    </Modal>
  )
}
