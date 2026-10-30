import { useTranslation } from 'react-i18next'
import { Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import { cx } from '@/utils/cx.js'
import styles from './OnboardingStep.module.css'

// The two profile steps before the plan step (M-014).
const TOTAL_STEPS = 2

/**
 * Shared frame of the two profile steps: "Step N of 2" eyebrow, title and lead,
 * a centred white card for the step's content and an optional action row beneath it.
 * `size` picks the card width from the Figma frames (wide 768 px, narrow 672 px).
 */
export default function OnboardingStep({ step, stepName, title, lead, size = 'wide', children, footer }) {
  const { t } = useTranslation()
  return (
    <>
      <PageTitle eyebrow={t('onboarding:step', { step, total: TOTAL_STEPS, name: stepName })} title={title} description={lead} />
      <div className={cx(styles.column, styles[size])}>
        <Panel padding={0}>
          <div className={styles.card}>{children}</div>
        </Panel>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </>
  )
}
