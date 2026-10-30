import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import { formatPrice } from '../hooks/useRecruiterLearning.js'

/** Confirms a (pretend) course purchase. No payment method is requested; the course is only marked purchased locally. */
export default function PurchaseDialog({ course, onConfirm, onClose }) {
  return (
    <ConfirmDialog
      open={Boolean(course)}
      title={course ? `Buy “${course.title}”?` : ''}
      description="Recruiter learning is a local prototype state. No payment method is requested and nothing is charged. The course is only marked as purchased in this browser."
      confirmLabel={course ? `Confirm purchase · ${formatPrice(course.price)}` : 'Confirm'}
      onConfirm={() => onConfirm(course)}
      onClose={onClose}
    />
  )
}
