import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import styles from './FormDialog.module.css'

/**
 * Frame of the My profile editors (OD16): a Modal whose footer submits the form inside it, with the
 * failure message for errors that belong to no field. The caller keys it per opening so its state starts fresh.
 */
export default function FormDialog({ open, title, description, submitLabel, onClose, onSubmit, busy, failure, width = 560, children }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const formId = useId()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width={width}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {submitLabel ?? t('profile:form.save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {children}
        {failure && (
          <p className={styles.failure} role="alert">
            {errorText.code(failure)}
          </p>
        )}
      </form>
    </Modal>
  )
}
