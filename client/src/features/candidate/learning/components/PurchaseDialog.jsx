import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'

/**
 * Buying a course: a priced course goes through the demo checkout and `onConfirm` runs only after a successful
 * payment; a free course is just confirmed, with no payment recorded.
 */
export default function PurchaseDialog({ course, onConfirm, onClose }) {
  const paid = Boolean(course) && course.price > 0
  return (
    <>
      <CheckoutDialog
        item={paid ? { kind: 'course', id: course.id, name: course.title, amount: course.price, caption: 'One-time course access' } : null}
        payerRole="candidate"
        onPaid={() => onConfirm(course)}
        onClose={onClose}
      />
      <ConfirmDialog
        open={Boolean(course) && !paid}
        title={course ? `Add “${course.title}”?` : ''}
        description="This course is free, so there is nothing to pay. It is added to your learning in this browser."
        confirmLabel="Add course"
        onConfirm={() => onConfirm(course)}
        onClose={onClose}
      />
    </>
  )
}
