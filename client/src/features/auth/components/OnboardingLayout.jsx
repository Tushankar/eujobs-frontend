import { useCallback, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { ArrowRight, Building2, Check, ShieldCheck } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Button, Icon } from '@/components/ui'
import { BRAND } from '@/app/brand.js'
import BrandLogo from '@/components/layout/BrandLogo.jsx'
import { ONBOARDING_STEPS } from '../data/onboarding.js'
import { useOnboardingState } from '../utils/useOnboardingState.js'
import styles from './OnboardingLayout.module.css'

const REVIEW_INDEX = ONBOARDING_STEPS.length - 1

/**
 * Shell of the recruiter onboarding (Figma frames "Account registration" to "Admin review &
 * approval"): header, step sidebar and the step card with its progress bar. The step pages
 * render in the card through <Outlet> and read the shared state with useOnboarding().
 *
 * Progress (non-sensitive field values and completed steps) is kept in localStorage; passwords
 * and OTP codes live in `secrets`, which is memory only. A step can only be opened once every
 * step before it is complete, otherwise the user is sent to the first open step.
 */
export default function OnboardingLayout() {
  const { pathname } = useLocation()
  const { data, saveData, completed, completeStep } = useOnboardingState()
  const [secrets, setSecrets] = useState({})
  const saveSecrets = useCallback((patch) => setSecrets((current) => ({ ...current, ...patch })), [])

  const currentId = pathname.replace(/\/+$/, '').split('/').pop()
  const currentIndex = ONBOARDING_STEPS.findIndex((step) => step.id === currentId)
  // Moving back slides the next step in from the left, moving forward from the right.
  const [travel, setTravel] = useState({ index: currentIndex, direction: 'forward' })
  if (travel.index !== currentIndex) {
    setTravel({ index: currentIndex, direction: currentIndex < travel.index ? 'back' : 'forward' })
  }
  const firstOpenIndex = ONBOARDING_STEPS.findIndex((step, index) => index < REVIEW_INDEX && !completed.includes(step.id))
  const furthestIndex = firstOpenIndex === -1 ? REVIEW_INDEX : firstOpenIndex

  if (currentIndex === -1 || currentIndex > furthestIndex) {
    return <Navigate to={ONBOARDING_STEPS[furthestIndex].path} replace />
  }

  const percent = ((currentIndex + 1) / ONBOARDING_STEPS.length) * 100
  const isLastStep = currentIndex === REVIEW_INDEX

  function stepState(step, index) {
    if (index === currentIndex) return 'current'
    return completed.includes(step.id) ? 'done' : 'todo'
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/recruiter/sign-in" aria-label={BRAND.name}>
            <BrandLogo height={30} />
          </Link>
          <div className={styles.headerAside}>
            <span>Already registered?</span>
            <Button as={Link} to="/recruiter/sign-in" variant="outline" rightIcon={<Icon as={ArrowRight} size={13} />}>
              Sign in
            </Button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <aside className={styles.sidebar}>
          <div className={styles.intro}>
            <span className={styles.introIcon}>
              <Icon as={Building2} size={19} />
            </span>
            <p className={styles.eyebrow}>Recruiter verification</p>
            <h1 className={styles.title}>Create a trusted hiring account</h1>
            <p className={styles.description}>Verify your identity and organisation before accessing recruiter tools.</p>
          </div>

          <nav className={styles.steps} aria-label="Application progress">
            <ol>
              {ONBOARDING_STEPS.map((step, index) => {
                const state = stepState(step, index)
                return (
                  <li
                    key={step.id}
                    className={cx(styles.step, state === 'current' && styles.stepCurrent)}
                    aria-current={state === 'current' ? 'step' : undefined}
                  >
                    <span className={cx(styles.marker, styles[`marker_${state}`])}>
                      {state === 'done' ? <Icon as={Check} size={13} strokeWidth={2.2} className={styles.markerCheck} /> : index + 1}
                    </span>
                    <span>
                      <span className={cx(styles.stepLabel, styles[`label_${state}`])}>{step.label}</span>
                      <span className={styles.stepStatus}>
                        {state === 'current' ? 'In progress' : state === 'done' ? 'Completed' : 'Not started'}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </nav>

          <div className={styles.privacy}>
            <Icon as={ShieldCheck} size={17} className={styles.privacyIcon} />
            <div>
              <p className={styles.privacyTitle}>Private by design</p>
              <p className={styles.privacyText}>
                Non-sensitive details are saved on this device. Passwords, codes, and selected files are never retained.
              </p>
            </div>
          </div>
        </aside>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.progressRow}>
              <p className={styles.stepCount} key={currentIndex}>
                Step {currentIndex + 1} of {ONBOARDING_STEPS.length}
              </p>
              <span className={cx(styles.percentBadge, isLastStep && styles.percentBadgeReview)} key={`percent-${currentIndex}`}>
                {percent}% complete
              </span>
            </div>
            <div
              className={styles.track}
              role="progressbar"
              aria-label="Onboarding progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div className={cx(styles.fill, 'grow-x')} style={{ width: `${percent}%` }} />
            </div>
          </div>
          <div className={styles.cardBody} key={currentId} data-direction={travel.direction}>
            <Outlet context={{ data, saveData, completed, completeStep, secrets, saveSecrets }} />
          </div>
        </section>
      </main>
    </div>
  )
}
