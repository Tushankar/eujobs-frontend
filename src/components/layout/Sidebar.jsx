import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CircleHelp, LogOut, Settings2 } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Icon, IconButton } from '@/components/ui'
import { workspacePath } from '@/app/workspaces.js'
import logo from '@/assets/images/logo.png'
import aiSparkle from '@/assets/icons/ai-sparkle-blue.svg'
import styles from './Sidebar.module.css'

/** Badge text computed by a hook (e.g. the live count of active applications). */
function LiveBadgeText({ useText }) {
  return useText()
}

function NavItem({ workspace, item }) {
  return (
    <NavLink
      to={workspacePath(workspace, item.to)}
      end={item.end}
      className={({ isActive }) => cx(styles.link, isActive && styles.active)}
    >
      {item.icon ? (
        <Icon as={item.icon} size={17} />
      ) : (
        <img src={item.iconSrc} alt="" className={styles.customIcon} />
      )}
      <span className={styles.linkLabel}>{item.label}</span>
      {item.badge && (
        <span className={cx(styles.badge, item.badge.tone === 'ai' && styles.badgeAi)}>
          {item.badge.useText ? <LiveBadgeText useText={item.badge.useText} /> : item.badge.text}
        </span>
      )}
    </NavLink>
  )
}

export default function Sidebar({ workspace, open, onClose }) {
  const navigate = useNavigate()
  const { promo, user } = workspace

  return (
    <>
      {open && <div className={styles.scrim} onClick={onClose} aria-hidden="true" />}
      <aside
        id="workspace-sidebar"
        className={cx(styles.sidebar, open && styles.open)}
        data-workspace={workspace.id}
        aria-label={`${workspace.label} navigation`}
      >
        <Link to={workspace.basePath} className={styles.brand} aria-label="Local Worksmen — AI Job Portal home">
          <img src={logo} alt="Local Worksmen, AI Job Portal" width={189} height={45} />
        </Link>

        <div className={styles.navArea}>
          <p className={styles.sectionLabel}>Workspace</p>
          <nav className={styles.nav} aria-label="Workspace">
            {workspace.nav.map((item) => (
              <NavItem key={item.label} workspace={workspace} item={item} />
            ))}
          </nav>
        </div>

        <div className={styles.footer}>
          {promo && (
            <div className={styles.promo}>
              <div className={styles.promoTitle}>
                <img src={aiSparkle} alt="" width={14} height={14} />
                <p>{promo.title}</p>
              </div>
              <p className={styles.promoText}>{promo.text}</p>
              <Link to={workspacePath(workspace, promo.to)} className={styles.promoLink}>
                {promo.linkLabel}
                <Icon as={ArrowRight} size={12} />
              </Link>
            </div>
          )}

          <NavLink
            to={workspacePath(workspace, 'settings')}
            className={({ isActive }) => cx(styles.utility, promo && styles.utilityAfterPromo, isActive && styles.utilityActive)}
          >
            <Icon as={Settings2} size={17} />
            Settings
          </NavLink>
          <NavLink
            to={workspacePath(workspace, 'help')}
            className={({ isActive }) => cx(styles.utility, isActive && styles.utilityActive)}
          >
            <Icon as={CircleHelp} size={17} />
            <span className={styles.utilityLabel}>Help &amp; resources</span>
            <Icon as={ArrowUpRight} size={13} />
          </NavLink>

          <div className={styles.user}>
            <img src={user.avatar} alt="" width={32} height={32} className={styles.avatar} />
            <div className={styles.userText}>
              <p className={styles.userName}>{user.name}</p>
              <p className={styles.userSubtitle}>{user.subtitle}</p>
            </div>
            <IconButton icon={LogOut} label="Sign out" onClick={() => navigate(workspace.signInPath)} />
          </div>
        </div>
      </aside>
    </>
  )
}
