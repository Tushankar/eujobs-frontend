import { useState } from 'react'
import { Bell, BellOff, Plus, Trash2 } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Button, Icon, IconButton } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import JobAlertModal from '../components/JobAlertModal.jsx'
import { useJobAlerts } from '../hooks/useJobAlerts.js'
import styles from './JobAlertsPage.module.css'

/** Job alerts: list with pause/resume, edit (click the name), delete and a create dialog, all persisted locally. */
export default function JobAlertsPage() {
  const { alerts, saveAlert, toggleAlert, deleteAlert } = useJobAlerts()
  const [editing, setEditing] = useState(null) // null | 'new' | alert object
  const [deleting, setDeleting] = useState(null)

  const createButton = (
    <Button leftIcon={<Icon as={Plus} size={14} />} onClick={() => setEditing('new')}>
      Create job alert
    </Button>
  )

  return (
    <div>
      <PageTitle title="Let the right work find you." description="Thoughtful updates. On your terms. Never just more noise." actions={createButton} />

      <div className={styles.list}>
        {alerts.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No job alerts yet"
            description="Create an alert and we’ll keep a digest of matching roles ready for you."
            action={createButton}
          />
        ) : (
          <ul className={styles.items}>
            {alerts.map((alert) => (
              <li key={alert.id} className={styles.card}>
                <span className={cx(styles.tile, !alert.active && styles.tilePaused)}>
                  <Icon as={alert.active ? Bell : BellOff} size={18} />
                </span>
                <div className={styles.text}>
                  <h2 className={styles.name}>
                    <button type="button" className={styles.nameButton} onClick={() => setEditing(alert)} aria-label={`Edit alert: ${alert.name}`}>
                      {alert.name}
                    </button>
                  </h2>
                  <p className={styles.meta}>
                    {alert.frequency} digest · {alert.active ? 'Active' : 'Paused'}
                  </p>
                </div>
                <Button variant="secondary" className={styles.toggle} onClick={() => toggleAlert(alert.id)}>
                  {alert.active ? 'Pause alert' : 'Resume alert'}
                </Button>
                <IconButton icon={Trash2} label={`Delete alert: ${alert.name}`} onClick={() => setDeleting(alert)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className={styles.note}>Demo alerts are saved locally. Email delivery requires a connected notification service.</p>

      <JobAlertModal
        open={editing !== null}
        alert={editing && editing !== 'new' ? editing : null}
        onSave={saveAlert}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this alert?"
        description={deleting ? `“${deleting.name}” will stop appearing in your digests.` : undefined}
        confirmLabel="Delete alert"
        tone="danger"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          deleteAlert(deleting.id)
          setDeleting(null)
        }}
      />
    </div>
  )
}
