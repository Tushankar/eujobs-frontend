import { Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import { cx } from '@/utils/cx.js'
import { TOTAL_STEPS } from '../data/onboarding.js'
import styles from './OnboardingStep.module.css'

/**
 * Shared frame of the two profile-completion steps: "Step N of 2" eyebrow, title and lead,
 * a centred white card for the step's content and an optional action row beneath it.
 * `size` picks the card width from the Figma frames (wide 768 px, narrow 672 px).
 */
export default function OnboardingStep({ step, stepName, title, lead, size = 'wide', children, footer }) {
  return (
    <>
      <PageTitle eyebrow={`Step ${step} of ${TOTAL_STEPS} · ${stepName}`} title={title} description={lead} />
      <div className={cx(styles.column, styles[size])}>
        <Panel padding={0}>
          <div className={styles.card}>{children}</div>
        </Panel>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </>
  )
}
