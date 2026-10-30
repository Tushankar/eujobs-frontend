import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'

/**
 * Buying a course: a paid course goes through the demo checkout, a free one is simply added. Either way
 * `onConfirm` (which marks the course purchased) only runs once the payment succeeds or the free course is added.
 */
export default function PurchaseDialog({ course, onConfirm, onClose }) {
  const paid = Boolean(course) && course.price > 0

  return (
    <>
      <CheckoutDialog
        item={paid ? { kind: 'course', id: course.id, name: course.title, amount: course.price, caption: course.access ?? 'One-time course access' } : null}
        payerRole="recruiter"
        onPaid={() => onConfirm(course)}
        onClose={onClose}
      />
      <ConfirmDialog
        open={Boolean(course) && !paid}
        title={course ? `Add “${course.title}”?` : ''}
        description="This course is free. It will be added to your learning and saved in this browser."
        confirmLabel="Add course"
        onConfirm={() => onConfirm(course)}
        onClose={onClose}
      />
    </>
  )
}
