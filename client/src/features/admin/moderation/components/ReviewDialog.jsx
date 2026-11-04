import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Icon, Modal, TextareaField } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './ReviewDialog.module.css'

/**
 * Review dialog of a content case (M-167). Step 1 shows the details (`children`) and the decision buttons; choosing
 * one opens step 2, where the admin writes a reason (required for restrictive decisions, ≤ `maxReason`) and confirms.
 * `extra(action)` adds controls to step 2 (the photo removal). Nothing is saved until step 2 is confirmed.
 * `actions` = [{ id, label, icon, variant, reasonRequired, confirmTitle, confirmText, confirmLabel }].
 */
export default function ReviewDialog({ title, actions, maxReason, extra, busy, error: serverError, onDecide, onClose, children }) {
  const { t } = useTranslation('moderation')
  const [pending, setPending] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  function choose(action) {
    setPending(action)
    setReason('')
    setError('')
  }

  function confirm() {
    const trimmed = reason.trim()
    if (pending.reasonRequired && !trimmed) return setError(t('content.reasonRequired'))
    if (trimmed.length > maxReason) return setError(t('content.reasonTooLong', { max: maxReason }))
    onDecide(pending, trimmed)
  }

  return (
    <Modal open onClose={onClose} title={title} width={560} divided>
      {pending ? (
        <div data-decision-step={pending.id}>
          <h3 className={styles.confirmTitle}>{pending.confirmTitle}</h3>
          <p className={styles.confirmText}>{pending.confirmText}</p>
          <TextareaField
            className={styles.reason}
            name="reason"
            label={t(pending.reasonRequired ? 'content.reason' : 'content.reasonOptional')}
            hint={t('content.reasonHint')}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setError('')
            }}
            error={error}
            rows={3}
            data-autofocus
          />
          {extra?.(pending)}
          {serverError && (
            <p className={styles.serverError} role="alert">
              {serverError}
            </p>
          )}
          <div className={styles.actions}>
            <Button variant="outline" onClick={() => setPending(null)}>
              {t('content.back')}
            </Button>
            <Button variant={pending.variant === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={confirm}>
              {pending.confirmLabel}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {children}
          {actions.length > 0 && (
            <div className={styles.actions}>
              {actions.map((action) => (
                <Button
                  key={action.id}
                  variant={action.variant === 'danger' ? 'outline' : action.variant}
                  className={cx(action.variant === 'danger' && styles.danger)}
                  leftIcon={action.icon && <Icon as={action.icon} size={13} />}
                  onClick={() => choose(action)}
                  data-action={action.id}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
