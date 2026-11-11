import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CircleHelp, Crown, LogOut, Settings2 } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Avatar, Icon, IconButton } from '@/components/ui'
import { can } from '@/app/permissions.js'
import { workspacePath } from '@/app/workspaces.js'
import { signOut } from '@/app/session.js'
import { openUpgrade } from '@/app/upgrade.js'
import PlanChip from '@/features/candidate/billing/components/PlanChip.jsx'
import { lacksEntitlement, usePlan } from '@/features/candidate/billing/usePlan.js'
import { useSectionBadge } from '@/features/notifications/api.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import aiSparkle from '@/assets/icons/ai-sparkle-blue.svg'
import aiNavIcon from '@/assets/icons/ai-nav.svg'
import aiNavIconActive from '@/assets/icons/ai-sparkle-blue-16.svg'
import BrandLogo from './BrandLogo.jsx'
import { identitySubtitle } from './identity.js'
import PlanBadge from './PlanBadge.jsx'
import { isPaidPlan } from '@/lib/plans.js'
import logoMark from '@/assets/images/logo-mark.png'
import styles from './Sidebar.module.css'

/** A badge whose text a hook computes (e.g. the live count of active applications); none when the hook returns null (M-094). */
function LiveBadge({ useText, className, name }) {
  const text = useText()
  return text ? (
    <span className={className} data-nav-badge={name}>
      {text}
    </span>
  ) : null
}

function SectionBadge({ section }) {
  const { t } = useTranslation()
  const text = useSectionBadge(section)
  return text ? (
    <span className={cx(styles.badge, styles.badgeAlert)} data-notification-badge={section} aria-label={t('notifications:bell.labelUnread', { count: Number(text) })}>
      {text}
    </span>
  ) : null
}

function NavItem({ workspace, item, me }) {
  const { t } = useTranslation()
  const locked = item.entitlement && lacksEntitlement(me, item.entitlement, [workspace.id])
  return (
    <NavLink
      to={workspacePath(workspace, item.to)}
      end={item.end}
      className={({ isActive }) => cx(styles.link, isActive && styles.active)}
    >
      {({ isActive }) => (
        <>
          {item.icon || (isActive && item.activeIcon) ? (
            <Icon as={isActive && item.activeIcon ? item.activeIcon : item.icon} size={17} />
          ) : (
            <img src={isActive && item.iconSrc === aiNavIcon ? aiNavIconActive : item.iconSrc} alt="" className={styles.customIcon} />
          )}
          <span className={styles.linkLabel}>{t(`shell:nav.${item.key}`)}</span>
          {locked && <PlanChip />}
          {!locked && item.badge?.useText && <LiveBadge useText={item.badge.useText} className={styles.badge} name={item.key} />}
          {!locked && item.badge?.textKey && <span className={cx(styles.badge, item.badge.tone === 'ai' && styles.badgeAi)}>{t(`shell:${item.badge.textKey}`)}</span>}
          {/* P11b-Q10: unread notifications of this section; Messages keeps only its unread-messages badge. */}
          {item.key !== 'messages' && <SectionBadge section={item.key} />}
        </>
      )}
    </NavLink>
  )
}

/**
 * M-196: the candidate promo card: the Plus upsell with the price (Free), "Complete your profile" (Plus with an
 * incomplete profile), or none.
 */
function usePromo(workspace, me) {
  const { isPlus, plus } = usePlan()
  if (!workspace.promo || me?.role !== 'candidate') return null
  if (!isPlus) return plus?.price ? { kind: 'upsell', plus } : null
  return me.completeness?.complete ? null : { kind: 'complete' }
}

/** The Free upsell, LinkedIn Premium style: white card, the logo mark beside the gold Plus chip, the price, a gold button. */
function UpsellCard({ plus }) {
  const { t } = useTranslation()
  const format = useFormat()
  const dispatch = useDispatch()
  const plan = plus.name
  return (
    <div className={styles.upsell} data-promo="upsell">
      <div className={styles.upsellHead}>
        <img src={logoMark} alt="" className={styles.upsellLogo} />
        <span className={styles.upsellCrown}>
          <Icon as={Crown} size={11} strokeWidth={2.4} /> {plan}
        </span>
      </div>
      <p className={styles.upsellTitle}>{t('shell:promo.upsellTitle', { plan })}</p>
      <p className={styles.upsellText}>{t('shell:promo.upsellPerks')}</p>
      <p className={styles.upsellPrice}>
        <strong>{format.money(plus.price.amountMinor, plus.price.currency)}</strong> {t('shell:promo.perMonth')}
      </p>
      <button type="button" className={styles.upsellButton} onClick={() => dispatch(openUpgrade())}>
        {t('shell:promo.upsellLink', { plan })}
        <Icon as={ArrowRight} size={14} />
      </button>
    </div>
  )
}

function PromoCard({ workspace, promo }) {
  const { t } = useTranslation()
  if (promo.kind === 'upsell') return <UpsellCard plus={promo.plus} />
  return (
    <div className={styles.promo} data-promo={promo.kind}>
      <div className={styles.promoTitle}>
        <img src={aiSparkle} alt="" width={14} height={14} />
        <p>{t('shell:promo.title')}</p>
      </div>
      <p className={styles.promoText}>{t('shell:promo.text')}</p>
      <Link to={workspacePath(workspace, workspace.promo.to)} className={styles.promoLink}>
        {t('shell:promo.link')}
        <Icon as={ArrowRight} size={12} />
      </Link>
    </div>
  )
}

/** The active-item highlight glides to the new item on navigation (GSAP); placed instantly the first time. */
function useNavIndicator(navRef, indicatorRef, pathname, itemCount) {
  const placed = useRef(false)
  useGSAP(
    () => {
      const indicator = indicatorRef.current
      const active = navRef.current?.querySelector(`.${styles.active}`)
      if (!indicator) return
      if (!active) {
        gsap.to(indicator, { autoAlpha: 0, duration: 0.2 })
        return
      }
      const to = { y: active.offsetTop, height: active.offsetHeight, autoAlpha: 1 }
      if (!placed.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.set(indicator, to)
      else gsap.to(indicator, { ...to, duration: 0.45, ease: 'power3.out', overwrite: true })
      placed.current = true
    },
    { dependencies: [pathname, itemCount] },
  )
}

export default function Sidebar({ workspace, open, onClose }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { me } = usePreferences()
  const promo = usePromo(workspace, me)
  const navItems = workspace.nav.filter((item) => can(me, item.permission))
  const navRef = useRef(null)
  const indicatorRef = useRef(null)
  useNavIndicator(navRef, indicatorRef, pathname, navItems.length)

  function handleSignOut() {
    signOut()
    navigate(workspace.signInPath)
  }

  return (
    <>
      <div className={cx(styles.scrim, open && styles.scrimOpen)} onClick={onClose} aria-hidden="true" />
      <aside
        id="workspace-sidebar"
        className={cx(styles.sidebar, open && styles.open)}
        data-workspace={workspace.id}
        aria-label={t(`shell:workspaces.${workspace.id}.navigation`)}
      >
        <Link to={workspace.basePath} className={styles.brand} aria-label={t('shell:brandHome')}>
          <BrandLogo height={45} />
        </Link>

        <div className={styles.navArea}>
          <p className={styles.sectionLabel}>{t('shell:sidebar.section')}</p>
          <nav ref={navRef} className={cx(styles.nav, 'stagger')} aria-label={t('shell:sidebar.section')}>
            <span ref={indicatorRef} className={styles.indicator} aria-hidden="true" />
            {navItems.map((item) => (
              <NavItem key={item.to} workspace={workspace} item={item} me={me} />
            ))}
          </nav>
        </div>

        <div className={styles.footer}>
          {promo && <PromoCard workspace={workspace} promo={promo} />}

          <NavLink
            to={workspacePath(workspace, 'settings')}
            className={({ isActive }) => cx(styles.utility, promo && styles.utilityAfterPromo, isActive && styles.utilityActive)}
          >
            <Icon as={Settings2} size={17} />
            {t('shell:sidebar.settings')}
          </NavLink>
          <NavLink
            to={workspacePath(workspace, 'help')}
            className={({ isActive }) => cx(styles.utility, isActive && styles.utilityActive)}
          >
            <Icon as={CircleHelp} size={17} />
            <span className={styles.utilityLabel}>{t('shell:sidebar.help')}</span>
            <Icon as={ArrowUpRight} size={13} />
          </NavLink>

          {me && (
            <div className={styles.user}>
              <Avatar name={me.fullName} src={(me.photoUrl ?? me.company?.logoUrl) ?? undefined} size={32} className={styles.avatar} />
              <div className={styles.userText}>
                <p className={styles.userName}>{me.fullName}</p>
                {/* A candidate's paid plan shows as the premium badge; a recruiter's sits under the company. */}
                {!(me.role === 'candidate' && isPaidPlan(me)) && <p className={styles.userSubtitle}>{identitySubtitle(me, t)}</p>}
                <PlanBadge me={me} small />
              </div>
              <IconButton icon={LogOut} label={t('shell:signOut')} onClick={handleSignOut} />
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
