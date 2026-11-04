import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ScanSearch, X } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { Avatar, Button, Icon, Modal, TextareaField } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { SUBMISSION_TONES } from '@/features/admin/shared/tones.js'
import { useDecideVerificationMutation, useGetVerificationSubmissionQuery } from '../api.js'
import DocumentViewer from './DocumentViewer.jsx'
import dialogStyles from './ReviewDialog.module.css'
import detailStyles from './ReviewDetails.module.css'
import styles from './VerificationReview.module.css'

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

  if (!item) {
    return (
      <Modal open onClose={onClose} title={dialog('title')} width={600}>
        <p className={detailStyles.contextText}>{error ? errorText.code(error) : t('common:loading')}</p>
      </Modal>
    )
  }

  const open = item.status === 'in_review' && !item.reset
  // Footer: Reject / Approve on an open submission; Back / Confirm while a decision is being confirmed.
  let footer = null
  if (pending)
    footer = (
      <>
        <Button variant="secondary" onClick={() => setPending(null)}>
          {dialog('back')}
        </Button>
        <Button variant={pending === 'rejected' ? 'danger' : 'primary'} loading={isLoading} onClick={confirm}>
          {dialog(pending === 'approved' ? 'confirmApprove' : 'confirmReject')}
        </Button>
      </>
    )
  else if (open)
    footer = (
      <>
        <Button variant="outline" className={dialogStyles.danger} leftIcon={<Icon as={X} size={13} />} onClick={() => setPending('rejected')}>
          {dialog('reject')}
        </Button>
        <Button leftIcon={<Icon as={Check} size={13} />} onClick={() => setPending('approved')}>
          {dialog('approve')}
        </Button>
      </>
    )

  const summary = [
    [dialog('check'), t(`enums:verificationCategory.${item.category}`)],
    item.evidenceType && [dialog('evidence'), t(`enums:evidenceType.${item.evidenceType}`)],
    [dialog('submitted'), format.dateTime(item.submittedAt)],
  ].filter(Boolean)

  return (
    <Modal open onClose={onClose} title={dialog('title')} width={item.file ? 1040 : 560} footer={footer}>
      {/* Two panes: the document on the left, what it must match and the decision on the right. */}
      <div className={cx(styles.review, item.file && styles.withFile)}>
        {item.file && (
          <div className={styles.document}>
            <DocumentViewer file={item.file} />
          </div>
        )}
        <div className={styles.details}>
          <div className={styles.person}>
            <Avatar name={item.candidate.fullName} src={item.candidate.photoUrl ?? undefined} size={44} />
            <div className={styles.personText}>
              <h3 className={styles.personName}>{item.candidate.fullName}</h3>
              <p className={styles.personEmail}>{item.candidate.email}</p>
            </div>
            <PillBadge tone={SUBMISSION_TONES[item.status]}>{t(`enums:verificationStatus.${item.status}`)}</PillBadge>
          </div>

          <dl className={styles.summary}>
            {summary.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div className={styles.match}>
            <p className={styles.matchLabel}>
              <Icon as={ScanSearch} size={14} />
              {dialog('claim')}
            </p>
            <p className={styles.matchValue} data-claim>
              <Claim category={item.category} claim={item.claim} />
            </p>
          </div>

          {!open && item.reviewedAt && (
            <p className={styles.decided}>
              {dialog('decided', { status: t(`enums:verificationStatus.${item.status}`), name: item.reviewedBy, date: format.dateTime(item.reviewedAt) })}
              {item.reason && ` ${dialog('reason', { reason: item.reason })}`}
            </p>
          )}

          {item.history.length > 0 && (
            <div>
              <p className={styles.sectionLabel}>{dialog('history')}</p>
              <ul className={styles.timeline}>
                {item.history.map((previous) => (
                  <li key={previous.id}>
                    <PillBadge tone={SUBMISSION_TONES[previous.status]}>{t(`enums:verificationStatus.${previous.status}`)}</PillBadge>
                    <span>
                      {format.dateTime(previous.submittedAt)}
                      {previous.reason && ` · ${dialog('reason', { reason: previous.reason })}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pending && (
            <div className={cx(styles.confirm, pending === 'rejected' && styles.confirmReject)}>
              <h3 className={styles.confirmTitle}>{dialog(pending === 'approved' ? 'approveTitle' : 'rejectTitle')}</h3>
              <p className={styles.confirmText}>{dialog(pending === 'approved' ? 'approveText' : 'rejectText')}</p>
              {pending === 'rejected' && (
                <TextareaField
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
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
