import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Crown, X } from 'lucide-react'
import { useFinishTourMutation } from '@/app/api.js'
import { endTour, startTour } from '@/app/tour.js'
import { openUpgrade } from '@/app/upgrade.js'
import { workspacePath } from '@/app/workspaces.js'
import { Button, Icon, IconButton, Modal, Skeleton, SkeletonRegion } from '@/components/ui'
import { usePlan } from '@/features/candidate/billing/usePlan.js'
import PlanFeatures from '@/features/payments/components/PlanFeatures.jsx'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { TOURS } from './steps.js'
import styles from './ProductTour.module.css'

const START = { phase: 'welcome', index: 0, onPage: false }
// Space between the highlighted element and the card, and between the card and the window edge.
const GAP = 14
const EDGE = 16
const HOLE_PADDING = 6

/** Where the card goes: right of the target, else below, else above, else over its bottom-right corner; centred without one. */
function placeCard(rect, width, height) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clampTop = (top) => Math.max(EDGE, Math.min(top, vh - height - EDGE))
  const clampLeft = (left) => Math.max(EDGE, Math.min(left, vw - width - EDGE))
  if (!rect) return { top: clampTop((vh - height) / 2), left: clampLeft((vw - width) / 2) }
  if (rect.right + GAP + width <= vw - EDGE) return { top: clampTop(rect.top), left: rect.right + GAP }
  if (rect.bottom + GAP + height <= vh - EDGE) return { top: rect.bottom + GAP, left: clampLeft(rect.left) }
  if (rect.top - GAP - height >= EDGE) return { top: rect.top - GAP - height, left: clampLeft(rect.left) }
  return { top: vh - height - EDGE, left: clampLeft(rect.right - width - EDGE) }
}

const same = (a, b, keys) => a === b || Boolean(a && b && keys.every((key) => Math.round(a[key]) === Math.round(b[key])))

/**
 * Follows `selector` every frame (the page may still be loading, scrolling or resizing): the hole around it and the
 * card beside it. The element is scrolled into view once, when it first shows up.
 */
function useSpotlight(selector, cardRef) {
  const [layout, setLayout] = useState({ hole: null, card: null })
  useEffect(() => {
    let frame
    let scrolled = false
    function tick() {
      const element = document.querySelector(selector)
      const box = element?.getBoundingClientRect()
      const shown = box && box.width > 0 && box.height > 0 && box.right > 0 && box.left < window.innerWidth
      if (shown && !scrolled) {
        scrolled = true
        element.scrollIntoView({ block: box.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth' })
      }
      const hole = shown
        ? { top: box.top - HOLE_PADDING, left: box.left - HOLE_PADDING, width: box.width + HOLE_PADDING * 2, height: box.height + HOLE_PADDING * 2 }
        : null
      const target = hole && { ...hole, right: hole.left + hole.width, bottom: hole.top + hole.height }
      const card = cardRef.current && placeCard(target, cardRef.current.offsetWidth, cardRef.current.offsetHeight)
      setLayout((current) => (same(current.hole, hole, ['top', 'left', 'width', 'height']) && same(current.card, card, ['top', 'left']) ? current : { hole, card }))
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [selector, cardRef])
  return layout
}

/** One step's card over the dimmed page: the sidebar item first, then (after "Take me there") the page's main action. */
function StepCard({ workspace, view, onBack, onNext, onGo, onClose }) {
  const { t } = useTranslation()
  const titleId = useId()
  const cardRef = useRef(null)
  const primaryRef = useRef(null)
  const { steps } = TOURS[workspace.id]
  const step = steps[view.index]
  const selector = view.onPage ? step.target : `#workspace-sidebar a[href="${workspacePath(workspace, step.to)}"]`
  const { hole, card } = useSpotlight(selector, cardRef)
  const last = view.index === steps.length - 1
  const text = (part) => t(`tour:${workspace.id}.steps.${step.key}.${view.onPage ? `page${part[0].toUpperCase()}${part.slice(1)}` : part}`)

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true })
  }, [view])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className={styles.layer}>
      {/* Clicks outside the card do nothing while the tour runs. */}
      <div className={cx(styles.blocker, !hole && styles.dim)} />
      {hole && <div className={styles.hole} style={hole} aria-hidden="true" />}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(styles.card, card && styles.cardPlaced)}
        style={card ? { top: card.top, left: card.left } : undefined}
        data-tour-card={`${step.key}${view.onPage ? '-page' : ''}`}
      >
        <div className={styles.cardHead}>
          <p className={styles.progressText}>
            {t('tour:card.progress', { current: view.index + 1, total: steps.length })}
            {view.onPage && <span className={styles.onPage}> · {t('tour:card.onPage')}</span>}
          </p>
          <IconButton icon={X} label={t('tour:card.skip')} onClick={onClose} />
        </div>
        <div className={styles.segments} aria-hidden="true">
          {steps.map((item, index) => (
            <span key={item.key} className={cx(styles.segment, index <= view.index && styles.segmentDone)} />
          ))}
        </div>
        <h2 id={titleId} className={styles.cardTitle}>
          {text('title')}
        </h2>
        <p className={styles.cardText}>{text('text')}</p>
        <div className={styles.cardFooter}>
          {(view.index > 0 || view.onPage) && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              {t('tour:card.back')}
            </Button>
          )}
          {view.onPage ? (
            <Button ref={primaryRef} size="sm" onClick={onNext} rightIcon={!last && <Icon as={ArrowRight} size={14} />}>
              {t(last ? 'tour:card.finish' : 'tour:card.next')}
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onNext}>
                {t(last ? 'tour:card.finish' : 'tour:card.next')}
              </Button>
              <Button ref={primaryRef} size="sm" onClick={onGo} rightIcon={<Icon as={ArrowRight} size={14} />}>
                {t('tour:card.go')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * The welcome dialog's plan card: the role's paid plan (Plus, Recruiter Plus) with its price in the reader's currency
 * and what it includes, from the plan record; "You're on …" once it is paid.
 */
function PlanOffer({ onUpgrade }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { isPlus, plus, loading } = usePlan()
  if (loading) {
    return (
      <SkeletonRegion className={styles.offer}>
        <Skeleton width={110} height={16} />
        <Skeleton width={140} height={28} />
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} width="85%" />
        ))}
      </SkeletonRegion>
    )
  }
  if (!plus) return null
  return (
    <section className={styles.offer} data-tour-plan={isPlus ? 'active' : 'offer'}>
      <p className={styles.offerName}>
        <Icon as={Crown} size={15} strokeWidth={2} />
        {plus.name}
      </p>
      {isPlus ? (
        <p className={styles.offerNote}>{t('tour:plan.active', { plan: plus.name })}</p>
      ) : (
        plus.price && (
          <p className={styles.offerPrice}>
            <strong>{format.money(plus.price.amountMinor, plus.price.currency)}</strong>
            <span>{t('billing:perMonth')}</span>
          </p>
        )
      )}
      <PlanFeatures plan={plus} className={styles.offerFeatures} />
      {!isPlus && (
        <div className={styles.offerAction}>
          <Button variant="outline" fullWidth onClick={onUpgrade}>
            {t('tour:plan.upgrade', { plan: plus.name })}
          </Button>
          <p className={styles.offerNote}>{t('tour:plan.free')}</p>
        </div>
      )}
    </section>
  )
}

/**
 * The first-login product tour of the candidate and recruiter workspaces: a welcome dialog, one spotlight step per
 * core page, and a closing dialog. It opens by itself on the Overview while /me says `tourPending`; finishing or
 * skipping it at any point records that (POST /me/tour), and the profile menu or Help page replays it.
 */
export default function ProductTour({ workspace }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { me } = usePreferences()
  const open = useSelector((state) => state.tour.open)
  const [finishTour] = useFinishTourMutation()
  const [view, setView] = useState(START)
  const autoOpened = useRef(false)
  const tour = TOURS[workspace.id]

  useEffect(() => {
    if (autoOpened.current || !me?.tourPending || me.legal?.acceptRequired || pathname !== workspace.basePath) return
    autoOpened.current = true
    dispatch(startTour())
  }, [me, pathname, workspace.basePath, dispatch])

  function close() {
    dispatch(endTour())
    setView(START)
    if (me?.tourPending) finishTour()
  }

  const showStep = (index, onPage = false) => setView({ phase: 'step', index, onPage })
  const step = tour.steps[view.index]
  const role = workspace.id
  const firstName = me?.fullName?.split(' ')[0] ?? ''

  function next() {
    if (view.index + 1 < tour.steps.length) showStep(view.index + 1)
    else setView({ ...view, phase: 'done' })
  }

  function back() {
    if (view.onPage) showStep(view.index)
    else showStep(view.index - 1)
  }

  function go() {
    navigate(workspacePath(workspace, step.to))
    showStep(view.index, true)
  }

  function upgrade() {
    close()
    dispatch(openUpgrade())
  }

  function finishWith() {
    navigate(workspacePath(workspace, tour.done))
    close()
  }

  return (
    <>
      <Modal
        open={open && view.phase === 'welcome'}
        onClose={close}
        width={800}
        title={t('tour:welcome.title', { name: firstName })}
        description={t(`tour:${role}.welcomeText`)}
        footer={
          <div className={styles.modalFooter}>
            <span className={styles.duration}>{t('tour:welcome.duration')}</span>
            <Button variant="ghost" onClick={close}>
              {t('tour:welcome.skip')}
            </Button>
            <Button data-autofocus onClick={() => showStep(0)} rightIcon={<Icon as={ArrowRight} size={14} />}>
              {t('tour:welcome.start')}
            </Button>
          </div>
        }
      >
        <div className={styles.welcome}>
          <ol className={styles.plan}>
            {tour.steps.map((item, index) => (
              <li key={item.key} className={styles.planRow}>
                <span className={styles.planNumber}>{index + 1}</span>
                <span className={styles.planText}>
                  <span className={styles.planTitle}>{t(`tour:${role}.steps.${item.key}.title`)}</span>
                  <span className={styles.planSummary}>{t(`tour:${role}.steps.${item.key}.summary`)}</span>
                </span>
              </li>
            ))}
          </ol>
          <PlanOffer onUpgrade={upgrade} />
        </div>
      </Modal>

      {open && view.phase === 'step' && <StepCard workspace={workspace} view={view} onBack={back} onNext={next} onGo={go} onClose={close} />}

      <Modal
        open={open && view.phase === 'done'}
        onClose={close}
        width={480}
        title={t('tour:done.title')}
        description={t(`tour:${role}.doneText`)}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="ghost" onClick={close}>
              {t('tour:done.explore')}
            </Button>
            <Button data-autofocus onClick={finishWith} rightIcon={<Icon as={ArrowRight} size={14} />}>
              {t(`tour:${role}.doneAction`)}
            </Button>
          </div>
        }
      >
        <p className={styles.replay}>{t('tour:done.replay')}</p>
      </Modal>
    </>
  )
}
