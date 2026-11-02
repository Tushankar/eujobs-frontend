import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Pause, X } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { Button, Icon, Modal, TextareaField } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useDecideAccountMutation, useGetAccountQuery } from '../api.js'
import { ACCOUNT_TONES } from '../data/moderation.js'
import FilePreview from './FilePreview.jsx'
import dialogStyles from './ReviewDialog.module.css'
import detailStyles from './ReviewDetails.module.css'
import styles from './VerificationReview.module.css'
import accountStyles from './AccountReview.module.css'

const ICONS = { approved: Check, rejected: X, suspended: Pause }

/**
 * Review dialog of one recruiter (§3.12, M-165, OQ-2): applicant, company record, contact checks, KYC files
 * (`documents.view`), dates and earlier decisions; then the decisions the server allows for this status, with a
 * reason (required for Reject and Suspend, ≤ 300, P4-D4).
 */
export default function AccountReview({ userId, onDecided, onClose }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { data: account, error } = useGetAccountQuery(userId)
  const [decideAccount, { isLoading }] = useDecideAccountMutation()
  const [pending, setPending] = useState(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(null)
  const [failure, setFailure] = useState(null)
  const max = config?.limits.accountDecisionReason.max
  const dialog = (key, params) => t(`moderation:accounts.dialog.${key}`, params)
  // Approving a suspended account reactivates it (OQ-2).
  const actionKey = (decision) => (decision === 'approved' && account?.status === 'suspended' ? 'reactivate' : decision)
  const reasonRequired = pending && pending !== 'approved'

  async function confirm() {
    const trimmed = reason.trim()
    if (reasonRequired && !trimmed) return setReasonError({ key: 'required' })
    if (trimmed.length > max) return setReasonError({ key: 'too_long', params: { max } })
    try {
      await decideAccount({ userId, decision: pending, ...(trimmed && { reason: trimmed }) }).unwrap()
      onDecided(dialog('decidedNow'))
      onClose()
    } catch (failed) {
      setReasonError(serverFieldErrors(failed).reason ?? null)
      if (errorCode(failed) !== 'VALIDATION_FAILED') setFailure(failed)
    }
  }

  let body
  if (!account) body = <p className={detailStyles.contextText}>{error ? errorText.code(error) : t('common:loading')}</p>
  else if (pending)
    body = (
      <div>
        <h3 className={dialogStyles.confirmTitle}>{dialog(`confirm.${actionKey(pending)}.title`)}</h3>
        <p className={dialogStyles.confirmText}>{dialog(`confirm.${actionKey(pending)}.text`)}</p>
        <TextareaField
          className={dialogStyles.reason}
          label={dialog(reasonRequired ? 'reasonLabel' : 'reasonOptional')}
          name="reason"
          hint={dialog('reasonHint', { max })}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            setReasonError(null)
          }}
          error={errorText.field('decisionReason', reasonError)}
          rows={3}
          data-autofocus
        />
        {failure && (
          <p className={styles.failure} role="alert">
            {errorText.code(failure)}
          </p>
        )}
        <div className={dialogStyles.actions}>
          <Button variant="outline" onClick={() => setPending(null)}>
            {dialog('back')}
          </Button>
          <Button variant={pending === 'approved' ? 'primary' : 'danger'} loading={isLoading} onClick={confirm}>
            {dialog(`confirm.${actionKey(pending)}.button`)}
          </Button>
        </div>
      </div>
    )
  else {
    const { company } = account
    const notProvided = dialog('notProvided')
    const facts = company
      ? [
          ['legalName', company.legalName],
          ['displayName', company.displayName],
          ['website', company.website],
          ['businessEmail', company.businessEmail],
          ['industry', company.industry],
          ['size', company.size && t(`enums:companySize.${company.size}`)],
          ['location', company.location && t('common:city.value', { city: company.location.city, country: format.country(company.location.countryCode) })],
          ['businessAddress', company.businessAddress],
          ['registrationDetails', company.registrationDetails],
        ]
      : []
    body = (
      <div>
        <div className={styles.candidate}>
          <div>
            <h3 className={detailStyles.accountName}>{account.fullName}</h3>
            <p className={detailStyles.accountMeta}>{[account.jobTitle, account.email].filter(Boolean).join(' · ')}</p>
          </div>
          <PillBadge tone={ACCOUNT_TONES[account.status]}>{t(`moderation:accounts.status.${account.status}`)}</PillBadge>
        </div>
        <dl className={detailStyles.facts}>
          <dt>{dialog('email')}</dt>
          <dd>{dialog(account.emailVerified ? 'emailVerified' : 'emailUnverified')}</dd>
          <dt>{dialog('phone')}</dt>
          <dd>{account.phone.e164 ? `${account.phone.e164} · ${dialog(account.phone.verified ? 'phoneConfirmed' : 'phoneUnconfirmed')}` : notProvided}</dd>
          {account.submittedAt && (
            <>
              <dt>{dialog('submittedAt')}</dt>
              <dd>{format.dateTime(account.submittedAt)}</dd>
            </>
          )}
        </dl>
        {company && (
          <div className={detailStyles.context}>
            <p className={detailStyles.eyebrow}>{dialog('company')}</p>
            <dl className={cx(detailStyles.facts, accountStyles.facts)}>
              {facts.map(([key, value]) => (
                <div key={key} className={accountStyles.fact}>
                  <dt>{dialog(key)}</dt>
                  <dd>{value || notProvided}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div className={detailStyles.context}>
          <p className={detailStyles.eyebrow}>{dialog('documents')}</p>
          {account.documents.length === 0 && <p className={detailStyles.contextText}>{dialog('noDocuments')}</p>}
          <ul className={accountStyles.documents}>
            {account.documents.map((document) => (
              <li key={document.id}>
                <p className={detailStyles.contextText}>
                  <strong>{dialog(`documentType.${document.type}`)}</strong> · {format.date(document.uploadedAt)}
                </p>
                {document.fileId ? (
                  <FilePreview file={{ id: document.fileId, name: document.name, mime: document.mime }} />
                ) : (
                  <p className={detailStyles.contextText}>{dialog('fileDeleted')}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
        {account.history.length > 0 && (
          <div className={styles.history}>
            <p className={detailStyles.eyebrow}>{dialog('history')}</p>
            <ul>
              {account.history.map((entry) => (
                <li key={`${entry.decision}-${entry.at}`}>
                  {dialog('decided', { decision: dialog(`decision.${entry.decision}`), name: entry.by ?? '', date: format.dateTime(entry.at) })}
                  {entry.reason && ` · ${dialog('reason', { reason: entry.reason })}`}
                </li>
              ))}
            </ul>
          </div>
        )}
        {account.actions.length === 0 ? (
          account.status === 'rejected' && <p className={dialogStyles.previous}>{dialog('noActions')}</p>
        ) : (
          <div className={dialogStyles.actions}>
            {account.actions.map((decision) => (
              <Button
                key={decision}
                variant={decision === 'approved' ? 'primary' : 'outline'}
                className={decision === 'approved' ? undefined : dialogStyles.danger}
                leftIcon={<Icon as={ICONS[decision]} size={13} />}
                onClick={() => {
                  setPending(decision)
                  setReason('')
                  setReasonError(null)
                }}
              >
                {dialog(`action.${actionKey(decision)}`)}
              </Button>
            ))}
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
