import { useTranslation } from 'react-i18next'
import { Crown } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Icon } from '@/components/ui'
import styles from './PlanBadge.module.css'

/** True when the user is on a paid plan (candidate Plus, Recruiter Plus). */
export const isPaidPlan = (me) => me?.plan === 'plus' || me?.plan === 'recruiter_plus'

/** The paid plan's premium badge (profile menu, sidebar): a flat gold pill with a crown. `small` for the sidebar. */
export default function PlanBadge({ me, small = false }) {
  const { t } = useTranslation()
  if (!isPaidPlan(me)) return null
  return (
    <span className={cx(styles.badge, small && styles.small)} data-plan-badge>
      <Icon as={Crown} size={small ? 10 : 12} strokeWidth={2} />
      {t(`enums:planKey.${me.plan}`)}
    </span>
  )
}
