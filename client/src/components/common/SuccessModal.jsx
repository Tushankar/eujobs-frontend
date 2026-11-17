import { useId, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { Button, Modal } from '@/components/ui'
import styles from './SuccessModal.module.css'

// Eight stars around the check: angle (degrees), distance (px), size (px), tone. Fixed, so every modal looks the same.
const STARS = [
  { angle: -90, distance: 74, size: 14, tone: 'gold' },
  { angle: -40, distance: 82, size: 10, tone: 'navy' },
  { angle: 5, distance: 78, size: 13, tone: 'gold' },
  { angle: 50, distance: 70, size: 9, tone: 'navy' },
  { angle: 95, distance: 76, size: 11, tone: 'gold' },
  { angle: 140, distance: 80, size: 10, tone: 'navy' },
  { angle: 185, distance: 74, size: 13, tone: 'gold' },
  { angle: 230, distance: 70, size: 9, tone: 'navy' },
]

function Star({ size }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 1.5l2.6 6.9 7.4.4-5.8 4.6 2 7.1L12 16.4l-6.2 4.1 2-7.1L2 8.8l7.4-.4z" fill="currentColor" />
    </svg>
  )
}

/**
 * The success modal of a big moment (owner 2026-11-17): a check that draws itself in a green circle, gold and navy
 * stars that burst out once and fade, then the title, message and "what happens next" rising in. Under reduced motion
 * everything only fades. `primary` = { label, to | onClick }; the secondary button closes.
 */
export default function SuccessModal({ open, onClose, title, message, steps = [], stepsTitle, primary, closeLabel, ...rest }) {
  const titleId = useId()
  const root = useRef(null)

  useLayoutEffect(() => {
    if (!open || !root.current) return undefined
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia()
      mm.add({ full: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
        if (conditions.reduce) {
          timeline.from('[data-success-rise]', { opacity: 0, duration: 0.4, stagger: 0.05 })
          gsap.set('[data-success-star]', { opacity: 0 })
          return
        }
        timeline
          .from('[data-success-ring]', { scale: 0.4, opacity: 0, duration: 0.5, ease: 'back.out(1.8)' })
          .fromTo('[data-success-check]', { strokeDashoffset: 48 }, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out' }, '-=0.15')
          .fromTo(
            '[data-success-star]',
            { x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 },
            {
              x: (index) => Math.cos((STARS[index].angle * Math.PI) / 180) * STARS[index].distance,
              y: (index) => Math.sin((STARS[index].angle * Math.PI) / 180) * STARS[index].distance,
              scale: 1,
              rotate: (index) => (index % 2 ? 140 : -140),
              duration: 0.8,
              stagger: 0.02,
            },
            '-=0.35',
          )
          .to('[data-success-star]', { opacity: 0, scale: 0.6, duration: 0.6, stagger: 0.02, ease: 'power1.in' }, '-=0.15')
          .from('[data-success-rise]', { y: 16, opacity: 0, duration: 0.55, stagger: 0.07, clearProps: 'transform,opacity' }, 0.35)
      })
    }, root)
    return () => ctx.revert()
  }, [open])

  const primaryButton =
    primary &&
    (primary.to ? (
      <Button as={Link} to={primary.to} onClick={onClose} data-success-primary>
        {primary.label}
      </Button>
    ) : (
      <Button onClick={primary.onClick} data-success-primary>
        {primary.label}
      </Button>
    ))

  return (
    <Modal open={open} onClose={onClose} width={460} labelledBy={titleId} className={styles.modal}>
      <div ref={root} className={styles.success} {...rest}>
        <div className={styles.badge}>
          {STARS.map((star, index) => (
            <span key={index} className={`${styles.star} ${styles[star.tone]}`} data-success-star>
              <Star size={star.size} />
            </span>
          ))}
          <span className={styles.ring} data-success-ring>
            <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
              <path d="M13 25l7 7 15-16" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="48" data-success-check />
            </svg>
          </span>
        </div>
        <h2 id={titleId} className={styles.title} data-success-rise>
          {title}
        </h2>
        {message && (
          <p className={styles.message} data-success-rise>
            {message}
          </p>
        )}
        {steps.length > 0 && (
          <div className={styles.next} data-success-rise>
            {stepsTitle && <p className={styles.nextTitle}>{stepsTitle}</p>}
            <ol className={styles.steps}>
              {steps.map((step, index) => (
                <li key={step}>
                  <span className={styles.stepNumber}>{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className={styles.actions} data-success-rise>
          {primaryButton}
          <Button variant="secondary" onClick={onClose} data-success-close>
            {closeLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
