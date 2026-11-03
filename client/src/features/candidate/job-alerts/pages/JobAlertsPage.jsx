import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Bell, BellOff, Plus, Sparkles, Trash2 } from 'lucide-react'
import { openUpgrade } from '@/app/upgrade.js'
import { cx } from '@/utils/cx.js'
import { Button, Icon, IconButton, Panel } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { PlanGate } from '@/features/candidate/billing/components/RequirePlan.jsx'
import { useFormat } from '@/lib/preferences.js'
import { useDeleteJobAlertMutation, useGetJobAlertsQuery, useUpdateJobAlertMutation } from '../api.js'
import JobAlertModal from '../components/JobAlertModal.jsx'
import styles from './JobAlertsPage.module.css'

/**
 * Job alerts (§3.6): the list with pause/resume, edit (click the name), delete and the create dialog. Without the
 * plan the alerts are kept but paused (M-119): read and delete only, with the upgrade notice; a Free candidate
 * without alerts sees the gate (M-118, P7-Q2).
 */
export default function JobAlertsPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const dispatch = useDispatch()
  const { data } = useGetJobAlertsQuery()
  const [updateAlert] = useUpdateJobAlertMutation()
  const [deleteAlert] = useDeleteJobAlertMutation()
  const [editing, setEditing] = useState(null) // null | 'new' | alert
  const [deleting, setDeleting] = useState(null)

  if (!data) return null
  const alerts = data.items
  const paused = data.planPaused
  if (paused && alerts.length === 0) return <PlanGate entitlement="job_alerts" />

  const createButton = !paused && (
    <Button leftIcon={<Icon as={Plus} size={14} />} data-create-alert onClick={() => setEditing('new')}>
      {t('jobAlerts:create')}
    </Button>
  )

  return (
    <div>
      <PageTitle title={t('jobAlerts:title')} description={t('jobAlerts:description')} actions={createButton} />

      {paused && (
        <Panel padding={20} className={styles.paused} data-alerts-paused>
          <div>
            <h2 className={styles.pausedTitle}>{t('jobAlerts:planPaused.title')}</h2>
            <p className={styles.pausedText}>{t('jobAlerts:planPaused.text')}</p>
          </div>
          <Button leftIcon={<Icon as={Sparkles} size={14} />} onClick={() => dispatch(openUpgrade('job_alerts'))}>
            {t('jobAlerts:planPaused.upgrade')}
          </Button>
        </Panel>
      )}

      <div className={styles.list}>
        {alerts.length === 0 ? (
          <EmptyState icon={Bell} title={t('jobAlerts:empty')} description={t('jobAlerts:emptyText')} action={createButton} />
        ) : (
          <ul className={styles.items}>
            {alerts.map((alert) => {
              const active = alert.active && !paused
              const where = alert.location ? t('common:city.value', { city: alert.location.city, country: format.country(alert.location.countryCode) }) : format.country(alert.country)
              return (
                <li key={alert.id} className={styles.card} data-alert={alert.id} data-alert-name={alert.name}>
                  <span className={cx(styles.tile, !active && styles.tilePaused)}>
                    <Icon as={active ? Bell : BellOff} size={18} />
                  </span>
                  <div className={styles.text}>
                    <h2 className={styles.name}>
                      {paused ? (
                        alert.name
                      ) : (
                        <button type="button" className={styles.nameButton} onClick={() => setEditing(alert)} aria-label={t('jobAlerts:edit', { name: alert.name })}>
                          {alert.name}
                        </button>
                      )}
                    </h2>
                    <p className={styles.meta}>{[t(`jobAlerts:frequency.${alert.frequency}`), where, t(active ? 'jobAlerts:active' : 'jobAlerts:paused')].join(' · ')}</p>
                  </div>
                  {!paused && (
                    <Button variant="secondary" className={styles.toggle} onClick={() => updateAlert({ id: alert.id, active: !alert.active })}>
                      {t(alert.active ? 'jobAlerts:pause' : 'jobAlerts:resume')}
                    </Button>
                  )}
                  <IconButton icon={Trash2} label={t('jobAlerts:delete', { name: alert.name })} onClick={() => setDeleting(alert)} />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <JobAlertModal open={editing !== null} alert={editing && editing !== 'new' ? editing : null} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title={t('jobAlerts:deleteDialog.title')}
        description={deleting ? t('jobAlerts:deleteDialog.description', { name: deleting.name }) : undefined}
        confirmLabel={t('jobAlerts:deleteDialog.confirm')}
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
