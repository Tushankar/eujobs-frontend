import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Lock } from 'lucide-react'
import { Button, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import { useAgencySetup } from '../useAgencySetup.js'
import styles from './AgencySetup.module.css'

/**
 * 2026-11-23 (owner: "first add your client, then post a job… users need to understand the flow"): the agency's
 * setup in order: client, agreement, a published agency job, people on the books, a placement. Each row is done or
 * to do (a locked one says what it waits for); the next step has the main button. `title`/`text` fit the page it is on;
 * `hideWhenDone` leaves it out once everything is done (the Overview).
 */
export default function AgencySetup({ title, text, hideWhenDone = false, className }) {
  const { t } = useTranslation()
  const { loading, steps, next, doneCount, complete } = useAgencySetup()

  if (loading) {
    return (
      <SkeletonRegion className={cx(styles.card, className)}>
        <Skeleton width="40%" height={22} />
        {steps.map((step) => (
          <Skeleton key={step.key} height={56} />
        ))}
      </SkeletonRegion>
    )
  }
  if (hideWhenDone && complete) return null

  return (
    <section className={cx(styles.card, className)} aria-labelledby="agency-setup-title" data-agency-setup={next?.key ?? 'done'} data-get-started>
      <div className={styles.head}>
        <div>
          <h2 id="agency-setup-title" className={styles.title}>
            {title ?? t('agency:setup.title')}
          </h2>
          <p className={styles.text}>{text ?? t('agency:setup.text')}</p>
        </div>
        <div className={styles.progress}>
          <p className={styles.progressText}>{t('agency:setup.progress', { done: doneCount, total: steps.length })}</p>
          <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label={t('agency:setup.progress', { done: doneCount, total: steps.length })}>
            <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
        </div>
      </div>
      <ol className={styles.steps}>
        {steps.map((step, index) => {
          const isNext = next?.key === step.key
          return (
            <li key={step.key} className={cx(styles.step, step.done && styles.done, step.locked && !step.done && styles.locked, isNext && styles.next)} data-setup-step={step.key}>
              <span className={styles.marker} aria-hidden="true">
                {step.done ? <Icon as={Check} size={14} strokeWidth={3} /> : step.locked ? <Icon as={Lock} size={13} /> : index + 1}
              </span>
              <span className={styles.body}>
                <span className={styles.stepTitle}>{t(`agency:setup.steps.${step.key}.title`)}</span>
                <span className={styles.stepText}>{step.locked && !step.done ? t(`agency:setup.steps.${step.key}.locked`) : t(`agency:setup.steps.${step.key}.text`)}</span>
              </span>
              <span className={styles.action}>
                {step.done ? (
                  <span className={styles.doneLabel}>{t('agency:setup.done')}</span>
                ) : step.locked ? null : isNext ? (
                  <Button as={Link} to={step.to} size="sm" rightIcon={<Icon as={ArrowRight} size={13} />} data-tour={step.key === 'job' ? 'job-create' : undefined}>
                    {t('agency:setup.start')}
                  </Button>
                ) : (
                  <Button as={Link} to={step.to} size="sm" variant="outline" data-tour={step.key === 'job' ? 'job-create' : undefined}>
                    {t('agency:setup.open')}
                  </Button>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
