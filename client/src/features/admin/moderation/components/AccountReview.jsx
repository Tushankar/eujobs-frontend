import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, CircleCheck, FileText, Pause, X } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import { Avatar, Button, CompanyLogo, Icon, Modal, Skeleton, SkeletonRegion, TextareaField } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useDecideAccountMutation, useGetAccountQuery } from '../api.js'
import { ACCOUNT_TONES } from '../tones.js'
import DocumentViewer from './DocumentViewer.jsx'
import dialogStyles from './ReviewDialog.module.css'
import detailStyles from './ReviewDetails.module.css'
import styles from './VerificationReview.module.css'
import accountStyles from './AccountReview.module.css'
import { useMarkSeen } from '@/features/notifications/api.js'

const ICONS = { approved: Check, rejected: X, suspended: Pause }
const DECISION_TONES = { approved: 'success', rejected: 'danger', suspended: 'danger' }

/** The recruiter's details while they load: the person, the contact checks and the company record. */
function ReviewSkeleton() {
  const { t } = useTranslation()
  const dialog = (key) => t(`moderation:accounts.dialog.${key}`)
  const rows = (keys) =>
    keys.map((key) => (
      <div key={key}>
        <span className={accountStyles.skeletonLabel}>{dialog(key)}</span>
        <Skeleton width={140} height={12} />
      </div>
    ))
  return (
    <SkeletonRegion className={styles.details}>
      <div className={styles.person}>
        <Skeleton shape="circle" width={44} height={44} />
        <div className={styles.personText}>
          <p className={styles.personName}>
            <Skeleton width={160} height={16} />
          </p>
          <p className={styles.personEmail}>
            <Skeleton width={220} />
          </p>
        </div>
        <Skeleton shape="pill" />
      </div>
      <div className={cx(accountStyles.card, accountStyles.facts, accountStyles.contact)}>{rows(['email', 'phone', 'submittedAt'])}</div>
      <div className={accountStyles.card}>
        <div className={accountStyles.companyHead}>
          <Skeleton shape="block" width={40} height={40} />
          <div className={styles.personText}>
            <p className={accountStyles.companyName}>
              <Skeleton width={140} height={14} />
            </p>
            <p className={styles.personEmail}>
              <Skeleton width={120} />
            </p>
          </div>
        </div>
        <p className={accountStyles.cardLabel}>{dialog('company')}</p>
        <div className={accountStyles.facts}>{rows(['legalName', 'businessEmail', 'industry', 'size'])}</div>
      </div>
    </SkeletonRegion>
  )
}

/**
 * Review dialog of one recruiter (§3.12, M-165, OQ-2): the selected KYC file on the left (`documents.view`);
 * applicant, contact checks, company record, documents and earlier decisions on the right; the decisions the server
 * allows for this status in the footer, with a reason (required for Reject and Suspend, ≤ 300, P4-D4).
 */
export default function AccountReview({ userId, onDecided, onClose }) {
  // P11b-Q10: opening this item marks its notifications read.
  useMarkSeen('account', userId)
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
  const [selectedId, setSelectedId] = useState(null)
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

  if (!account) {
    return (
      <Modal open onClose={onClose} title={dialog('title')} width={600}>
        {error ? <p className={detailStyles.contextText}>{errorText.code(error)}</p> : <ReviewSkeleton />}
      </Modal>
    )
  }

  const { company } = account
  const notProvided = dialog('notProvided')
  // The viewer shows one stored file at a time; deleted files (M-186) stay listed without a preview.
  const stored = account.documents.filter((document) => document.fileId)
  const shown = stored.find((document) => document.id === selectedId) ?? stored[0]

  let footer = null
  if (pending)
    footer = (
      <>
        <Button variant="secondary" onClick={() => setPending(null)}>
          {dialog('back')}
        </Button>
        <Button variant={pending === 'approved' ? 'primary' : 'danger'} loading={isLoading} onClick={confirm}>
          {dialog(`confirm.${actionKey(pending)}.button`)}
        </Button>
      </>
    )
  else if (account.actions.length > 0)
    footer = account.actions.map((decision) => (
      <Button
        key={decision}
        variant={decision === 'approved' ? 'primary' : 'outline'}
        className={decision === 'approved' ? undefined : dialogStyles.danger}
        leftIcon={<Icon as={ICONS[decision]} size={13} />}
        onClick={() => {
          setPending(decision)
          setReason('')
          setReasonError(null)
          setFailure(null)
        }}
      >
        {dialog(`action.${actionKey(decision)}`)}
      </Button>
    ))

  // A passed check in green, anything else muted.
  const check = (ok, okKey, failKey) => (
    <span className={cx(accountStyles.checkNote, ok && accountStyles.passed)}>
      {ok && <Icon as={CircleCheck} size={13} />}
      {dialog(ok ? okKey : failKey)}
    </span>
  )
  const contact = [
    ['email', check(account.emailVerified, 'emailVerified', 'emailUnverified')],
    [
      'phone',
      account.phone.e164 ? (
        <>
          <span>{account.phone.e164}</span>
          {check(account.phone.verified, 'phoneConfirmed', 'phoneUnconfirmed')}
        </>
      ) : (
        notProvided
      ),
    ],
    account.submittedAt && ['submittedAt', format.dateTime(account.submittedAt)],
  ].filter(Boolean)

  const facts = company
    ? [
        ['legalName', company.legalName],
        ['businessEmail', company.businessEmail],
        ['industry', company.industry],
        ['size', company.size && t(`enums:companySize.${company.size}`)],
        ['location', company.location && t('common:city.value', { city: company.location.city, country: format.country(company.location.countryCode) })],
        ['businessAddress', company.businessAddress],
        ['registrationDetails', company.registrationDetails],
      ]
    : []

  return (
    <Modal open onClose={onClose} title={dialog('title')} width={shown ? 1040 : 600} footer={footer}>
      <div className={cx(styles.review, shown && styles.withFile)}>
        {shown && (
          <div className={styles.document}>
            <DocumentViewer key={shown.id} file={{ id: shown.fileId, name: shown.name, mime: shown.mime }} />
          </div>
        )}
        <div className={styles.details}>
          <div className={styles.person}>
            <Avatar name={account.fullName} size={44} />
            <div className={styles.personText}>
              <div className={accountStyles.nameRow}>
                <h3 className={styles.personName}>{account.fullName}</h3>
                <PillBadge tone="neutral">{t('enums:role.recruiter')}</PillBadge>
              </div>
              <p className={styles.personEmail}>{[account.jobTitle, account.email].filter(Boolean).join(' · ')}</p>
            </div>
            <PillBadge tone={ACCOUNT_TONES[account.status]}>{t(`moderation:accounts.status.${account.status}`)}</PillBadge>
          </div>

          <dl className={cx(accountStyles.card, accountStyles.facts, accountStyles.contact)}>
            {contact.map(([key, value]) => (
              <div key={key}>
                <dt>{dialog(key)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          {company && (
            <section className={accountStyles.card}>
              <div className={accountStyles.companyHead}>
                <CompanyLogo name={company.displayName} id={company.id} src={company.logoUrl ?? undefined} size={40} />
                <div className={styles.personText}>
                  <p className={accountStyles.companyName}>{company.displayName}</p>
                  {company.website ? (
                    <a className={accountStyles.website} href={company.website} target="_blank" rel="noopener noreferrer">
                      {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  ) : (
                    <p className={styles.personEmail}>{notProvided}</p>
                  )}
                </div>
              </div>
              <p className={accountStyles.cardLabel}>{dialog('company')}</p>
              <dl className={accountStyles.facts}>
                {facts.map(([key, value]) => (
                  <div key={key}>
                    <dt>{dialog(key)}</dt>
                    <dd className={cx(!value && accountStyles.missing)}>{value || notProvided}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <div>
            <p className={styles.sectionLabel}>{dialog('documents')}</p>
            {account.documents.length === 0 ? (
              <p className={styles.decided}>{dialog('noDocuments')}</p>
            ) : (
              <ul className={accountStyles.documents}>
                {account.documents.map((document) => (
                  <li key={document.id}>
                    <button
                      type="button"
                      className={cx(accountStyles.document, document.id === shown?.id && accountStyles.selected)}
                      disabled={!document.fileId}
                      aria-pressed={document.id === shown?.id}
                      onClick={() => setSelectedId(document.id)}
                    >
                      <Icon as={FileText} size={16} />
                      <span className={accountStyles.documentText}>
                        <span className={accountStyles.documentType}>{dialog(`documentType.${document.type}`)}</span>
                        <span className={accountStyles.documentMeta}>{document.fileId ? `${document.name} · ${format.date(document.uploadedAt)}` : dialog('fileDeleted')}</span>
                      </span>
                      {document.fileId && <Icon as={ChevronRight} size={14} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {account.history.length > 0 && (
            <div>
              <p className={styles.sectionLabel}>{dialog('history')}</p>
              <ul className={styles.timeline}>
                {account.history.map((entry) => (
                  <li key={`${entry.decision}-${entry.at}`}>
                    <PillBadge tone={DECISION_TONES[entry.decision]}>{dialog(`decision.${entry.decision}`)}</PillBadge>
                    <span>
                      {[entry.by, format.dateTime(entry.at)].filter(Boolean).join(' · ')}
                      {entry.reason && ` · ${dialog('reason', { reason: entry.reason })}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {account.actions.length === 0 && account.status === 'rejected' && <p className={styles.decided}>{dialog('noActions')}</p>}

          {pending && (
            <div className={cx(styles.confirm, pending !== 'approved' && styles.confirmReject)}>
              <h3 className={styles.confirmTitle}>{dialog(`confirm.${actionKey(pending)}.title`)}</h3>
              <p className={styles.confirmText}>{dialog(`confirm.${actionKey(pending)}.text`)}</p>
              <TextareaField
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
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
