import { useState } from 'react'
import { Button, Icon, Modal, TextareaField } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './ReviewDialog.module.css'

const MAX_REASON_LENGTH = 300

/**
 * Review dialog shared by reported content and pending accounts. Step 1 shows the details (`children`) and the
 * decision buttons; choosing one opens step 2, where the admin writes a reason (required for restrictive
 * decisions) and confirms. Nothing is saved until step 2 is confirmed.
 * `actionsAlign` = 'start' left-aligns the decision buttons (the pending-account frame); default 'end'.
 * `actions` = [{ id, label, icon, variant, reasonRequired, confirmTitle, confirmText, confirmLabel }].
 */
export default function ReviewDialog({ title, actions, previous, actionsAlign = 'end', onDecide, onClose, children }) {
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
    if (pending.reasonRequired && !trimmed) {
      setError('Add a reason so the decision has a clear record.')
      return
    }
    if (trimmed.length > MAX_REASON_LENGTH) {
      setError(`Keep the reason to ${MAX_REASON_LENGTH} characters or fewer.`)
      return
    }
    onDecide(pending, trimmed)
  }

  return (
    <Modal open onClose={onClose} title={title} width={512} divided>
      {pending ? (
        <div>
          <h3 className={styles.confirmTitle}>{pending.confirmTitle}</h3>
          <p className={styles.confirmText}>{pending.confirmText}</p>
          <TextareaField
            className={styles.reason}
            label={pending.reasonRequired ? 'Reason' : 'Reason (optional)'}
            hint="Saved with the decision on this device and recorded in the audit log."
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setError('')
            }}
            error={error}
            rows={3}
            data-autofocus
          />
          <div className={styles.actions}>
            <Button variant="outline" onClick={() => setPending(null)}>
              Back
            </Button>
            <Button variant={pending.variant === 'danger' ? 'danger' : 'primary'} onClick={confirm}>
              {pending.confirmLabel}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {children}
          {previous && (
            <p className={styles.previous}>
              <strong>{previous.label}.</strong> {previous.reason ? `Reason: ${previous.reason}` : 'No reason was added.'} You
              can record a new decision below.
            </p>
          )}
          <div className={cx(styles.actions, actionsAlign === 'start' && styles.actionsStart)}>
            {actions.map((action) => (
              <Button
                key={action.id}
                variant={action.variant === 'danger' ? 'outline' : action.variant}
                className={cx(action.variant === 'danger' && styles.danger)}
                leftIcon={action.icon && <Icon as={action.icon} size={13} />}
                onClick={() => choose(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
