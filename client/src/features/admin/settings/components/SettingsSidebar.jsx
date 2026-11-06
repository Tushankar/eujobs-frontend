import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, CircleCheck, CircleHelp, CircleMinus, Clock, FileText, ShieldCheck, TriangleAlert, UserPlus, Users } from 'lucide-react'
import { Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { can } from '@/app/permissions.js'
import { cx } from '@/utils/cx.js'
import { identitySubtitle } from '@/components/layout/identity.js'
import { useGetAccountQueueQuery, useGetModerationSummaryQuery, useGetVerificationQueueQuery } from '@/features/admin/moderation/api.js'
import styles from './SettingsSidebar.module.css'

/** A row link: grey icon, label (and caption), optional count, chevron. */
function RowLink({ to, icon, label, caption, count }) {
  return (
    <li>
      <Link to={to} className={styles.row}>
        <Icon as={icon} size={18} className={styles.icon} />
        <span className={styles.text}>
          <span className={styles.label}>{label}</span>
          {caption && <span className={styles.caption}>{caption}</span>}
        </span>
        {count !== undefined && <PillBadge tone={count ? 'warning' : 'neutral'}>{count}</PillBadge>}
        <Icon as={ChevronRight} size={16} className={styles.icon} />
      </Link>
    </li>
  )
}

/** Things to do: the live moderation queues (moderation.manage); hidden without that permission. */
function TodoCard({ me }) {
  const { t } = useTranslation()
  const skip = !can(me, 'moderation.manage')
  const { data: accounts, isLoading: accountsLoading } = useGetAccountQueueQuery('pending_review', { skip })
  const { data: summary, isLoading: summaryLoading } = useGetModerationSummaryQuery(undefined, { skip })
  const { data: checks, isLoading: checksLoading } = useGetVerificationQueueQuery('in_review', { skip })
  if (!skip && (accountsLoading || summaryLoading || checksLoading))
    return (
      <Panel padding={0} className={styles.card}>
        <h2 className={styles.heading}>{t('account:admin.todo')}</h2>
        <SkeletonRegion>
          <ul className={styles.rows}>
            {[120, 96].map((width) => (
              <li key={width} className={styles.row}>
                <Skeleton shape="circle" width={18} height={18} />
                <span className={styles.text}>
                  <span className={styles.label}>
                    <Skeleton width={width} height={12} />
                  </span>
                  <span className={styles.caption}>
                    <Skeleton width={width + 40} />
                  </span>
                </span>
                <Skeleton shape="pill" width={24} height={20} />
              </li>
            ))}
          </ul>
        </SkeletonRegion>
      </Panel>
    )
  if (skip || !accounts || !summary || !checks) return null
  const rows = [
    { key: 'accounts', to: '/admin/moderation/accounts', icon: Users, count: accounts.counts.pending_review ?? 0 },
    { key: 'content', to: '/admin/moderation', icon: TriangleAlert, count: summary.contentOpen },
    { key: 'verification', to: '/admin/moderation/verification', icon: ShieldCheck, count: checks.total },
  ].filter((row) => row.count > 0)
  return (
    <Panel padding={0} className={styles.card} data-card="todo">
      <h2 className={styles.heading}>{t('account:admin.todo')}</h2>
      {rows.length ? (
        <ul className={styles.rows}>
          {rows.map((row) => (
            <RowLink key={row.key} to={row.to} icon={row.icon} label={t(`moderation:${row.key}.stat.label`)} caption={t(`moderation:${row.key}.stat.caption`)} count={row.count} />
          ))}
        </ul>
      ) : (
        <div className={styles.clear}>
          <Icon as={CircleCheck} size={18} className={styles.done} />
          <span className={styles.text}>
            <span className={styles.label}>{t('account:admin.allClear')}</span>
            <span className={styles.caption}>{t('account:admin.allClearText')}</span>
          </span>
        </div>
      )}
    </Panel>
  )
}

function QuickActionsCard({ me }) {
  const { t } = useTranslation()
  const actions = [
    { key: 'invite', to: '/admin/access-management/users/invite', icon: UserPlus, label: t('access:invite'), permission: 'users.add' },
    { key: 'audit', to: '/admin/audit-logs', icon: Clock, label: t('shell:nav.auditLogs'), permission: 'audit.view' },
    { key: 'reports', to: '/admin/reports', icon: FileText, label: t('shell:nav.reports'), permission: 'reports.view' },
    { key: 'help', to: '/admin/help', icon: CircleHelp, label: t('shell:sidebar.help') },
  ].filter((action) => can(me, action.permission))
  return (
    <Panel padding={0} className={styles.card} data-card="actions">
      <h2 className={styles.heading}>{t('account:admin.quickActions')}</h2>
      <ul className={styles.rows}>
        {actions.map((action) => (
          <RowLink key={action.key} to={action.to} icon={action.icon} label={action.label} />
        ))}
      </ul>
    </Panel>
  )
}

/** One permission group: label, held/total with a thin bar; opens to list every permission of the group. */
function GroupRow({ entry, open, onToggle }) {
  const { t } = useTranslation()
  const total = entry.permissions.length
  const held = entry.permissions.filter((permission) => permission.held).length
  const progress = t('account:admin.groupProgress', { held, total })
  return (
    <li>
      <button type="button" className={styles.groupHead} aria-expanded={open} aria-controls={`group-${entry.group}`} onClick={onToggle}>
        <span className={styles.groupLine}>
          <span className={styles.label}>{t(`enums:permissionGroup.${entry.group}`)}</span>
          <span className={styles.groupCount} aria-label={progress}>
            {held}/{total}
          </span>
          <Icon as={ChevronDown} size={16} className={cx(styles.icon, styles.chevron, open && styles.chevronOpen)} />
        </span>
        <span className={styles.bar} aria-hidden="true">
          <span className={cx(styles.fill, held === total && styles.fillFull)} style={{ width: `${(held / total) * 100}%` }} />
        </span>
      </button>
      {open && (
        <ul id={`group-${entry.group}`} className={styles.permissions}>
          {entry.permissions.map(({ id, held: has }) => (
            <li key={id} className={cx(!has && styles.missing)}>
              <Icon as={has ? CircleCheck : CircleMinus} size={14} className={has ? styles.done : styles.icon} />
              {t(`enums:permission.${id}`)}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** Your access: the role, then one row per permission group with what this admin holds in it. */
function AccessCard({ me }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(null)
  const groups = me.permissionGroups ?? []
  return (
    <Panel padding={0} className={styles.card} data-card="access">
      <h2 className={styles.heading}>{t('account:admin.access')}</h2>
      <div className={styles.role}>
        <Icon as={ShieldCheck} size={18} className={styles.icon} />
        <span className={styles.text}>
          <span className={styles.label}>{identitySubtitle(me, t)}</span>
          <span className={styles.caption}>{t('account:admin.permissionCount', { count: me.permissions?.length ?? 0 })}</span>
        </span>
      </div>
      <ul className={styles.rows}>
        {groups.map((entry) => (
          <GroupRow key={entry.group} entry={entry} open={open === entry.group} onToggle={() => setOpen((current) => (current === entry.group ? null : entry.group))} />
        ))}
      </ul>
      {can(me, 'roles.view') && (
        <div className={styles.footer}>
          <Link to="/admin/access-management" className={styles.pill}>
            {t('shell:nav.accessManagement')}
          </Link>
        </div>
      )}
    </Panel>
  )
}

/** Right-hand column of admin Settings: things to do, quick actions and the admin's access. */
export default function SettingsSidebar({ me }) {
  return (
    <div className={`${styles.sidebar} sticky-side`}>
      <TodoCard me={me} />
      <QuickActionsCard me={me} />
      <AccessCard me={me} />
    </div>
  )
}
