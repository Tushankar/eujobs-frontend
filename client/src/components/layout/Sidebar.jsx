import { useTranslation } from 'react-i18next'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CircleHelp, LogOut, Settings2 } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Avatar, Icon, IconButton } from '@/components/ui'
import { workspacePath } from '@/app/workspaces.js'
import { signOut } from '@/app/session.js'
import { usePreferences } from '@/lib/preferences.js'
import aiSparkle from '@/assets/icons/ai-sparkle-blue.svg'
import aiNavIcon from '@/assets/icons/ai-nav.svg'
import aiNavIconActive from '@/assets/icons/ai-sparkle-blue-16.svg'
import BrandLogo from './BrandLogo.jsx'
import { identitySubtitle } from './identity.js'
import styles from './Sidebar.module.css'

/** Badge text computed by a hook (e.g. the live count of active applications). */
function LiveBadgeText({ useText }) {
  return useText()
}

function NavItem({ workspace, item }) {
  const { t } = useTranslation()
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
          {item.badge && (
            <span className={cx(styles.badge, item.badge.tone === 'ai' && styles.badgeAi)}>
              {item.badge.useText ? <LiveBadgeText useText={item.badge.useText} /> : t(`shell:${item.badge.textKey}`)}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({ workspace, open, onClose }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { me } = usePreferences()
  const { promo } = workspace

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
          <nav className={cx(styles.nav, 'stagger')} aria-label={t('shell:sidebar.section')}>
            {workspace.nav.map((item) => (
              <NavItem key={item.to} workspace={workspace} item={item} />
            ))}
          </nav>
        </div>

        <div className={styles.footer}>
          {promo && (
            <div className={styles.promo}>
              <div className={styles.promoTitle}>
                <img src={aiSparkle} alt="" width={14} height={14} />
                <p>{t('shell:promo.title')}</p>
              </div>
              <p className={styles.promoText}>{t('shell:promo.text')}</p>
              <Link to={workspacePath(workspace, promo.to)} className={styles.promoLink}>
                {t('shell:promo.link')}
                <Icon as={ArrowRight} size={12} />
              </Link>
            </div>
          )}

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
              <Avatar name={me.fullName} src={me.photoUrl ?? undefined} size={32} className={styles.avatar} />
              <div className={styles.userText}>
                <p className={styles.userName}>{me.fullName}</p>
                <p className={styles.userSubtitle}>{identitySubtitle(me, t)}</p>
              </div>
              <IconButton icon={LogOut} label={t('shell:signOut')} onClick={handleSignOut} />
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
