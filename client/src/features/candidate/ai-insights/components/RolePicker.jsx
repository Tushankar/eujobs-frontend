import { useTranslation } from 'react-i18next'
import { CompanyLogo, Panel, SelectField } from '@/components/ui'
import { useJobText } from '@/lib/jobText.js'
import styles from './RolePicker.module.css'

/** M-063: the chosen role on the left, "Compare with a role" (top 10 + saved + applied) on the right. */
export default function RolePicker({ roles, jobId, onChange }) {
  const { t } = useTranslation('aiInsights')
  const jobText = useJobText()
  const job = roles.find((role) => role.id === jobId)
  if (!roles.length) {
    return (
      <Panel className={styles.picker} padding={20}>
        <p className={styles.meta}>{t('picker.none')}</p>
      </Panel>
    )
  }
  return (
    <Panel className={styles.picker} padding={20}>
      {job && (
        <div className={styles.summary}>
          <CompanyLogo name={job.company.displayName} id={job.company.id} src={job.company.logoUrl ?? undefined} size={44} />
          <div>
            <p className={styles.title}>{job.title}</p>
            <p className={styles.meta}>
              {[t('picker.meta', { company: job.company.displayName, mode: t(`enums:workPreference.${job.workPreference}`) }), job.salary && jobText.salary(job)].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}
      <SelectField
        className={styles.field}
        name="role"
        label={t('picker.label')}
        value={jobId ?? ''}
        options={roles.map((role) => ({ value: role.id, label: `${role.title} · ${role.company.displayName}` }))}
        onChange={(event) => onChange(event.target.value)}
      />
    </Panel>
  )
}
