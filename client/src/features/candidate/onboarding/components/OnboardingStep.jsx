import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import PageTitle from '@/components/common/PageTitle.jsx'
import { cx } from '@/utils/cx.js'
import styles from './OnboardingStep.module.css'

// The onboarding steps in order (M-014): the two profile steps, then the plan.
const STEPS = ['story', 'preferences', 'plan']

/** The stepper over every step: done steps ticked, the current one filled, the next ones dashed. */
function Stepper({ step }) {
  const { t } = useTranslation()
  return (
    <div className={styles.progress}>
      <ol className={styles.stepper} aria-label={t('onboarding:progress', { step, total: STEPS.length })}>
        {STEPS.map((key, index) => {
          const state = index + 1 < step ? 'done' : index + 1 === step ? 'current' : 'next'
          return (
            <li key={key} className={cx(styles.stepItem, styles[state])} aria-current={state === 'current' ? 'step' : undefined}>
              <span className={styles.marker}>{state === 'done' ? <Icon as={Check} size={13} strokeWidth={3} /> : index + 1}</span>
              <span className={styles.stepLabel}>{t(`onboarding:${key}.name`)}</span>
            </li>
          )
        })}
      </ol>
      <p className={styles.count}>{t('onboarding:progress', { step, total: STEPS.length })}</p>
    </div>
  )
}

/**
 * Shared frame of the onboarding steps: the stepper, title and lead, the step's content in a white card with its
 * `actions` in a ruled row at the bottom, and `aside` pinned beside it on wide windows (below it on narrow ones).
 * `framed={false}` leaves the content without the card (the plan step's own plan cards).
 */
export default function OnboardingStep({ step, title, lead, children, actions, aside, framed = true }) {
  return (
    <div className={styles.page}>
      <Stepper step={step} />
      <PageTitle title={title} description={lead} />
      <div className={styles.layout}>
        <div className={styles.main}>
          {framed ? (
            <Panel padding={0}>
              <div className={styles.card}>{children}</div>
              {actions && <div className={styles.actions}>{actions}</div>}
            </Panel>
          ) : (
            <>
              {children}
              {actions && <div className={cx(styles.actions, styles.actionsBare)}>{actions}</div>}
            </>
          )}
        </div>
        {aside && <aside className={cx(styles.aside, 'sticky-side')}>{aside}</aside>}
      </div>
    </div>
  )
}
