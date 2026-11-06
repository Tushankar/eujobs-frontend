import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Icon } from '@/components/ui'
import styles from './PlanFeatures.module.css'

/** What a paid plan includes, from its plan record in the reader's language (M-116, P11d-Q9). */
export default function PlanFeatures({ plan, className }) {
  const { t } = useTranslation('billing')
  if (!plan?.features?.length) return null
  return (
    <div className={className}>
      <p className={styles.title}>{t('includes', { plan: plan.name })}</p>
      <ul className={styles.list} data-plan-features={plan.key}>
        {plan.features.map((feature) => (
          <li key={feature}>
            <Icon as={Check} size={15} strokeWidth={2.2} className={styles.check} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
