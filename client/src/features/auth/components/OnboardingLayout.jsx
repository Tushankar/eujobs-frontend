import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Building2, Check, LogOut, ShieldCheck } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Button, Icon } from '@/components/ui'
import { BRAND } from '@/app/brand.js'
import { signOut } from '@/app/session.js'
import BrandLogo from '@/components/layout/BrandLogo.jsx'
import { useGetOnboardingQuery } from '../api.js'
import { ONBOARDING_STEPS } from '../data/onboarding.js'
import styles from './OnboardingLayout.module.css'

const REVIEW_INDEX = ONBOARDING_STEPS.length - 1

/**
 * Shell of the recruiter onboarding (Figma frames "Account registration" to "Admin review & approval"): header,
 * step sidebar and the step card with its progress bar. The state comes from GET /recruiter/onboarding (M-151,
 * P4-D2); a step opens only when every step before it is done, otherwise the first open step is shown.
 */
export default function OnboardingLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: state } = useGetOnboardingQuery(undefined, { refetchOnMountOrArgChange: true })

  const currentId = pathname.replace(/\/+$/, '').split('/').pop()
  const currentIndex = ONBOARDING_STEPS.findIndex((step) => step.id === currentId)
  // Moving back slides the next step in from the left, moving forward from the right.
  const [travel, setTravel] = useState({ index: currentIndex, direction: 'forward' })
  if (travel.index !== currentIndex) {
    setTravel({ index: currentIndex, direction: currentIndex < travel.index ? 'back' : 'forward' })
  }
  if (!state) return null

  const furthestIndex = ONBOARDING_STEPS.findIndex((step) => step.id === state.currentStep)
  if (currentIndex === -1 || currentIndex > furthestIndex) {
    return <Navigate to={ONBOARDING_STEPS[furthestIndex].path} replace />
  }

  const percent = ((currentIndex + 1) / ONBOARDING_STEPS.length) * 100
  const isLastStep = currentIndex === REVIEW_INDEX

  function stepState(step, index) {
    if (index === currentIndex) return 'current'
    return state.steps[step.id] ? 'done' : 'todo'
  }

  function handleSignOut() {
    signOut()
    navigate('/recruiter/sign-in', { replace: true })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/recruiter/onboarding" aria-label={BRAND.name}>
            <BrandLogo height={30} />
          </Link>
          <div className={styles.headerAside}>
            <span>{t('auth:onboarding.signedInAs', { email: state.account.email })}</span>
            <Button variant="outline" onClick={handleSignOut} rightIcon={<Icon as={LogOut} size={13} />}>
              {t('auth:onboarding.signOut')}
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
            <p className={styles.eyebrow}>{t('auth:onboarding.eyebrow')}</p>
            <h1 className={styles.title}>{t('auth:onboarding.title')}</h1>
            <p className={styles.description}>{t('auth:onboarding.description')}</p>
          </div>

          <nav className={styles.steps} aria-label={t('auth:onboarding.progressLabel')}>
            <ol>
              {ONBOARDING_STEPS.map((step, index) => {
                const status = stepState(step, index)
                return (
                  <li key={step.id} className={cx(styles.step, status === 'current' && styles.stepCurrent)} aria-current={status === 'current' ? 'step' : undefined}>
                    <span className={cx(styles.marker, styles[`marker_${status}`])}>
                      {status === 'done' ? <Icon as={Check} size={13} strokeWidth={2.2} className={styles.markerCheck} /> : index + 1}
                    </span>
                    <span>
                      <span className={cx(styles.stepLabel, styles[`label_${status}`])}>{t(`auth:onboarding.steps.${step.id}`)}</span>
                      <span className={styles.stepStatus}>{t(`auth:onboarding.stepState.${status}`)}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </nav>

          <div className={styles.privacy}>
            <Icon as={ShieldCheck} size={17} className={styles.privacyIcon} />
            <div>
              <p className={styles.privacyTitle}>{t('auth:onboarding.privacyTitle')}</p>
              <p className={styles.privacyText}>{t('auth:onboarding.privacyText')}</p>
            </div>
          </div>
        </aside>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.progressRow}>
              <p className={styles.stepCount} key={currentIndex}>
                {t('auth:onboarding.stepCount', { current: currentIndex + 1, total: ONBOARDING_STEPS.length })}
              </p>
              <span className={cx(styles.percentBadge, isLastStep && styles.percentBadgeReview)} key={`percent-${currentIndex}`}>
                {t('auth:onboarding.percent', { percent })}
              </span>
            </div>
            <div className={styles.track} role="progressbar" aria-label={t('auth:onboarding.progressBar')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <div className={cx(styles.fill, 'grow-x')} style={{ width: `${percent}%` }} />
            </div>
          </div>
          <div className={styles.cardBody} key={currentId} data-direction={travel.direction}>
            <Outlet context={{ state }} />
          </div>
        </section>
      </main>
    </div>
  )
}
