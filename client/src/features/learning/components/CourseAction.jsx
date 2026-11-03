import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, ShoppingCart } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import CheckoutDialog from '@/features/payments/components/CheckoutDialog.jsx'
import { useEnrollFreeMutation } from '../api.js'
import { nextLessonId, useLearningPath } from '../useCourseText.js'

/**
 * The course's main action: continue learning once enrolled, enrol in a free course, or buy a paid one through the
 * confirm step and Stripe's hosted Checkout (M-124; recruiters buy for themselves, M-112).
 */
export default function CourseAction({ course, fullWidth = true }) {
  const { t } = useTranslation('learning')
  const errorText = useErrorText()
  const base = useLearningPath()
  const [enrollFree, { isLoading, error }] = useEnrollFreeMutation()
  const [buying, setBuying] = useState(false)

  if (course.enrollment) {
    const started = course.enrollment.lessonsDone > 0
    return (
      <Button as={Link} to={`${base}/${course.id}/lessons/${nextLessonId(course)}`} fullWidth={fullWidth} rightIcon={<Icon as={ArrowRight} size={14} />} data-course-action="continue">
        {t(started ? 'action.continue' : 'action.start')}
      </Button>
    )
  }
  if (course.isFree) {
    return (
      <>
        <Button fullWidth={fullWidth} loading={isLoading} onClick={() => enrollFree(course.id)} data-course-action="enrol">
          {t('action.enrol')}
        </Button>
        {error && <p role="alert">{errorText.code(error)}</p>}
      </>
    )
  }
  return (
    <>
      <Button fullWidth={fullWidth} leftIcon={<Icon as={ShoppingCart} size={14} />} disabled={!course.price} onClick={() => setBuying(true)} data-course-action="buy">
        {t('action.buy')}
      </Button>
      <CheckoutDialog item={buying ? { kind: 'course', itemId: course.id } : null} description={t('action.buyDescription', { title: course.title })} onClose={() => setBuying(false)} />
    </>
  )
}
