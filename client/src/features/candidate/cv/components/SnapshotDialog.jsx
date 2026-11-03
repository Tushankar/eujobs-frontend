import { useTranslation } from 'react-i18next'
import { Button, Modal } from '@/components/ui'
import { useGetConfigQuery } from '@/app/api.js'
import { useGetProfileQuery } from '@/features/candidate/profile/api.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './SnapshotDialog.module.css'

/**
 * P9-Q3: before the AI snapshot changes the profile, the candidate sees exactly what changes: the headline, the years,
 * and the skills that will be added (up to the 12-skill limit; existing skills stay).
 */
export default function SnapshotDialog({ version, busy, error, onConfirm, onClose }) {
  const { t } = useTranslation('cv')
  const format = useFormat()
  const { data: profile } = useGetProfileQuery()
  const { data: config } = useGetConfigQuery()
  const proposal = version?.pendingSnapshot
  if (!proposal || !profile || !config) return null
  const listed = new Set(profile.skills.map((skill) => skill.toLocaleLowerCase()))
  const room = Math.max(0, config.limits.profile.skills.max - profile.skills.length)
  const missing = proposal.skills.filter((skill) => !listed.has(skill.toLocaleLowerCase()))
  const added = missing.slice(0, room)
  const rows = [
    [t('snapshot.headline'), profile.headline || '—', proposal.role],
    [t('snapshot.years'), profile.yearsExperience ?? '—', proposal.years],
  ]
  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      title={t('snapshot.confirmTitle', { number: version.number })}
      description={t('snapshot.confirmLead')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('snapshot.cancel')}
          </Button>
          <Button loading={busy} onClick={onConfirm} data-confirm-snapshot>
            {t('snapshot.confirm')}
          </Button>
        </>
      }
    >
      <div className={styles.body} data-snapshot-changes>
        <dl className={styles.changes}>
          {rows.map(([label, from, to]) => (
            <div key={label} className={styles.change}>
              <dt>{label}</dt>
              <dd>{t('snapshot.fromTo', { from, to })}</dd>
            </div>
          ))}
          <div className={styles.change}>
            <dt>{t('snapshot.skills')}</dt>
            <dd>{added.length ? t('snapshot.addSkills', { skills: format.list(added) }) : t('snapshot.noSkills')}</dd>
          </div>
        </dl>
        {missing.length > added.length && <p className={styles.note}>{t('snapshot.limit', { skills: format.list(missing.slice(room)), max: config.limits.profile.skills.max })}</p>}
        <p className={styles.note}>{t('snapshot.kept')}</p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
