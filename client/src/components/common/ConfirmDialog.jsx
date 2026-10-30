import { useTranslation } from 'react-i18next'
import { Button, Modal } from '@/components/ui'

/**
 * Confirmation dialog built on Modal. `tone="danger"` styles the confirm button as destructive.
 * The caller closes it (set `open` false) from `onConfirm` and `onClose`.
 */
export default function ConfirmDialog({ open, title, description, children, confirmLabel, cancelLabel, tone = 'primary', onConfirm, onClose }) {
  const { t } = useTranslation()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width={440}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel ?? t('common:cancel')}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel ?? t('common:confirm')}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
