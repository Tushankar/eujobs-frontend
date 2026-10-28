import { Check, FileText, GitCompare } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { cx } from '@/utils/cx.js'
import { formatVersionDate } from '../utils/cvVersions.js'
import styles from './VersionRow.module.css'

function StatusBadge({ version, live }) {
  if (live) {
    return (
      <PillBadge tone="success" dot>
        Current live CV
      </PillBadge>
    )
  }
  if (!version.approved) return <PillBadge tone="warning">Awaiting your approval</PillBadge>
  return <PillBadge>Approved snapshot</PillBadge>
}

/** One entry of the CV version history with its Compare toggle and approve / set-live action. */
export default function VersionRow({ version, live, comparing, onToggleCompare, onApprove }) {
  const label = `Version ${version.version} · ${version.fileName}`
  return (
    <article className={cx(styles.row, comparing && styles.comparing)}>
      <span className={styles.tile}>
        <Icon as={FileText} size={18} />
      </span>
      <div className={styles.body}>
        <div className={styles.titleLine}>
          <h3 className={styles.title}>{label}</h3>
          {version.tag && <PillBadge>{version.tag}</PillBadge>}
        </div>
        <div className={styles.status}>
          <StatusBadge version={version} live={live} />
        </div>
        <p className={styles.meta}>
          {formatVersionDate(version.createdAt)} · {version.source}
        </p>
        <p className={styles.note}>{version.note}</p>
      </div>
      <div className={styles.actions}>
        <Button
          variant="outline"
          className={cx(comparing && styles.comparePressed)}
          aria-pressed={comparing}
          aria-label={`Compare Version ${version.version}`}
          leftIcon={<Icon as={GitCompare} size={13} />}
          onClick={onToggleCompare}
        >
          Compare
        </Button>
        {!live && (
          <Button leftIcon={<Icon as={Check} size={13} />} aria-label={`${version.approved ? 'Set' : 'Approve'} Version ${version.version} as live`} onClick={onApprove}>
            {version.approved ? 'Set as live' : 'Approve as live'}
          </Button>
        )}
      </div>
    </article>
  )
}
